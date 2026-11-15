/**
 * Hexstead's islands, as pointy-top hex tiles in axial coordinates with the
 * corners (vertices) and sides (edges) they share, worked out once per shape:
 *   standard: 19 tiles (rows of 3-4-5-4-3) and 9 harbours, for 3 or 4 players;
 *   large:    30 tiles (rows of 3-4-5-6-5-4-3) and 11 harbours, for 5 or 6;
 *   newShores: Open Sea's map, 58 tiles of land and sea: the standard home
 *              island, a strait, and three small outer islands with goldfields.
 * A board is the shuffled terrain, number tokens and harbour kinds laid over a shape.
 */
import { shuffle } from '../kit/engine';

export type Resource = 'timber' | 'clay' | 'wool' | 'grain' | 'stone';
export type Terrain = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'badlands' | 'gold' | 'sea';
export type HarborKind = Resource | 'any';

export const RESOURCES: Resource[] = ['timber', 'clay', 'wool', 'grain', 'stone'];
export const YIELD: Record<Terrain, Resource | null> = {
  forest: 'timber',
  hills: 'clay',
  pasture: 'wool',
  fields: 'grain',
  mountains: 'stone',
  badlands: null,
  // A goldfield pays the resource its owner picks; the sea pays nothing.
  gold: null,
  sea: null,
};
export const isLand = (t: Terrain) => t !== 'sea';
/** How many of the 36 dice outcomes roll each total (the dots on a number token). */
export const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 0, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export interface Tile {
  q: number;
  r: number;
  /** Centre, in hex-radius units. */
  x: number;
  y: number;
  /** Its six corners, clockwise from the top. */
  corners: number[];
  /** Tiles sharing a side with it. */
  neighbours: number[];
  /** 0 for the home island, 1-3 for Open Sea's outer islands, -1 for sea. */
  island: number;
}

export interface Vertex {
  x: number;
  y: number;
  tiles: number[];
  edges: number[];
  /** Corners one edge away. */
  neighbours: number[];
}

export interface Edge {
  v: [number, number];
  tiles: number[];
  /** Midpoint. */
  x: number;
  y: number;
}

export type Layout = 'standard' | 'large' | 'newShores';

/** The tiles of each shape, row by row: [first q, tiles in the row] for r = -n..n. */
const ROWS: Record<Layout, [number, number][]> = {
  standard: [
    [0, 3],
    [-1, 4],
    [-2, 5],
    [-2, 4],
    [-2, 3],
  ],
  large: [
    [0, 3],
    [-1, 4],
    [-2, 5],
    [-3, 6],
    [-3, 5],
    [-3, 4],
    [-3, 3],
  ],
  newShores: [
    [0, 7],
    [-1, 8],
    [-2, 9],
    [-3, 10],
    [-3, 9],
    [-3, 8],
    [-3, 7],
  ],
};
const HARBOR_COUNT: Record<Layout, number> = { standard: 9, large: 11, newShores: 9 };

/** New Shores' outer islands, by axial coordinates; everything else that isn't the
 *  home island (within two tiles of the centre) is sea. */
const OUTER_ISLANDS: [number, number][][] = [
  [
    [4, -3],
    [5, -3],
    [5, -2],
  ],
  [
    [4, 0],
    [5, 0],
    [4, 1],
  ],
  [
    [2, 2],
    [1, 3],
    [2, 3],
  ],
];

/** Which island a tile belongs to: 0 the home island, 1-3 an outer island, -1 the sea. */
function islandAt(layout: Layout, q: number, r: number): number {
  if (layout !== 'newShores') return 0;
  if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) return 0;
  const k = OUTER_ISLANDS.findIndex((tiles) => tiles.some(([a, b]) => a === q && b === r));
  return k < 0 ? -1 : k + 1;
}

