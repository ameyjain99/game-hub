/**
 * Blockyard's renderer (three.js). The world is cut into 16×16 columns; each
 * becomes two meshes – solid blocks (leaves cut out) and see-through ones
 * (water, glass) – with only the faces that touch open space, shaded per side
 * and darkened in corners (ambient occlusion). A change rebuilds just the
 * columns it touches.
 */
import * as THREE from 'three';
import { BLOCKS, B, D, H, W, index } from '../world';
import { paintAtlas, tileUV } from './textures';

const CHUNK = 16;
const CX = Math.ceil(W / CHUNK);
const CZ = Math.ceil(D / CHUNK);
const SKY = new THREE.Color('#9fd0ff');

/** Each face: normal, the two edge vectors (u × v = normal) and its corner. */
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], o: [1, 0, 1], shade: 0.8, side: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: [0, 0, 0], shade: 0.8, side: 1 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], o: [0, 1, 1], shade: 1, side: 0 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: [0, 0, 0], shade: 0.55, side: 2 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, 1], shade: 0.68, side: 1 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], o: [1, 0, 0], shade: 0.68, side: 1 },
] as const;
const AO = [1, 0.8, 0.66, 0.52];

interface Chunk {
  solid: THREE.Mesh | null;
  clear: THREE.Mesh | null;
}

