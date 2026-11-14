/**
 * Tic-Tac-Toe as a running series between two players: each round, the player
 * who starts plays X; starts alternate round to round; the score carries over.
 * "REMATCH" deals the next round.
 *
 * The bot plays Newell & Simon's rule-based strategy (win, block, fork, block a
 * fork, centre, opposite corner, corner, side), which never loses.
 */
import { IllegalMove, nextRandom, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type TttDifficulty = 'easy' | 'normal' | 'hard';

export interface TttState {
  players: KitPlayer[];
  board: Cell[];
  round: number;
  /** Who plays X (and so moved first) this round. */
  xId: string;
  /** Whose move it is. */
  turn: string;
  /** Cells in the order they were played this round. */
  moves: number[];
  /** The three cells of the winning line, once there is one. */
  winLine: number[] | null;
  /** This round's winner; null while playing or for a draw. */
  winner: string | null;
  roundOver: boolean;
  score: Record<string, number>;
  draws: number;
  /** Someone left: the series is over for good. */
  closed: boolean;
  seed: number;
}

export type TttAction = { type: 'PLACE'; cell: number };

export const LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const CORNERS = [0, 2, 6, 8];
const SIDES = [1, 3, 5, 7];
const OPPOSITE: Record<number, number> = { 0: 8, 2: 6, 6: 2, 8: 0 };

export const markOf = (s: TttState, id: string): Mark => (s.xId === id ? 'X' : 'O');
const other = (s: TttState, id: string): string => s.players.find((p) => p.id !== id)!.id;

export function winningLine(board: Cell[]): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [...line];
  }
  return null;
}

/** Cells that would complete a line of `mark`'s right now. */
function winningCells(board: Cell[], mark: Mark): number[] {
  const out = new Set<number>();
  for (const line of LINES) {
    const own = line.filter((i) => board[i] === mark).length;
    const empty = line.filter((i) => board[i] === null);
    if (own === 2 && empty.length === 1) out.add(empty[0]);
  }
  return [...out];
}

const empties = (board: Cell[]) => board.flatMap((c, i) => (c === null ? [i] : []));
const put = (board: Cell[], i: number, mark: Mark): Cell[] => board.map((c, j) => (j === i ? mark : c));
const flip = (m: Mark): Mark => (m === 'X' ? 'O' : 'X');

/** Cells where `mark` would make a fork (two open lines at once). */
function forkCells(board: Cell[], mark: Mark): number[] {
  return empties(board).filter((i) => winningCells(put(board, i, mark), mark).length >= 2);
}

/**
 * The cells Newell & Simon's strategy allows for `mark` here, from its first
 * rule that applies: win, block, fork, block the opponent's fork, centre,
 * opposite corner, empty corner, empty side. Any of them is a perfect move.
 */