function buildGeometry(layout: Layout) {
  const half = (ROWS[layout].length - 1) / 2;
  const coords: [number, number][] = ROWS[layout].flatMap(([q0, n], k) => Array.from({ length: n }, (_, i) => [q0 + i, k - half] as [number, number]));
  // The large shape's long middle row sits half a tile left in axial terms: centre it.
  const shift = layout === 'large' ? 0.5 : 0;

  const tiles: Tile[] = [];
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];
  const vertexAt = new Map<string, number>();
  const edgeAt = new Map<string, number>();

  for (const [q, r] of coords) {
    const x = Math.sqrt(3) * (q + r / 2 + shift);
    const y = 1.5 * r;
    const corners: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90);
      const vx = x + Math.cos(a);
      const vy = y + Math.sin(a);
      const key = `${Math.round(vx * 1000)},${Math.round(vy * 1000)}`;
      let id = vertexAt.get(key);
      if (id === undefined) {
        id = vertices.length;
        vertexAt.set(key, id);
        vertices.push({ x: vx, y: vy, tiles: [], edges: [], neighbours: [] });
      }
      vertices[id].tiles.push(tiles.length);
      corners.push(id);
    }
    tiles.push({ q, r, x, y, corners, neighbours: [], island: islandAt(layout, q, r) });
  }

  tiles.forEach((t, ti) => {
    for (let i = 0; i < 6; i++) {
      const a = t.corners[i];
      const b = t.corners[(i + 1) % 6];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      let id = edgeAt.get(key);
      if (id === undefined) {
        id = edges.length;
        edgeAt.set(key, id);
        edges.push({ v: [Math.min(a, b), Math.max(a, b)], tiles: [], x: (vertices[a].x + vertices[b].x) / 2, y: (vertices[a].y + vertices[b].y) / 2 });
        vertices[a].edges.push(id);
        vertices[b].edges.push(id);
        vertices[a].neighbours.push(b);
        vertices[b].neighbours.push(a);
      }
      edges[id].tiles.push(ti);
    }
  });

  for (const e of edges) {
    if (e.tiles.length !== 2) continue;
    tiles[e.tiles[0]].neighbours.push(e.tiles[1]);
    tiles[e.tiles[1]].neighbours.push(e.tiles[0]);
  }

  // The coast in order round the (home) island, and every third or fourth edge of it a harbour.
  const home = (t: number) => tiles[t].island === 0;
  const coast = edges
    .map((_, i) => i)
    .filter((i) => (layout === 'newShores' ? edges[i].tiles.length === 2 && edges[i].tiles.filter(home).length === 1 : edges[i].tiles.length === 1))
    .sort((a, b) => Math.atan2(edges[a].y, edges[a].x) - Math.atan2(edges[b].y, edges[b].x));
  const harborEdges: number[] = [];
  if (layout === 'standard' || layout === 'newShores') {
    for (let h = 0, k = 0; h < 9; h++) {
      harborEdges.push(coast[k]);
      k += h % 3 === 2 ? 4 : 3;
    }
  } else {
    const n = HARBOR_COUNT[layout];
    for (let h = 0; h < n; h++) harborEdges.push(coast[Math.floor((h * coast.length) / n)]);
  }
  return { tiles, vertices, edges, coast, harborEdges };
}

export type Geometry = ReturnType<typeof buildGeometry>;
const SHAPES: Partial<Record<Layout, Geometry>> = {};
/** The geometry of a shape (worked out once). */
export const geometry = (layout: Layout): Geometry => (SHAPES[layout] ??= buildGeometry(layout));
/** The standard island. */
export const GEO = geometry('standard');
/** The geometry a board is laid on. */
export const geoOf = (b: { layout?: Layout }): Geometry => geometry(b.layout ?? 'standard');

