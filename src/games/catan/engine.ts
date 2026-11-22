/**
 * Catan: settle a hex island, trade, and build to 10 points. 3 or 4 players.
 *
 * Setup: in snake order (1, 2, 3, then 3, 2, 1) each player places a settlement
 * and a road beside it; the second settlement collects a card from each tile
 * around it. A turn: roll two dice; every tile showing the total pays its
 * neighbours (1 per settlement, 2 per city) unless the robber stands on it. A 7
 * pays nothing: players holding more than 7 cards discard half, and the roller
 * moves the robber and steals a card. Then trade (with the bank, harbours or
 * other players), build, buy and play development cards, and end the turn.
 *
 * Every step that needs someone else (a discard, an answer to an offer) is
 * asked of one player at a time, so the game always has one actor.
 */
import { IllegalMove, nextRandom, shuffle, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';
import { PIPS, RESOURCES, YIELD, geoOf, isLand, makeBoard, type Board, type Layout, type Resource } from './board';
import {
  METROPOLIS_LEVEL,
  COMMODITIES,
  PROGRESS_DECKS,
  PROGRESS_AREA,
  PROGRESS_LIMIT,
  FIXED_TOKENS,
  GOODS_BANK,
  AREAS,
  AREA_GOOD,
  BARBARIAN_TRACK,
  MAX_LEVEL,
  MAX_WALLS,
  MERCHANT_POINTS,
  EVENT_DIE_FACES,
  POINT_PROGRESS_CARDS,
  CITY_GOOD,
  KNIGHTS_PER_LEVEL,
  CITIES_KNIGHTS_WIN_POINTS,
  emptyGoods,
  goodsSize,
  type Card,
  type Commodity,
  type ProgressCard,
  type Goods,
  type Area,
  type EventDie,
  type Knight,
} from './citiesKnights';
import { catanBot } from './bot';

export type { Resource } from './board';
export type Hand = Record<Resource, number>;
export type DevCard = 'knight' | 'victoryPoint' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';
export type Piece = 'road' | 'settlement' | 'city' | 'devCard' | 'ship';
/** base: the island game. seafarers: Seafarers, with ships and outer islands. cities-knights: cities, areas and the barbarian ship. */
export type CatanMode = 'base' | 'seafarers' | 'cities-knights';

export const COSTS: Record<Piece, Partial<Hand>> = {
  road: { lumber: 1, brick: 1 },
  settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  devCard: { wool: 1, grain: 1, ore: 1 },
  ship: { lumber: 1, wool: 1 },
};
/** Cities & Knights' prices. */
export const KNIGHT_COSTS = {
  hire: { wool: 1, ore: 1 } as Partial<Hand>,
  activate: { grain: 1 } as Partial<Hand>,
  promote: { wool: 1, ore: 1 } as Partial<Hand>,
  wall: { brick: 2 } as Partial<Hand>,
  /** A city with a Physician progress card. */
  medicine: { ore: 2, grain: 1 } as Partial<Hand>,
};
/** Pieces each player owns. */
export const LIMITS = { road: 15, settlement: 5, city: 4, ship: 15 };
/** Cards of each resource in the bank: 19, or 24 at a table of 5 or 6. */
export const BANK: Record<Layout, number> = { standard: 19, large: 24, newShores: 19 };
export const WIN_POINTS = 10;
/** Seafarers plays to more points: the outer islands add island bonuses. */
export const SEAFARERS_WIN_POINTS = 13;
/** Points for a player's first settlement on each outer island. */
export const ISLAND_BONUS_POINTS = 2;
export const winPoints = (s: { mode?: CatanMode }) => (s.mode === 'seafarers' ? SEAFARERS_WIN_POINTS : s.mode === 'cities-knights' ? CITIES_KNIGHTS_WIN_POINTS : WIN_POINTS);
const MIN_SEATS = 3;
const MAX_SEATS = 6;
/** The island for a table: the large one seats 5 or 6. */
const layoutFor = (seats: number): Layout => (seats >= 5 ? 'large' : 'standard');
/** Longest Road and Largest Army need at least this much. */
export const ROAD_MIN = 5;
export const ARMY_MIN = 3;
/** A game that runs this many turns ends with the points leader winning. */
const MAX_ROUNDS = 600;
const deckOf = (counts: Record<DevCard, number>): DevCard[] => (Object.keys(counts) as DevCard[]).flatMap((c) => Array<DevCard>(counts[c]).fill(c));
/** The development card deck: 25 cards, or 34 at a table of 5 or 6. */
export const DEV_CARD_DECKS: Record<Layout, DevCard[]> = {
  standard: deckOf({ knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 }),
  large: deckOf({ knight: 20, victoryPoint: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 }),
  newShores: deckOf({ knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 }),
};

export interface CatanPlayer extends KitPlayer {
  hand: Hand;
  /** Cards in hand: all others see of your hand. */
  handCount: number;
  /** Development cards held, with the turn each was bought. */
  devCards: { card: DevCard; bought: number }[];
  devCardCount: number;
  /** Knights played. */
  knightsPlayed: number;
  out?: boolean;
  /** Cities & Knights: commodity cards (hidden like resources). */
  goods: Goods;
  /** Cities & Knights: improvement level in each area. */
  areas: Record<Area, number>;
  /** Cities & Knights: progress cards held (hidden from others; see progressCardCount). */
  progressCards: ProgressCard[];
  progressCardCount: number;
  /** Cities & Knights: walls built, Defender of Catan points, and point progress cards shown. */
  walls: number;
  defender: number;
  progressCardPoints: number;
}

interface Offer {
  from: string;
  give: Partial<Hand>;
  get: Partial<Hand>;
  /** Cities & Knights: commodities in the offer too. */
  giveGoods?: Partial<Goods>;
  getGoods?: Partial<Goods>;
  /** Players still to answer (they may answer in any order, all at once). */
  asked: string[];
  answers: Record<string, boolean>;
  /** Other terms a player proposed instead, by player: what THEY would give and get. */
  counters?: Record<string, { give: Partial<Hand>; get: Partial<Hand> }>;
}

/**
 * Cities & Knights: a choice a player must make before play goes on (answered with
 * RESOLVE). Whoever owes the first ask is the actor until it is answered.
 */
export type Ask =
  /** Saboteur: discard `count` cards of your choice to the bank. */
  | { kind: 'discard'; player: string; count: number }
  /** Wedding: give `count` cards of your choice. */
  | { kind: 'give'; player: string; to: string; count: number }
  /** Commercial Harbor: give a commodity of your choice for the resource you were handed. */
  | { kind: 'harbor'; player: string; to: string }
  /** Master Merchant: take `count` cards from `from`'s hand, which you are shown. */
  | { kind: 'take'; player: string; from: string; count: number }
  /** Spy: take one of `from`'s progress cards, which you are shown. */
  | { kind: 'spy'; player: string; from: string }
  /** The barbarians won: choose the city you lose. */
  | { kind: 'pillage'; player: string }
  /** A tie for the best defence: choose the area deck to draw from. */
  | { kind: 'draw'; player: string }
  /** More than 4 progress cards: choose one to put under its deck. */
  | { kind: 'progressCard-limit'; player: string }
  /** Your knight was pushed off `from`: choose an empty corner along your roads. */
  | { kind: 'retreat'; player: string; from: number; knight: Knight }
  /** Deserter: choose the knight you give up. */
  | { kind: 'desert'; player: string; to: string }
  /** Deserter: place a knight of this strength, free (or skip). */
  | { kind: 'hire'; player: string; level: 1 | 2 | 3; active: boolean }
  /** Diplomat: build the road you removed again, elsewhere (or skip). */
  | { kind: 'road'; player: string; skip: number };

/** special: at a table of 5 or 6, after each turn the others may build in turn (no trading). */
/** gold: players owed gold field pay pick their resources, one at a time. */
type Phase = 'setup' | 'roll' | 'discard' | 'robber' | 'steal' | 'main' | 'roadBuilding' | 'offer' | 'special' | 'gold' | 'over';

export interface CatanEvent {
  seq: number;
  kind:
    | 'roll'
    | 'produce'
    | 'build'
    | 'buy'
    | 'play'
    | 'robber'
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
    | 'islandBonus'
    | 'eventDie'
    | 'attack'
    | 'improve'
    | 'knight'
    | 'progressCard'
    | 'metropolis'
    | 'harbor'
    | 'swap'
    | 'unroad';
  /** Cities & Knights: the event die face, the progress card, the area, or the attack's outcome. */
  eventDie?: EventDie;
  progressCard?: ProgressCard;
  area?: Area;
  goods?: Partial<Goods>;
  text?: string;
  player?: string;
  target?: string;
  piece?: Piece;
  card?: DevCard;
  cards?: Partial<Hand>;
  /** What was given in a trade. */
  paid?: Partial<Hand>;
  paidGoods?: Partial<Goods>;
  /** How many cards changed hands (kept when the cards themselves are hidden). */
  n?: number;
  dice?: [number, number];
  /** 'longest' or 'army' for an award. */
  award?: 'longest' | 'army';
}

export interface CatanState {
  /** The expansion in play (absent on older states: the base game). */
  mode?: CatanMode;
  board: Board;
  players: CatanPlayer[];
  /** By corner: a settlement or city and its owner. */
  buildings: ({ player: string; city: boolean } | null)[];
  /** By edge: the road's owner. */
  roads: (string | null)[];
  /** Seafarers, by edge: the ship's owner. */
  ships: (string | null)[];
  /** Seafarers: a ship has been moved this turn. */
  shipMoved: boolean;
  /** Seafarers: ships built this turn (they can't move until next turn). */
  newShips: number[];
  /** Seafarers: the outer islands each player has made island bonus on. */
  islandBonus: Record<string, number[]>;
  /** Seafarers: gold field pay owed, picked one player at a time (Cities & Knights: Science's pick too). */
  gold: { player: string; count: number }[];
  /** Cities & Knights, by corner: a knight. */
  knights: (Knight | null)[];
  /** Cities & Knights, by corner: a wall around the city there. */
  walls: boolean[];
  /** Cities & Knights: each area's Metropolis (its holder and the city it stands on). */
  metropolises: Record<Area, { player: string; vertex: number } | null>;
  /** Cities & Knights: the barbarian ship's place on its track (attacks at BARBARIAN_TRACK). */
  barbarians: number;
  /** Cities & Knights: the barbarian ship has attacked at least once (the robber moves only after that). */
  attacked: boolean;
  eventDie: EventDie | null;
  progressCardDecks: Record<Area, ProgressCard[]>;
  progressCardDeckCount: Record<Area, number>;
  goodsBank: Goods;
  /** Cities & Knights: this turn's progress card effects still to use (harbor: players a Commercial Harbor may still trade with). */
  perks: { medicine: boolean; crane: boolean; smith: number; fleet: Card | null; harbor?: string[] };
  /** Cities & Knights: the robber is moving for a Bishop (rob everyone beside it). */
  bishop: boolean;
  /** Cities & Knights: the robber is being chased off (it must go to a numbered tile). */
  chasing?: boolean;
  /** Cities & Knights: choices still owed, in order, and what they interrupted. */
  asks?: Ask[];
  resume?: ('produce' | 'end')[];
  /** Cities & Knights: the merchant, on a tile, and who placed it. */
  merchant?: { player: string; tile: number } | null;
  bank: Hand;
  deck: DevCard[];
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
  playedDevCard: boolean;
  /** Where play returns once the robber has moved (and stolen). */
  afterRobber: 'roll' | 'main';
  offer: Offer | null;
  /** The special build phase: players still to build, in order. */
  special: string[];
  longestRoad: { player: string | null; length: number };
  largestArmy: { player: string | null; size: number };
  log: CatanEvent[];
  seq: number;
  seed: number;
  over: boolean;
  winner: string | null;
}

export type CatanAction =
  | { type: 'ROLL' }
  | { type: 'BUILD_ROAD'; edge: number }
  | { type: 'BUILD_SHIP'; edge: number }
  | { type: 'MOVE_SHIP'; from: number; to: number }
  | { type: 'PICK_GOLD'; cards: Partial<Hand> }
  | { type: 'BUILD_SETTLEMENT'; vertex: number }
  | { type: 'BUILD_CITY'; vertex: number }
  | { type: 'BUY_DEVELOPMENT' }
  | { type: 'PLAY_DEVELOPMENT'; card: Exclude<DevCard, 'victoryPoint'>; take?: Resource[] }
  | { type: 'DISCARD'; cards: Partial<Hand>; goods?: Partial<Goods> }
  | { type: 'MOVE_ROBBER'; tile: number }
  | { type: 'STEAL'; from: string }
  | { type: 'BANK_TRADE'; give: Card; get: Card }
  | { type: 'BUILD_KNIGHT'; vertex: number }
  | { type: 'ACTIVATE'; vertex: number }
  | { type: 'PROMOTE'; vertex: number }
  | { type: 'MOVE_KNIGHT'; from: number; to: number }
  | { type: 'CHASE'; vertex: number }
  | { type: 'IMPROVE'; area: Area }
  | { type: 'BUILD_WALL'; vertex: number }
  | { type: 'PLAY_PROGRESS'; progressCard: ProgressCard; take?: Card[]; target?: string; vertex?: number; edge?: number; tile?: number; tiles?: [number, number]; dice?: [number, number] }
  /** Cities & Knights: answer the first ask. */
  | { type: 'RESOLVE'; cards?: Partial<Hand>; goods?: Partial<Goods>; vertex?: number; edge?: number; area?: Area; progressCard?: ProgressCard; skip?: boolean }
  /** Cities & Knights, after a Commercial Harbor: hand a player one resource for a commodity of their choice. */
  | { type: 'HARBOR'; target: string; give: Resource }
  | { type: 'OFFER'; give: Partial<Hand>; get: Partial<Hand>; giveGoods?: Partial<Goods>; getGoods?: Partial<Goods> }
  | { type: 'ANSWER'; accept: boolean }
  /** Instead of yes or no: other terms, as the answering player would give and get them. */
  | { type: 'COUNTER'; give: Partial<Hand>; get: Partial<Hand> }
  /** `counter`: take that player's counter-offer rather than the original terms. */
  | { type: 'CLOSE_OFFER'; with: string | null; counter?: boolean }
  | { type: 'END_TURN' };

export const emptyHand = (): Hand => ({ lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 });
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
export const geoFor = (s: CatanState) => geoOf(s.board);
const other = (s: CatanState, edge: number, v: number) => {
  const [a, b] = geoFor(s).edges[edge].v;
  return a === v ? b : a;
};
const seatOf = (s: CatanState, id: string) => s.players.findIndex((p) => p.id === id);
const count = (s: CatanState, id: string, kind: 'road' | 'settlement' | 'city' | 'ship') =>
  kind === 'road'
    ? s.roads.filter((r) => r === id).length
    : kind === 'ship'
      ? (s.ships ?? []).filter((r) => r === id).length
      : s.buildings.filter((b) => b?.player === id && b.city === (kind === 'city')).length;

const terrainAt = (s: CatanState, t: number) => s.board.terrain[t];
/** An edge a road can take: it touches land. */
const roadEdge = (s: CatanState, e: number) => geoFor(s).edges[e].tiles.some((t) => isLand(terrainAt(s, t)));
/** An edge a ship can take: it touches the sea. */
const seaEdge = (s: CatanState, e: number) => geoFor(s).edges[e].tiles.some((t) => terrainAt(s, t) === 'sea');
const freeEdge = (s: CatanState, e: number) => s.roads[e] === null && !(s.ships ?? [])[e];
/** A corner a building can take: it touches land. */
const landCorner = (s: CatanState, v: number) => geoFor(s).vertices[v].tiles.some((t) => isLand(terrainAt(s, t)));
/** The sides of a tile. */
export const tileEdges = (s: CatanState, t: number) => geoFor(s).edges.flatMap((e, i) => (e.tiles.includes(t) ? [i] : []));

// ---------------- Cities & Knights helpers ----------------

const isGood = (c: Card): c is Commodity => (COMMODITIES as string[]).includes(c);
/** Every card in a hand: resources and commodities. */
export const cardsHeld = (p: CatanPlayer) => handSize(p.hand) + goodsSize(p.goods);
/** The most cards a player may hold through a 7: 7, plus 2 for each wall. */
const handLimit = (s: CatanState, p: CatanPlayer) => 7 + (s.mode === 'cities-knights' ? 2 * p.walls : 0);
const knightAt = (s: CatanState, v: number) => (s.knights ?? [])[v] ?? null;
const enemyAt = (s: CatanState, v: number, id: string) => {
  const b = s.buildings[v];
  const w = knightAt(s, v);
  return (!!b && b.player !== id) || (!!w && w.player !== id);
};
/** The dice odds of the tiles around a corner (for picking a city to lose or to crown). */
const cornerPips = (s: CatanState, v: number) => geoFor(s).vertices[v].tiles.reduce((t, x) => t + (s.board.numbers[x] ? PIPS[s.board.numbers[x]!] : 0), 0);

/** Corners where `id` may hire a knight: empty land corners on their own road. */
export function legalKnightSpots(s: CatanState, id: string): number[] {
  if (s.mode !== 'cities-knights') return [];
  return geoFor(s).vertices.flatMap((v, i) => (!s.buildings[i] && !knightAt(s, i) && landCorner(s, i) && v.edges.some((e) => s.roads[e] === id) ? [i] : []));
}

/** Corners a knight at `from` can reach along its owner's roads, past no other player's piece. */
function knightReach(s: CatanState, from: number, id: string): Set<number> {
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

/** Where a knight of `id`'s pushed off `from` may go: an empty corner they reach from there along their roads. */
export function retreatSpots(s: CatanState, id: string, from: number): number[] {
  return [...knightReach(s, from, id)].filter((v) => v !== from && !s.buildings[v] && !knightAt(s, v));
}

/** Roads a Diplomat may remove: at one end, nothing of their owner's (no building, knight or other road). */
export function openRoads(s: CatanState): number[] {
  if (s.mode !== 'cities-knights') return [];
  const geo = geoFor(s);
  return s.roads.flatMap((owner, e) => {
    if (!owner) return [];
    const loose = geo.edges[e].v.some((v) => s.buildings[v]?.player !== owner && knightAt(s, v)?.player !== owner && !geo.vertices[v].edges.some((x) => x !== e && s.roads[x] === owner));
    return loose ? [e] : [];
  });
}

/** A player's knights, by corner. */
export const knightsOf = (s: CatanState, id: string) => (s.knights ?? []).flatMap((w, v) => (w?.player === id ? [v] : []));

/** Cities the barbarians may take from `id`: any without a Metropolis. */
export function pillageable(s: CatanState, id: string): number[] {
  const metropolises = new Set(AREAS.flatMap((g) => (s.metropolises[g] ? [s.metropolises[g]!.vertex] : [])));
  return s.buildings.flatMap((b, v) => (b?.player === id && b.city && !metropolises.has(v) ? [v] : []));
}

/** Deserter: the strength of knight `id` may place (the one given up, else strength 1), or null if none is left. */
function hireLevel(s: CatanState, id: string, level: 1 | 2 | 3): 1 | 2 | 3 | null {
  const owned = (lv: number) => (s.knights ?? []).filter((w) => w?.player === id && w.level === lv).length;
  if (owned(level) < KNIGHTS_PER_LEVEL) return level;
  return owned(1) < KNIGHTS_PER_LEVEL ? 1 : null;
}

/** Where an active knight at `from` may go: an empty corner along its roads, or onto a weaker rival knight. */
export function knightMoves(s: CatanState, id: string, from: number): number[] {
  const w = knightAt(s, from);
  if (!w || w.player !== id || !w.active || w.since >= s.round) return [];
  return [...knightReach(s, from, id)].filter((v) => {
    const there = knightAt(s, v);
    if (s.buildings[v]) return false;
    if (!there) return true;
    return there.player !== id && there.level < w.level;
  });
}

/** Your active knights beside the robber, which can chase it off (after the first attack). */
export function chasers(s: CatanState, id: string): number[] {
  if (s.mode !== 'cities-knights' || !s.attacked) return [];
  return geoFor(s).tiles[s.board.robber].corners.filter((v) => {
    const w = knightAt(s, v);
    return !!w && w.player === id && w.active && w.since < s.round;
  });
}

/** What the next level of an area costs `id` in its commodity, or null if it can't be built. */
export function improveCost(s: CatanState, id: string, g: Area): number | null {
  const p = s.players.find((x) => x.id === id)!;
  const next = p.areas[g] + 1;
  if (next > MAX_LEVEL) return null;
  if (!s.buildings.some((b) => b?.player === id && b.city)) return null;
  if (next === MAX_LEVEL && s.players.some((x) => x.id !== id && x.areas[g] >= MAX_LEVEL)) return null;
  // A level that takes a Metropolis needs a city to put it on.
  const holder = s.metropolises[g];
  const wantsMetropolis = (next === METROPOLIS_LEVEL && !holder) || (next === MAX_LEVEL && !!holder && holder.player !== id);
  if (wantsMetropolis && !s.buildings.some((b, v) => b?.player === id && b.city && !AREAS.some((x) => s.metropolises[x]?.vertex === v))) return null;
  return Math.max(0, next - (s.perks?.crane ? 1 : 0));
}

/** How many of `card` you give the bank for one card. */
export function bankRatio(s: CatanState, id: string, card: Card): number {
  if (s.perks?.fleet === card) return 2;
  if (!isGood(card)) {
    // The merchant's tile: its resource trades 2 for 1 for whoever placed it.
    const m = s.merchant;
    if (m && m.player === id && YIELD[s.board.terrain[m.tile]] === card) return 2;
    return tradeRatio(s, id, card);
  }
  const p = s.players.find((x) => x.id === id)!;
  if (p.areas.trade >= 3) return 2;
  // A 3:1 harbour takes commodities too.
  let best = 4;
  geoFor(s).harborEdges.forEach((e, k) => {
    if (s.board.harbors[k] === 'any' && geoFor(s).edges[e].v.some((v) => s.buildings[v]?.player === id)) best = 3;
  });
  return best;
}

/** Corners where `id` may put a settlement now (the setup ignores road connection). */
export function legalSettlementSpots(s: CatanState, id: string): number[] {
  const setup = s.phase === 'setup';
  const geo = geoFor(s);
  return geo.vertices.flatMap((v, i) => {
    if (s.buildings[i] || knightAt(s, i) || v.neighbours.some((n) => s.buildings[n]) || !landCorner(s, i)) return [];
    // Seafarers: everyone starts on the home island.
    if (setup && s.mode === 'seafarers' && !v.tiles.some((t) => geo.tiles[t].island === 0 && isLand(terrainAt(s, t)))) return [];
    if (!setup && !v.edges.some((e) => s.roads[e] === id || (s.ships ?? [])[e] === id)) return [];
    return [i];
  });
}

/** Edges where `id` may put a road now. */
export function legalRoadSpots(s: CatanState, id: string): number[] {
  if (s.phase === 'setup') {
    const v = s.setup?.last;
    return v === null || v === undefined ? [] : geoFor(s).vertices[v].edges.filter((e) => freeEdge(s, e) && roadEdge(s, e));
  }
  return geoFor(s).edges.flatMap((e, i) => {
    if (!freeEdge(s, i) || !roadEdge(s, i)) return [];
    const joins = e.v.some((v) => {
      const b = s.buildings[v];
      if (b?.player === id) return true;
      if (enemyAt(s, v, id)) return false; // another player's building or knight blocks the way
      return geoFor(s).vertices[v].edges.some((x) => x !== i && s.roads[x] === id);
    });
    return joins ? [i] : [];
  });
}

/** Seafarers: edges where `id` may put a ship now (`ignore`: a ship being moved). */
export function legalShipSpots(s: CatanState, id: string, ignore: number | null = null): number[] {
  if (s.mode !== 'seafarers') return [];
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

/** Seafarers: your ships that may move: at the open end of a line, not built this turn, clear of the pirate. */
export function movableShips(s: CatanState, id: string): number[] {
  if (s.mode !== 'seafarers' || s.shipMoved) return [];
  const geo = geoFor(s);
  return s.ships.flatMap((owner, e) => {
    if (owner !== id || s.newShips.includes(e)) return [];
    if (s.board.pirate !== undefined && geo.edges[e].tiles.includes(s.board.pirate)) return [];
    const open = geo.edges[e].v.some((v) => s.buildings[v]?.player !== id && !geo.vertices[v].edges.some((x) => x !== e && s.ships[x] === id));
    return open && legalShipSpots(s, id, e).length > 0 ? [e] : [];
  });
}

/** Your settlements, which can become cities. */
export const legalCitySpots = (s: CatanState, id: string) => s.buildings.flatMap((b, i) => (b?.player === id && !b.city ? [i] : []));

/** How many of `r` you give the bank for one card: 4, 3 with any 3:1 harbour, 2 with that resource's harbour. */
export function tradeRatio(s: CatanState, id: string, r: Resource): number {
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
export function longestRoadOf(s: CatanState, id: string): number {
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

/** Points: 1 per settlement, 2 per city, 2 each for Longest Road and Largest Army, and (if counted) 1 per victory point card. */
export function victoryPoints(s: CatanState, id: string, hidden = true): number {
  let pts = 0;
  for (const b of s.buildings) if (b?.player === id) pts += b.city ? 2 : 1;
  if (s.longestRoad.player === id) pts += 2;
  if (s.largestArmy.player === id) pts += 2;
  if (hidden) pts += s.players.find((p) => p.id === id)?.devCards.filter((c) => c.card === 'victoryPoint').length ?? 0;
  pts += ISLAND_BONUS_POINTS * (s.islandBonus?.[id]?.length ?? 0);
  if (s.mode === 'cities-knights') {
    const p = s.players.find((x) => x.id === id);
    pts += (p?.defender ?? 0) + (p?.progressCardPoints ?? 0);
    for (const g of AREAS) if (s.metropolises[g]?.player === id) pts += 2;
    if (s.merchant?.player === id) pts += MERCHANT_POINTS;
  }
  return pts;
}

function note(s: CatanState, e: Omit<CatanEvent, 'seq'>) {
  s.seq += 1;
  s.log = [{ ...e, seq: s.seq }, ...s.log].slice(0, 60);
}

function updateLongestRoad(s: CatanState) {
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

function updateArmy(s: CatanState, id: string) {
  const p = s.players.find((x) => x.id === id)!;
  if (p.knightsPlayed >= ARMY_MIN && p.knightsPlayed > s.largestArmy.size && s.largestArmy.player !== id) {
    s.largestArmy = { player: id, size: p.knightsPlayed };
    note(s, { kind: 'award', player: id, award: 'army' });
  } else if (s.largestArmy.player === id) s.largestArmy.size = p.knightsPlayed;
}

/** Seafarers: a player's first settlement on an outer island scores Island bonus. */
function islandBonus(s: CatanState, id: string, v: number) {
  if (s.mode !== 'seafarers') return;
  const geo = geoFor(s);
  for (const t of geo.vertices[v].tiles) {
    const k = geo.tiles[t].island;
    if (k > 0 && isLand(s.board.terrain[t]) && !s.islandBonus[id].includes(k)) {
      s.islandBonus[id].push(k);
      note(s, { kind: 'islandBonus', player: id });
    }
  }
}

function payCost(s: CatanState, p: CatanPlayer, cost: Partial<Hand>) {
  if (!canPay(p.hand, cost)) throw new IllegalMove("you can't pay for that");
  for (const r of RESOURCES) {
    p.hand[r] -= cost[r] ?? 0;
    s.bank[r] += cost[r] ?? 0;
  }
}

function produce(s: CatanState, total: number) {
  const owed = new Map<Resource, Map<string, number>>();
  const goodsOwed = new Map<Commodity, Map<string, number>>();
  const gold = new Map<string, number>();
  s.board.numbers.forEach((n, t) => {
    if (n !== total || t === s.board.robber) return;
    if (s.board.terrain[t] === 'gold') {
      for (const c of geoFor(s).tiles[t].corners) {
        const b = s.buildings[c];
        if (b && !s.players.find((p) => p.id === b.player)?.out) gold.set(b.player, (gold.get(b.player) ?? 0) + (b.city ? 2 : 1));
      }
      return;
    }
    const res = YIELD[s.board.terrain[t]];
    if (!res) return;
    for (const c of geoFor(s).tiles[t].corners) {
      const b = s.buildings[c];
      if (!b || s.players.find((p) => p.id === b.player)?.out) continue;
      // Cities & Knights: a city on forest, pasture or mountains makes a commodity in place of its second card.
      const good = s.mode === 'cities-knights' && b.city ? CITY_GOOD[s.board.terrain[t]] : undefined;
      const m = owed.get(res) ?? new Map<string, number>();
      m.set(b.player, (m.get(b.player) ?? 0) + (b.city && !good ? 2 : 1));
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
  // Cities & Knights: Science (level 3) gives a player who got nothing one resource of their choice.
  if (s.mode === 'cities-knights') {
    for (const p of s.players) if (!p.out && p.areas.science >= 3 && !got.has(p.id) && !gotGoods.has(p.id)) gold.set(p.id, 1);
  }
  // Gold field pay is picked by each player owed it, in seat order from the roller.
  const n = s.players.length;
  s.gold = Array.from({ length: n }, (_, k) => s.players[(s.turn + k) % n])
    .filter((p) => gold.has(p.id))
    .map((p) => ({ player: p.id, count: gold.get(p.id)! }));
}

function nextSeat(s: CatanState, from: number): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (from + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return from;
}

/** Move the setup on to the next placement, skipping anyone who left. */
function advanceSetup(s: CatanState) {
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
function endTurn(s: CatanState) {
  if (s.board.layout === 'large') {
    const n = s.players.length;
    s.special = Array.from({ length: n - 1 }, (_, k) => s.players[(s.turn + 1 + k) % n]).filter((p) => !p.out).map((p) => p.id);
    s.offer = null;
    s.phase = 'special';
    if (s.special.length > 0) return;
  }
  startTurn(s, nextSeat(s, s.turn));
}

function startTurn(s: CatanState, seat: number) {
  s.special = [];
  s.perks = { medicine: false, crane: false, smith: 0, fleet: null, harbor: [] };
  s.eventDie = null;
  s.shipMoved = false;
  s.newShips = [];
  s.turn = seat;
  s.round += 1;
  s.phase = 'roll';
  s.dice = null;
  s.playedDevCard = false;
  s.freeRoads = 0;
  s.offer = null;
  if (s.round > MAX_ROUNDS) finishByPoints(s);
}

function finishByPoints(s: CatanState) {
  const live = s.players.filter((p) => !p.out);
  live.sort((a, b) => victoryPoints(s, b.id) - victoryPoints(s, a.id));
  s.over = true;
  s.phase = 'over';
  s.winner = live[0]?.id ?? null;
}

/** After the robber moves: steal from the one player next to it, or ask whom to rob. */
function robberStep(s: CatanState, tile: number) {
  const me = s.players[s.turn];
  const atSea = s.board.terrain[tile] === 'sea';
  const sides = atSea ? tileEdges(s, tile) : [];
  const near = (p: CatanPlayer) => (atSea ? sides.some((e) => s.ships[e] === p.id) : geoFor(s).tiles[tile].corners.some((c) => s.buildings[c]?.player === p.id));
  const victims = s.players.filter((p) => p !== me && !p.out && cardsHeld(p) > 0 && near(p));
  if (s.bishop) {
    // A Bishop robs one card from every player beside the robber.
    s.bishop = false;
    for (const v of victims) {
      const got = takeRandom(s, v, me, 1);
      note(s, { kind: 'steal', player: me.id, target: v.id, cards: got.cards, goods: got.goods });
    }
    s.phase = s.afterRobber;
    return;
  }
  if (victims.length === 0) s.phase = s.afterRobber;
  else if (victims.length === 1) steal(s, victims[0].id);
  else {
    s.stealFrom = victims.map((p) => p.id);
    s.phase = 'steal';
  }
}

/** Move `n` cards at random (resources and commodities) from one player to another (or to the bank). */
function takeRandom(s: CatanState, from: CatanPlayer, to: CatanPlayer | null, n: number): { cards: Partial<Hand>; goods: Partial<Goods> } {
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

function steal(s: CatanState, from: string) {
  const victim = s.players.find((p) => p.id === from)!;
  const got = takeRandom(s, victim, s.players[s.turn], 1);
  s.stealFrom = [];
  s.phase = s.afterRobber;
  note(s, { kind: 'steal', player: s.players[s.turn].id, target: from, cards: got.cards, goods: got.goods });
}

function sync(s: CatanState): CatanState {
  for (const p of s.players) {
    p.handCount = handSize(p.hand) + goodsSize(p.goods ?? {});
    p.devCardCount = p.devCards.length;
    p.progressCardCount = (p.progressCards ?? []).length;
  }
  if (s.progressCardDecks) s.progressCardDeckCount = { trade: s.progressCardDecks.trade.length, politics: s.progressCardDecks.politics.length, science: s.progressCardDecks.science.length };
  s.deckCount = s.deck.length;
  return s;
}

interface CatanOptions {
  mode?: CatanMode;
}

export function createCatan(seats: KitSeat[], seed: number, options?: unknown): CatanState {
  const asked = (options as CatanOptions | undefined)?.mode;
  const mode: CatanMode = asked === 'seafarers' || asked === 'cities-knights' ? asked : 'base';
  const layout = mode === 'seafarers' ? 'newShores' : layoutFor(seats.length);
  const board = makeBoard(seed, layout);
  const geo = geoOf(board);
  // Cities & Knights has no development cards: its progress cards come from three area decks.
  const [deck, s1] = mode === 'cities-knights' ? [[] as DevCard[], board.seed] : shuffle(DEV_CARD_DECKS[layout], board.seed);
  let s2 = s1;
  const progressCardDecks = {} as Record<Area, ProgressCard[]>;
  for (const g of AREAS) [progressCardDecks[g], s2] = mode === 'cities-knights' ? shuffle(PROGRESS_DECKS[g], s2) : [[], s2];
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
      devCards: [],
      devCardCount: 0,
      knightsPlayed: 0,
      goods: emptyGoods(),
      areas: { trade: 0, politics: 0, science: 0 },
      progressCards: [],
      progressCardCount: 0,
      walls: 0,
      defender: 0,
      progressCardPoints: 0,
    })),
    buildings: geo.vertices.map(() => null),
    roads: geo.edges.map(() => null),
    ships: geo.edges.map(() => null),
    shipMoved: false,
    newShips: [],
    islandBonus: Object.fromEntries(seats.map((_, i) => [`p${i}`, []])),
    gold: [],
    knights: geo.vertices.map(() => null),
    walls: geo.vertices.map(() => false),
    metropolises: { trade: null, politics: null, science: null },
    barbarians: 0,
    attacked: false,
    eventDie: null,
    progressCardDecks,
    progressCardDeckCount: { trade: progressCardDecks.trade.length, politics: progressCardDecks.politics.length, science: progressCardDecks.science.length },
    goodsBank: { paper: GOODS_BANK, cloth: GOODS_BANK, coin: GOODS_BANK },
    perks: { medicine: false, crane: false, smith: 0, fleet: null, harbor: [] },
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
    playedDevCard: false,
    afterRobber: 'main',
    offer: null,
    special: [],
    longestRoad: { player: null, length: 0 },
    largestArmy: { player: null, size: 0 },
    log: [],
    seq: 0,
    seed: s2,
    over: false,
    winner: null,
  });
}

/** The player who must act now. */
export function catanActor(s: CatanState): string | null {
  // Cities & Knights: an owed choice comes before anything else.
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

function applyHex(prev: CatanState, action: CatanAction | KitCommonAction, actorId: string): CatanState {
  if (action.type === 'REMATCH') {
    if (!prev.over) throw new IllegalMove('the game is still on');
    return createCatan(
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
  if (catanActor(s) !== actorId) throw new IllegalMove('not your turn');
  // Cities & Knights: while a choice is owed, it is the only move.
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
      if (s.discards.length === 0) s.phase = robberNext(s);
      break;
    }
    case 'MOVE_ROBBER': {
      if (s.phase !== 'robber') throw new IllegalMove('the robber is not yours to move');
      if (!Number.isInteger(action.tile) || action.tile < 0 || action.tile >= geoFor(s).tiles.length) throw new IllegalMove('move the robber to another tile');
      if (s.board.terrain[action.tile] === 'sea') {
        // Seafarers: the pirate moves instead, to another sea tile.
        if (s.mode !== 'seafarers' || action.tile === s.board.pirate) throw new IllegalMove('move the pirate to another sea tile');
        s.board.pirate = action.tile;
        note(s, { kind: 'pirate', player: actorId });
      } else {
        if (action.tile === s.board.robber) throw new IllegalMove('move the robber to another tile');
        if (s.chasing && s.board.numbers[action.tile] === null) throw new IllegalMove('chase the robber to a numbered tile');
        s.chasing = false;
        s.board.robber = action.tile;
        note(s, { kind: 'robber', player: actorId });
      }
      robberStep(s, action.tile);
      break;
    }
    case 'STEAL': {
      if (s.phase !== 'steal' || !s.stealFrom.includes(action.from)) throw new IllegalMove("you can't rob that player");
      steal(s, action.from);
      break;
    }
    case 'BUILD_ROAD': {
      const free = s.phase === 'setup' || s.phase === 'roadBuilding';
      if (s.phase === 'setup' ? !s.setup!.needRoad : s.phase !== 'main' && s.phase !== 'roadBuilding' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalRoadSpots(s, actorId).includes(action.edge)) throw new IllegalMove("you can't build a road there");
      if (count(s, actorId, 'road') >= LIMITS.road) throw new IllegalMove('you have no roads left');
      if (!free) payCost(s, me, COSTS.road);
      s.roads[action.edge] = actorId;
      note(s, { kind: 'build', player: actorId, piece: 'road' });
      if (s.phase === 'setup') advanceSetup(s);
      else {
        if (s.phase === 'roadBuilding') {
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
    case 'BUILD_SETTLEMENT': {
      if (s.phase === 'setup' ? s.setup!.needRoad : s.phase !== 'main' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalSettlementSpots(s, actorId).includes(action.vertex)) throw new IllegalMove("you can't build a settlement there");
      if (count(s, actorId, 'settlement') >= LIMITS.settlement) throw new IllegalMove('you have no settlements left');
      if (s.phase !== 'setup') payCost(s, me, COSTS.settlement);
      // Cities & Knights: the second setup placement is a city.
      const asCity = s.phase === 'setup' && s.mode === 'cities-knights' && s.setup!.step >= s.players.length;
      s.buildings[action.vertex] = { player: actorId, city: asCity };
      note(s, { kind: 'build', player: actorId, piece: 'settlement' });
      if (s.phase === 'setup') {
        // The second settlement collects one card from each producing tile around it.
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
        islandBonus(s, actorId, action.vertex);
        updateLongestRoad(s);
      }
      break;
    }
    case 'BUILD_SHIP': {
      const free = s.phase === 'setup' || s.phase === 'roadBuilding';
      if (s.mode !== 'seafarers') throw new IllegalMove('no ships in this game');
      if (s.phase === 'setup' ? !s.setup!.needRoad : s.phase !== 'main' && s.phase !== 'roadBuilding' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalShipSpots(s, actorId).includes(action.edge)) throw new IllegalMove("you can't build a ship there");
      if (count(s, actorId, 'ship') >= LIMITS.ship) throw new IllegalMove('you have no ships left');
      if (!free) payCost(s, me, COSTS.ship);
      s.ships[action.edge] = actorId;
      s.newShips.push(action.edge);
      note(s, { kind: 'build', player: actorId, piece: 'ship' });
      if (s.phase === 'setup') advanceSetup(s);
      else {
        if (s.phase === 'roadBuilding') {
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
    case 'BUILD_CITY': {
      if (s.phase !== 'main' && s.phase !== 'special') throw new IllegalMove('not now');
      if (!legalCitySpots(s, actorId).includes(action.vertex)) throw new IllegalMove('build a city on one of your settlements');
      if (count(s, actorId, 'city') >= LIMITS.city) throw new IllegalMove('you have no cities left');
      payCost(s, me, s.perks?.medicine ? KNIGHT_COSTS.medicine : COSTS.city);
      if (s.perks) s.perks.medicine = false;
      s.buildings[action.vertex] = { player: actorId, city: true };
      note(s, { kind: 'build', player: actorId, piece: 'city' });
      break;
    }
    case 'BUY_DEVELOPMENT': {
      if (s.mode === 'cities-knights') throw new IllegalMove('there are no development cards in Cities & Knights');
      if (s.phase !== 'main' && s.phase !== 'special') throw new IllegalMove('not now');
      if (s.deck.length === 0) throw new IllegalMove('the development card deck is empty');
      payCost(s, me, COSTS.devCard);
      me.devCards.push({ card: s.deck.shift()!, bought: s.round });
      note(s, { kind: 'buy', player: actorId, piece: 'devCard' });
      break;
    }
    case 'PLAY_DEVELOPMENT': {
      if (s.phase !== 'main' && !(s.phase === 'roll' && action.card === 'knight')) throw new IllegalMove('not now');
      if (s.playedDevCard) throw new IllegalMove('you have already played a development card this turn');
      const k = me.devCards.findIndex((c) => c.card === action.card && c.bought < s.round);
      if (k < 0) throw new IllegalMove("you have no such card you can play yet");
      const take = action.take ?? [];
      if (action.card === 'yearOfPlenty') {
        if (take.length !== 2 || !take.every((r) => RESOURCES.includes(r))) throw new IllegalMove('choose two cards');
        const want = emptyHand();
        for (const r of take) want[r] += 1;
        if (!RESOURCES.every((r) => s.bank[r] >= want[r])) throw new IllegalMove("the bank doesn't have those");
      }
      if (action.card === 'monopoly' && (take.length !== 1 || !RESOURCES.includes(take[0]))) throw new IllegalMove('name one resource');
      me.devCards.splice(k, 1);
      s.playedDevCard = true;
      note(s, { kind: 'play', player: actorId, card: action.card });
      switch (action.card) {
        case 'knight':
          me.knightsPlayed += 1;
          updateArmy(s, actorId);
          s.afterRobber = s.phase === 'roll' ? 'roll' : 'main';
          s.phase = 'robber';
          break;
        case 'roadBuilding':
          s.freeRoads = Math.min(2, LIMITS.road - count(s, actorId, 'road') + (s.mode === 'seafarers' ? LIMITS.ship - count(s, actorId, 'ship') : 0));
          if (s.freeRoads > 0 && legalRoadSpots(s, actorId).length + legalShipSpots(s, actorId).length > 0) s.phase = 'roadBuilding';
          else s.freeRoads = 0;
          break;
        case 'yearOfPlenty':
          for (const r of take) {
            s.bank[r] -= 1;
            me.hand[r] += 1;
          }
          break;
        case 'monopoly': {
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
      if ((isGood(give) || isGood(get)) && s.mode !== 'cities-knights') throw new IllegalMove('no commodities in this game');
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
    case 'BUILD_KNIGHT':
    case 'ACTIVATE':
    case 'PROMOTE':
    case 'MOVE_KNIGHT':
    case 'CHASE':
    case 'IMPROVE':
    case 'BUILD_WALL':
    case 'PLAY_PROGRESS':
      citiesKnightsAction(s, me, action);
      break;
    case 'HARBOR': {
      if (s.mode !== 'cities-knights' || s.phase !== 'main') throw new IllegalMove('not now');
      const left = s.perks.harbor ?? [];
      if (!left.includes(action.target)) throw new IllegalMove('no Commercial Harbor trade with that player now');
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
      // Cities & Knights: commodities trade between players like resources.
      const giveGoods = s.mode === 'cities-knights' ? cleanGoods(action.giveGoods) : {};
      const getGoods = s.mode === 'cities-knights' ? cleanGoods(action.getGoods) : {};
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
      s.offer = { from: actorId, give, get, ...(s.mode === 'cities-knights' ? { giveGoods, getGoods } : {}), asked, answers: {} };
      note(s, { kind: 'offer', player: actorId, paid: give, cards: get, ...(s.mode === 'cities-knights' ? { paidGoods: giveGoods, goods: getGoods } : {}) });
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
      // Cities & Knights: more than 4 progress cards at the end of your turn: put the extra back first.
      if (s.mode === 'cities-knights' && me.progressCards.length > PROGRESS_LIMIT) {
        for (let k = PROGRESS_LIMIT; k < me.progressCards.length; k++) (s.asks ??= []).push({ kind: 'progressCard-limit', player: actorId });
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

function closeOffer(s: CatanState, withId: string | null, counter = false) {
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

// ---------------- Cities & Knights: choices owed by players ----------------

/** Cards a player picked from a hand: exactly `n`, all of them held. */
function picked(p: CatanPlayer, r: Extract<CatanAction, { type: 'RESOLVE' }>, n: number): { cards: Partial<Hand>; goods: Partial<Goods> } {
  const cards = clean(r.cards ?? {});
  const goods = cleanGoods(r.goods);
  if (handSize(cards) + goodsSize(goods) !== n || !canPay(p.hand, cards) || !hasGoods(p.goods, goods)) throw new IllegalMove(`choose exactly ${n} of the cards held`);
  return { cards, goods };
}

/** Move cards from one player to another, or to the bank. */
function moveCards(s: CatanState, from: CatanPlayer, to: CatanPlayer | null, cards: Partial<Hand>, goods: Partial<Goods>) {
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
function onlyChoice(p: CatanPlayer, n: number): Extract<CatanAction, { type: 'RESOLVE' }> | null {
  if (cardsHeld(p) <= n) return { type: 'RESOLVE', cards: { ...p.hand }, goods: { ...p.goods } };
  const kinds: Card[] = [...RESOURCES.filter((r) => p.hand[r] > 0), ...COMMODITIES.filter((c) => p.goods[c] > 0)];
  if (kinds.length !== 1) return null;
  const k = kinds[0];
  return isGood(k) ? { type: 'RESOLVE', goods: { [k]: n } } : { type: 'RESOLVE', cards: { [k]: n } };
}

/** An ask with one possible answer (or none) answers itself. */
function autoAnswer(s: CatanState, a: Ask): Extract<CatanAction, { type: 'RESOLVE' }> | null {
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
      const held = who(a.from).progressCards;
      return held.length <= 1 ? { type: 'RESOLVE', progressCard: held[0], skip: held.length === 0 } : null;
    }
    case 'pillage': {
      const cities = pillageable(s, a.player);
      return cities.length <= 1 ? { type: 'RESOLVE', vertex: cities[0], skip: cities.length === 0 } : null;
    }
    case 'draw': {
      const decks = AREAS.filter((g) => s.progressCardDecks[g].length > 0);
      return decks.length <= 1 ? { type: 'RESOLVE', area: decks[0], skip: decks.length === 0 } : null;
    }
    case 'progressCard-limit':
      return p.progressCards.length <= PROGRESS_LIMIT ? { type: 'RESOLVE', skip: true } : null;
    case 'retreat': {
      const spots = retreatSpots(s, a.player, a.from);
      return spots.length <= 1 ? { type: 'RESOLVE', vertex: spots[0], skip: spots.length === 0 } : null;
    }
    case 'desert': {
      const mine = knightsOf(s, a.player);
      return mine.length <= 1 ? { type: 'RESOLVE', vertex: mine[0], skip: mine.length === 0 } : null;
    }
    case 'hire':
      return hireLevel(s, a.player, a.level) === null || legalKnightSpots(s, a.player).length === 0 ? { type: 'RESOLVE', skip: true } : null;
    case 'road':
      return legalRoadSpots(s, a.player).every((e) => e === a.skip) || count(s, a.player, 'road') >= LIMITS.road ? { type: 'RESOLVE', skip: true } : null;
  }
}

/** Apply a player's answer to the first ask (which it removes); follow-up asks go to the front. */
function resolveAsk(s: CatanState, a: Ask, r: Extract<CatanAction, { type: 'RESOLVE' }>) {
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
      if (r.skip && from.progressCards.length === 0) return;
      const k = r.progressCard ? from.progressCards.indexOf(r.progressCard) : -1;
      if (k < 0) throw new IllegalMove('take one of their progress cards');
      p.progressCards.push(from.progressCards.splice(k, 1)[0]);
      note(s, { kind: 'progressCard', player: p.id, target: from.id, text: 'spy' });
      return;
    }
    case 'pillage': {
      const cities = pillageable(s, p.id);
      if (r.skip && cities.length === 0) return;
      if (r.vertex === undefined || !cities.includes(r.vertex)) throw new IllegalMove('choose one of your cities without a Metropolis');
      s.buildings[r.vertex] = { player: p.id, city: false };
      if (s.walls[r.vertex]) {
        s.walls[r.vertex] = false;
        p.walls -= 1;
      }
      note(s, { kind: 'attack', player: p.id, text: 'pillaged' });
      return;
    }
    case 'draw': {
      if (r.skip && AREAS.every((g) => s.progressCardDecks[g].length === 0)) return;
      if (!r.area || !AREAS.includes(r.area) || s.progressCardDecks[r.area].length === 0) throw new IllegalMove('choose a deck with cards left');
      drawProgressCard(s, p, r.area);
      return;
    }
    case 'progressCard-limit': {
      if (r.skip && p.progressCards.length <= PROGRESS_LIMIT) return;
      const k = r.progressCard ? p.progressCards.indexOf(r.progressCard) : -1;
      if (k < 0) throw new IllegalMove('choose one of your progress cards to put back');
      const [e] = p.progressCards.splice(k, 1);
      s.progressCardDecks[PROGRESS_AREA[e]].push(e);
      note(s, { kind: 'progressCard', player: p.id, area: PROGRESS_AREA[e], text: 'discard' });
      return;
    }
    case 'retreat': {
      const spots = retreatSpots(s, p.id, a.from);
      if (r.skip && spots.length === 0) {
        note(s, { kind: 'knight', player: p.id, text: 'lost' });
        return;
      }
      if (r.vertex === undefined || !spots.includes(r.vertex)) throw new IllegalMove('choose an empty corner along your roads');
      s.knights[r.vertex] = a.knight;
      note(s, { kind: 'knight', player: p.id, text: 'retreat' });
      updateLongestRoad(s);
      return;
    }
    case 'desert': {
      const mine = knightsOf(s, p.id);
      if (r.skip && mine.length === 0) return;
      if (r.vertex === undefined || !mine.includes(r.vertex)) throw new IllegalMove('choose one of your knights');
      const w = s.knights[r.vertex]!;
      s.knights[r.vertex] = null;
      note(s, { kind: 'knight', player: p.id, target: a.to, text: 'desert' });
      updateLongestRoad(s);
      s.asks!.unshift({ kind: 'hire', player: a.to, level: w.level, active: w.active });
      return;
    }
    case 'hire': {
      if (r.skip) return;
      const level = hireLevel(s, p.id, a.level);
      if (level === null || r.vertex === undefined || !legalKnightSpots(s, p.id).includes(r.vertex)) throw new IllegalMove('choose an empty corner on your road');
      s.knights[r.vertex] = { player: p.id, level, active: a.active, since: s.round };
      note(s, { kind: 'knight', player: p.id, text: 'hire' });
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
function runAsks(s: CatanState) {
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

/** Roll the dice (or set them, for an Alchemist): the event die first, then what the numbers pay. */
function roll(s: CatanState, actorId: string, dice: [number, number]) {
  s.dice = dice;
  s.rolls[dice[0] + dice[1]] += 1;
  note(s, { kind: 'roll', player: actorId, dice });
  if (s.mode === 'cities-knights') {
    eventDie(s, dice[0]);
    // An attack or a fifth progress card can need choices; the roll pays out once they are made.
    if (s.asks?.length) {
      s.resume = [...(s.resume ?? []), 'produce'];
      runAsks(s);
      return;
    }
  }
  afterRoll(s);
}

function afterRoll(s: CatanState) {
  if (s.over) return;
  const total = s.dice![0] + s.dice![1];
  if (total === 7) {
    const order = [0, 1, 2, 3, 4, 5].slice(0, s.players.length).map((k) => s.players[(s.turn + k) % s.players.length]);
    s.discards = order.filter((p) => !p.out && cardsHeld(p) > handLimit(s, p)).map((p) => p.id);
    s.afterRobber = 'main';
    s.phase = s.discards.length ? 'discard' : robberNext(s);
  } else {
    produce(s, total);
    s.phase = s.gold?.length ? 'gold' : 'main';
  }
}

/** Keep counts in step, and end the game if the player whose turn it is has 10 points. */
function finish(s: CatanState): CatanState {
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

/** After a 7's discards: the robber moves, except in Cities & Knights before the barbarian ship's first attack. */
function robberNext(s: CatanState): Phase {
  return s.mode === 'cities-knights' && !s.attacked ? 'main' : 'robber';
}

/** Draw a progress card from an area's deck (point progress cards are shown and scored at once). Out of
 *  turn, a fifth progress card in hand must be put back at once, the holder choosing which. */
function drawProgressCard(s: CatanState, p: CatanPlayer, g: Area) {
  if (s.progressCardDecks[g].length === 0) return;
  const e = s.progressCardDecks[g].shift()!;
  if (POINT_PROGRESS_CARDS.includes(e)) {
    p.progressCardPoints += 1;
    note(s, { kind: 'progressCard', player: p.id, progressCard: e, area: g, text: 'point' });
  } else {
    p.progressCards.push(e);
    note(s, { kind: 'progressCard', player: p.id, area: g });
    if (p.progressCards.length > PROGRESS_LIMIT && s.players[s.turn].id !== p.id) (s.asks ??= []).unshift({ kind: 'progressCard-limit', player: p.id });
  }
}

/** Cities & Knights: the event die. A ship moves the barbarians on (and they may land); a gate draws progress cards. */
function eventDie(s: CatanState, red: number) {
  const [r, seed] = nextRandom(s.seed);
  s.seed = seed;
  const face = EVENT_DIE_FACES[Math.floor(r * EVENT_DIE_FACES.length)];
  s.eventDie = face;
  note(s, { kind: 'eventDie', eventDie: face });
  if (face === 'ship') {
    s.barbarians += 1;
    if (s.barbarians >= BARBARIAN_TRACK) attack(s);
    return;
  }
  // A gate: every player whose area level is at least the red die's value less one draws a progress card.
  const n = s.players.length;
  for (let k = 0; k < n; k++) {
    const p = s.players[(s.turn + k) % n];
    if (!p.out && p.areas[face] >= 1 && red <= p.areas[face] + 1) drawProgressCard(s, p, face);
  }
}

/** Cities & Knights: the barbarians land. Activated knights against the number of cities. */
function attack(s: CatanState) {
  const live = s.players.filter((p) => !p.out);
  const power = new Map(live.map((p) => [p.id, (s.knights ?? []).reduce((t, w) => t + (w && w.player === p.id && w.active ? w.level : 0), 0)]));
  const strength = s.buildings.filter((b) => b?.city).length;
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
      // A tie for the most: no Defender of Catan point; each of them draws a progress card from the deck of their choice.
      for (const h of order.filter((p) => heroes.includes(p))) asks.push({ kind: 'draw', player: h.id });
      note(s, { kind: 'attack', text: heroes.length ? 'defended-tie' : 'defended' });
    }
  } else {
    // The weakest defenders who have a city that isn't a Metropolis each lose one city, of their choice.
    const exposed = live.filter((p) => pillageable(s, p.id).length > 0);
    const low = Math.min(...exposed.map((p) => power.get(p.id)!));
    for (const p of order.filter((x) => exposed.includes(x) && power.get(x.id) === low)) asks.push({ kind: 'pillage', player: p.id });
  }
  for (const w of s.knights) if (w) w.active = false;
  s.barbarians = 0;
  s.attacked = true;
}

/** Cities & Knights: hand a Metropolis to `id` (it stands on their best city that holds none). */
function crown(s: CatanState, id: string, g: Area) {
  const taken = new Set(AREAS.flatMap((x) => (s.metropolises[x] ? [s.metropolises[x]!.vertex] : [])));
  const cities = s.buildings.flatMap((b, v) => (b?.player === id && b.city && !taken.has(v) ? [v] : []));
  if (cities.length === 0) return false;
  const v = cities.reduce((a, b) => (cornerPips(s, b) > cornerPips(s, a) ? b : a));
  s.metropolises[g] = { player: id, vertex: v };
  note(s, { kind: 'metropolis', player: id, area: g });
  return true;
}

function give(from: CatanPlayer, to: CatanPlayer, card: Card, n: number): number {
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

/** Cities & Knights' own actions: knights, improvements, walls and progress cards. */
function citiesKnightsAction(s: CatanState, me: CatanPlayer, a: Extract<CatanAction, { type: 'BUILD_KNIGHT' | 'ACTIVATE' | 'PROMOTE' | 'MOVE_KNIGHT' | 'CHASE' | 'IMPROVE' | 'BUILD_WALL' | 'PLAY_PROGRESS' }>) {
  if (s.mode !== 'cities-knights') throw new IllegalMove('not in this game');
  // Progress cards check their own timing (the Alchemist goes before the roll).
  if (a.type === 'PLAY_PROGRESS') return playProgressCard(s, me, a);
  const building = s.phase === 'main' || (s.phase === 'special' && a.type !== 'MOVE_KNIGHT' && a.type !== 'CHASE');
  if (!building) throw new IllegalMove('not now');
  const id = me.id;
  const levels = (lv: number) => s.knights.filter((w) => w?.player === id && w.level === lv).length;
  switch (a.type) {
    case 'BUILD_KNIGHT': {
      if (!legalKnightSpots(s, id).includes(a.vertex)) throw new IllegalMove('hire a knight on an empty corner of your road');
      if (levels(1) >= KNIGHTS_PER_LEVEL) throw new IllegalMove('you have no strength-1 knights left');
      payCost(s, me, KNIGHT_COSTS.hire);
      s.knights[a.vertex] = { player: id, level: 1, active: false, since: s.round };
      note(s, { kind: 'knight', player: id, text: 'hire' });
      updateLongestRoad(s);
      return;
    }
    case 'ACTIVATE': {
      const w = knightAt(s, a.vertex);
      if (!w || w.player !== id || w.active) throw new IllegalMove('activate one of your inactive knights');
      payCost(s, me, KNIGHT_COSTS.activate);
      w.active = true;
      w.since = s.round;
      note(s, { kind: 'knight', player: id, text: 'activate' });
      return;
    }
    case 'PROMOTE': {
      const w = knightAt(s, a.vertex);
      if (!w || w.player !== id || w.level >= 3) throw new IllegalMove('promote one of your knights below strength 3');
      if (w.promoted === s.round) throw new IllegalMove('a knight is promoted only once a turn');
      if (w.level === 2 && me.areas.politics < 3) throw new IllegalMove('strength 3 needs Politics at level 3');
      if (levels(w.level + 1) >= KNIGHTS_PER_LEVEL) throw new IllegalMove('you have no knights of that strength left');
      if (s.perks.smith > 0) s.perks.smith -= 1;
      else payCost(s, me, KNIGHT_COSTS.promote);
      w.level = (w.level + 1) as 2 | 3;
      w.promoted = s.round;
      note(s, { kind: 'knight', player: id, text: 'promote' });
      return;
    }
    case 'MOVE_KNIGHT': {
      if (!knightMoves(s, id, a.from).includes(a.to)) throw new IllegalMove("that knight can't go there");
      const w = knightAt(s, a.from)!;
      const rival = knightAt(s, a.to);
      s.knights[a.from] = null;
      s.knights[a.to] = { ...w, active: false };
      if (rival) {
        // The weaker knight's owner moves it to an empty corner along their roads (or it leaves the board).
        note(s, { kind: 'knight', player: id, target: rival.player, text: 'displace' });
        (s.asks ??= []).push({ kind: 'retreat', player: rival.player, from: a.to, knight: rival });
        runAsks(s);
      } else note(s, { kind: 'knight', player: id, text: 'move' });
      updateLongestRoad(s);
      return;
    }
    case 'CHASE': {
      if (!chasers(s, id).includes(a.vertex)) throw new IllegalMove('that knight is not beside the robber');
      knightAt(s, a.vertex)!.active = false;
      s.afterRobber = 'main';
      s.chasing = true;
      s.phase = 'robber';
      note(s, { kind: 'knight', player: id, text: 'chase' });
      return;
    }
    case 'IMPROVE': {
      const cost = improveCost(s, id, a.area);
      if (cost === null) throw new IllegalMove("you can't improve that area");
      const good = AREA_GOOD[a.area];
      if (me.goods[good] < cost) throw new IllegalMove(`you need ${cost} ${good}`);
      const next = me.areas[a.area] + 1;
      // The Metropolis: the first to level 4 takes it; reaching 5 first takes it from a holder still at 4.
      const holder = s.metropolises[a.area];
      const wantsMetropolis = (next === METROPOLIS_LEVEL && !holder) || (next === MAX_LEVEL && holder && holder.player !== id);
      if (wantsMetropolis && !s.buildings.some((b, v) => b?.player === id && b.city && !AREAS.some((g) => s.metropolises[g]?.vertex === v))) {
        throw new IllegalMove('you need a city without a Metropolis to hold it');
      }
      me.goods[good] -= cost;
      s.goodsBank[good] += cost;
      me.areas[a.area] = next;
      s.perks.crane = false;
      note(s, { kind: 'improve', player: id, area: a.area });
      if (wantsMetropolis) crown(s, id, a.area);
      return;
    }
    case 'BUILD_WALL': {
      if (s.buildings[a.vertex]?.player !== id || !s.buildings[a.vertex]!.city || s.walls[a.vertex]) throw new IllegalMove('build a wall around one of your cities');
      if (me.walls >= MAX_WALLS) throw new IllegalMove('you have no walls left');
      payCost(s, me, KNIGHT_COSTS.wall);
      s.walls[a.vertex] = true;
      me.walls += 1;
      note(s, { kind: 'build', player: id, text: 'wall' });
      return;
    }
  }
}

function playProgressCard(s: CatanState, me: CatanPlayer, a: Extract<CatanAction, { type: 'PLAY_PROGRESS' }>) {
  const k = me.progressCards.indexOf(a.progressCard);
  if (k < 0) throw new IllegalMove("you don't hold that progress card");
  if (s.players[s.turn].id !== me.id) throw new IllegalMove('play progress cards on your own turn');
  // Every progress card is played after the roll, except the Alchemist, which is played instead of it.
  if (a.progressCard === 'alchemist' ? s.phase !== 'roll' : s.phase !== 'main') {
    throw new IllegalMove(a.progressCard === 'alchemist' ? 'play the Alchemist before you roll' : 'play progress cards after rolling, on your turn');
  }
  // Seat order from you: the order in which other players answer.
  const others = Array.from({ length: s.players.length - 1 }, (_, i) => s.players[(seatOf(s, me.id) + 1 + i) % s.players.length]).filter((p) => !p.out);
  const points = (p: CatanPlayer) => victoryPoints(s, p.id, false);
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
  me.progressCards.splice(k, 1);
  s.progressCardDecks[PROGRESS_AREA[a.progressCard]].push(a.progressCard);
  note(s, { kind: 'progressCard', player: me.id, progressCard: a.progressCard, text: 'play' });
  switch (a.progressCard) {
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
      const r: Resource = a.progressCard === 'irrigation' ? 'grain' : 'ore';
      const n = Math.min(s.bank[r], 2 * mineTiles(a.progressCard === 'irrigation' ? 'fields' : 'mountains').size);
      s.bank[r] -= n;
      me.hand[r] += n;
      return;
    }
    case 'engineer': {
      const v = a.vertex ?? -1;
      if (s.buildings[v]?.player !== me.id || !s.buildings[v]!.city || s.walls[v] || me.walls >= MAX_WALLS) throw new IllegalMove('choose one of your cities without a wall');
      s.walls[v] = true;
      me.walls += 1;
      return;
    }
    case 'roadbuilding':
      s.freeRoads = Math.min(2, LIMITS.road - count(s, me.id, 'road'));
      if (s.freeRoads > 0 && legalRoadSpots(s, me.id).length > 0) s.phase = 'roadBuilding';
      else s.freeRoads = 0;
      return;
    case 'medicine':
      s.perks.medicine = true;
      return;
    case 'smith':
      s.perks.smith = 2;
      return;
    case 'crane':
      s.perks.crane = true;
      return;
    case 'warlord':
      for (const w of s.knights) if (w?.player === me.id && !w.active) Object.assign(w, { active: true, since: s.round });
      return;
    case 'bishop':
      if (!s.attacked) throw new IllegalMove('the robber stays put until the barbarians first land');
      s.bishop = true;
      s.afterRobber = 'main';
      s.phase = 'robber';
      return;
    case 'deserter': {
      const p = pickPlayer();
      if (knightsOf(s, p.id).length === 0) throw new IllegalMove('that player has no knights');
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
      const w = knightAt(s, v);
      if (!w || w.player === me.id || !geo.vertices[v].edges.some((e) => s.roads[e] === me.id)) throw new IllegalMove("choose a rival's knight on a corner touching your road");
      s.knights[v] = null;
      note(s, { kind: 'knight', player: me.id, target: w.player, text: 'displace' });
      asks.push({ kind: 'retreat', player: w.player, from: v, knight: w });
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
      if (p.progressCards.length === 0) throw new IllegalMove('that player holds no progress cards');
      asks.push({ kind: 'spy', player: me.id, from: p.id });
      runAsks(s);
      return;
    }
    case 'merchant': {
      const t = a.tile ?? -1;
      if (!(t >= 0 && t < geo.tiles.length) || !isLand(s.board.terrain[t]) || !geo.tiles[t].corners.some((c) => s.buildings[c]?.player === me.id)) {
        throw new IllegalMove('put the merchant on a land tile next to your settlement or city');
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
      throw new IllegalMove('that progress card is played the moment it is drawn');
  }
}

function forfeit(prev: CatanState, id: string): CatanState {
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
  // Cities & Knights: choices owed by, or about, the player who left fall away.
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
  if (s.phase === 'setup' && catanActor(s) === id) advanceSetup(s);
  else if (s.phase === 'discard' && s.discards.length === 0) s.phase = 'robber';
  else if (s.phase === 'special' && s.special.length === 0) startTurn(s, nextSeat(s, s.turn));
  else if (s.phase === 'gold' && s.gold.length === 0) s.phase = 'main';
  else if (s.turn === k && s.phase !== 'setup') startTurn(s, nextSeat(s, k));
  return finish(s);
}

/** A player's view: others' hands and development cards become counts, a robbery
 *  names its card only to the two players in it, and the deck is hidden. */
export function redactCatan(s: CatanState, viewer: string): CatanState {
  // Cities & Knights: a Master Merchant is shown the other player's cards, a Spy their progress cards, while choosing.
  const ask = s.asks?.[0];
  const shown = ask && ask.player === viewer && (ask.kind === 'take' || ask.kind === 'spy') ? ask : null;
  return {
    ...s,
    seed: 0,
    deck: [],
    progressCardDecks: { trade: [], politics: [], science: [] },
    players: s.players.map((p) => {
      if (p.id === viewer || s.over) return p;
      const hidden = { ...p, hand: emptyHand(), devCards: [], goods: emptyGoods(), progressCards: [] };
      if (shown?.from !== p.id) return hidden;
      return shown.kind === 'take' ? { ...hidden, hand: p.hand, goods: p.goods } : { ...hidden, progressCards: p.progressCards };
    }),
    log: s.log.map((e) => (e.kind === 'steal' && e.player !== viewer && e.target !== viewer ? { ...e, cards: undefined, goods: undefined } : e)),
  };
}

export const catanKit: GameKit<CatanState, CatanAction> = {
  seatError(count, options) {
    if ((options as CatanOptions | undefined)?.mode === 'seafarers') return count >= 3 && count <= 4 ? null : 'Seafarers is for 3 or 4 players';
    if ((options as CatanOptions | undefined)?.mode === 'cities-knights') return count >= 3 && count <= 4 ? null : 'Cities & Knights is for 3 or 4 players';
    return count >= MIN_SEATS && count <= MAX_SEATS ? null : `Catan is for ${MIN_SEATS} to ${MAX_SEATS} players`;
  },
  create: (seats, seed, options) => createCatan(seats, seed, options),
  apply: applyHex,
  actor: catanActor,
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand = Math.random) => catanBot(s, rand),
  // An idle player: ends the turn, declines or withdraws an offer; other steps are played sensibly for them.
  timeout(s) {
    // An owed choice is made sensibly for an idle player.
    if (s.asks?.length) return catanBot(s, Math.random);
    if (s.phase === 'main' || s.phase === 'special') return { type: 'END_TURN' };
    if (s.phase === 'offer') return s.offer!.asked.length ? { type: 'ANSWER', accept: false } : { type: 'CLOSE_OFFER', with: null };
    return catanBot(s, Math.random);
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
  redact: redactCatan,
  turnMs: 60_000,
};