export function strategyMoves(board: Cell[], mark: Mark): number[] {
  const opp = flip(mark);
  const win = winningCells(board, mark);
  if (win.length) return win;
  const block = winningCells(board, opp);
  if (block.length) return block;
  const fork = forkCells(board, mark);
  if (fork.length) return fork;

  const oppForks = forkCells(board, opp);
  if (oppForks.length === 1) return oppForks;
  if (oppForks.length > 1) {
    // Make a two in a row that forces a reply the opponent can't turn into a fork.
    const forcing = empties(board).filter((i) => {
      const after = put(board, i, mark);
      const threats = winningCells(after, mark);
      if (threats.length === 0) return false;
      return threats.every((reply) => winningCells(put(after, reply, opp), opp).length < 2);
    });
    if (forcing.length) return forcing;
    return oppForks;
  }

  if (board[4] === null) return [4];
  const opposite = CORNERS.filter((c) => board[c] === opp && board[OPPOSITE[c]] === null).map((c) => OPPOSITE[c]);
  if (opposite.length) return opposite;
  const corners = CORNERS.filter((c) => board[c] === null);
  if (corners.length) return corners;
  return SIDES.filter((c) => board[c] === null);
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

/** The bot's cell for the player to move. */
export function botCell(s: TttState, rand: () => number = Math.random): number {
  const me = s.players.find((p) => p.id === s.turn)!;
  const mark = markOf(s, me.id);
  const open = empties(s.board);
  const level = (me.difficulty ?? 'hard') as TttDifficulty;
  if (level === 'easy') {
    const win = winningCells(s.board, mark);
    if (win.length && rand() < 0.7) return pick(win, rand);
    return pick(open, rand);
  }
  if (level === 'normal' && rand() < 0.25) {
    // An occasional slip – but it still takes a win and blocks a loss.
    const urgent = [...winningCells(s.board, mark), ...winningCells(s.board, flip(mark))];
    return pick(urgent.length ? urgent : open, rand);
  }
  return pick(strategyMoves(s.board, mark), rand);
}

function newRound(s: TttState, round: number): TttState {
  // Starts alternate: p0 opens odd rounds, p1 even ones.
  const xId = s.players[(round - 1) % 2].id;
  return { ...s, board: Array(9).fill(null), round, xId, turn: xId, moves: [], winLine: null, winner: null, roundOver: false };
}

export function createTtt(seats: KitSeat[], seed: number): TttState {
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty }));
  const base: TttState = {
    players,
    board: [],
    round: 1,
    xId: 'p0',
    turn: 'p0',
    moves: [],
    winLine: null,
    winner: null,
    roundOver: false,
    score: Object.fromEntries(players.map((p) => [p.id, 0])),
    draws: 0,
    closed: false,
    seed,
  };
  return newRound(base, 1);
}

export function applyTtt(s: TttState, action: TttAction | KitCommonAction, actorId: string): TttState {
  if (!s.players.some((p) => p.id === actorId)) throw new IllegalMove('not in this game');
  switch (action.type) {
    case 'PLACE': {
      if (s.roundOver || s.closed) throw new IllegalMove('the round is over');
      if (s.turn !== actorId) throw new IllegalMove('not your turn');
      const cell = action.cell;
      if (!Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell] !== null) throw new IllegalMove('that square is taken');
      const board = put(s.board, cell, markOf(s, actorId));
      const winLine = winningLine(board);
      const moves = [...s.moves, cell];
      if (winLine) {
        return { ...s, board, moves, winLine, winner: actorId, roundOver: true, score: { ...s.score, [actorId]: s.score[actorId] + 1 } };
      }
      if (moves.length === 9) return { ...s, board, moves, roundOver: true, draws: s.draws + 1 };
      return { ...s, board, moves, turn: other(s, actorId) };
    }
    case 'REMATCH': {
      if (!s.roundOver || s.closed) throw new IllegalMove('the round is still on');
      const [, seed] = nextRandom(s.seed);
      return newRound({ ...s, seed }, s.round + 1);
    }
    case 'RESIGN': {
      if (s.roundOver || s.closed) throw new IllegalMove('the round is over');
      const winner = other(s, actorId);
      return { ...s, winner, roundOver: true, score: { ...s.score, [winner]: s.score[winner] + 1 } };
    }
    default:
      throw new IllegalMove('unknown action');
  }
}

export const ticTacToeKit: GameKit<TttState, TttAction> = {
  seatError: (count) => (count === 2 ? null : 'Tic-Tac-Toe is for 2 players'),
  create: (seats, seed) => createTtt(seats, seed),
  apply: applyTtt,
  actor: (s) => (s.roundOver || s.closed ? null : s.turn),
  players: (s) => s.players,
  isOver: (s) => s.roundOver || s.closed,
  bot: (s, rand) => ({ type: 'PLACE', cell: botCell(s, rand) }),
  // An idle player's clock runs out: the strategy plays a safe move for them.
  timeout: (s) => ({ type: 'PLACE', cell: strategyMoves(s.board, markOf(s, s.turn))[0] }),
  botDelay: (s) => (s.moves.length === 0 ? 900 : 650),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => {
    const winner = other(s, id);
    const score = s.roundOver ? s.score : { ...s.score, [winner]: s.score[winner] + 1 };
    return { ...s, closed: true, roundOver: true, winner: s.roundOver ? s.winner : winner, score };
  },
  end: (s) => ({ ...s, closed: true, roundOver: true }),
  redact: (s) => s,
  turnMs: 30_000,
};
