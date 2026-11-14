/**
 * Blockyard's block textures, painted in code: every tile is a 16×16 pixel
 * pattern drawn into one atlas canvas (no image files to ship). Drawing is
 * seeded, so the world looks the same on every visit.
 */
import { TILE } from '../world';

export const TILE_PX = 16;
export const ATLAS_COLS = 8;
export const TILE_COUNT = 24;
export const ATLAS_ROWS = Math.ceil(TILE_COUNT / ATLAS_COLS);

type Paint = (px: (x: number, y: number, rgba: string) => void, rand: () => number) => void;

const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
/** A base colour jittered per pixel. */
const jitter = (rand: () => number, [r, g, b]: [number, number, number], amount: number, a = 1) => {
  const k = (rand() - 0.5) * amount;
  return rgb(r + k, g + k, b + k, a);
};

const fill = (base: [number, number, number], amount: number): Paint => (px, rand) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, jitter(rand, base, amount));
};

const clay = (base: [number, number, number]): Paint => (px, rand) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, jitter(rand, base, 14));
};

const PAINT: Record<number, Paint> = {
  [TILE.grassTop]: fill([96, 168, 64], 34),
  [TILE.grassSide]: (px, rand) => {
    fill([134, 96, 67], 30)(px, rand);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(rand() * 3);
      for (let y = 0; y < depth; y++) px(x, y, jitter(rand, [96, 168, 64], 30));
    }
  },
  [TILE.dirt]: fill([134, 96, 67], 34),
  [TILE.stone]: (px, rand) => {
    fill([126, 126, 128], 22)(px, rand);
    for (let k = 0; k < 10; k++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), rgb(98, 98, 102));
  },
  [TILE.sand]: fill([222, 206, 150], 22),
  [TILE.water]: (px, rand) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, jitter(rand, [52, 112, 210], 26, 0.72));
  },
  [TILE.logSide]: (px, rand) => {
    for (let x = 0; x < 16; x++) {
      const stripe: [number, number, number] = x % 4 === 0 ? [86, 62, 38] : [112, 82, 52];
      for (let y = 0; y < 16; y++) px(x, y, jitter(rand, stripe, 16));
    }
  },
  [TILE.logTop]: (px, rand) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const r = Math.hypot(x - 7.5, y - 7.5);
        const ring = Math.floor(r) % 3 === 0;
        const base: [number, number, number] = r > 7 ? [100, 74, 46] : ring ? [160, 124, 80] : [186, 150, 100];
        px(x, y, jitter(rand, base, 12));
      }
    }
  },
  [TILE.leaves]: (px, rand) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (rand() < 0.18) continue; // gaps you can see through
        px(x, y, jitter(rand, [58, 128, 50], 44));
      }
    }
  },
  [TILE.planks]: (px, rand) => {
    for (let y = 0; y < 16; y++) {
      const seam = y % 4 === 3;
      const offset = Math.floor(y / 4) % 2 ? 8 : 0;
      for (let x = 0; x < 16; x++) {
        const joint = (x + offset) % 16 === 0;
        px(x, y, seam || joint ? jitter(rand, [120, 88, 52], 10) : jitter(rand, [176, 136, 84], 16));
      }
    }
  },
  [TILE.glass]: (px) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || y === 0 || x === 15 || y === 15;
        const glint = (x - y === 4 || x - y === 5) && x > 5 && x < 13;
        if (edge) px(x, y, rgb(214, 236, 246, 0.95));
        else if (glint) px(x, y, rgb(255, 255, 255, 0.7));
        else px(x, y, rgb(200, 230, 245, 0.16));
      }
    }
  },
  [TILE.brick]: (px, rand) => {
    for (let y = 0; y < 16; y++) {
      const mortarRow = y % 4 === 3;
      const offset = Math.floor(y / 4) % 2 ? 4 : 0;
      for (let x = 0; x < 16; x++) {
        const mortar = mortarRow || (x + offset) % 8 === 7;
        px(x, y, mortar ? jitter(rand, [196, 188, 176], 10) : jitter(rand, [166, 72, 56], 24));
      }
    }
  },
  [TILE.cobble]: (px, rand) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = Math.sin(x * 1.7 + Math.cos(y * 1.3) * 2) + Math.cos(y * 1.9 + Math.sin(x * 1.1) * 2);
        px(x, y, n > 0.9 || n < -1.2 ? jitter(rand, [92, 92, 96], 14) : jitter(rand, [140, 140, 142], 26));
      }
    }
  },
  [TILE.snow]: fill([240, 246, 250], 12),
  [TILE.bedrock]: (px, rand) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, rand() < 0.4 ? rgb(40, 40, 44) : jitter(rand, [86, 86, 90], 30));
  },
  [TILE.clayRed]: clay([206, 62, 62]),
  [TILE.clayOrange]: clay([230, 128, 40]),
  [TILE.clayYellow]: clay([236, 200, 52]),
  [TILE.clayGreen]: clay([64, 160, 84]),
  [TILE.clayBlue]: clay([52, 104, 208]),
  [TILE.clayPurple]: clay([128, 80, 186]),
  [TILE.clayWhite]: clay([232, 230, 224]),
  [TILE.clayBlack]: clay([40, 40, 46]),
  [TILE.lamp]: (px, rand) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const frame = x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || y === 7;
        px(x, y, frame ? jitter(rand, [120, 92, 52], 12) : jitter(rand, [255, 224, 140], 18));
      }
    }
  },
};

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The atlas, drawn once. */
export function paintAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_PX;
  canvas.height = ATLAS_ROWS * TILE_PX;
  const ctx = canvas.getContext('2d')!;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const ox = (tile % ATLAS_COLS) * TILE_PX;
    const oy = Math.floor(tile / ATLAS_COLS) * TILE_PX;
    const rand = mulberry(1000 + tile * 7919);
    PAINT[tile]?.((x, y, rgba) => {
      ctx.fillStyle = rgba;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }, rand);
  }
  return canvas;
}