const pool = (counts: Partial<Record<Terrain, number>>): Terrain[] => (Object.keys(counts) as Terrain[]).flatMap((t) => Array<Terrain>(counts[t]!).fill(t));
/** The land tiles of each shape (New Shores: its home island; see OUTER_TERRAINS for the rest). */
export const TERRAINS: Record<Layout, Terrain[]> = {
  standard: pool({ forest: 4, hills: 3, pasture: 4, fields: 4, mountains: 3, badlands: 1 }),
  large: pool({ forest: 6, hills: 5, pasture: 6, fields: 6, mountains: 5, badlands: 2 }),
  newShores: pool({ forest: 4, hills: 3, pasture: 4, fields: 4, mountains: 3, badlands: 1 }),
};
/** New Shores' nine outer-island tiles, two of them goldfields. */
export const OUTER_TERRAINS: Terrain[] = pool({ gold: 2, forest: 1, hills: 2, pasture: 1, fields: 1, mountains: 2 });
export const NUMBERS: Record<Layout, number[]> = {
  standard: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  large: [2, 2, ...[3, 4, 5, 6, 8, 9, 10, 11].flatMap((n) => [n, n, n]), 12, 12],
  newShores: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
};
export const OUTER_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11];
export const HARBOR_KINDS: Record<Layout, HarborKind[]> = {
  standard: ['any', 'any', 'any', 'any', 'timber', 'clay', 'wool', 'grain', 'stone'],
  large: ['any', 'any', 'any', 'any', 'any', 'timber', 'clay', 'wool', 'wool', 'grain', 'stone'],
  newShores: ['any', 'any', 'any', 'any', 'timber', 'clay', 'wool', 'grain', 'stone'],
};

export interface Board {
  /** The island's shape (absent on boards from before there was a choice: standard). */
  layout?: Layout;
  terrain: Terrain[];
  /** Each tile's number token (null on the badlands). */
  numbers: (number | null)[];
  /** The kind of each harbour, in `GEO.harborEdges` order. */
  harbors: HarborKind[];
  /** The tile the raider starts on: a badlands. */
  raider: number;
  /** Open Sea: the sea tile the corsair is on. */
  pirate?: number;
  seed: number;
}

/** A fresh board. Boards with a 6 or 8 beside another 6 or 8 are dealt again. */
export function makeBoard(seed: number, layout: Layout = 'standard'): Board {
  let s = seed;
  const hot = (n: number | null) => n === 6 || n === 8;
  const geo = geometry(layout);
  for (let attempt = 0; attempt < 5000; attempt++) {
    let terrain: Terrain[];
    let nums: number[];
    [terrain, s] = shuffle(TERRAINS[layout], s);
    [nums, s] = shuffle(NUMBERS[layout], s);
    if (layout === 'newShores') {
      // Home tiles take the island pool, outer islands theirs; the rest is sea.
      let outer: Terrain[];
      let outerNums: number[];
      [outer, s] = shuffle(OUTER_TERRAINS, s);
      [outerNums, s] = shuffle(OUTER_NUMBERS, s);
      const home = terrain;
      terrain = geo.tiles.map((t) => (t.island === 0 ? home.shift()! : t.island > 0 ? outer.shift()! : 'sea'));
      nums = geo.tiles.flatMap((t) => (t.island === 0 && terrain[geo.tiles.indexOf(t)] !== 'badlands' ? [nums.shift()!] : t.island > 0 ? [outerNums.shift()!] : []));
    }
    let k = 0;
    const numbers = terrain.map((t) => (t === 'badlands' || t === 'sea' ? null : nums[k++]));
    const ok = geo.tiles.every((t, i) => !hot(numbers[i]) || t.neighbours.every((j) => !hot(numbers[j])));
    if (!ok) continue;
    let harbors: HarborKind[];
    [harbors, s] = shuffle(HARBOR_KINDS[layout], s);
    // The corsair waits at sea in the far south-west corner of the map.
    const pirate = layout === 'newShores' ? geo.tiles.findIndex((t) => t.q === -3 && t.r === 3) : undefined;
    return { layout, terrain, numbers, harbors, raider: terrain.indexOf('badlands'), pirate, seed: s };
  }
  throw new Error('could not deal a board');
}
