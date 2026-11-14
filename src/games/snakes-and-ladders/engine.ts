/**
 * Snakes & Ladders on the classic 100-square board, with the ladders and snakes
 * of Milton Bradley's 1952 board. Everyone starts off the board (square 0). On a
 * turn you roll one die and walk that many squares; ending on a ladder's foot
 * climbs it, ending on a snake's head slides down it. A 6 rolls again. You must
 * land on 100 exactly: a roll that would overshoot walks to 100 and bounces back
 * the rest of the way. The first to reach 100 wins.
 */
import { IllegalMove, nextRandom, rollDie, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

export const LADDERS: Record<number, number> = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
export const SNAKES: Record<number, number> = { 16: 6, 48: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
export const FINISH = 100;

export interface SnlPlayer extends KitPlayer {
  /** 0 = waiting off the board. */
  pos: number;
  /** Left the game (only the remaining players take turns). */
  out?: boolean;
}

export interface SnlMove {
  player: string;
  roll: number;
  from: number;
  /** Every square walked through, in order (including a bounce back from 100). */
  path: number[];
  /** A ladder climbed or snake slid, from the square walked to. */
  via: { kind: 'ladder' | 'snake'; from: number; to: number } | null;
  to: number;
  /** A 6: the same player rolls again. */
  again: boolean;
  seq: number;
}

export interface SnlState {
  players: SnlPlayer[];
  turn: number;
  last: SnlMove | null;
  /** The most recent moves, newest first. */
  history: SnlMove[];
  winner: string | null;
  over: boolean;
  game: number;
  score: Record<string, number>;
  seed: number;
}

export type SnlAction = { type: 'ROLL' };

const HISTORY = 30;

/** The squares a roll walks, and where the token ends before any ladder or snake. */
export function walk(from: number, roll: number): number[] {
  const path: number[] = [];
  let at = from;
  let dir = 1;
  for (let i = 0; i < roll; i++) {
    if (at === FINISH) dir = -1; // bounce back off 100
    at += dir;
    path.push(at);
  }
  return path;
}

const active = (s: SnlState) => s.players.filter((p) => !p.out);

function nextTurn(s: SnlState, from: number): number {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (from + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return from;
}

function newGame(s: SnlState, game: number): SnlState {
  return { ...s, players: s.players.map((p) => ({ ...p, pos: 0 })), turn: 0, last: null, history: [], winner: null, over: false, game };
}

export function createSnl(seats: KitSeat[], seed: number): SnlState {
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty, pos: 0 }));
  const base = { players, score: Object.fromEntries(players.map((p) => [p.id, 0])), seed } as SnlState;
  return newGame(base, 1);
}

export function applySnl(s: SnlState, action: SnlAction | KitCommonAction, actorId: string): SnlState {
  const me = s.players.find((p) => p.id === actorId);
  if (!me) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || active(s).length < 2) throw new IllegalMove('the game is still on');
    const [, seed] = nextRandom(s.seed);
    return newGame({ ...s, seed }, s.game + 1);
  }
  if (s.over) throw new IllegalMove('the game is over');
  if (action.type === 'RESIGN') return snlKit.forfeit(s, actorId);
  if (action.type !== 'ROLL') throw new IllegalMove('unknown action');
  if (s.players[s.turn].id !== actorId) throw new IllegalMove('not your turn');

  const [roll, seed] = rollDie(s.seed);
  const path = walk(me.pos, roll);
  const landed = path[path.length - 1];
  const via = LADDERS[landed] ? { kind: 'ladder' as const, from: landed, to: LADDERS[landed] } : SNAKES[landed] ? { kind: 'snake' as const, from: landed, to: SNAKES[landed] } : null;
  const to = via ? via.to : landed;
  const won = to === FINISH;
  const again = roll === 6 && !won;
  const move: SnlMove = { player: actorId, roll, from: me.pos, path, via, to, again, seq: (s.last?.seq ?? 0) + 1 };
  const players = s.players.map((p) => (p.id === actorId ? { ...p, pos: to } : p));
  const next: SnlState = { ...s, players, seed, last: move, history: [move, ...s.history].slice(0, HISTORY) };
  if (won) return { ...next, winner: actorId, over: true, score: { ...s.score, [actorId]: (s.score[actorId] ?? 0) + 1 } };
  return { ...next, turn: again ? s.turn : nextTurn(s, s.turn) };
}

/** How long a move takes to watch: the walk, then any climb or slide. */
export function moveMs(m: SnlMove | null): number {
  if (!m) return 0;
  return m.path.length * 150 + (m.via ? 750 : 0);
}

export const snlKit: GameKit<SnlState, SnlAction> = {
  seatError: (count) => (count >= 2 && count <= 6 ? null : 'Snakes & Ladders is for 2–6 players'),
  create: (seats, seed) => createSnl(seats, seed),
  apply: applySnl,
  actor: (s) => (s.over ? null : s.players[s.turn].id),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: () => ({ type: 'ROLL' }),
  timeout: () => ({ type: 'ROLL' }),
  // Let the last move play out before the next roll.
  botDelay: (s) => 650 + moveMs(s.last),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => {
    const players = s.players.map((p) => (p.id === id ? { ...p, out: true } : p));
    const left = players.filter((p) => !p.out);
    const next = { ...s, players };
    if (s.over) return next;
    if (left.length === 1) {
      const winner = left[0].id;
      return { ...next, over: true, winner, score: { ...s.score, [winner]: (s.score[winner] ?? 0) + 1 } };
    }
    return s.players[s.turn].id === id ? { ...next, turn: nextTurn(next, s.turn) } : next;
  },
  end: (s) => ({ ...s, over: true }),
  redact: (s) => s,
  turnMs: 20_000,
};
