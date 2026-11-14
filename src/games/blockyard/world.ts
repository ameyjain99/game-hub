/**
 * Blockyard's world: a 96×40×96 grid of blocks generated from a seed – rolling
 * hills of grass over dirt and stone, sandy shores, water in the hollows, snow
 * on the peaks and trees scattered over the grass – plus the edits players make.
 *
 * Generation is deterministic, so a room only ever stores the seed and the
 * edits; every client builds the same world from them.
 */

export const W = 96;
export const H = 40;
export const D = 96;
export const WATER_LEVEL = 13;

/** Index of a block in the flat world array. */
export const index = (x: number, y: number, z: number) => (y * D + z) * W + x;
export const inBounds = (x: number, y: number, z: number) => x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D;
export const coordsOf = (i: number): [number, number, number] => [i % W, Math.floor(i / (W * D)), Math.floor(i / W) % D];

export const AIR = 0;

/** Texture tiles in the atlas (see ui/textures.ts). */
export const TILE = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  water: 5,
  logSide: 6,
  logTop: 7,
  leaves: 8,
  planks: 9,
  glass: 10,
  brick: 11,
  cobble: 12,
  snow: 13,
  bedrock: 14,
  clayRed: 15,
  clayOrange: 16,
  clayYellow: 17,
  clayGreen: 18,
  clayBlue: 19,
  clayPurple: 20,
  clayWhite: 21,
  clayBlack: 22,
  lamp: 23,
} as const;

export type Render = 'opaque' | 'cutout' | 'blend';

export interface BlockDef {
  name: string;
  /** Texture tiles: top, sides, bottom. */
  tiles: [number, number, number];
  /** Blocks movement. */
  solid: boolean;
  /** How it's drawn: opaque, cut-out (leaves) or see-through (water, glass). */
  render: Render;
  /** Shows in the palette (things players can place). */
  placeable: boolean;
}

const t = (n: number): [number, number, number] => [n, n, n];

export const BLOCKS: BlockDef[] = [
  { name: 'Air', tiles: t(0), solid: false, render: 'blend', placeable: false },
  { name: 'Grass', tiles: [TILE.grassTop, TILE.grassSide, TILE.dirt], solid: true, render: 'opaque', placeable: true },
  { name: 'Dirt', tiles: t(TILE.dirt), solid: true, render: 'opaque', placeable: true },
  { name: 'Stone', tiles: t(TILE.stone), solid: true, render: 'opaque', placeable: true },
  { name: 'Sand', tiles: t(TILE.sand), solid: true, render: 'opaque', placeable: true },
  { name: 'Water', tiles: t(TILE.water), solid: false, render: 'blend', placeable: true },
  { name: 'Log', tiles: [TILE.logTop, TILE.logSide, TILE.logTop], solid: true, render: 'opaque', placeable: true },
  { name: 'Leaves', tiles: t(TILE.leaves), solid: true, render: 'cutout', placeable: true },
  { name: 'Planks', tiles: t(TILE.planks), solid: true, render: 'opaque', placeable: true },
  { name: 'Glass', tiles: t(TILE.glass), solid: true, render: 'blend', placeable: true },
  { name: 'Brick', tiles: t(TILE.brick), solid: true, render: 'opaque', placeable: true },
  { name: 'Cobblestone', tiles: t(TILE.cobble), solid: true, render: 'opaque', placeable: true },
  { name: 'Snow', tiles: t(TILE.snow), solid: true, render: 'opaque', placeable: true },
  { name: 'Bedrock', tiles: t(TILE.bedrock), solid: true, render: 'opaque', placeable: false },
  { name: 'Red clay', tiles: t(TILE.clayRed), solid: true, render: 'opaque', placeable: true },
  { name: 'Orange clay', tiles: t(TILE.clayOrange), solid: true, render: 'opaque', placeable: true },
  { name: 'Yellow clay', tiles: t(TILE.clayYellow), solid: true, render: 'opaque', placeable: true },
  { name: 'Green clay', tiles: t(TILE.clayGreen), solid: true, render: 'opaque', placeable: true },
  { name: 'Blue clay', tiles: t(TILE.clayBlue), solid: true, render: 'opaque', placeable: true },
  { name: 'Purple clay', tiles: t(TILE.clayPurple), solid: true, render: 'opaque', placeable: true },
  { name: 'White clay', tiles: t(TILE.clayWhite), solid: true, render: 'opaque', placeable: true },
  { name: 'Black clay', tiles: t(TILE.clayBlack), solid: true, render: 'opaque', placeable: true },
  { name: 'Lamp', tiles: t(TILE.lamp), solid: true, render: 'opaque', placeable: true },
];

