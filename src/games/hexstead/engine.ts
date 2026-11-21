/**
 * Hexstead: settle a hex island, trade, and build to 10 points. 3 or 4 players.
 *
 * Setup: in snake order (1, 2, 3, then 3, 2, 1) each player places a homestead
 * and a road beside it; the second homestead collects a card from each tile
 * around it. A turn: roll two dice; every tile showing the total pays its
 * neighbours (1 per homestead, 2 per town) unless the raider stands on it. A 7
 * pays nothing: players holding more than 7 cards discard half, and the roller
 * moves the raider and steals a card. Then trade (with the bank, harbours or
 * other players), build, buy and play charter cards, and end the turn.
 *
 * Every step that needs someone else (a discard, an answer to an offer) is
 * asked of one player at a time, so the game always has one actor.
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';
import { PIPS, RESOURCES, YIELD, geoOf, isLand, makeBoard, type Board, type Layout, type Resource } from './board';
import {
  CAPITAL_LEVEL,
  COMMODITIES,
  EDICT_DECKS,
  EDICT_GUILD,
  EDICT_LIMIT,
  FIXED_TOKENS,
  GOODS_BANK,
  GUILDS,
  GUILD_GOOD,
  MARAUDER_TRACK,
  MAX_LEVEL,
  MAX_WALLS,
  MERCHANT_POINTS,
  OMEN_FACES,
  POINT_EDICTS,
  TOWN_GOOD,
  WARDENS_PER_LEVEL,
  WARDENS_WIN_POINTS,
  emptyGoods,
  goodsSize,
  type Card,
  type Commodity,
  type Edict,
  type Goods,
  type Guild,
  type Omen,
  type Warden,
} from './wardens';
import { hexBot } from './bot';

export type { Resource } from './board';
export type Hand = Record<Resource, number>;
export type Charter = 'ranger' | 'monument' | 'roadworks' | 'bounty' | 'market';
export type Piece = 'road' | 'homestead' | 'town' | 'charter' | 'ship';
/** base: the island game. sea: Open Sea, with ships and outer islands. wardens: towns, guilds and the marauder fleet. */
export type HxMode = 'base' | 'sea' | 'wardens';

export const COSTS: Record<Piece, Partial<Hand>> = {
  road: { timber: 1, clay: 1 },
  homestead: { timber: 1, clay: 1, wool: 1, grain: 1 },
  town: { grain: 2, stone: 3 },
  charter: { wool: 1, grain: 1, stone: 1 },
  ship: { timber: 1, wool: 1 },
};
/** Wardens' prices. */
export const WARDEN_COSTS = {
  recruit: { wool: 1, stone: 1 } as Partial<Hand>,
  muster: { grain: 1 } as Partial<Hand>,
  promote: { wool: 1, stone: 1 } as Partial<Hand>,
  wall: { clay: 2 } as Partial<Hand>,
  /** A town with a Physician edict. */
  physician: { stone: 2, grain: 1 } as Partial<Hand>,
};
/** Pieces each player owns. */
export const LIMITS = { road: 15, homestead: 5, town: 4, ship: 15 };
/** Cards of each resource in the bank: 19, or 24 at a table of 5 or 6. */
export const BANK: Record<Layout, number> = { standard: 19, large: 24, newShores: 19 };
export const BANK_SIZE = BANK.standard;
export const WIN_POINTS = 10;
/** Open Sea plays to more points: the outer islands add Landfall bonuses. */
export const SEA_WIN_POINTS = 13;
/** Points for a player's first homestead on each outer island. */
export const LANDFALL_POINTS = 2;
export const winPoints = (s: { mode?: HxMode }) => (s.mode === 'sea' ? SEA_WIN_POINTS : s.mode === 'wardens' ? WARDENS_WIN_POINTS : WIN_POINTS);
export const MIN_SEATS = 3;
export const MAX_SEATS = 6;
/** The island for a table: the large one seats 5 or 6. */
export const layoutFor = (seats: number): Layout => (seats >= 5 ? 'large' : 'standard');
/** Longest Road and Biggest Guard need at least this much. */
export const ROAD_MIN = 5;
export const GUARD_MIN = 3;
/** A game that runs this many turns ends with the points leader winning. */
const MAX_ROUNDS = 600;
const deckOf = (counts: Record<Charter, number>): Charter[] => (Object.keys(counts) as Charter[]).flatMap((c) => Array<Charter>(counts[c]).fill(c));
/** The charter deck: 25 cards, or 34 at a table of 5 or 6. */
export const CHARTER_DECKS: Record<Layout, Charter[]> = {
  standard: deckOf({ ranger: 14, monument: 5, roadworks: 2, bounty: 2, market: 2 }),
  large: deckOf({ ranger: 20, monument: 5, roadworks: 3, bounty: 3, market: 3 }),
  newShores: deckOf({ ranger: 14, monument: 5, roadworks: 2, bounty: 2, market: 2 }),
};

export interface HxPlayer extends KitPlayer {
  hand: Hand;
  /** Cards in hand: all others see of your hand. */
  handCount: number;
  /** Charter cards held, with the turn each was bought. */
  charters: { card: Charter; bought: number }[];
  charterCount: number;
  /** Rangers played. */
  rangers: number;
  out?: boolean;
  /** Wardens: commodity cards (hidden like resources). */
  goods: Goods;
  /** Wardens: improvement level in each guild. */
  guilds: Record<Guild, number>;
  /** Wardens: edicts held (hidden from others; see edictCount). */
  edicts: Edict[];
  edictCount: number;
  /** Wardens: walls built, Defender points, and point edicts shown. */
  walls: number;
  defender: number;
  edictPoints: number;
}

export interface Offer {
  from: string;
  give: Partial<Hand>;
  get: Partial<Hand>;
  /** Wardens: commodities in the offer too. */
  giveGoods?: Partial<Goods>;
  getGoods?: Partial<Goods>;
  /** Players still to answer (they may answer in any order, all at once). */
  asked: string[];
  answers: Record<string, boolean>;
  /** Other terms a player proposed instead, by player: what THEY would give and get. */
  counters?: Record<string, { give: Partial<Hand>; get: Partial<Hand> }>;
}

/**
 * Wardens: a choice a player must make before play goes on (answered with
 * RESOLVE). Whoever owes the first ask is the actor until it is answered.
 */
export type Ask =
  /** Saboteur: discard `count` cards of your choice to the bank. */
  | { kind: 'discard'; player: string; count: number }
  /** Wedding: give `count` cards of your choice. */
  | { kind: 'give'; player: string; to: string; count: number }
  /** Commercial Harbour: give a commodity of your choice for the resource you were handed. */
  | { kind: 'harbor'; player: string; to: string }
  /** Master Merchant: take `count` cards from `from`'s hand, which you are shown. */
  | { kind: 'take'; player: string; from: string; count: number }
  /** Spy: take one of `from`'s edicts, which you are shown. */
  | { kind: 'spy'; player: string; from: string }
  /** The marauders won: choose the town you lose. */
  | { kind: 'pillage'; player: string }
  /** A tie for the best defence: choose the guild deck to draw from. */
  | { kind: 'draw'; player: string }
  /** More than 4 edicts: choose one to put under its deck. */
  | { kind: 'edict-limit'; player: string }
  /** Your warden was pushed off `from`: choose an empty corner along your roads. */
  | { kind: 'retreat'; player: string; from: number; warden: Warden }
  /** Deserter: choose the warden you give up. */
  | { kind: 'desert'; player: string; to: string }
  /** Deserter: place a warden of this strength, free (or skip). */
  | { kind: 'enlist'; player: string; level: 1 | 2 | 3; active: boolean }
  /** Diplomat: build the road you removed again, elsewhere (or skip). */
  | { kind: 'road'; player: string; skip: number };

/** special: at a table of 5 or 6, after each turn the others may build in turn (no trading). */
/** gold: players owed goldfield pay pick their resources, one at a time. */
export type Phase = 'setup' | 'roll' | 'discard' | 'raider' | 'steal' | 'main' | 'roadworks' | 'offer' | 'special' | 'gold' | 'over';

export interface HxEvent {
  seq: number;
  kind:
    | 'roll'
    | 'produce'
    | 'build'
    | 'buy'
    | 'play'
    | 'raider'
    | 'steal'
    | 'discard'
    | 'trade'
    | 'bank'
    | 'offer'
    | 'award'
    | 'win'
    | 'out'
    | 'pirate'
    | 'move-ship'
    | 'landfall'
    | 'omen'
    | 'attack'
    | 'improve'
    | 'warden'
    | 'edict'
    | 'capital'
    | 'harbor'
    | 'swap'
    | 'unroad';
  /** Wardens: the omen face, the edict, the guild, or the attack's outcome. */
  omen?: Omen;
  edict?: Edict;
  guild?: Guild;
  goods?: Partial<Goods>;
  text?: string;
  player?: string;
  target?: string;
  piece?: Piece;
  card?: Charter;
  cards?: Partial<Hand>;
  /** What was given in a trade. */
  paid?: Partial<Hand>;
  paidGoods?: Partial<Goods>;
  /** How many cards changed hands (kept when the cards themselves are hidden). */
  n?: number;
  dice?: [number, number];
  /** 'longest' or 'guard' for an award. */
  award?: 'longest' | 'guard';
}

export interface HxState {
  /** The expansion in play (absent on older states: the base game). */
  mode?: HxMode;
  board: Board;
  players: HxPlayer[];
  /** By corner: a homestead or town and its owner. */
  buildings: ({ player: string; town: boolean } | null)[];
  /** By edge: the road's owner. */
  roads: (string | null)[];
  /** Open Sea, by edge: the ship's owner. */
  ships: (string | null)[];
  /** Open Sea: a ship has been moved this turn. */
  shipMoved: boolean;
  /** Open Sea: ships built this turn (they can't move until next turn). */
  newShips: number[];
  /** Open Sea: the outer islands each player has made landfall on. */
  landfall: Record<string, number[]>;
  /** Open Sea: goldfield pay owed, picked one player at a time (Wardens: the Academy's pick too). */
  gold: { player: string; count: number }[];
  /** Wardens, by corner: a warden. */
  wardens: (Warden | null)[];
  /** Wardens, by corner: a wall around the town there. */
  walls: boolean[];
  /** Wardens: each guild's Capital (its holder and the town it stands on). */
  capitals: Record<Guild, { player: string; vertex: number } | null>;
  /** Wardens: the marauder fleet's place on its track (lands at MARAUDER_TRACK). */
  marauders: number;
  /** Wardens: the fleet has landed at least once (the raider moves only after that). */
  attacked: boolean;
  omen: Omen | null;
  edictDecks: Record<Guild, Edict[]>;
  edictDeckCount: Record<Guild, number>;
  goodsBank: Goods;
  /** Wardens: this turn's edict effects still to use (harbor: players a Commercial Harbour may still trade with). */
  perks: { physician: boolean; crane: boolean; smith: number; fleet: Card | null; harbor?: string[] };
  /** Wardens: the raider is moving for a Bishop (rob everyone beside it). */
  bishop: boolean;
  /** Wardens: the raider is being chased off (it must go to a numbered tile). */
  chasing?: boolean;
  /** Wardens: choices still owed, in order, and what they interrupted. */
  asks?: Ask[];
  resume?: ('produce' | 'end')[];
  /** Wardens: the merchant, on a tile, and who placed it. */
  merchant?: { player: string; tile: number } | null;
  bank: Hand;
  deck: Charter[];
  deckCount: number;
  /** The seat whose turn it is. */
  turn: number;
  /** Turns played since setup (cards bought this turn carry it). */
  round: number;
  phase: Phase;
  setup: { step: number; needRoad: boolean; last: number | null } | null;
  dice: [number, number] | null;
  /** How often each total has been rolled. */
  rolls: number[];
  discards: string[];
  stealFrom: string[];
  freeRoads: number;
  playedCharter: boolean;
  /** Where play returns once the raider has moved (and stolen). */
  afterRaider: 'roll' | 'main';
  offer: Offer | null;
  /** The special build phase: players still to build, in order. */
  special: string[];
  longestRoad: { player: string | null; length: number };
  biggestGuard: { player: string | null; size: number };
  log: HxEvent[];
  seq: number;
  seed: number;
  over: boolean;
  winner: string | null;
}