export interface AvatarPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export class BlockyardScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 220);
  private atlas: THREE.CanvasTexture;
  private solidMat: THREE.MeshBasicMaterial;
  private clearMat: THREE.MeshBasicMaterial;
  private chunks = new Map<number, Chunk>();
  private dirty = new Set<number>();
  private highlight: THREE.LineSegments;
  private avatars = new Map<string, { group: THREE.Group; head: THREE.Mesh; target: AvatarPose; shown: AvatarPose }>();

  constructor(
    canvas: HTMLCanvasElement,
    private blocks: Uint8Array,
    readonly atlasCanvas: HTMLCanvasElement = paintAtlas(),
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = SKY;
    this.scene.fog = new THREE.Fog(SKY, 46, 120);
    this.camera.rotation.order = 'YXZ';

    this.atlas = new THREE.CanvasTexture(atlasCanvas);
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestFilter;
    this.atlas.generateMipmaps = false;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.solidMat = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.5 });
    this.clearMat = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) this.dirty.add(cz * CX + cx);
  }

  /** Replace the world wholesale (a new world). */
  setWorld(blocks: Uint8Array): void {
    this.blocks = blocks;
    for (let k = 0; k < CX * CZ; k++) this.dirty.add(k);
  }

  /** A block changed: rebuild its column, and a neighbour's if it sits on the edge. */
  blockChanged(x: number, z: number): void {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    this.dirty.add(cz * CX + cx);
    if (x % CHUNK === 0 && cx > 0) this.dirty.add(cz * CX + cx - 1);
    if (x % CHUNK === CHUNK - 1 && cx < CX - 1) this.dirty.add(cz * CX + cx + 1);
    if (z % CHUNK === 0 && cz > 0) this.dirty.add((cz - 1) * CX + cx);
    if (z % CHUNK === CHUNK - 1 && cz < CZ - 1) this.dirty.add((cz + 1) * CX + cx);
  }

  /** Rebuild up to `max` changed columns (nearest the camera first). */
  rebuild(max = Infinity): void {
    if (this.dirty.size === 0) return;
    const cam = this.camera.position;
    const order = [...this.dirty].sort((a, b) => {
      const da = Math.hypot(((a % CX) + 0.5) * CHUNK - cam.x, (Math.floor(a / CX) + 0.5) * CHUNK - cam.z);
      const db = Math.hypot(((b % CX) + 0.5) * CHUNK - cam.x, (Math.floor(b / CX) + 0.5) * CHUNK - cam.z);
      return da - db;
    });
    for (const k of order.slice(0, max)) {
      this.dirty.delete(k);
      this.buildChunk(k % CX, Math.floor(k / CX));
    }
  }

  private get(x: number, y: number, z: number): number {
    if (y < 0) return B.bedrock;
    if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return 0;
    return this.blocks[index(x, y, z)];
  }

  private occludes(x: number, y: number, z: number): boolean {
    const b = this.get(x, y, z);
    return b !== 0 && BLOCKS[b].render === 'opaque';
  }

  private buildChunk(cx: number, cz: number): void {
    const key = cz * CX + cx;
    const old = this.chunks.get(key);
    for (const m of [old?.solid, old?.clear]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
    }
    const solid = { pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] };
    const clear = { pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] };

    for (let y = 0; y < H; y++) {
      for (let z = cz * CHUNK; z < Math.min(D, (cz + 1) * CHUNK); z++) {
        for (let x = cx * CHUNK; x < Math.min(W, (cx + 1) * CHUNK); x++) {
          const b = this.blocks[index(x, y, z)];
          if (b === 0) continue;
          const def = BLOCKS[b];
          const out = def.render === 'blend' ? clear : solid;
          const water = b === B.water;
          const lowered = water && this.get(x, y + 1, z) !== B.water;
          for (const f of FACES) {
            const nb = this.get(x + f.n[0], y + f.n[1], z + f.n[2]);
            const nbDef = BLOCKS[nb];
            let visible: boolean;
            if (def.render === 'opaque') visible = nb === 0 || nbDef.render !== 'opaque';
            else visible = nb !== b && (nb === 0 || nbDef.render !== 'opaque');
            if (!visible) continue;
            const tile = def.tiles[f.side];
            const [u0, v0, u1, v1] = tileUV(tile);
            const base = out.pos.length / 3;
            const ao: number[] = [];
            for (let c = 0; c < 4; c++) {
              const a = c === 1 || c === 2 ? 1 : 0;
              const bb = c === 2 || c === 3 ? 1 : 0;
              const px = x + f.o[0] + a * f.u[0] + bb * f.v[0];
              let py = y + f.o[1] + a * f.u[1] + bb * f.v[1];
              const pz = z + f.o[2] + a * f.u[2] + bb * f.v[2];
              if (lowered && py === y + 1) py -= 0.125;
              out.pos.push(px, py, pz);
              out.uv.push(a ? u1 : u0, bb ? v1 : v0);
              // Corner darkening from the blocks around this corner of the face.
              let level = 0;
              if (def.render !== 'blend') {
                const s1 = [(a ? f.u[0] : -f.u[0]), (a ? f.u[1] : -f.u[1]), (a ? f.u[2] : -f.u[2])];
                const s2 = [(bb ? f.v[0] : -f.v[0]), (bb ? f.v[1] : -f.v[1]), (bb ? f.v[2] : -f.v[2])];
                const lx = x + f.n[0];
                const ly = y + f.n[1];
                const lz = z + f.n[2];
                const side1 = this.occludes(lx + s1[0], ly + s1[1], lz + s1[2]);
                const side2 = this.occludes(lx + s2[0], ly + s2[1], lz + s2[2]);
                const corner = this.occludes(lx + s1[0] + s2[0], ly + s1[1] + s2[1], lz + s1[2] + s2[2]);
                level = side1 && side2 ? 3 : Number(side1) + Number(side2) + Number(corner);
              }
              ao.push(level);
              // Lamps glow: they ignore side shading and corner darkening.
              const k = b === B.lamp ? 1.15 : f.shade * AO[level];
              out.col.push(k, k, k);
            }
            // Split the quad along the diagonal that keeps the shading smooth.
            if (ao[0] + ao[2] > ao[1] + ao[3]) out.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            else out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    const mesh = (data: typeof solid, mat: THREE.Material) => {
      if (data.idx.length === 0) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      g.setIndex(data.idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      this.scene.add(m);
      return m;
    };
    const chunk: Chunk = { solid: mesh(solid, this.solidMat), clear: mesh(clear, this.clearMat) };
    if (chunk.clear) chunk.clear.renderOrder = 1;
    this.chunks.set(key, chunk);
  }

  /** Outline the targeted block (or hide the outline). */
  target(hit: { x: number; y: number; z: number } | null): void {
    this.highlight.visible = !!hit;
    if (hit) this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  }

  /** Show, move or remove other builders (their poses arrive ~10 times a second). */
  setAvatar(id: string, pose: AvatarPose | null, color: string, name: string): void {
    const known = this.avatars.get(id);
    if (!pose) {
      if (known) {
        this.scene.remove(known.group);
        this.avatars.delete(id);
      }
      return;
    }
    if (known) {
      known.target = pose;
      return;
    }
    const group = new THREE.Group();
    const tint = new THREE.Color(color);
    const shade = (k: number) => new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(k) });
    const box = (w: number, h: number, d: number, k: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shade(k));
      m.position.y = y;
      group.add(m);
      return m;
    };
    box(0.5, 0.75, 0.28, 0.95, 1.08); // body
    box(0.22, 0.72, 0.24, 0.7, 0.36).position.x = -0.13; // legs
    box(0.22, 0.72, 0.24, 0.7, 0.36).position.x = 0.13;
    box(0.16, 0.7, 0.2, 0.85, 1.1).position.x = -0.33; // arms
    box(0.16, 0.7, 0.2, 0.85, 1.1).position.x = 0.33;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), new THREE.MeshBasicMaterial({ color: 0xf1d2b0 }));
    head.position.y = 1.7;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    visor.position.set(0, 0.04, -0.235);
    head.add(visor);
    group.add(head);
    // A name tag that always faces the camera.
    const tag = document.createElement('canvas');
    tag.width = 256;
    tag.height = 64;
    const ctx = tag.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 16), 128, 33);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(tag), depthTest: false }));
    sprite.scale.set(1.2, 0.3, 1);
    sprite.position.y = 2.25;
    group.add(sprite);
    group.position.set(pose.x, pose.y, pose.z);
    this.scene.add(group);
    this.avatars.set(id, { group, head, target: pose, shown: { ...pose } });
  }

  /** Glide avatars towards their latest pose. */
  private animateAvatars(dt: number): void {
    const k = Math.min(1, dt * 12);
    for (const a of this.avatars.values()) {
      const s = a.shown;
      const t = a.target;
      s.x += (t.x - s.x) * k;
      s.y += (t.y - s.y) * k;
      s.z += (t.z - s.z) * k;
      let dy = t.yaw - s.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      s.yaw += dy * k;
      s.pitch += (t.pitch - s.pitch) * k;
      a.group.position.set(s.x, s.y, s.z);
      a.group.rotation.y = s.yaw;
      a.head.rotation.x = s.pitch;
    }
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  render(dt: number): void {
    this.animateAvatars(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const c of this.chunks.values()) for (const m of [c.solid, c.clear]) m?.geometry.dispose();
    for (const a of this.avatars.values()) this.scene.remove(a.group);
    this.atlas.dispose();
    this.solidMat.dispose();
    this.clearMat.dispose();
    this.renderer.dispose();
  }
}
