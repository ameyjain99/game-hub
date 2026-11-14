/**
 * The contract every "kit" game engine implements: Tic-Tac-Toe, Checkers, Chess,
 * Snakes & Ladders, Ludo and Sequence. One contract lets a single server adapter
 * (`kitAdapter`), a single local runner (`useLocalKit`) and a single online
 * wrapper (`KitOnline`) serve them all.
 *
 * Engines stay pure: `apply` returns a new state and never mutates its input,
 * and all randomness comes from a seed carried in the state.
 */

/** Thrown by `apply` for an action that isn't legal (or isn't the actor's to make). */
export class IllegalMove extends Error {}

/** A seat as the room (or the local setup) hands it to `create`. */
export interface KitSeat {
  name: string;
  isAI: boolean;
  difficulty?: string;
}

/** The player fields every kit game keeps; engines add their own. */
export interface KitPlayer {
  id: string;
  name: string;
  isAI: boolean;
  difficulty?: string;
}

/** Every kit game accepts these alongside its own actions. */
export type KitCommonAction =
  /** Once the game is over, any human may start another with the same seats. */
  | { type: 'REMATCH' }
  /** Give up: the player leaves the result (and, in a two-player game, loses). */
  | { type: 'RESIGN' };

export interface GameKit<S, A extends { type: string }> {
  /** Null if this many seats can play, else the reason they can't. */
  seatError(count: number, options?: unknown): string | null;
  create(seats: KitSeat[], seed: number, options?: unknown): S;
  /** `actorId`'s action applied; throws IllegalMove if it's illegal or not theirs. */
  apply(state: S, action: A | KitCommonAction, actorId: string): S;
  /** The player who must act now; null once the game is over. */
  actor(state: S): string | null;
  players(state: S): KitPlayer[];
  isOver(state: S): boolean;
  /** The current actor's bot move. `rand` drives any randomness in its choice. */
  bot(state: S, rand?: () => number): A;
  /** What happens when an idle human's turn clock runs out (a cautious move for them). */
  timeout(state: S): A;
  /** How long a bot waits before acting in this state, so its moves can be followed. */
  botDelay?(state: S): number;
  /** Hand a seat to a bot (a dropped player). */
  setBot(state: S, playerId: string, difficulty: string): S;
  /** Take a seat out of the game (it resigns). */
  forfeit(state: S, playerId: string): S;
  /** End the game now (the room was abandoned). */
  end(state: S): S;
  /** The state `viewer` may see. */
  redact(state: S, viewer: string): S;
  /** A human's turn length online before `timeout` plays for them (default 45s). */
  turnMs?: number;
  /** Whether the room's turn clock runs at all (Chess plays untimed). */
  untimed?: boolean;
}

/** The default pause before a bot acts. */
export const BOT_DELAY_MS = 700;

/** Shorthand for a kit's player list lookup. */
export function playerById<P extends KitPlayer>(players: P[], id: string): P | undefined {
  return players.find((p) => p.id === id);
}

/** A small seeded RNG step (mulberry32) over a numeric state, for engines that
 *  keep their seed in plain JSON: returns [value in 0..1, next seed]. */
export function nextRandom(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** A die roll from a seed: [1..6, next seed]. */
export function rollDie(seed: number): [number, number] {
  const [r, next] = nextRandom(seed);
  return [1 + Math.floor(r * 6), next];
}

/** A seeded Fisher–Yates shuffle: [shuffled copy, next seed]. */
export function shuffle<T>(items: readonly T[], seed: number): [T[], number] {
  const out = items.slice();
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(s);
    s = next;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, s];
}