export type HxAction =
  | { type: 'ROLL' }
  | { type: 'BUILD_ROAD'; edge: number }
  | { type: 'BUILD_SHIP'; edge: number }
  | { type: 'MOVE_SHIP'; from: number; to: number }
  | { type: 'PICK_GOLD'; cards: Partial<Hand> }
  | { type: 'BUILD_HOMESTEAD'; vertex: number }
  | { type: 'BUILD_TOWN'; vertex: number }
  | { type: 'BUY_CHARTER' }
  | { type: 'PLAY_CHARTER'; card: Exclude<Charter, 'monument'>; take?: Resource[] }
  | { type: 'DISCARD'; cards: Partial<Hand>; goods?: Partial<Goods> }
  | { type: 'MOVE_RAIDER'; tile: number }
  | { type: 'STEAL'; from: string }
  | { type: 'BANK_TRADE'; give: Card; get: Card }
  | { type: 'BUILD_WARDEN'; vertex: number }
  | { type: 'MUSTER'; vertex: number }
  | { type: 'PROMOTE'; vertex: number }
  | { type: 'MOVE_WARDEN'; from: number; to: number }
  | { type: 'CHASE'; vertex: number }
  | { type: 'IMPROVE'; guild: Guild }
  | { type: 'BUILD_WALL'; vertex: number }
  | { type: 'PLAY_EDICT'; edict: Edict; take?: Card[]; target?: string; vertex?: number; edge?: number; tile?: number; tiles?: [number, number]; dice?: [number, number] }
  /** Wardens: answer the first ask. */
  | { type: 'RESOLVE'; cards?: Partial<Hand>; goods?: Partial<Goods>; vertex?: number; edge?: number; guild?: Guild; edict?: Edict; skip?: boolean }
  /** Wardens, after a Commercial Harbour: hand a player one resource for a commodity of their choice. */
  | { type: 'HARBOR'; target: string; give: Resource }
  | { type: 'OFFER'; give: Partial<Hand>; get: Partial<Hand>; giveGoods?: Partial<Goods>; getGoods?: Partial<Goods> }
  | { type: 'ANSWER'; accept: boolean }
  /** Instead of yes or no: other terms, as the answering player would give and get them. */
  | { type: 'COUNTER'; give: Partial<Hand>; get: Partial<Hand> }
  /** `counter`: take that player's counter-offer rather than the original terms. */
  | { type: 'CLOSE_OFFER'; with: string | null; counter?: boolean }
  | { type: 'END_TURN' };

export const emptyHand = (): Hand => ({ timber: 0, clay: 0, wool: 0, grain: 0, stone: 0 });
export const handSize = (h: Partial<Hand>) => RESOURCES.reduce((t, r) => t + (h[r] ?? 0), 0);
export const canPay = (h: Hand, cost: Partial<Hand>) => RESOURCES.every((r) => h[r] >= (cost[r] ?? 0));

/** Two dice from a seed: [[die, die], next seed]. */
export function rollDice(seed: number): [[number, number], number] {
  const [a, s1] = nextRandom(seed);
  const [b, s2] = nextRandom(s1);
  return [[1 + Math.floor(a * 6), 1 + Math.floor(b * 6)], s2];
}

const snake = (n: number) => [...Array.from({ length: n }, (_, i) => i), ...Array.from({ length: n }, (_, i) => n - 1 - i)];
/** The island this game is played on. */
export const geoFor = (s: HxState) => geoOf(s.board);
const other = (s: HxState, edge: number, v: number) => {
  const [a, b] = geoFor(s).edges[edge].v;
  return a === v ? b : a;
};
const seatOf = (s: HxState, id: string) => s.players.findIndex((p) => p.id === id);
const count = (s: HxState, id: string, kind: 'road' | 'homestead' | 'town' | 'ship') =>
  kind === 'road'
    ? s.roads.filter((r) => r === id).length
    : kind === 'ship'
      ? (s.ships ?? []).filter((r) => r === id).length
      : s.buildings.filter((b) => b?.player === id && b.town === (kind === 'town')).length;

const terrainAt = (s: HxState, t: number) => s.board.terrain[t];
/** An edge a road can take: it touches land. */
const roadEdge = (s: HxState, e: number) => geoFor(s).edges[e].tiles.some((t) => isLand(terrainAt(s, t)));
/** An edge a ship can take: it touches the sea. */
const seaEdge = (s: HxState, e: number) => geoFor(s).edges[e].tiles.some((t) => terrainAt(s, t) === 'sea');
const freeEdge = (s: HxState, e: number) => s.roads[e] === null && !(s.ships ?? [])[e];
/** A corner a building can take: it touches land. */
const landCorner = (s: HxState, v: number) => geoFor(s).vertices[v].tiles.some((t) => isLand(terrainAt(s, t)));
/** The sides of a tile. */
export const tileEdges = (s: HxState, t: number) => geoFor(s).edges.flatMap((e, i) => (e.tiles.includes(t) ? [i] : []));

// ---------------- Wardens helpers ----------------

const isGood = (c: Card): c is Commodity => (COMMODITIES as string[]).includes(c);
/** Every card in a hand: resources and commodities. */
export const cardsHeld = (p: HxPlayer) => handSize(p.hand) + goodsSize(p.goods);
/** The most cards a player may hold through a 7: 7, plus 2 for each wall. */
export const handLimit = (s: HxState, p: HxPlayer) => 7 + (s.mode === 'wardens' ? 2 * p.walls : 0);
const wardenAt = (s: HxState, v: number) => (s.wardens ?? [])[v] ?? null;
const enemyAt = (s: HxState, v: number, id: string) => {
  const b = s.buildings[v];
  const w = wardenAt(s, v);
  return (!!b && b.player !== id) || (!!w && w.player !== id);
};
/** The dice odds of the tiles around a corner (for picking a town to lose or to crown). */
const cornerPips = (s: HxState, v: number) => geoFor(s).vertices[v].tiles.reduce((t, x) => t + (s.board.numbers[x] ? PIPS[s.board.numbers[x]!] : 0), 0);

/** Corners where `id` may recruit a warden: empty land corners on their own road. */
export function legalWardenSpots(s: HxState, id: string): number[] {
  if (s.mode !== 'wardens') return [];
  return geoFor(s).vertices.flatMap((v, i) => (!s.buildings[i] && !wardenAt(s, i) && landCorner(s, i) && v.edges.some((e) => s.roads[e] === id) ? [i] : []));
}

/** Corners a warden at `from` can reach along its owner's roads, past no other player's piece. */
function wardenReach(s: HxState, from: number, id: string): Set<number> {
  const geo = geoFor(s);
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length) {
    const v = queue.shift()!;
    if (v !== from && enemyAt(s, v, id)) continue;
    for (const e of geo.vertices[v].edges) {
      if (s.roads[e] !== id) continue;
      const w = other(s, e, v);
      if (!seen.has(w)) {
        seen.add(w);
        queue.push(w);
      }
    }
  }
  seen.delete(from);
  return seen;
}

/** Where a warden of `id`'s pushed off `from` may go: an empty corner they reach from there along their roads. */
export function retreatSpots(s: HxState, id: string, from: number): number[] {
  return [...wardenReach(s, from, id)].filter((v) => v !== from && !s.buildings[v] && !wardenAt(s, v));
}

/** Roads a Diplomat may remove: at one end, nothing of their owner's (no building, warden or other road). */
export function openRoads(s: HxState): number[] {
  if (s.mode !== 'wardens') return [];
  const geo = geoFor(s);
  return s.roads.flatMap((owner, e) => {
    if (!owner) return [];
    const loose = geo.edges[e].v.some((v) => s.buildings[v]?.player !== owner && wardenAt(s, v)?.player !== owner && !geo.vertices[v].edges.some((x) => x !== e && s.roads[x] === owner));
    return loose ? [e] : [];
  });
}

/** A player's wardens, by corner. */
export const wardensOf = (s: HxState, id: string) => (s.wardens ?? []).flatMap((w, v) => (w?.player === id ? [v] : []));

/** Towns the marauders may take from `id`: any without a Capital. */
export function pillageable(s: HxState, id: string): number[] {
  const capitals = new Set(GUILDS.flatMap((g) => (s.capitals[g] ? [s.capitals[g]!.vertex] : [])));
  return s.buildings.flatMap((b, v) => (b?.player === id && b.town && !capitals.has(v) ? [v] : []));
}

/** Deserter: the strength of warden `id` may place (the one given up, else strength 1), or null if none is left. */
export function enlistLevel(s: HxState, id: string, level: 1 | 2 | 3): 1 | 2 | 3 | null {
  const owned = (lv: number) => (s.wardens ?? []).filter((w) => w?.player === id && w.level === lv).length;
  if (owned(level) < WARDENS_PER_LEVEL) return level;
  return owned(1) < WARDENS_PER_LEVEL ? 1 : null;
}

/** Where an active warden at `from` may go: an empty corner along its roads, or onto a weaker rival warden. */
export function wardenMoves(s: HxState, id: string, from: number): number[] {
  const w = wardenAt(s, from);
  if (!w || w.player !== id || !w.active || w.since >= s.round) return [];
  return [...wardenReach(s, from, id)].filter((v) => {
    const there = wardenAt(s, v);
    if (s.buildings[v]) return false;
    if (!there) return true;
    return there.player !== id && there.level < w.level;
  });
}

/** Your active wardens beside the raider, which can chase it off (after the first landing). */
export function chasers(s: HxState, id: string): number[] {
  if (s.mode !== 'wardens' || !s.attacked) return [];
  return geoFor(s).tiles[s.board.raider].corners.filter((v) => {
    const w = wardenAt(s, v);
    return !!w && w.player === id && w.active && w.since < s.round;
  });
}

/** What the next level of a guild costs `id` in its commodity, or null if it can't be built. */
export function improveCost(s: HxState, id: string, g: Guild): number | null {
  const p = s.players.find((x) => x.id === id)!;
  const next = p.guilds[g] + 1;
  if (next > MAX_LEVEL) return null;
  if (!s.buildings.some((b) => b?.player === id && b.town)) return null;
  if (next === MAX_LEVEL && s.players.some((x) => x.id !== id && x.guilds[g] >= MAX_LEVEL)) return null;
  // A level that takes a Capital needs a town to put it on.
  const holder = s.capitals[g];
  const wantsCapital = (next === CAPITAL_LEVEL && !holder) || (next === MAX_LEVEL && !!holder && holder.player !== id);
  if (wantsCapital && !s.buildings.some((b, v) => b?.player === id && b.town && !GUILDS.some((x) => s.capitals[x]?.vertex === v))) return null;
  return Math.max(0, next - (s.perks?.crane ? 1 : 0));
}

/** How many of `card` you give the bank for one card. */
export function bankRatio(s: HxState, id: string, card: Card): number {
  if (s.perks?.fleet === card) return 2;
  if (!isGood(card)) {
    // The merchant's tile: its resource trades 2 for 1 for whoever placed it.
    const m = s.merchant;
    if (m && m.player === id && YIELD[s.board.terrain[m.tile]] === card) return 2;
    return tradeRatio(s, id, card);
  }
  const p = s.players.find((x) => x.id === id)!;
  if (p.guilds.trade >= 3) return 2;
  // A 3:1 harbour takes commodities too.
  let best = 4;
  geoFor(s).harborEdges.forEach((e, k) => {
    if (s.board.harbors[k] === 'any' && geoFor(s).edges[e].v.some((v) => s.buildings[v]?.player === id)) best = 3;
  });
  return best;
}

/** Corners where `id` may put a homestead now (the setup ignores road connection). */
export function legalHomesteadSpots(s: HxState, id: string): number[] {
  const setup = s.phase === 'setup';
  const geo = geoFor(s);
  return geo.vertices.flatMap((v, i) => {
    if (s.buildings[i] || wardenAt(s, i) || v.neighbours.some((n) => s.buildings[n]) || !landCorner(s, i)) return [];
    // Open Sea: everyone starts on the home island.
    if (setup && s.mode === 'sea' && !v.tiles.some((t) => geo.tiles[t].island === 0 && isLand(terrainAt(s, t)))) return [];
    if (!setup && !v.edges.some((e) => s.roads[e] === id || (s.ships ?? [])[e] === id)) return [];
    return [i];
  });
}

/** Edges where `id` may put a road now. */
export function legalRoadSpots(s: HxState, id: string): number[] {
  if (s.phase === 'setup') {
    const v = s.setup?.last;
    return v === null || v === undefined ? [] : geoFor(s).vertices[v].edges.filter((e) => freeEdge(s, e) && roadEdge(s, e));
  }
  return geoFor(s).edges.flatMap((e, i) => {
    if (!freeEdge(s, i) || !roadEdge(s, i)) return [];
    const joins = e.v.some((v) => {
      const b = s.buildings[v];
      if (b?.player === id) return true;
      if (enemyAt(s, v, id)) return false; // another player's building or warden blocks the way
      return geoFor(s).vertices[v].edges.some((x) => x !== i && s.roads[x] === id);
    });
    return joins ? [i] : [];
  });
}

