import { makeRng, type Rng } from '../../../shared/rng';
import { boardOf, isMega, ownableIds, spaceName, spacesOf, type BoardId } from './board';
import { MEGA } from './mega';
import { CHANCE, CHEST } from './cards';
import { playerIdForSeat } from '../../../net/protocol';

/** Bot strength. 'easy' buys/never trades; 'normal' plays a competent game;
 *  'hard' actively pursues monopolies and manages cash. */
export type MonopolyDifficulty = 'easy' | 'normal' | 'hard';

/** Turn phases. `roll` starts a turn; `jail` is the start-of-turn jail decision;
 *  `action` is the post-move management phase; `auction`/`trade` are interactive
 *  sub-phases other seats act into; `over` once a winner is decided. */
type Phase = 'roll' | 'jail' | 'action' | 'auction' | 'trade' | 'over';

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
  /** Rounds to play before the highest net worth wins; 0 plays until one player is left. */
  roundLimit: number;
  /** Which places are on the board (the squares and prices are the same on all). */
  board: BoardId;
  /** Paid for passing or landing on Go. */
  goSalary: number;
  /** The fine to leave Jail. */
  jailFine: number;
  /** Turns you may roll for doubles in Jail before you must pay. */
  jailTurns: number;
  /** A fixed prize the bank pays for landing on Free Parking (0: none). */
  freeParkingPrize: number;
  /** Income Tax is the lower of its printed amount and 10% of your net worth. */
  incomeTaxTenPercent: boolean;
  /** A property can be bought (or auctioned) only by a player who has passed Go once. */
  firstLapBuy: boolean;
  /** Title deeds dealt to each player at the start, paid for at the printed price (0: none). */
  dealtProperties: number;
  /** Seconds on the online turn clock. */
  turnSeconds: number;
}

/** The values each numeric setting may take (anything else falls back to the default). */
export const SETTING_CHOICES = {
  goSalary: [100, 200, 300, 400],
  jailFine: [50, 100, 200],
  jailTurns: [1, 2, 3],
  freeParkingPrize: [0, 100, 250, 500],
  dealtProperties: [0, 2, 3],
  turnSeconds: [60, 90, 120, 180],
} as const;

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
  roundLimit: 0,
  board: 'neo',
  goSalary: 200,
  jailFine: 50,
  jailTurns: 3,
  freeParkingPrize: 0,
  incomeTaxTenPercent: false,
  firstLapBuy: false,
  dealtProperties: 0,
  turnSeconds: 90,
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
  /** Failed roll-for-doubles attempts while jailed (0-3). */
  jailRolls: number;
  getOutCards: number;
  bankrupt: boolean;
  /** Has passed (or landed on) Go at least once: matters when buying waits for a first lap. */
  passedGo?: boolean;
  /** Mega: Bus Tickets held (kept face up, so everyone can see the count). */
  busTickets?: number;
}

/** A face of the Mega Edition's speed die: 1, 2 or 3 pips, a bus, or Mr. Monopoly (two faces). */
export type SpeedFace = 1 | 2 | 3 | 'bus' | 'mr';
export const SPEED_FACES: SpeedFace[] = [1, 2, 3, 'bus', 'mr', 'mr'];

/**
 * Mega: something the player to move must decide before the turn goes on.
 *  - triples: all three dice matched; move to any square.
 *  - auction: landed on Auction; name an unowned property for the bank to auction.
 *  - birthday: landed on Birthday Gift; take the money or a Bus Ticket.
 */
type PendingChoice = { kind: 'triples' } | { kind: 'auction' } | { kind: 'birthday' };

/** Per-space ownership. `houses` 0-4; 5 means a hotel; 6 a skyscraper (Mega). */
interface Ownership {
  owner: string | null;
  houses: number;
  mortgaged: boolean;
  /** Mega: a train depot stands on this railroad. */
  depot?: boolean;
}

interface PendingAuction {
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
  /** Mega: Bus Tickets changing hands. */
  busTickets?: number;
}

export interface PendingTrade {
  from: string;
  to: string;
  give: TradeBundle;
  receive: TradeBundle;
}

