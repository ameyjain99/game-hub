/**
 * The builder's body: walking with gravity, jumping, swimming and flying,
 * colliding with blocks as an upright 0.6×1.8 box; and the ray from the eye
 * that picks the block being looked at.
 */
import { BLOCKS, B, H, W, D, index, isSolid } from '../world';

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  flying: boolean;
}

export interface Input {
  forward: number; // -1..1
  strafe: number; // -1..1
  jump: boolean;
  down: boolean;
  sprint: boolean;
  yaw: number;
}

export const EYE = 1.62;
const HALF = 0.3;
const HEIGHT = 1.8;
const GRAVITY = 28;
const JUMP = 8.6;
const WALK = 4.4;
const RUN = 6.8;
const FLY = 10;
const EPS = 1e-4;

export const blockAt = (blocks: Uint8Array, x: number, y: number, z: number) =>
  x < 0 || z < 0 || x >= W || z >= D ? B.bedrock : y < 0 ? B.bedrock : y >= H ? 0 : blocks[index(x, y, z)];

const solidAt = (blocks: Uint8Array, x: number, y: number, z: number) => isSolid(blockAt(blocks, x, y, z));

/** Whether a body standing at (x, y, z) overlaps a solid block. */
export function collides(blocks: Uint8Array, x: number, y: number, z: number): boolean {
  for (let bx = Math.floor(x - HALF); bx <= Math.floor(x + HALF - EPS); bx++)
    for (let by = Math.floor(y); by <= Math.floor(y + HEIGHT - EPS); by++)
      for (let bz = Math.floor(z - HALF); bz <= Math.floor(z + HALF - EPS); bz++) if (solidAt(blocks, bx, by, bz)) return true;
  return false;
}

/** Whether a block cell overlaps the body (no placing a block inside yourself). */
export function overlapsBody(b: Body, x: number, y: number, z: number): boolean {
  return x + 1 > b.x - HALF && x < b.x + HALF && y + 1 > b.y && y < b.y + HEIGHT && z + 1 > b.z - HALF && z < b.z + HALF;
}

export const inWater = (blocks: Uint8Array, b: Body) => blockAt(blocks, Math.floor(b.x), Math.floor(b.y + 0.4), Math.floor(b.z)) === B.water;

/** Advance the body by `dt` seconds. */
export function step(blocks: Uint8Array, b: Body, input: Input, dt: number): void {
  const swimming = inWater(blocks, b);
  const speed = b.flying ? FLY : input.sprint ? RUN : WALK;
  const sin = Math.sin(input.yaw);
  const cos = Math.cos(input.yaw);
  // Forward is -z when yaw is 0.
  let mx = -sin * input.forward + cos * input.strafe;
  let mz = -cos * input.forward - sin * input.strafe;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const target = swimming && !b.flying ? speed * 0.55 : speed;
  // Ease towards the wanted speed: snappy on the ground, floaty in the air.
  const grip = b.onGround || b.flying ? 14 : 4;
  b.vx += (mx * target - b.vx) * Math.min(1, grip * dt);
  b.vz += (mz * target - b.vz) * Math.min(1, grip * dt);

  if (b.flying) {
    const up = (input.jump ? 1 : 0) - (input.down ? 1 : 0);
    b.vy += (up * FLY - b.vy) * Math.min(1, 12 * dt);
  } else if (swimming) {
    b.vy -= GRAVITY * 0.25 * dt;
    if (input.jump) b.vy = Math.min(b.vy + 30 * dt, 3.2);
    b.vy = Math.max(b.vy, -3);
  } else {
    b.vy -= GRAVITY * dt;
    if (input.jump && b.onGround) b.vy = JUMP;
    b.vy = Math.max(b.vy, -40);
  }

  // Move one axis at a time, stopping flush against whatever it meets.
  b.onGround = false;
  const steps = Math.ceil((Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz)) * dt) / 0.25) || 1;
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    const nx = b.x + b.vx * h;
    if (collides(blocks, nx, b.y, b.z)) {
      b.x = b.vx > 0 ? Math.floor(nx + HALF) - HALF - EPS : Math.floor(nx - HALF) + 1 + HALF + EPS;
      b.vx = 0;
    } else b.x = nx;
    const nz = b.z + b.vz * h;
    if (collides(blocks, b.x, b.y, nz)) {
      b.z = b.vz > 0 ? Math.floor(nz + HALF) - HALF - EPS : Math.floor(nz - HALF) + 1 + HALF + EPS;
      b.vz = 0;
    } else b.z = nz;
    const ny = b.y + b.vy * h;
    if (collides(blocks, b.x, ny, b.z)) {
      if (b.vy < 0) {
        b.y = Math.floor(ny) + 1;
        b.onGround = true;
        if (b.flying) b.flying = false; // landing ends a flight
      } else b.y = Math.floor(ny + HEIGHT) - HEIGHT - EPS;
      b.vy = 0;
    } else b.y = ny;
  }
  // Never fall out of the world.
  if (b.y < -10) {
    b.y = H;
    b.vy = 0;
  }
}

export interface Hit {
  x: number;
  y: number;
  z: number;
  /** The face that was hit: where a new block would go. */
  nx: number;
  ny: number;
  nz: number;
  block: number;
}

/** The first block (not air or water) within `reach` along the look direction. */
export function pick(blocks: Uint8Array, ox: number, oy: number, oz: number, yaw: number, pitch: number, reach = 6): Hit | null {
  const dx = -Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * Math.cos(pitch);
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity;
  const tdy = dy ? Math.abs(1 / dy) : Infinity;
  const tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tx = dx ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
  let ty = dy ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
  let tz = dz ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let t = 0; t <= reach; ) {
    const b = x >= 0 && z >= 0 && x < W && z < D && y >= 0 && y < H ? blocks[index(x, y, z)] : 0;
    if (b !== 0 && b !== B.water) return { x, y, z, nx, ny, nz, block: b };
    if (tx < ty && tx < tz) {
      x += sx;
      t = tx;
      tx += tdx;
      nx = -sx;
      ny = 0;
      nz = 0;
    } else if (ty < tz) {
      y += sy;
      t = ty;
      ty += tdy;
      nx = 0;
      ny = -sy;
      nz = 0;
    } else {
      z += sz;
      t = tz;
      tz += tdz;
      nx = 0;
      ny = 0;
      nz = -sz;
    }
  }
  return null;
}

export const blockName = (b: number) => BLOCKS[b]?.name ?? '';