/** Open Sea: edges where `id` may put a ship now (`ignore`: a ship being moved). */
export function legalShipSpots(s: HxState, id: string, ignore: number | null = null): number[] {
  if (s.mode !== 'sea') return [];
  const geo = geoFor(s);
  const nearPirate = (e: number) => s.board.pirate !== undefined && geo.edges[e].tiles.includes(s.board.pirate);
  if (s.phase === 'setup') {
    const v = s.setup?.last;
    return v === null || v === undefined ? [] : geo.vertices[v].edges.filter((e) => freeEdge(s, e) && seaEdge(s, e) && !nearPirate(e));
  }
  return geo.edges.flatMap((e, i) => {
    if ((!freeEdge(s, i) && i !== ignore) || !seaEdge(s, i) || nearPirate(i) || i === ignore) return [];
    const joins = e.v.some((v) => {
      const b = s.buildings[v];
      if (b?.player === id) return true;
      if (b) return false;
      return geo.vertices[v].edges.some((x) => x !== i && x !== ignore && s.ships[x] === id);
    });
    return joins ? [i] : [];
  });
}

/** Open Sea: your ships that may move: at the open end of a line, not built this turn, clear of the corsair. */
export function movableShips(s: HxState, id: string): number[] {
  if (s.mode !== 'sea' || s.shipMoved) return [];
  const geo = geoFor(s);
  return s.ships.flatMap((owner, e) => {
    if (owner !== id || s.newShips.includes(e)) return [];
    if (s.board.pirate !== undefined && geo.edges[e].tiles.includes(s.board.pirate)) return [];
    const open = geo.edges[e].v.some((v) => s.buildings[v]?.player !== id && !geo.vertices[v].edges.some((x) => x !== e && s.ships[x] === id));
    return open && legalShipSpots(s, id, e).length > 0 ? [e] : [];
  });
}

/** Your homesteads, which can become towns. */
export const legalTownSpots = (s: HxState, id: string) => s.buildings.flatMap((b, i) => (b?.player === id && !b.town ? [i] : []));

/** How many of `r` you give the bank for one card: 4, 3 with any 3:1 harbour, 2 with that resource's harbour. */
export function tradeRatio(s: HxState, id: string, r: Resource): number {
  let best = 4;
  geoFor(s).harborEdges.forEach((e, k) => {
    if (!geoFor(s).edges[e].v.some((v) => s.buildings[v]?.player === id)) return;
    const kind = s.board.harbors[k];
    if (kind === r) best = Math.min(best, 2);
    else if (kind === 'any') best = Math.min(best, 3);
  });
  return best;
}

/** The longest chain of `id`'s roads with no road used twice; an opponent's building cuts it. */
export function longestRoadOf(s: HxState, id: string): number {
  let best = 0;
  const blocked = (v: number) => enemyAt(s, v, id);
  const used = new Set<number>();
  const ships = s.ships ?? [];
  const kindOf = (e: number) => (s.roads[e] === id ? 'road' : ships[e] === id ? 'ship' : null);
  // Roads and ships join only at the player's own building.
  const walk = (v: number, len: number, came: 'road' | 'ship' | null) => {
    if (len > best) best = len;
    if (len > 0 && blocked(v)) return;
    for (const e of geoFor(s).vertices[v].edges) {
      const k = kindOf(e);
      if (!k || used.has(e)) continue;
      if (came && k !== came && s.buildings[v]?.player !== id) continue;
      used.add(e);
      walk(other(s, e, v), len + 1, k);
      used.delete(e);
    }
  };
  geoFor(s).edges.forEach((edge, e) => {
    if (kindOf(e)) for (const v of edge.v) walk(v, 0, null);
  });
  return best;
}

/** Points: 1 per homestead, 2 per town, 2 each for Longest Road and Biggest Guard, and (if counted) 1 per monument. */
export function victoryPoints(s: HxState, id: string, hidden = true): number {
  let pts = 0;
  for (const b of s.buildings) if (b?.player === id) pts += b.town ? 2 : 1;
  if (s.longestRoad.player === id) pts += 2;
  if (s.biggestGuard.player === id) pts += 2;
  if (hidden) pts += s.players.find((p) => p.id === id)?.charters.filter((c) => c.card === 'monument').length ?? 0;
  pts += LANDFALL_POINTS * (s.landfall?.[id]?.length ?? 0);
  if (s.mode === 'wardens') {
    const p = s.players.find((x) => x.id === id);
    pts += (p?.defender ?? 0) + (p?.edictPoints ?? 0);
    for (const g of GUILDS) if (s.capitals[g]?.player === id) pts += 2;
    if (s.merchant?.player === id) pts += MERCHANT_POINTS;
  }
  return pts;
}

function note(s: HxState, e: Omit<HxEvent, 'seq'>) {
  s.seq += 1;
  s.log = [{ ...e, seq: s.seq }, ...s.log].slice(0, 60);
}

function updateLongestRoad(s: HxState) {
  const lens = s.players.filter((p) => !p.out).map((p) => [p.id, longestRoadOf(s, p.id)] as const);
  const top = Math.max(0, ...lens.map(([, n]) => n));
  const before = s.longestRoad.player;
  let holder: string | null;
  if (top < ROAD_MIN) holder = null;
  else if (before && lens.find(([id]) => id === before)?.[1] === top) holder = before;
  else {
    const leaders = lens.filter(([, n]) => n === top);
    holder = leaders.length === 1 ? leaders[0][0] : null;
  }
  s.longestRoad = { player: holder, length: holder ? top : 0 };
  if (holder && holder !== before) note(s, { kind: 'award', player: holder, award: 'longest' });
}

function updateGuard(s: HxState, id: string) {
  const p = s.players.find((x) => x.id === id)!;
  if (p.rangers >= GUARD_MIN && p.rangers > s.biggestGuard.size && s.biggestGuard.player !== id) {
    s.biggestGuard = { player: id, size: p.rangers };
    note(s, { kind: 'award', player: id, award: 'guard' });
  } else if (s.biggestGuard.player === id) s.biggestGuard.size = p.rangers;
}

/** Open Sea: a player's first homestead on an outer island scores Landfall. */
function landfall(s: HxState, id: string, v: number) {
  if (s.mode !== 'sea') return;
  const geo = geoFor(s);
  for (const t of geo.vertices[v].tiles) {
    const k = geo.tiles[t].island;
    if (k > 0 && isLand(s.board.terrain[t]) && !s.landfall[id].includes(k)) {
      s.landfall[id].push(k);
      note(s, { kind: 'landfall', player: id });
    }
  }
}

function payCost(s: HxState, p: HxPlayer, cost: Partial<Hand>) {
  if (!canPay(p.hand, cost)) throw new IllegalMove("you can't pay for that");
  for (const r of RESOURCES) {
    p.hand[r] -= cost[r] ?? 0;
    s.bank[r] += cost[r] ?? 0;
  }
}

function produce(s: HxState, total: number) {
  const owed = new Map<Resource, Map<string, number>>();
  const goodsOwed = new Map<Commodity, Map<string, number>>();
  const gold = new Map<string, number>();
  s.board.numbers.forEach((n, t) => {
    if (n !== total || t === s.board.raider) return;
    if (s.board.terrain[t] === 'gold') {
      for (const c of geoFor(s).tiles[t].corners) {
        const b = s.buildings[c];
        if (b && !s.players.find((p) => p.id === b.player)?.out) gold.set(b.player, (gold.get(b.player) ?? 0) + (b.town ? 2 : 1));
      }
      return;
    }
    const res = YIELD[s.board.terrain[t]];
    if (!res) return;
    for (const c of geoFor(s).tiles[t].corners) {
      const b = s.buildings[c];
      if (!b || s.players.find((p) => p.id === b.player)?.out) continue;
      // Wardens: a town on forest, pasture or mountains makes a commodity in place of its second card.
      const good = s.mode === 'wardens' && b.town ? TOWN_GOOD[s.board.terrain[t]] : undefined;
      const m = owed.get(res) ?? new Map<string, number>();
      m.set(b.player, (m.get(b.player) ?? 0) + (b.town && !good ? 2 : 1));
      owed.set(res, m);
      if (good) {
        const g = goodsOwed.get(good) ?? new Map<string, number>();
        g.set(b.player, (g.get(b.player) ?? 0) + 1);
        goodsOwed.set(good, g);
      }
    }
  });
  const gotGoods = new Map<string, Partial<Goods>>();
  for (const [good, m] of goodsOwed) {
    const want = [...m.values()].reduce((a, b) => a + b, 0);
    if (want > s.goodsBank[good] && m.size > 1) continue;
    for (const [id, n] of m) {
      const amount = Math.min(n, s.goodsBank[good]);
      if (amount === 0) continue;
      s.goodsBank[good] -= amount;
      s.players.find((p) => p.id === id)!.goods[good] += amount;
      gotGoods.set(id, { ...gotGoods.get(id), [good]: amount });
    }
  }
  const got = new Map<string, Partial<Hand>>();
  for (const [res, m] of owed) {
    const want = [...m.values()].reduce((a, b) => a + b, 0);
    // A bank short of a resource pays it to nobody, unless only one player is owed it.
    if (want > s.bank[res] && m.size > 1) continue;
    for (const [id, n] of m) {
      const amount = Math.min(n, s.bank[res]);
      if (amount === 0) continue;
      s.bank[res] -= amount;
      s.players.find((p) => p.id === id)!.hand[res] += amount;
      got.set(id, { ...got.get(id), [res]: amount });
    }
  }
  for (const p of s.players) {
    if (got.has(p.id) || gotGoods.has(p.id)) note(s, { kind: 'produce', player: p.id, cards: got.get(p.id), goods: gotGoods.get(p.id) });
  }
  // Wardens: the Academy (level 3) gives a player who got nothing one resource of their choice.
  if (s.mode === 'wardens') {
    for (const p of s.players) if (!p.out && p.guilds.academy >= 3 && !got.has(p.id) && !gotGoods.has(p.id)) gold.set(p.id, 1);
  }
  // Goldfield pay is picked by each player owed it, in seat order from the roller.
  const n = s.players.length;
  s.gold = Array.from({ length: n }, (_, k) => s.players[(s.turn + k) % n])
    .filter((p) => gold.has(p.id))
    .map((p) => ({ player: p.id, count: gold.get(p.id)! }));
}

function nextSeat(s: HxState, from: number): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (from + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return from;
}

/** Move the setup on to the next placement, skipping anyone who left. */
function advanceSetup(s: HxState) {
  const order = snake(s.players.length);
  let step = s.setup!.step + 1;
  while (step < order.length && s.players[order[step]].out) step++;
  if (step >= order.length) {
    s.setup = null;
    s.phase = 'roll';
    s.turn = s.players.findIndex((p) => !p.out);
    s.round = 1;
  } else s.setup = { step, needRoad: false, last: null };
}

/** The turn ends: at a table of 5 or 6 the others build in turn first. */
function endTurn(s: HxState) {
  if (s.board.layout === 'large') {
    const n = s.players.length;
    s.special = Array.from({ length: n - 1 }, (_, k) => s.players[(s.turn + 1 + k) % n]).filter((p) => !p.out).map((p) => p.id);
    s.offer = null;
    s.phase = 'special';
    if (s.special.length > 0) return;
  }
  startTurn(s, nextSeat(s, s.turn));
}

function startTurn(s: HxState, seat: number) {
  s.special = [];
  s.perks = { physician: false, crane: false, smith: 0, fleet: null, harbor: [] };
  s.omen = null;
  s.shipMoved = false;
  s.newShips = [];
  s.turn = seat;
  s.round += 1;
  s.phase = 'roll';
  s.dice = null;
  s.playedCharter = false;
  s.freeRoads = 0;
  s.offer = null;
  if (s.round > MAX_ROUNDS) finishByPoints(s);
}

function finishByPoints(s: HxState) {
  const live = s.players.filter((p) => !p.out);
  live.sort((a, b) => victoryPoints(s, b.id) - victoryPoints(s, a.id));
  s.over = true;
  s.phase = 'over';
  s.winner = live[0]?.id ?? null;
}