export interface DrawnCard {
  deck: 'chance' | 'chest';
  text: string;
  playerId: string;
  /** The `rollSeq` of the roll that led to the draw. */
  atRoll: number;
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
  /** Counts every roll of the dice, so the UI can tell a new roll from a repeat
   *  of the same faces. */
  rollSeq: number;
  /** The Chance/Community Chest card drawn most recently (public), and the roll
   *  it came from, so the UI can reveal it during that roll's turn. */
  lastCard: DrawnCard | null;
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
  /** Mega: skyscrapers and train depots the bank still has. */
  skyscrapersLeft?: number;
  depotsLeft?: number;
  /** Mega: the speed die as last rolled (null when it was not rolled, as in Jail). */
  speedDie?: SpeedFace | null;
  /** Mega: the speed die's bonus still to take, once the ordinary move is dealt with. */
  bonus?: 'mr' | 'bus' | null;
  /** Mega: a decision the player to move owes. */
  choice?: PendingChoice | null;
  /** Mega: the Bus Ticket deck, top first (true: an "all other tickets expire" ticket). Hidden from players. */
  busDeck?: boolean[];
  /** Mega: how many Bus Tickets are left in the deck (public). */
  busLeft?: number;
  freeParkingPot: number;
  /** Count of individual turns taken - a safety net to end pathological games. */
  turns: number;
  /** The round being played (1 first); everyone has one turn in a round. */
  round: number;
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

/** Fisher-Yates shuffle of [0..n) using the seeded RNG. */
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
  s.board = boardOf(s.board);
  const mega = isMega(s.board);
  // The Mega Edition starts everyone with 2,500 unless the host chose another amount.
  if (mega && settings?.startingCash === undefined) s.startingCash = MEGA.startingCash;
  const OWNABLE = ownableIds(s.board);
  const BOARD = spacesOf(s.board);
  for (const key of Object.keys(SETTING_CHOICES) as (keyof typeof SETTING_CHOICES)[]) {
    if (!(SETTING_CHOICES[key] as readonly number[]).includes(s[key])) s[key] = DEFAULT_SETTINGS[key];
  }
  // Settings arrive from a client: anything that is not a sane amount or a switch falls back to the standard rule.
  const whole = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max;
  if (!whole(s.startingCash, 100, 10_000)) s.startingCash = mega ? MEGA.startingCash : DEFAULT_SETTINGS.startingCash;
  if (!whole(s.roundLimit, 0, 200)) s.roundLimit = DEFAULT_SETTINGS.roundLimit;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (typeof DEFAULT_SETTINGS[key] === 'boolean' && typeof s[key] !== 'boolean') (s as unknown as Record<string, unknown>)[key] = DEFAULT_SETTINGS[key];
  }
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
  for (const id of OWNABLE) ownership[id] = { owner: null, houses: 0, mortgaged: false };

  // The short game: title deeds dealt out before the first roll, each paid for at its printed price.
  const log: string[] = [];
  if (s.dealtProperties > 0) {
    const deeds = shuffled(OWNABLE.length, rng).map((i) => OWNABLE[i]);
    for (const seat of turnOrder) {
      const mine = deeds.splice(0, s.dealtProperties);
      for (const id of mine) {
        ownership[id].owner = players[seat].id;
        players[seat].cash -= BOARD[id].price ?? 0;
      }
      log.push(`{${players[seat].id}} was dealt ${mine.map((id) => spaceName(id, s.board)).join(' and ')}`);
    }
  }

  const chanceOrder = shuffled(CHANCE.length, rng);
  const chestOrder = shuffled(CHEST.length, rng);
  // Mega: 16 Bus Tickets, three of which make all the others held expire. Shuffled after everything else, so a seed deals a standard game the same way on every board.
  const busDeck = mega ? shuffled(MEGA.busTickets, rng).map((i) => i < MEGA.expiringTickets) : undefined;

  return {
    players,
    turnOrder,
    current: 0,
    phase: 'roll',
    settings: s,
    ownership,
    dice: null,
    rollSeq: 0,
    lastCard: null,
    doubles: 0,
    pendingPurchase: null,
    chanceOrder,
    chestOrder,
    chancePtr: 0,
    chestPtr: 0,
    chanceJailOut: false,
    chestJailOut: false,
    housesLeft: 32,
    hotelsLeft: 12,
    ...(mega ? { skyscrapersLeft: MEGA.skyscrapers, depotsLeft: MEGA.depots, speedDie: null, bonus: null, choice: null, busDeck, busLeft: MEGA.busTickets } : {}),
    freeParkingPot: 0,
    turns: 0,
    round: 1,
    tradesThisTurn: 0,
    pendingAuction: null,
    pendingTrade: null,
    pendingDebt: null,
    log,
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