/** A tile's UV rectangle (inset half a texel against bleeding). */
export function tileUV(tile: number): [number, number, number, number] {
  const w = ATLAS_COLS * TILE_PX;
  const h = ATLAS_ROWS * TILE_PX;
  const x = (tile % ATLAS_COLS) * TILE_PX;
  const y = Math.floor(tile / ATLAS_COLS) * TILE_PX;
  const e = 0.02;
  return [(x + e) / w, 1 - (y + TILE_PX - e) / h, (x + TILE_PX - e) / w, 1 - (y + e) / h];
}

/** A small isometric picture of a block, for the hotbar and palette (a data URL). */
export function blockIcon(atlas: HTMLCanvasElement, tiles: [number, number, number], size = 48): string {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const src = (tile: number) => [(tile % ATLAS_COLS) * TILE_PX, Math.floor(tile / ATLAS_COLS) * TILE_PX] as const;
  const face = (tile: number, m: [number, number, number, number, number, number], shade: number) => {
    ctx.save();
    ctx.setTransform(...m);
    const [sx, sy] = src(tile);
    ctx.drawImage(atlas, sx, sy, TILE_PX, TILE_PX, 0, 0, TILE_PX, TILE_PX);
    ctx.fillStyle = `rgba(0,0,0,${shade})`;
    ctx.fillRect(0, 0, TILE_PX, TILE_PX);
    ctx.restore();
  };
  // An isometric cube: the top rhombus and two side faces, per texture pixel.
  const mid = size / 2;
  const half = size * 0.45; // half the cube's width
  const rise = half * 0.577; // tan 30°
  const top = size * 0.02;
  const sideH = size - top - 2 * rise - size * 0.02;
  const u = half / TILE_PX;
  const v = rise / TILE_PX;
  const h = sideH / TILE_PX;
  face(tiles[0], [u, v, -u, v, mid, top], 0);
  face(tiles[1], [u, v, 0, h, mid - half, top + rise], 0.18);
  face(tiles[1], [u, -v, 0, h, mid, top + 2 * rise], 0.34);
  return c.toDataURL();
}