/** After the raider moves: steal from the one player next to it, or ask whom to rob. */
function raiderStep(s: HxState, tile: number) {
  const me = s.players[s.turn];
  const atSea = s.board.terrain[tile] === 'sea';
  const sides = atSea ? tileEdges(s, tile) : [];
  const near = (p: HxPlayer) => (atSea ? sides.some((e) => s.ships[e] === p.id) : geoFor(s).tiles[tile].corners.some((c) => s.buildings[c]?.player === p.id));
  const victims = s.players.filter((p) => p !== me && !p.out && cardsHeld(p) > 0 && near(p));
  if (s.bishop) {
    // A Bishop robs one card from every player beside the raider.
    s.bishop = false;
    for (const v of victims) {
      const got = takeRandom(s, v, me, 1);
      note(s, { kind: 'steal', player: me.id, target: v.id, cards: got.cards, goods: got.goods });
    }
    s.phase = s.afterRaider;
    return;
  }
  if (victims.length === 0) s.phase = s.afterRaider;
  else if (victims.length === 1) steal(s, victims[0].id);
  else {
    s.stealFrom = victims.map((p) => p.id);
    s.phase = 'steal';
  }
}

/** Move `n` cards at random (resources and commodities) from one player to another (or to the bank). */
function takeRandom(s: HxState, from: HxPlayer, to: HxPlayer | null, n: number): { cards: Partial<Hand>; goods: Partial<Goods> } {
  const cards: Partial<Hand> = {};
  const goods: Partial<Goods> = {};
  for (let k = 0; k < n; k++) {
    const pile: Card[] = [...RESOURCES.flatMap((r) => Array<Card>(from.hand[r]).fill(r)), ...COMMODITIES.flatMap((c) => Array<Card>(from.goods[c]).fill(c))];
    if (pile.length === 0) break;
    const [r, seed] = nextRandom(s.seed);
    s.seed = seed;
    const card = pile[Math.floor(r * pile.length)];
    if (isGood(card)) {
      from.goods[card] -= 1;
      if (to) to.goods[card] += 1;
      else s.goodsBank[card] += 1;
      goods[card] = (goods[card] ?? 0) + 1;
    } else {
      from.hand[card] -= 1;
      if (to) to.hand[card] += 1;
      else s.bank[card] += 1;
      cards[card] = (cards[card] ?? 0) + 1;
    }
  }
  return { cards, goods };
}

function steal(s: HxState, from: string) {
  const victim = s.players.find((p) => p.id === from)!;
  const got = takeRandom(s, victim, s.players[s.turn], 1);
  s.stealFrom = [];
  s.phase = s.afterRaider;
  note(s, { kind: 'steal', player: s.players[s.turn].id, target: from, cards: got.cards, goods: got.goods });
}

function sync(s: HxState): HxState {
  for (const p of s.players) {
    p.handCount = handSize(p.hand) + goodsSize(p.goods ?? {});
    p.charterCount = p.charters.length;
    p.edictCount = (p.edicts ?? []).length;
  }
  if (s.edictDecks) s.edictDeckCount = { trade: s.edictDecks.trade.length, council: s.edictDecks.council.length, academy: s.edictDecks.academy.length };
  s.deckCount = s.deck.length;
  return s;
}

export interface HxOptions {
  mode?: HxMode;
}

export function createHexstead(seats: KitSeat[], seed: number, options?: unknown): HxState {
  const asked = (options as HxOptions | undefined)?.mode;
  const mode: HxMode = asked === 'sea' || asked === 'wardens' ? asked : 'base';
  const layout = mode === 'sea' ? 'newShores' : layoutFor(seats.length);
  const board = makeBoard(seed, layout);
  const geo = geoOf(board);
  // Wardens has no charter cards: its edicts come from three guild decks.
  const [deck, s1] = mode === 'wardens' ? [[] as Charter[], board.seed] : shuffle(CHARTER_DECKS[layout], board.seed);
  let s2 = s1;
  const edictDecks = {} as Record<Guild, Edict[]>;
  for (const g of GUILDS) [edictDecks[g], s2] = mode === 'wardens' ? shuffle(EDICT_DECKS[g], s2) : [[], s2];
  const bank = Object.fromEntries(RESOURCES.map((r) => [r, BANK[layout]])) as Hand;
  return sync({
    mode,
    board,
    players: seats.map((p, i) => ({
      id: `p${i}`,
      name: p.name,
      isAI: p.isAI,
      difficulty: p.difficulty,
      hand: emptyHand(),
      handCount: 0,
      charters: [],
      charterCount: 0,
      rangers: 0,
      goods: emptyGoods(),
      guilds: { trade: 0, council: 0, academy: 0 },
      edicts: [],
      edictCount: 0,
      walls: 0,
      defender: 0,
      edictPoints: 0,
    })),
    buildings: geo.vertices.map(() => null),
    roads: geo.edges.map(() => null),
    ships: geo.edges.map(() => null),
    shipMoved: false,
    newShips: [],
    landfall: Object.fromEntries(seats.map((_, i) => [`p${i}`, []])),
    gold: [],
    wardens: geo.vertices.map(() => null),
    walls: geo.vertices.map(() => false),
    capitals: { trade: null, council: null, academy: null },
    marauders: 0,
    attacked: false,
    omen: null,
    edictDecks,
    edictDeckCount: { trade: edictDecks.trade.length, council: edictDecks.council.length, academy: edictDecks.academy.length },
    goodsBank: { parchment: GOODS_BANK, linen: GOODS_BANK, silver: GOODS_BANK },
    perks: { physician: false, crane: false, smith: 0, fleet: null, harbor: [] },
    bishop: false,
    chasing: false,
    asks: [],
    resume: [],
    merchant: null,
    bank,
    deck,
    deckCount: deck.length,
    turn: 0,
    round: 0,
    phase: 'setup',
    setup: { step: 0, needRoad: false, last: null },
    dice: null,
    rolls: Array(13).fill(0),
    discards: [],
    stealFrom: [],
    freeRoads: 0,
    playedCharter: false,
    afterRaider: 'main',
    offer: null,
    special: [],
    longestRoad: { player: null, length: 0 },
    biggestGuard: { player: null, size: 0 },
    log: [],
    seq: 0,
    seed: s2,
    over: false,
    winner: null,
  });
}

/** The player who must act now. */
export function hexActor(s: HxState): string | null {
  // Wardens: an owed choice comes before anything else.
  const ask = s.asks?.[0];
  if (ask && s.phase !== 'over') return ask.player;
  switch (s.phase) {
    case 'over':
      return null;
    case 'setup':
      return s.players[snake(s.players.length)[s.setup!.step]].id;
    case 'discard':
      return s.discards[0] ?? null;
    case 'offer':
      return s.offer!.asked[0] ?? s.offer!.from;
    case 'special':
      return s.special[0] ?? null;
    case 'gold':
      return s.gold[0]?.player ?? null;
    default:
      return s.players[s.turn].id;
  }
}

