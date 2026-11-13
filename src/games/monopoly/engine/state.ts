import { makeRng, type Rng } from '../../../shared/rng';
import { OWNABLE_IDS } from './board';
import { CHANCE, CHEST } from './cards';
import { playerIdForSeat } from '../../../net/protocol';

/** Bot strength. 'easy' buys/never trades; 'normal' plays a competent game;
 *  'hard' actively pursues monopolies and manages cash. */
export type MonopolyDifficulty = 'easy' | 'normal' | 'hard';

/** Turn phases. `roll` starts a turn; `jail` is the start-of-turn jail decision;
 *  `action` is the post-move management phase; `auction`/`trade` are interactive
 *  sub-phases other seats act into; `over` once a winner is decided. */
export type Phase = 'roll' | 'jail' | 'action' | 'auction' | 'trade' | 'over';

export interface Settings {
  startingCash: number;
  auctions: boolean;
  mortgaging: boolean;
  evenBuild: boolean;
  doubleRentFullSet: boolean;
  freeParkingJackpot: boolean;
  doubleGoSalary: boolean;
  noRentInJail: boolean;
  randomizeOrder: boolean;
}

/** RAW-correct defaults; house rules (jackpot, double-Go, no-rent-in-jail) off. */
export const DEFAULT_SETTINGS: Settings = {
  startingCash: 1500,
  auctions: true,
  mortgaging: true,
  evenBuild: true,
  doubleRentFullSet: true,
  freeParkingJackpot: false,
  doubleGoSalary: false,
  noRentInJail: false,
  randomizeOrder: true,
};

export interface MonopolyPlayer {
  id: string;
  name?: string;
  avatar: string;
  isAI: boolean;
  difficulty?: MonopolyDifficulty;
  cash: number;
  position: number;
  inJail: boolean;
  /** Failed roll-for-doubles attempts while jailed (0–3). */
  jailRolls: number;
  getOutCards: number;
  bankrupt: boolean;
}

/** Per-space ownership. `houses` 0–4; 5 means a hotel. */
export interface Ownership {
  owner: string | null;
  houses: number;
  mortgaged: boolean;
}

export interface PendingAuction {
  spaceId: number;
  /** Seat indices still eligible to bid, in bidding order. */
  participants: number[];
  /** Seat indices that have passed. */
  passed: number[];
  highBid: number;
  highBidder: number | null;
  /** Whose bid/pass is awaited (seat index). */
  turn: number;
}

export interface TradeBundle {
  cash: number;
  properties: number[];
  getOutCards: number;
}

export interface PendingTrade {
  from: string;
  to: string;
  give: TradeBundle;
  receive: TradeBundle;
}

export interface SeatConfig {
  name?: string;
  avatar: string;
  isAI: boolean;
  difficulty?: MonopolyDifficulty;
}

export interface MonopolyState {
  players: MonopolyPlayer[];
  /** Play order as seat indices; `current` indexes into this list. */
  turnOrder: number[];
  current: number;
  phase: Phase;
  settings: Settings;
  ownership: Record<number, Ownership>;
  dice: [number, number] | null;
  /** Consecutive doubles this turn (3 → jail). */
  doubles: number;
  /** The space the current player just landed on and may buy, or null. */
  pendingPurchase: number | null;
  chanceOrder: number[];
  chestOrder: number[];
  chancePtr: number;
  chestPtr: number;
  /** True while a deck's Get-Out-of-Jail card is held by a player (out of play). */
  chanceJailOut: boolean;
  chestJailOut: boolean;
  housesLeft: number;
  hotelsLeft: number;
  freeParkingPot: number;
  /** Count of individual turns taken — a safety net to end pathological games. */
  turns: number;
  /** Trade offers made this turn (bots propose at most one, so they can't loop). */
  tradesThisTurn: number;
  pendingAuction: PendingAuction | null;
  pendingTrade: PendingTrade | null;
  /** An unsettled debt: the current player's cash is negative and they must
   *  liquidate or declare bankruptcy before ending the turn. */
  pendingDebt: { debtor: number; creditor: number | null } | null;
  log: string[];
  winner: string | null;
  rngState: number;
}

/** Fisher–Yates shuffle of [0..n) using the seeded RNG. */
function shuffled(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createMonopolyGame(
  configs: SeatConfig[],
  seed: number,
  settings?: Partial<Settings>,
): MonopolyState {
  const s: Settings = { ...DEFAULT_SETTINGS, ...settings };
  const rng = makeRng(seed);

  const players: MonopolyPlayer[] = configs.map((c, i) => ({
    id: playerIdForSeat(i),
    name: c.name,
    avatar: c.avatar,
    isAI: c.isAI,
    difficulty: c.difficulty ?? 'normal',
    cash: s.startingCash,
    position: 0,
    inJail: false,
    jailRolls: 0,
    getOutCards: 0,
    bankrupt: false,
  }));

  const turnOrder = s.randomizeOrder
    ? shuffled(players.length, rng)
    : players.map((_, i) => i);

  const ownership: Record<number, Ownership> = {};
  for (const id of OWNABLE_IDS) ownership[id] = { owner: null, houses: 0, mortgaged: false };

  return {
    players,
    turnOrder,
    current: 0,
    phase: 'roll',
    settings: s,
    ownership,
    dice: null,
    doubles: 0,
    pendingPurchase: null,
    chanceOrder: shuffled(CHANCE.length, rng),
    chestOrder: shuffled(CHEST.length, rng),
    chancePtr: 0,
    chestPtr: 0,
    chanceJailOut: false,
    chestJailOut: false,
    housesLeft: 32,
    hotelsLeft: 12,
    freeParkingPot: 0,
    turns: 0,
    tradesThisTurn: 0,
    pendingAuction: null,
    pendingTrade: null,
    pendingDebt: null,
    log: [],
    winner: null,
    rngState: rng.state,
  };
}

/** The seat index whose turn it currently is (ignores sub-phases). */
export function currentSeat(state: MonopolyState): number {
  return state.turnOrder[state.current];
}

/** The player whose turn it currently is. */
export function currentPlayer(state: MonopolyState): MonopolyPlayer {
  return state.players[currentSeat(state)];
}