export const B = {
  grass: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  water: 5,
  log: 6,
  leaves: 7,
  planks: 8,
  glass: 9,
  brick: 10,
  cobble: 11,
  snow: 12,
  bedrock: 13,
  lamp: 22,
} as const;

/** Blocks the palette offers, in order. */
export const PALETTE = BLOCKS.flatMap((b, id) => (b.placeable ? [id] : []));
/** The hotbar a new player starts with. */
export const DEFAULT_HOTBAR = [B.grass, B.dirt, B.stone, B.planks, B.log, B.glass, B.brick, B.cobble, 14];

export const isSolid = (b: number) => BLOCKS[b]?.solid ?? false;

// ---------------------------------------------------------------------------
// Noise.

function hash(seed: number, x: number, z: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Smooth value noise in 0..1 on a grid of `cell` blocks. */
function valueNoise(seed: number, x: number, z: number, cell: number): number {
  const gx = x / cell;
  const gz = z / cell;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const u = smooth(gx - x0);
  const v = smooth(gz - z0);
  const a = hash(seed, x0, z0);
  const b = hash(seed, x0 + 1, z0);
  const c = hash(seed, x0, z0 + 1);
  const d = hash(seed, x0 + 1, z0 + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Height of the ground at a column. */
export function heightAt(seed: number, x: number, z: number): number {
  const n = valueNoise(seed, x, z, 32) * 0.6 + valueNoise(seed + 7, x, z, 14) * 0.3 + valueNoise(seed + 13, x, z, 6) * 0.1;
  // Gentle plains with the occasional hill, and a lift towards the middle so
  // the spawn is on land.
  const cx = (x - W / 2) / (W / 2);
  const cz = (z - D / 2) / (D / 2);
  const centre = Math.max(0, 1 - Math.sqrt(cx * cx + cz * cz)) * 3;
  return Math.max(3, Math.min(H - 8, Math.round(6 + n * 18 + centre)));
}

/** The world as the seed makes it (before any edits). */
export function generate(seed: number): Uint8Array {
  const blocks = new Uint8Array(W * H * D);
  const heights = new Int16Array(W * D);
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const h = heightAt(seed, x, z);
      heights[z * W + x] = h;
      const beach = h <= WATER_LEVEL + 1;
      for (let y = 0; y <= h; y++) {
        let b: number = B.stone;
        if (y === 0) b = B.bedrock;
        else if (y === h) b = beach ? B.sand : h >= 25 ? B.snow : B.grass;
        else if (y >= h - 3) b = beach ? B.sand : B.dirt;
        blocks[index(x, y, z)] = b;
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) blocks[index(x, y, z)] = B.water;
    }
  }
  // Trees on grass, kept apart from each other and from the edges.
  for (let z = 3; z < D - 3; z++) {
    for (let x = 3; x < W - 3; x++) {
      const h = heights[z * W + x];
      if (blocks[index(x, h, z)] !== B.grass || hash(seed + 99, x, z) > 0.014) continue;
      const trunk = 4 + Math.floor(hash(seed + 5, x, z) * 2);
      if (h + trunk + 3 >= H) continue;
      for (let y = 1; y <= trunk; y++) blocks[index(x, h + y, z)] = B.log;
      const top = h + trunk;
      for (let dy = -2; dy <= 1; dy++) {
        const r = dy >= 0 ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash(seed + dy, x + dx, z + dz) < 0.6) continue;
            const i = index(x + dx, top + dy, z + dz);
            if (blocks[i] === AIR) blocks[i] = B.leaves;
          }
        }
      }
      blocks[index(x, top + 2, z)] = B.leaves;
    }
  }
  return blocks;
}

/** Where a new player stands: on the ground in the middle of the world. */
export function spawnPoint(blocks: Uint8Array): [number, number, number] {
  const x = Math.floor(W / 2);
  const z = Math.floor(D / 2);
  let y = H - 1;
  while (y > 0 && !isSolid(blocks[index(x, y, z)])) y--;
  return [x + 0.5, y + 1.01, z + 0.5];
}