function applyHex(prev: HxState, action: HxAction | KitCommonAction, actorId: string): HxState {
  if (action.type === 'REMATCH') {
    if (!prev.over) throw new IllegalMove('the game is still on');
    return createHexstead(
      prev.players.map((p) => ({ name: p.name, isAI: p.isAI, difficulty: p.difficulty })),
      nextRandom(prev.seed)[1],
      { mode: prev.mode },
    );
  }
  if (prev.over) throw new IllegalMove('the game is over');
  if (action.type === 'RESIGN') return forfeit(prev, actorId);
  const s = structuredClone(prev);
  const me = s.players.find((p) => p.id === actorId);
  if (!me) throw new IllegalMove('not in this game');
  // An offerer may withdraw their offer while others are still answering.
  if (action.type === 'CLOSE_OFFER' && s.phase === 'offer' && s.offer?.from === actorId) {
    closeOffer(s, action.with, !!action.counter);
    return finish(s);
  }
  // An offer is put to the whole table at once: anyone asked may answer, in any order.
  if (action.type === 'ANSWER' && s.phase === 'offer' && s.offer?.asked.includes(actorId)) {
    const o = s.offer;
    o.answers[actorId] = action.accept && canPay(me.hand, o.get) && hasGoods(me.goods, o.getGoods);
    o.asked = o.asked.filter((id) => id !== actorId);
    if (o.asked.length === 0 && !Object.values(o.answers).some(Boolean) && !Object.keys(o.counters ?? {}).length) closeOffer(s, null);
    return finish(s);
  }
  // ...or come back with other terms (anyone at the table but the one who made the offer).
  if (action.type === 'COUNTER' && s.phase === 'offer' && s.offer && s.offer.from !== actorId && !me.out) {
    const give = clean(action.give);
    const get = clean(action.get);
    if (!handSize(give) || !handSize(get)) throw new IllegalMove('offer something for something');
    if (RESOURCES.some((r) => (give[r] ?? 0) > 0 && (get[r] ?? 0) > 0)) throw new IllegalMove("don't ask for what you're giving");
    if (!canPay(me.hand, give)) throw new IllegalMove("you don't have those cards");
    const o = s.offer;
    o.counters = { ...(o.counters ?? {}), [actorId]: { give, get } };
    o.answers[actorId] = false;
    o.asked = o.asked.filter((id) => id !== actorId);
    return finish(s);
  }
  if (hexActor(s) !== actorId) throw new IllegalMove('not your turn');
  // Wardens: while a choice is owed, it is the only move.
  if (s.asks?.length) {
    if (action.type !== 'RESOLVE') throw new IllegalMove('waiting for a choice');
    resolveAsk(s, s.asks[0], action);
    runAsks(s);
    return finish(s);
  }
  if (action.type === 'RESOLVE') throw new IllegalMove('there is nothing to choose');

  switch (action.type) {
    case 'ROLL': {
      if (s.phase !== 'roll') throw new IllegalMove('not time to roll');
      const [dice, seed] = rollDice(s.seed);
      s.seed = seed;
      roll(s, actorId, dice);
      break;
    }
    case 'DISCARD': {
      if (s.phase !== 'discard') throw new IllegalMove('nothing to discard');
      const need = Math.floor(cardsHeld(me) / 2);
      const goods = action.goods ?? {};
      if (handSize(action.cards) + goodsSize(goods) !== need || !canPay(me.hand, action.cards) || !COMMODITIES.every((c) => me.goods[c] >= (goods[c] ?? 0))) {
        throw new IllegalMove(`discard exactly ${need} of your cards`);
      }
      payCost(s, me, action.cards);
      for (const c of COMMODITIES) {
        me.goods[c] -= goods[c] ?? 0;
        s.goodsBank[c] += goods[c] ?? 0;
      }
      note(s, { kind: 'discard', player: actorId, cards: action.cards, goods });
      s.discards.shift();
      if (s.discards.length === 0) s.phase = raiderNext(s);
      break;
    }
    case 'MOVE_RAIDER': {
      if (s.phase !== 'raider') throw new IllegalMove('the raider is not yours to move');
      if (!Number.isInteger(action.tile) || action.tile < 0 || action.tile >= geoFor(s).tiles.length) throw new IllegalMove('move the raider to another tile');
      if (s.board.terrain[action.tile] === 'sea') {
        // Open Sea: the corsair moves instead, to another sea tile.
        if (s.mode !== 'sea' || action.tile === s.board.pirate) throw new IllegalMove('move the corsair to another sea tile');
        s.board.pirate = action.tile;
        note(s, { kind: 'pirate', player: actorId });
      } else {
        if (action.tile === s.board.raider) throw new IllegalMove('move the raider to another tile');
        if (s.chasing && s.board.numbers[action.tile] === null) throw new IllegalMove('chase the raider to a numbered tile');
        s.chasing = false;
        s.board.raider = action.tile;
        note(s, { kind: 'raider', player: actorId });
      }
      raiderStep(s, action.tile);
      break;
    }
    case 'STEAL': {
      if (s.phase !== 'steal' || !s.stealFrom.includes(action.from)) throw new IllegalMove("you can't rob that player");
      steal(s, action.from);
      break;
    }
    case 'BUILD_ROAD': {
      const free = s.phase === 'setup' || s.phase === 'roadworks';
      if (s.phase === 'setup' ? !s.setup!.needRoad : s.phase !== 'main' && s.phase !== 'roadworks' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalRoadSpots(s, actorId).includes(action.edge)) throw new IllegalMove("you can't build a road there");
      if (count(s, actorId, 'road') >= LIMITS.road) throw new IllegalMove('you have no roads left');
      if (!free) payCost(s, me, COSTS.road);
      s.roads[action.edge] = actorId;
      note(s, { kind: 'build', player: actorId, piece: 'road' });
      if (s.phase === 'setup') advanceSetup(s);
      else {
        if (s.phase === 'roadworks') {
          s.freeRoads -= 1;
          if (s.freeRoads <= 0 || legalRoadSpots(s, actorId).length + legalShipSpots(s, actorId).length === 0 || count(s, actorId, 'road') >= LIMITS.road) {
            s.freeRoads = 0;
            s.phase = 'main';
          }
        }
        updateLongestRoad(s);
      }
      break;
    }
    case 'BUILD_HOMESTEAD': {
      if (s.phase === 'setup' ? s.setup!.needRoad : s.phase !== 'main' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalHomesteadSpots(s, actorId).includes(action.vertex)) throw new IllegalMove("you can't build a homestead there");
      if (count(s, actorId, 'homestead') >= LIMITS.homestead) throw new IllegalMove('you have no homesteads left');
      if (s.phase !== 'setup') payCost(s, me, COSTS.homestead);
      // Wardens: the second setup placement is a town.
      const asTown = s.phase === 'setup' && s.mode === 'wardens' && s.setup!.step >= s.players.length;
      s.buildings[action.vertex] = { player: actorId, town: asTown };
      note(s, { kind: 'build', player: actorId, piece: 'homestead' });
      if (s.phase === 'setup') {
        // The second homestead collects one card from each producing tile around it.
        if (s.setup!.step >= s.players.length) {
          const cards: Partial<Hand> = {};
          for (const t of geoFor(s).vertices[action.vertex].tiles) {
            const r = YIELD[s.board.terrain[t]];
            if (r && s.bank[r] > 0) {
              me.hand[r] += 1;
              s.bank[r] -= 1;
              cards[r] = (cards[r] ?? 0) + 1;
            }
          }
          if (handSize(cards)) note(s, { kind: 'produce', player: actorId, cards });
        }
        s.setup = { ...s.setup!, needRoad: true, last: action.vertex };
      } else {
        landfall(s, actorId, action.vertex);
        updateLongestRoad(s);
      }
      break;
    }
    case 'BUILD_SHIP': {
      const free = s.phase === 'setup' || s.phase === 'roadworks';
      if (s.mode !== 'sea') throw new IllegalMove('no ships in this game');
      if (s.phase === 'setup' ? !s.setup!.needRoad : s.phase !== 'main' && s.phase !== 'roadworks' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalShipSpots(s, actorId).includes(action.edge)) throw new IllegalMove("you can't build a ship there");
      if (count(s, actorId, 'ship') >= LIMITS.ship) throw new IllegalMove('you have no ships left');
      if (!free) payCost(s, me, COSTS.ship);
      s.ships[action.edge] = actorId;
      s.newShips.push(action.edge);
      note(s, { kind: 'build', player: actorId, piece: 'ship' });
      if (s.phase === 'setup') advanceSetup(s);
      else {
        if (s.phase === 'roadworks') {
          s.freeRoads -= 1;
          if (s.freeRoads <= 0) s.phase = 'main';
        }
        updateLongestRoad(s);
      }
      break;
    }
    case 'MOVE_SHIP': {
      if (s.phase !== 'main') throw new IllegalMove('not now');
      if (!movableShips(s, actorId).includes(action.from)) throw new IllegalMove("that ship can't move");
      if (!legalShipSpots(s, actorId, action.from).includes(action.to)) throw new IllegalMove("the ship can't go there");
      s.ships[action.from] = null;
      s.ships[action.to] = actorId;
      s.shipMoved = true;
      note(s, { kind: 'move-ship', player: actorId });
      updateLongestRoad(s);
      break;
    }
    case 'PICK_GOLD': {
      const due = s.gold[0];
      if (s.phase !== 'gold' || due?.player !== actorId) throw new IllegalMove('no gold to pick');
      const cards = clean(action.cards);
      if (handSize(cards) !== Math.min(due.count, handSize(s.bank))) throw new IllegalMove(`pick ${due.count} cards`);
      if (!RESOURCES.every((r) => s.bank[r] >= (cards[r] ?? 0))) throw new IllegalMove("the bank doesn't have those");
      for (const r of RESOURCES) {
        s.bank[r] -= cards[r] ?? 0;
        me.hand[r] += cards[r] ?? 0;
      }
      note(s, { kind: 'produce', player: actorId, cards });
      s.gold.shift();
      if (s.gold.length === 0) s.phase = 'main';
      break;
    }
    case 'BUILD_TOWN': {
      if (s.phase !== 'main' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalTownSpots(s, actorId).includes(action.vertex)) throw new IllegalMove('build a town on one of your homesteads');
      if (count(s, actorId, 'town') >= LIMITS.town) throw new IllegalMove('you have no towns left');
      payCost(s, me, s.perks?.physician ? WARDEN_COSTS.physician : COSTS.town);
      if (s.perks) s.perks.physician = false;
      s.buildings[action.vertex] = { player: actorId, town: true };
      note(s, { kind: 'build', player: actorId, piece: 'town' });
      break;
    }
    case 'BUY_CHARTER': {
      if (s.mode === 'wardens') throw new IllegalMove('there are no charter cards in Wardens');
      if (s.phase !== 'main' && s.phase !== 'special') throw new IllegalMove('not now');
      if (s.deck.length === 0) throw new IllegalMove('the charter deck is empty');
      payCost(s, me, COSTS.charter);
      me.charters.push({ card: s.deck.shift()!, bought: s.round });
      note(s, { kind: 'buy', player: actorId, piece: 'charter' });
      break;
    }
    case 'PLAY_CHARTER': {
      if (s.phase !== 'main' && !(s.phase === 'roll' && action.card === 'ranger')) throw new IllegalMove('not now');
      if (s.playedCharter) throw new IllegalMove('you have already played a charter card this turn');
      const k = me.charters.findIndex((c) => c.card === action.card && c.bought < s.round);
      if (k < 0) throw new IllegalMove("you have no such card you can play yet");
      const take = action.take ?? [];
      if (action.card === 'bounty') {
        if (take.length !== 2 || !take.every((r) => RESOURCES.includes(r))) throw new IllegalMove('choose two cards');
        const want = emptyHand();
        for (const r of take) want[r] += 1;
        if (!RESOURCES.every((r) => s.bank[r] >= want[r])) throw new IllegalMove("the bank doesn't have those");
      }
      if (action.card === 'market' && (take.length !== 1 || !RESOURCES.includes(take[0]))) throw new IllegalMove('name one resource');
      me.charters.splice(k, 1);
      s.playedCharter = true;
      note(s, { kind: 'play', player: actorId, card: action.card });
      switch (action.card) {
        case 'ranger':
          me.rangers += 1;
          updateGuard(s, actorId);
          s.afterRaider = s.phase === 'roll' ? 'roll' : 'main';
          s.phase = 'raider';
          break;
        case 'roadworks':
          s.freeRoads = Math.min(2, LIMITS.road - count(s, actorId, 'road') + (s.mode === 'sea' ? LIMITS.ship - count(s, actorId, 'ship') : 0));
          if (s.freeRoads > 0 && legalRoadSpots(s, actorId).length + legalShipSpots(s, actorId).length > 0) s.phase = 'roadworks';
          else s.freeRoads = 0;
          break;
        case 'bounty':
          for (const r of take) {
            s.bank[r] -= 1;
            me.hand[r] += 1;
          }
          break;
        case 'market': {
          const r = take[0];
          let got = 0;
          for (const p of s.players) {
            if (p === me || p.out) continue;
            got += p.hand[r];
            p.hand[r] = 0;
          }
          me.hand[r] += got;
          note(s, { kind: 'trade', player: actorId, cards: { [r]: got } });
          break;
        }
      }
      break;
    }
    case 'BANK_TRADE': {
      if (s.phase !== 'main') throw new IllegalMove('not now');
      const { give, get } = action;
      if (give === get) throw new IllegalMove('trade one card for another');
      if ((isGood(give) || isGood(get)) && s.mode !== 'wardens') throw new IllegalMove('no commodities in this game');
      const n = bankRatio(s, actorId, give);
      const have = isGood(give) ? me.goods[give] : me.hand[give];
      if (have < n) throw new IllegalMove(`you need ${n} ${give}`);
      if ((isGood(get) ? s.goodsBank[get] : s.bank[get]) < 1) throw new IllegalMove(`the bank has no ${get}`);
      if (isGood(give)) {
        me.goods[give] -= n;
        s.goodsBank[give] += n;
      } else {
        me.hand[give] -= n;
        s.bank[give] += n;
      }
      if (isGood(get)) {
        s.goodsBank[get] -= 1;
        me.goods[get] += 1;
      } else {
        s.bank[get] -= 1;
        me.hand[get] += 1;
      }
      note(s, { kind: 'bank', player: actorId, paid: isGood(give) ? {} : { [give]: n }, cards: isGood(get) ? {} : { [get]: 1 }, goods: isGood(get) ? { [get]: 1 } : undefined });
      break;
    }
    case 'BUILD_WARDEN':
    case 'MUSTER':
    case 'PROMOTE':
    case 'MOVE_WARDEN':
    case 'CHASE':
    case 'IMPROVE':
    case 'BUILD_WALL':
    case 'PLAY_EDICT':
      wardensAction(s, me, action);
      break;
    case 'HARBOR': {
      if (s.mode !== 'wardens' || s.phase !== 'main') throw new IllegalMove('not now');
      const left = s.perks.harbor ?? [];
      if (!left.includes(action.target)) throw new IllegalMove('no Commercial Harbour trade with that player now');
      if (!RESOURCES.includes(action.give) || me.hand[action.give] < 1) throw new IllegalMove('offer a resource you hold');
      s.perks.harbor = left.filter((x) => x !== action.target);
      const them = s.players.find((p) => p.id === action.target)!;
      // Nobody can be made to give a commodity they don't have: the card stays with you.
      if (goodsSize(them.goods) === 0) {
        note(s, { kind: 'harbor', player: actorId, target: them.id, text: 'none' });
        break;
      }
      me.hand[action.give] -= 1;
      them.hand[action.give] += 1;
      (s.asks ??= []).push({ kind: 'harbor', player: them.id, to: actorId });
      runAsks(s);
      break;
    }
    case 'OFFER': {
      if (s.phase !== 'main') throw new IllegalMove('not now');
      const give = clean(action.give);
      const get = clean(action.get);
      // Wardens: commodities trade between players like resources.
      const giveGoods = s.mode === 'wardens' ? cleanGoods(action.giveGoods) : {};
      const getGoods = s.mode === 'wardens' ? cleanGoods(action.getGoods) : {};
      if (!(handSize(give) + goodsSize(giveGoods)) || !(handSize(get) + goodsSize(getGoods))) throw new IllegalMove('offer something for something');
      if (RESOURCES.some((r) => (give[r] ?? 0) > 0 && (get[r] ?? 0) > 0) || COMMODITIES.some((c) => (giveGoods[c] ?? 0) > 0 && (getGoods[c] ?? 0) > 0)) {
        throw new IllegalMove("don't ask for what you're giving");
      }
      if (!canPay(me.hand, give) || !hasGoods(me.goods, giveGoods)) throw new IllegalMove("you don't have those cards");
      const asked: string[] = [];
      for (let k = 1; k < s.players.length; k++) {
        const p = s.players[(s.turn + k) % s.players.length];
        if (!p.out && canPay(p.hand, get) && hasGoods(p.goods, getGoods)) asked.push(p.id);
      }
      s.offer = { from: actorId, give, get, ...(s.mode === 'wardens' ? { giveGoods, getGoods } : {}), asked, answers: {} };
      note(s, { kind: 'offer', player: actorId, paid: give, cards: get, ...(s.mode === 'wardens' ? { paidGoods: giveGoods, goods: getGoods } : {}) });
      if (asked.length === 0) closeOffer(s, null);
      else s.phase = 'offer';
      break;
    }
    case 'ANSWER': {
      if (s.phase !== 'offer' || s.offer!.asked[0] !== actorId) throw new IllegalMove('nothing to answer');
      s.offer!.answers[actorId] = action.accept && canPay(me.hand, s.offer!.get) && hasGoods(me.goods, s.offer!.getGoods);
      s.offer!.asked.shift();
      if (s.offer!.asked.length === 0 && !Object.values(s.offer!.answers).some(Boolean)) closeOffer(s, null);
      break;
    }
    case 'CLOSE_OFFER':
      if (s.phase !== 'offer' || s.offer!.from !== actorId) throw new IllegalMove('no offer of yours is open');
      closeOffer(s, action.with);
      break;
    case 'END_TURN':
      if (s.phase === 'special') {
        // Done building out of turn.
        s.special.shift();
        if (s.special.length === 0) startTurn(s, nextSeat(s, s.turn));
        break;
      }
      if (s.phase !== 'main') throw new IllegalMove('finish what you started first');
      // Wardens: more than 4 edicts at the end of your turn: put the extra back first.
      if (s.mode === 'wardens' && me.edicts.length > EDICT_LIMIT) {
        for (let k = EDICT_LIMIT; k < me.edicts.length; k++) (s.asks ??= []).push({ kind: 'edict-limit', player: actorId });
        s.resume = [...(s.resume ?? []), 'end'];
        runAsks(s);
        break;
      }
      endTurn(s);
      break;
  }
  return finish(s);
}

const clean = (h: Partial<Hand>): Partial<Hand> => Object.fromEntries(RESOURCES.filter((r) => (h[r] ?? 0) > 0).map((r) => [r, Math.floor(h[r]!)]));
const cleanGoods = (g: Partial<Goods> | undefined): Partial<Goods> => Object.fromEntries(COMMODITIES.filter((c) => (g?.[c] ?? 0) > 0).map((c) => [c, Math.floor(g![c]!)]));
const hasGoods = (have: Goods, want: Partial<Goods> | undefined) => COMMODITIES.every((c) => have[c] >= (want?.[c] ?? 0));

function closeOffer(s: HxState, withId: string | null, counter = false) {
  const o = s.offer!;
  s.offer = null;
  s.phase = 'main';
  if (!withId) return;
  if (counter) {
    // The offerer takes that player's counter-offer: its terms are from their side.
    const c = o.counters?.[withId];
    if (!c) throw new IllegalMove('that player made no counter-offer');
    const a = s.players.find((p) => p.id === o.from)!;
    const b = s.players.find((p) => p.id === withId)!;
    if (!canPay(b.hand, c.give) || !canPay(a.hand, c.get)) return;
    for (const r of RESOURCES) {
      const g = c.give[r] ?? 0;
      const w = c.get[r] ?? 0;
      b.hand[r] += w - g;
      a.hand[r] += g - w;
    }
    note(s, { kind: 'trade', player: o.from, target: withId, paid: c.get, cards: c.give });
    return;
  }
  if (!o.answers[withId]) throw new IllegalMove('that player did not accept');
  const a = s.players.find((p) => p.id === o.from)!;
  const b = s.players.find((p) => p.id === withId)!;
  if (!canPay(a.hand, o.give) || !canPay(b.hand, o.get) || !hasGoods(a.goods, o.giveGoods) || !hasGoods(b.goods, o.getGoods)) return;
  for (const r of RESOURCES) {
    const g = o.give[r] ?? 0;
    const w = o.get[r] ?? 0;
    a.hand[r] += w - g;
    b.hand[r] += g - w;
  }
  for (const c of COMMODITIES) {
    const g = o.giveGoods?.[c] ?? 0;
    const w = o.getGoods?.[c] ?? 0;
    a.goods[c] += w - g;
    b.goods[c] += g - w;
  }
  note(s, { kind: 'trade', player: o.from, target: withId, paid: o.give, cards: o.get, ...(o.giveGoods ? { paidGoods: o.giveGoods, goods: o.getGoods } : {}) });
}

// ---------------- Wardens: choices owed by players ----------------

/** Cards a player picked from a hand: exactly `n`, all of them held. */
function picked(p: HxPlayer, r: Extract<HxAction, { type: 'RESOLVE' }>, n: number): { cards: Partial<Hand>; goods: Partial<Goods> } {
  const cards = clean(r.cards ?? {});
  const goods = cleanGoods(r.goods);
  if (handSize(cards) + goodsSize(goods) !== n || !canPay(p.hand, cards) || !hasGoods(p.goods, goods)) throw new IllegalMove(`choose exactly ${n} of the cards held`);
  return { cards, goods };
}

/** Move cards from one player to another, or to the bank. */
function moveCards(s: HxState, from: HxPlayer, to: HxPlayer | null, cards: Partial<Hand>, goods: Partial<Goods>) {
  for (const r of RESOURCES) {
    from.hand[r] -= cards[r] ?? 0;
    if (to) to.hand[r] += cards[r] ?? 0;
    else s.bank[r] += cards[r] ?? 0;
  }
  for (const c of COMMODITIES) {
    from.goods[c] -= goods[c] ?? 0;
    if (to) to.goods[c] += goods[c] ?? 0;
    else s.goodsBank[c] += goods[c] ?? 0;
  }
}

/** The only way to choose `n` cards from a hand, if there is just one (all of it, or all of one kind). */
function onlyChoice(p: HxPlayer, n: number): Extract<HxAction, { type: 'RESOLVE' }> | null {
  if (cardsHeld(p) <= n) return { type: 'RESOLVE', cards: { ...p.hand }, goods: { ...p.goods } };
  const kinds: Card[] = [...RESOURCES.filter((r) => p.hand[r] > 0), ...COMMODITIES.filter((c) => p.goods[c] > 0)];
  if (kinds.length !== 1) return null;
  const k = kinds[0];
  return isGood(k) ? { type: 'RESOLVE', goods: { [k]: n } } : { type: 'RESOLVE', cards: { [k]: n } };
}

/** An ask with one possible answer (or none) answers itself. */
function autoAnswer(s: HxState, a: Ask): Extract<HxAction, { type: 'RESOLVE' }> | null {
  const p = s.players.find((x) => x.id === a.player)!;
  const who = (id: string) => s.players.find((x) => x.id === id)!;
  switch (a.kind) {
    case 'discard':
    case 'give':
      return onlyChoice(p, a.count);
    case 'take':
      return cardsHeld(who(a.from)) <= a.count ? { type: 'RESOLVE', cards: { ...who(a.from).hand }, goods: { ...who(a.from).goods } } : null;
    case 'harbor': {
      const kinds = COMMODITIES.filter((c) => p.goods[c] > 0);
      return kinds.length === 1 ? { type: 'RESOLVE', goods: { [kinds[0]]: 1 } } : null;
    }
    case 'spy': {
      const held = who(a.from).edicts;
      return held.length <= 1 ? { type: 'RESOLVE', edict: held[0], skip: held.length === 0 } : null;
    }
    case 'pillage': {
      const towns = pillageable(s, a.player);
      return towns.length <= 1 ? { type: 'RESOLVE', vertex: towns[0], skip: towns.length === 0 } : null;
    }
    case 'draw': {
      const decks = GUILDS.filter((g) => s.edictDecks[g].length > 0);
      return decks.length <= 1 ? { type: 'RESOLVE', guild: decks[0], skip: decks.length === 0 } : null;
    }
    case 'edict-limit':
      return p.edicts.length <= EDICT_LIMIT ? { type: 'RESOLVE', skip: true } : null;
    case 'retreat': {
      const spots = retreatSpots(s, a.player, a.from);
      return spots.length <= 1 ? { type: 'RESOLVE', vertex: spots[0], skip: spots.length === 0 } : null;
    }
    case 'desert': {
      const mine = wardensOf(s, a.player);
      return mine.length <= 1 ? { type: 'RESOLVE', vertex: mine[0], skip: mine.length === 0 } : null;
    }
    case 'enlist':
      return enlistLevel(s, a.player, a.level) === null || legalWardenSpots(s, a.player).length === 0 ? { type: 'RESOLVE', skip: true } : null;
    case 'road':
      return legalRoadSpots(s, a.player).every((e) => e === a.skip) || count(s, a.player, 'road') >= LIMITS.road ? { type: 'RESOLVE', skip: true } : null;
  }
}

/** Apply a player's answer to the first ask (which it removes); follow-up asks go to the front. */
function resolveAsk(s: HxState, a: Ask, r: Extract<HxAction, { type: 'RESOLVE' }>) {
  const p = s.players.find((x) => x.id === a.player)!;
  const who = (id: string) => s.players.find((x) => x.id === id)!;
  s.asks!.shift();
  switch (a.kind) {
    case 'discard': {
      const { cards, goods } = picked(p, r, Math.min(a.count, cardsHeld(p)));
      moveCards(s, p, null, cards, goods);
      note(s, { kind: 'discard', player: p.id, cards, goods });
      return;
    }
    case 'give': {
      const { cards, goods } = picked(p, r, Math.min(a.count, cardsHeld(p)));
      moveCards(s, p, who(a.to), cards, goods);
      note(s, { kind: 'steal', player: a.to, target: p.id, cards, goods, text: 'given', n: handSize(cards) + goodsSize(goods) });
      return;
    }
    case 'take': {
      const from = who(a.from);
      const { cards, goods } = picked(from, r, Math.min(a.count, cardsHeld(from)));
      moveCards(s, from, p, cards, goods);
      note(s, { kind: 'steal', player: p.id, target: from.id, cards, goods, text: 'taken', n: handSize(cards) + goodsSize(goods) });
      return;
    }
    case 'harbor': {
      const goods = cleanGoods(r.goods);
      if (goodsSize(goods) !== 1 || !hasGoods(p.goods, goods)) throw new IllegalMove('give one commodity you hold');
      moveCards(s, p, who(a.to), {}, goods);
      note(s, { kind: 'harbor', player: a.to, target: p.id, goods });
      return;
    }
    case 'spy': {
      const from = who(a.from);
      if (r.skip && from.edicts.length === 0) return;
      const k = r.edict ? from.edicts.indexOf(r.edict) : -1;
      if (k < 0) throw new IllegalMove('take one of their edicts');
      p.edicts.push(from.edicts.splice(k, 1)[0]);
      note(s, { kind: 'edict', player: p.id, target: from.id, text: 'spy' });
      return;
    }
    case 'pillage': {
      const towns = pillageable(s, p.id);
      if (r.skip && towns.length === 0) return;
      if (r.vertex === undefined || !towns.includes(r.vertex)) throw new IllegalMove('choose one of your towns without a Capital');
      s.buildings[r.vertex] = { player: p.id, town: false };
      if (s.walls[r.vertex]) {
        s.walls[r.vertex] = false;
        p.walls -= 1;
      }
      note(s, { kind: 'attack', player: p.id, text: 'pillaged' });
      return;
    }
    case 'draw': {
      if (r.skip && GUILDS.every((g) => s.edictDecks[g].length === 0)) return;
      if (!r.guild || !GUILDS.includes(r.guild) || s.edictDecks[r.guild].length === 0) throw new IllegalMove('choose a deck with cards left');
      drawEdict(s, p, r.guild);
      return;
    }
    case 'edict-limit': {
      if (r.skip && p.edicts.length <= EDICT_LIMIT) return;
      const k = r.edict ? p.edicts.indexOf(r.edict) : -1;
      if (k < 0) throw new IllegalMove('choose one of your edicts to put back');
      const [e] = p.edicts.splice(k, 1);
      s.edictDecks[EDICT_GUILD[e]].push(e);
      note(s, { kind: 'edict', player: p.id, guild: EDICT_GUILD[e], text: 'discard' });
      return;
    }
    case 'retreat': {
      const spots = retreatSpots(s, p.id, a.from);
      if (r.skip && spots.length === 0) {
        note(s, { kind: 'warden', player: p.id, text: 'lost' });
        return;
      }
      if (r.vertex === undefined || !spots.includes(r.vertex)) throw new IllegalMove('choose an empty corner along your roads');
      s.wardens[r.vertex] = a.warden;
      note(s, { kind: 'warden', player: p.id, text: 'retreat' });
      updateLongestRoad(s);
      return;
    }
    case 'desert': {
      const mine = wardensOf(s, p.id);
      if (r.skip && mine.length === 0) return;
      if (r.vertex === undefined || !mine.includes(r.vertex)) throw new IllegalMove('choose one of your wardens');
      const w = s.wardens[r.vertex]!;
      s.wardens[r.vertex] = null;
      note(s, { kind: 'warden', player: p.id, target: a.to, text: 'desert' });
      updateLongestRoad(s);
      s.asks!.unshift({ kind: 'enlist', player: a.to, level: w.level, active: w.active });
      return;
    }
    case 'enlist': {
      if (r.skip) return;
      const level = enlistLevel(s, p.id, a.level);
      if (level === null || r.vertex === undefined || !legalWardenSpots(s, p.id).includes(r.vertex)) throw new IllegalMove('choose an empty corner on your road');
      s.wardens[r.vertex] = { player: p.id, level, active: a.active, since: s.round };
      note(s, { kind: 'warden', player: p.id, text: 'enlist' });
      updateLongestRoad(s);
      return;
    }
    case 'road': {
      if (r.skip) return;
      if (r.edge === undefined || r.edge === a.skip || !legalRoadSpots(s, p.id).includes(r.edge)) throw new IllegalMove('choose another place for the road');
      s.roads[r.edge] = p.id;
      note(s, { kind: 'build', player: p.id, piece: 'road' });
      updateLongestRoad(s);
      return;
    }
  }
}

/** Settle every ask that answers itself; once none are owed, carry on with what they interrupted. */
function runAsks(s: HxState) {
  const asks = (s.asks ??= []);
  while (asks.length) {
    const a = asks[0];
    const p = s.players.find((x) => x.id === a.player);
    if (!p || p.out) {
      asks.shift();
      continue;
    }
    const auto = autoAnswer(s, a);
    if (!auto) return;
    resolveAsk(s, a, auto);
  }
  while (!asks.length && s.resume?.length) {
    const next = s.resume.shift();
    if (next === 'produce') afterRoll(s);
    else if (next === 'end') endTurn(s);
  }
}

/** Roll the dice (or set them, for an Alchemist): the omen die first, then what the numbers pay. */
function roll(s: HxState, actorId: string, dice: [number, number]) {
  s.dice = dice;
  s.rolls[dice[0] + dice[1]] += 1;
  note(s, { kind: 'roll', player: actorId, dice });
  if (s.mode === 'wardens') {
    omen(s, dice[0]);
    // A landing or a fifth edict can need choices; the roll pays out once they are made.
    if (s.asks?.length) {
      s.resume = [...(s.resume ?? []), 'produce'];
      runAsks(s);
      return;
    }
  }
  afterRoll(s);
}

function afterRoll(s: HxState) {
  if (s.over) return;
  const total = s.dice![0] + s.dice![1];
  if (total === 7) {
    const order = [0, 1, 2, 3, 4, 5].slice(0, s.players.length).map((k) => s.players[(s.turn + k) % s.players.length]);
    s.discards = order.filter((p) => !p.out && cardsHeld(p) > handLimit(s, p)).map((p) => p.id);
    s.afterRaider = 'main';
    s.phase = s.discards.length ? 'discard' : raiderNext(s);
  } else {
    produce(s, total);
    s.phase = s.gold?.length ? 'gold' : 'main';
  }
}

/** Keep counts in step, and end the game if the player whose turn it is has 10 points. */
function finish(s: HxState): HxState {
  sync(s);
  if (!s.over && s.phase !== 'setup') {
    const current = s.players[s.turn];
    if (!current.out && victoryPoints(s, current.id) >= winPoints(s)) {
      s.over = true;
      s.phase = 'over';
      s.winner = current.id;
      note(s, { kind: 'win', player: current.id });
    }
  }
  return s;
}

/** After a 7's discards: the raider moves, except in Wardens before the fleet's first landing. */
function raiderNext(s: HxState): Phase {
  return s.mode === 'wardens' && !s.attacked ? 'main' : 'raider';
}

/** Draw an edict from a guild's deck (point edicts are shown and scored at once). Out of
 *  turn, a fifth edict in hand must be put back at once, the holder choosing which. */
function drawEdict(s: HxState, p: HxPlayer, g: Guild) {
  if (s.edictDecks[g].length === 0) return;
  const e = s.edictDecks[g].shift()!;
  if (POINT_EDICTS.includes(e)) {
    p.edictPoints += 1;
    note(s, { kind: 'edict', player: p.id, edict: e, guild: g, text: 'point' });
  } else {
    p.edicts.push(e);
    note(s, { kind: 'edict', player: p.id, guild: g });
    if (p.edicts.length > EDICT_LIMIT && s.players[s.turn].id !== p.id) (s.asks ??= []).unshift({ kind: 'edict-limit', player: p.id });
  }
}

/** Wardens: the omen die. A ship moves the marauders on (and they may land); a gate draws edicts. */
function omen(s: HxState, red: number) {
  const [r, seed] = nextRandom(s.seed);
  s.seed = seed;
  const face = OMEN_FACES[Math.floor(r * OMEN_FACES.length)];
  s.omen = face;
  note(s, { kind: 'omen', omen: face });
  if (face === 'ship') {
    s.marauders += 1;
    if (s.marauders >= MARAUDER_TRACK) attack(s);
    return;
  }
  // A gate: every player whose guild level is at least the red die's value less one draws an edict.
  const n = s.players.length;
  for (let k = 0; k < n; k++) {
    const p = s.players[(s.turn + k) % n];
    if (!p.out && p.guilds[face] >= 1 && red <= p.guilds[face] + 1) drawEdict(s, p, face);
  }
}

/** Wardens: the marauders land. Mustered wardens against the number of towns. */
function attack(s: HxState) {
  const live = s.players.filter((p) => !p.out);
  const power = new Map(live.map((p) => [p.id, (s.wardens ?? []).reduce((t, w) => t + (w && w.player === p.id && w.active ? w.level : 0), 0)]));
  const strength = s.buildings.filter((b) => b?.town).length;
  const defence = [...power.values()].reduce((a, b) => a + b, 0);
  // Choices that follow are made in seat order from the roller.
  const order = Array.from({ length: s.players.length }, (_, k) => s.players[(s.turn + k) % s.players.length]).filter((p) => !p.out);
  const asks = (s.asks ??= []);
  if (defence >= strength) {
    const best = Math.max(...power.values());
    const heroes = live.filter((p) => power.get(p.id) === best && best > 0);
    if (heroes.length === 1) {
      heroes[0].defender += 1;
      note(s, { kind: 'attack', player: heroes[0].id, text: 'defended' });
    } else {
      // A tie for the most: no Defender point; each of them draws an edict from the deck of their choice.
      for (const h of order.filter((p) => heroes.includes(p))) asks.push({ kind: 'draw', player: h.id });
      note(s, { kind: 'attack', text: heroes.length ? 'defended-tie' : 'defended' });
    }
  } else {
    // The weakest defenders who have a town that isn't a Capital each lose one town, of their choice.
    const exposed = live.filter((p) => pillageable(s, p.id).length > 0);
    const low = Math.min(...exposed.map((p) => power.get(p.id)!));
    for (const p of order.filter((x) => exposed.includes(x) && power.get(x.id) === low)) asks.push({ kind: 'pillage', player: p.id });
  }
  for (const w of s.wardens) if (w) w.active = false;
  s.marauders = 0;
  s.attacked = true;
}

/** Wardens: hand a Capital to `id` (it stands on their best town that holds none). */
function crown(s: HxState, id: string, g: Guild) {
  const taken = new Set(GUILDS.flatMap((x) => (s.capitals[x] ? [s.capitals[x]!.vertex] : [])));
  const towns = s.buildings.flatMap((b, v) => (b?.player === id && b.town && !taken.has(v) ? [v] : []));
  if (towns.length === 0) return false;
  const v = towns.reduce((a, b) => (cornerPips(s, b) > cornerPips(s, a) ? b : a));
  s.capitals[g] = { player: id, vertex: v };
  note(s, { kind: 'capital', player: id, guild: g });
  return true;
}

function give(from: HxPlayer, to: HxPlayer, card: Card, n: number): number {
  const have = isGood(card) ? from.goods[card] : from.hand[card];
  const k = Math.min(n, have);
  if (isGood(card)) {
    from.goods[card] -= k;
    to.goods[card] += k;
  } else {
    from.hand[card] -= k;
    to.hand[card] += k;
  }
  return k;
}

/** Wardens' own actions: wardens, improvements, walls and edicts. */
function wardensAction(s: HxState, me: HxPlayer, a: Extract<HxAction, { type: 'BUILD_WARDEN' | 'MUSTER' | 'PROMOTE' | 'MOVE_WARDEN' | 'CHASE' | 'IMPROVE' | 'BUILD_WALL' | 'PLAY_EDICT' }>) {
  if (s.mode !== 'wardens') throw new IllegalMove('not in this game');
  // Edicts check their own timing (the Alchemist goes before the roll).
  if (a.type === 'PLAY_EDICT') return playEdict(s, me, a);
  const building = s.phase === 'main' || (s.phase === 'special' && a.type !== 'MOVE_WARDEN' && a.type !== 'CHASE');
  if (!building) throw new IllegalMove('not now');
  const id = me.id;
  const levels = (lv: number) => s.wardens.filter((w) => w?.player === id && w.level === lv).length;
  switch (a.type) {
    case 'BUILD_WARDEN': {
      if (!legalWardenSpots(s, id).includes(a.vertex)) throw new IllegalMove('recruit a warden on an empty corner of your road');
      if (levels(1) >= WARDENS_PER_LEVEL) throw new IllegalMove('you have no strength-1 wardens left');
      payCost(s, me, WARDEN_COSTS.recruit);
      s.wardens[a.vertex] = { player: id, level: 1, active: false, since: s.round };
      note(s, { kind: 'warden', player: id, text: 'recruit' });
      updateLongestRoad(s);
      return;
    }
    case 'MUSTER': {
      const w = wardenAt(s, a.vertex);
      if (!w || w.player !== id || w.active) throw new IllegalMove('muster one of your resting wardens');
      payCost(s, me, WARDEN_COSTS.muster);
      w.active = true;
      w.since = s.round;
      note(s, { kind: 'warden', player: id, text: 'muster' });
      return;
    }
    case 'PROMOTE': {
      const w = wardenAt(s, a.vertex);
      if (!w || w.player !== id || w.level >= 3) throw new IllegalMove('promote one of your wardens below strength 3');
      if (w.promoted === s.round) throw new IllegalMove('a warden is promoted only once a turn');
      if (w.level === 2 && me.guilds.council < 3) throw new IllegalMove('strength 3 needs the Council at level 3');
      if (levels(w.level + 1) >= WARDENS_PER_LEVEL) throw new IllegalMove('you have no wardens of that strength left');
      if (s.perks.smith > 0) s.perks.smith -= 1;
      else payCost(s, me, WARDEN_COSTS.promote);
      w.level = (w.level + 1) as 2 | 3;
      w.promoted = s.round;
      note(s, { kind: 'warden', player: id, text: 'promote' });
      return;
    }
    case 'MOVE_WARDEN': {
      if (!wardenMoves(s, id, a.from).includes(a.to)) throw new IllegalMove("that warden can't go there");
      const w = wardenAt(s, a.from)!;
      const rival = wardenAt(s, a.to);
      s.wardens[a.from] = null;
      s.wardens[a.to] = { ...w, active: false };
      if (rival) {
        // The weaker warden's owner moves it to an empty corner along their roads (or it leaves the board).
        note(s, { kind: 'warden', player: id, target: rival.player, text: 'displace' });
        (s.asks ??= []).push({ kind: 'retreat', player: rival.player, from: a.to, warden: rival });
        runAsks(s);
      } else note(s, { kind: 'warden', player: id, text: 'move' });
      updateLongestRoad(s);
      return;
    }
    case 'CHASE': {
      if (!chasers(s, id).includes(a.vertex)) throw new IllegalMove('that warden is not beside the raider');
      wardenAt(s, a.vertex)!.active = false;
      s.afterRaider = 'main';
      s.chasing = true;
      s.phase = 'raider';
      note(s, { kind: 'warden', player: id, text: 'chase' });
      return;
    }
    case 'IMPROVE': {
      const cost = improveCost(s, id, a.guild);
      if (cost === null) throw new IllegalMove("you can't improve that guild");
      const good = GUILD_GOOD[a.guild];
      if (me.goods[good] < cost) throw new IllegalMove(`you need ${cost} ${good}`);
      const next = me.guilds[a.guild] + 1;
      // The Capital: the first to level 4 takes it; reaching 5 first takes it from a holder still at 4.
      const holder = s.capitals[a.guild];
      const wantsCapital = (next === CAPITAL_LEVEL && !holder) || (next === MAX_LEVEL && holder && holder.player !== id);
      if (wantsCapital && !s.buildings.some((b, v) => b?.player === id && b.town && !GUILDS.some((g) => s.capitals[g]?.vertex === v))) {
        throw new IllegalMove('you need a town without a Capital to hold it');
      }
      me.goods[good] -= cost;
      s.goodsBank[good] += cost;
      me.guilds[a.guild] = next;
      s.perks.crane = false;
      note(s, { kind: 'improve', player: id, guild: a.guild });
      if (wantsCapital) crown(s, id, a.guild);
      return;
    }
    case 'BUILD_WALL': {
      if (s.buildings[a.vertex]?.player !== id || !s.buildings[a.vertex]!.town || s.walls[a.vertex]) throw new IllegalMove('build a wall around one of your towns');
      if (me.walls >= MAX_WALLS) throw new IllegalMove('you have no walls left');
      payCost(s, me, WARDEN_COSTS.wall);
      s.walls[a.vertex] = true;
      me.walls += 1;
      note(s, { kind: 'build', player: id, text: 'wall' });
      return;
    }
  }
}

function playEdict(s: HxState, me: HxPlayer, a: Extract<HxAction, { type: 'PLAY_EDICT' }>) {
  const k = me.edicts.indexOf(a.edict);
  if (k < 0) throw new IllegalMove("you don't hold that edict");
  if (s.players[s.turn].id !== me.id) throw new IllegalMove('play edicts on your own turn');
  // Every edict is played after the roll, except the Alchemist, which is played instead of it.
  if (a.edict === 'alchemist' ? s.phase !== 'roll' : s.phase !== 'main') {
    throw new IllegalMove(a.edict === 'alchemist' ? 'play the Alchemist before you roll' : 'play edicts after rolling, on your turn');
  }
  // Seat order from you: the order in which other players answer.
  const others = Array.from({ length: s.players.length - 1 }, (_, i) => s.players[(seatOf(s, me.id) + 1 + i) % s.players.length]).filter((p) => !p.out);
  const points = (p: HxPlayer) => victoryPoints(s, p.id, false);
  const geo = geoFor(s);
  const mineTiles = (terrain: string) => new Set(geo.tiles.flatMap((t, i) => (s.board.terrain[i] === terrain && t.corners.some((c) => s.buildings[c]?.player === me.id) ? [i] : [])));
  const take = a.take ?? [];
  const asks = (s.asks ??= []);
  const pickPlayer = () => {
    const p = others.find((x) => x.id === a.target);
    if (!p) throw new IllegalMove('choose a player');
    return p;
  };
  // The card leaves your hand for the bottom of its deck, then takes effect.
  me.edicts.splice(k, 1);
  s.edictDecks[EDICT_GUILD[a.edict]].push(a.edict);
  note(s, { kind: 'edict', player: me.id, edict: a.edict, text: 'play' });
  switch (a.edict) {
    case 'alchemist': {
      const d = a.dice;
      if (!d || d.length !== 2 || !d.every((x) => Number.isInteger(x) && x >= 1 && x <= 6)) throw new IllegalMove('choose both dice, 1 to 6');
      roll(s, me.id, [d[0], d[1]]);
      return;
    }
    case 'inventor': {
      const [x, y] = a.tiles ?? [-1, -1];
      const n = s.board.numbers;
      const movable = (t: number) => Number.isInteger(t) && t >= 0 && t < n.length && n[t] !== null && !FIXED_TOKENS.includes(n[t]!);
      if (x === y || !movable(x) || !movable(y)) throw new IllegalMove('choose two number tokens other than a 2, 12, 6 or 8');
      note(s, { kind: 'swap', player: me.id, text: `${n[x]} and ${n[y]}` });
      [n[x], n[y]] = [n[y], n[x]];
      return;
    }
    case 'irrigation':
    case 'mining': {
      const r: Resource = a.edict === 'irrigation' ? 'grain' : 'stone';
      const n = Math.min(s.bank[r], 2 * mineTiles(a.edict === 'irrigation' ? 'fields' : 'mountains').size);
      s.bank[r] -= n;
      me.hand[r] += n;
      return;
    }
    case 'engineer': {
      const v = a.vertex ?? -1;
      if (s.buildings[v]?.player !== me.id || !s.buildings[v]!.town || s.walls[v] || me.walls >= MAX_WALLS) throw new IllegalMove('choose one of your towns without a wall');
      s.walls[v] = true;
      me.walls += 1;
      return;
    }
    case 'roadbuilding':
      s.freeRoads = Math.min(2, LIMITS.road - count(s, me.id, 'road'));
      if (s.freeRoads > 0 && legalRoadSpots(s, me.id).length > 0) s.phase = 'roadworks';
      else s.freeRoads = 0;
      return;
    case 'medicine':
      s.perks.physician = true;
      return;
    case 'smith':
      s.perks.smith = 2;
      return;
    case 'crane':
      s.perks.crane = true;
      return;
    case 'warlord':
      for (const w of s.wardens) if (w?.player === me.id && !w.active) Object.assign(w, { active: true, since: s.round });
      return;
    case 'bishop':
      if (!s.attacked) throw new IllegalMove('the raider stays put until the marauders first land');
      s.bishop = true;
      s.afterRaider = 'main';
      s.phase = 'raider';
      return;
    case 'deserter': {
      const p = pickPlayer();
      if (wardensOf(s, p.id).length === 0) throw new IllegalMove('that player has no wardens');
      asks.push({ kind: 'desert', player: p.id, to: me.id });
      runAsks(s);
      return;
    }
    case 'diplomat': {
      const e = a.edge ?? -1;
      if (!openRoads(s).includes(e)) throw new IllegalMove('choose an open road: one with nothing of its owner at one end');
      const owner = s.roads[e]!;
      s.roads[e] = null;
      note(s, { kind: 'unroad', player: me.id, target: owner });
      updateLongestRoad(s);
      if (owner === me.id) {
        asks.push({ kind: 'road', player: me.id, skip: e });
        runAsks(s);
      }
      return;
    }
    case 'intrigue': {
      const v = a.vertex ?? -1;
      const w = wardenAt(s, v);
      if (!w || w.player === me.id || !geo.vertices[v].edges.some((e) => s.roads[e] === me.id)) throw new IllegalMove("choose a rival's warden on a corner touching your road");
      s.wardens[v] = null;
      note(s, { kind: 'warden', player: me.id, target: w.player, text: 'displace' });
      asks.push({ kind: 'retreat', player: w.player, from: v, warden: w });
      runAsks(s);
      updateLongestRoad(s);
      return;
    }
    case 'saboteur':
      for (const p of others) if (points(p) >= points(me) && Math.floor(cardsHeld(p) / 2) > 0) asks.push({ kind: 'discard', player: p.id, count: Math.floor(cardsHeld(p) / 2) });
      runAsks(s);
      return;
    case 'wedding':
      for (const p of others) if (points(p) > points(me) && cardsHeld(p) > 0) asks.push({ kind: 'give', player: p.id, to: me.id, count: 2 });
      runAsks(s);
      return;
    case 'spy': {
      const p = pickPlayer();
      if (p.edicts.length === 0) throw new IllegalMove('that player holds no edicts');
      asks.push({ kind: 'spy', player: me.id, from: p.id });
      runAsks(s);
      return;
    }
    case 'merchant': {
      const t = a.tile ?? -1;
      if (!(t >= 0 && t < geo.tiles.length) || !isLand(s.board.terrain[t]) || !geo.tiles[t].corners.some((c) => s.buildings[c]?.player === me.id)) {
        throw new IllegalMove('put the merchant on a land tile next to your homestead or town');
      }
      s.merchant = { player: me.id, tile: t };
      return;
    }
    case 'commercial-harbor':
      s.perks.harbor = others.map((p) => p.id);
      return;
    case 'resource-monopoly': {
      const r = take[0];
      if (!r || isGood(r) || !RESOURCES.includes(r)) throw new IllegalMove('name a resource');
      for (const p of others) give(p, me, r, 2);
      return;
    }
    case 'trade-monopoly': {
      const c = take[0];
      if (!c || !isGood(c)) throw new IllegalMove('name a commodity');
      for (const p of others) give(p, me, c, 1);
      return;
    }
    case 'merchant-fleet': {
      const c = take[0];
      if (!c || !(isGood(c) || RESOURCES.includes(c))) throw new IllegalMove('name a resource or commodity');
      s.perks.fleet = c;
      return;
    }
    case 'master-merchant': {
      const p = pickPlayer();
      if (points(p) <= points(me)) throw new IllegalMove('choose a player with more points than you');
      asks.push({ kind: 'take', player: me.id, from: p.id, count: 2 });
      runAsks(s);
      return;
    }
    default:
      throw new IllegalMove('that edict is played the moment it is drawn');
  }
}

function forfeit(prev: HxState, id: string): HxState {
  const k = seatOf(prev, id);
  if (k < 0 || prev.players[k].out || prev.over) return prev;
  const s = structuredClone(prev);
  const p = s.players[k];
  p.out = true;
  for (const r of RESOURCES) {
    s.bank[r] += p.hand[r];
    p.hand[r] = 0;
  }
  for (const c of COMMODITIES) {
    s.goodsBank[c] += p.goods[c];
    p.goods[c] = 0;
  }
  note(s, { kind: 'out', player: id });
  const live = s.players.filter((x) => !x.out);
  if (live.length === 1) {
    s.over = true;
    s.phase = 'over';
    s.winner = live[0].id;
    return sync(s);
  }
  s.discards = s.discards.filter((x) => x !== id);
  s.stealFrom = s.stealFrom.filter((x) => x !== id);
  s.special = s.special.filter((x) => x !== id);
  s.gold = (s.gold ?? []).filter((x) => x.player !== id);
  if (s.offer) {
    s.offer.asked = s.offer.asked.filter((x) => x !== id);
    if (s.offer.from === id) closeOffer(s, null);
  }
  // Wardens: choices owed by, or about, the player who left fall away.
  const involves = (a: Ask) => a.player === id || ((a.kind === 'take' || a.kind === 'spy') && a.from === id) || ((a.kind === 'give' || a.kind === 'harbor' || a.kind === 'desert') && a.to === id);
  const pending = (s.asks ?? []).length > 0;
  s.asks = (s.asks ?? []).filter((a) => !involves(a));
  if (s.merchant?.player === id) s.merchant = null;
  if (pending) {
    // A turn that was waiting on choices ends once they are made.
    if (s.turn === k && s.phase !== 'setup') s.resume = [...(s.resume ?? []), 'end'];
    runAsks(s);
    return finish(s);
  }
  if (s.phase === 'setup' && hexActor(s) === id) advanceSetup(s);
  else if (s.phase === 'discard' && s.discards.length === 0) s.phase = 'raider';
  else if (s.phase === 'special' && s.special.length === 0) startTurn(s, nextSeat(s, s.turn));
  else if (s.phase === 'gold' && s.gold.length === 0) s.phase = 'main';
  else if (s.turn === k && s.phase !== 'setup') startTurn(s, nextSeat(s, k));
  return finish(s);
}

/** A player's view: others' hands and charter cards become counts, a robbery
 *  names its card only to the two players in it, and the deck is hidden. */
export function redactHex(s: HxState, viewer: string): HxState {
  // Wardens: a Master Merchant is shown the other player's cards, a Spy their edicts, while choosing.
  const ask = s.asks?.[0];
  const shown = ask && ask.player === viewer && (ask.kind === 'take' || ask.kind === 'spy') ? ask : null;
  return {
    ...s,
    seed: 0,
    deck: [],
    edictDecks: { trade: [], council: [], academy: [] },
    players: s.players.map((p) => {
      if (p.id === viewer || s.over) return p;
      const hidden = { ...p, hand: emptyHand(), charters: [], goods: emptyGoods(), edicts: [] };
      if (shown?.from !== p.id) return hidden;
      return shown.kind === 'take' ? { ...hidden, hand: p.hand, goods: p.goods } : { ...hidden, edicts: p.edicts };
    }),
    log: s.log.map((e) => (e.kind === 'steal' && e.player !== viewer && e.target !== viewer ? { ...e, cards: undefined, goods: undefined } : e)),
  };
}

export const hexKit: GameKit<HxState, HxAction> = {
  seatError(count, options) {
    if ((options as HxOptions | undefined)?.mode === 'sea') return count >= 3 && count <= 4 ? null : 'Open Sea is for 3 or 4 players';
    if ((options as HxOptions | undefined)?.mode === 'wardens') return count >= 3 && count <= 4 ? null : 'Wardens is for 3 or 4 players';
    return count >= MIN_SEATS && count <= MAX_SEATS ? null : `Hexstead is for ${MIN_SEATS} to ${MAX_SEATS} players`;
  },
  create: (seats, seed, options) => createHexstead(seats, seed, options),
  apply: applyHex,
  actor: hexActor,
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand = Math.random) => hexBot(s, rand),
  // An idle player: ends the turn, declines or withdraws an offer; other steps are played sensibly for them.
  timeout(s) {
    // An owed choice is made sensibly for an idle player.
    if (s.asks?.length) return hexBot(s, Math.random);
    if (s.phase === 'main' || s.phase === 'special') return { type: 'END_TURN' };
    if (s.phase === 'offer') return s.offer!.asked.length ? { type: 'ANSWER', accept: false } : { type: 'CLOSE_OFFER', with: null };
    return hexBot(s, Math.random);
  },
  botDelay: (s) => (s.phase === 'setup' ? 800 : s.asks?.length || s.phase === 'offer' || s.phase === 'discard' ? 650 : 700),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit,
  end: (s) => {
    if (s.over) return s;
    const t = structuredClone(s);
    finishByPoints(t);
    return sync(t);
  },
  redact: redactHex,
  turnMs: 60_000,
};
