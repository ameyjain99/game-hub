/**
 * Checkers – American checkers / English draughts on an 8×8 board.
 *
 * Rules: the dark squares are played. Black starts on squares 1–12 (top) and
 * moves first; White on 21–32. Men move one square diagonally forward; kings one
 * square in any diagonal direction. Captures are compulsory, the player may
 * choose which capture to make, and a capturing piece must keep jumping while it
 * can – except that a man reaching the far row is crowned and its move ends. A
 * player with no legal move (or no pieces) loses. Forty moves each (80 plies)
 * with no capture and no man moved is a draw.
 *
 * A multi-jump is played one hop per action, so each hop can be seen.
 */
import { IllegalMove, nextRandom, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

export type Side = 'black' | 'white';
/** A square's content: 0 empty; 1 black man, 2 black king; -1 white man, -2 white king. */
export type Piece = number;
export type CheckersDifficulty = 'easy' | 'normal' | 'hard';

export interface CheckersState {
  players: KitPlayer[];
  /** Who plays Black (and so moves first) this game. */
  blackId: string;
  board: Piece[];
  turn: Side;
  /** The square of a piece in the middle of a multi-jump, which must keep jumping. */
  chain: number | null;
  /** The last hop, for highlighting and animation. */
  lastHop: { from: number; to: number; captured: number | null; capturedPiece: Piece; side: Side } | null;
  /** The full move list in checkers notation ("11-15", "22x15x8"). */
  moves: string[];
  /** Plies since the last capture or man move (80 → draw). */
  quiet: number;
  winner: string | null;
  draw: boolean;
  over: boolean;
  /** Why it ended: 'no-moves' | 'resigned' | 'forty-moves' | 'abandoned'. */
  reason: string | null;
  game: number;
  score: Record<string, number>;
  seed: number;
}

export type CheckersAction = { type: 'MOVE'; from: number; to: number };

/** A whole move: the squares visited and the squares captured. */
export interface FullMove {
  path: number[];
  captures: number[];
}

export const DRAW_PLIES = 80;

export const rowOf = (sq: number) => Math.floor(sq / 8);
export const colOf = (sq: number) => sq % 8;
export const isDark = (sq: number) => (rowOf(sq) + colOf(sq)) % 2 === 1;
/** Standard checkers numbering: 1–32 across the dark squares from Black's side. */
export const squareNumber = (sq: number) => rowOf(sq) * 4 + Math.floor(colOf(sq) / 2) + 1;

export const sideOf = (p: Piece): Side | null => (p > 0 ? 'black' : p < 0 ? 'white' : null);
const isKing = (p: Piece) => Math.abs(p) === 2;
const other = (side: Side): Side => (side === 'black' ? 'white' : 'black');

export function initialBoard(): Piece[] {
  return Array.from({ length: 64 }, (_, sq) => {
    if (!isDark(sq)) return 0;
    const r = rowOf(sq);
    return r <= 2 ? 1 : r >= 5 ? -1 : 0;
  });
}

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Diagonal directions a piece may move or capture in. */
function dirsFor(p: Piece): number[][] {
  if (isKing(p)) return DIRS;
  return p > 0 ? DIRS.slice(2) : DIRS.slice(0, 2); // black moves down the board, white up
}

const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
const crowns = (p: Piece, sq: number) => !isKing(p) && ((p > 0 && rowOf(sq) === 7) || (p < 0 && rowOf(sq) === 0));

/** Single jumps from `sq` (landing, captured). */
function jumpsFrom(board: Piece[], sq: number): [number, number][] {
  const p = board[sq];
  const out: [number, number][] = [];
  for (const [dr, dc] of dirsFor(p)) {
    const mid = at(rowOf(sq) + dr, colOf(sq) + dc);
    const land = at(rowOf(sq) + 2 * dr, colOf(sq) + 2 * dc);
    if (mid < 0 || land < 0) continue;
    if (board[land] === 0 && board[mid] !== 0 && sideOf(board[mid]) !== sideOf(p)) out.push([land, mid]);
  }
  return out;
}

/** Every complete capture sequence starting with the piece on `sq`. */
function captureSequences(board: Piece[], sq: number): FullMove[] {
  const out: FullMove[] = [];
  const walk = (b: Piece[], from: number, path: number[], caps: number[]) => {
    const jumps = jumpsFrom(b, from);
    if (jumps.length === 0) {
      if (caps.length) out.push({ path, captures: caps });
      return;
    }
    for (const [land, mid] of jumps) {
      const next = b.slice();
      next[land] = next[from];
      next[from] = 0;
      next[mid] = 0;
      if (crowns(b[from], land)) out.push({ path: [...path, land], captures: [...caps, mid] }); // crowning ends the move
      else walk(next, land, [...path, land], [...caps, mid]);
    }
  };
  walk(board, sq, [sq], []);
  return out;
}

/** All legal whole moves for `side`; captures only, when any exists. */
export function legalMoves(board: Piece[], side: Side): FullMove[] {
  const caps: FullMove[] = [];
  const steps: FullMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (sideOf(p) !== side) continue;
    caps.push(...captureSequences(board, sq));
    if (caps.length) continue;
    for (const [dr, dc] of dirsFor(p)) {
      const to = at(rowOf(sq) + dr, colOf(sq) + dc);
      if (to >= 0 && board[to] === 0) steps.push({ path: [sq, to], captures: [] });
    }
  }
  return caps.length ? caps : steps;
}

/** The hops (from → to) the player to move may make now. */
export function legalHops(s: CheckersState): { from: number; to: number; capture: boolean }[] {
  if (s.over) return [];
  const moves = s.chain !== null ? captureSequences(s.board, s.chain) : legalMoves(s.board, s.turn);
  const seen = new Set<string>();
  const out: { from: number; to: number; capture: boolean }[] = [];
  for (const m of moves) {
    const key = `${m.path[0]}-${m.path[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: m.path[0], to: m.path[1], capture: m.captures.length > 0 });
  }
  return out;
}

/** Apply a whole move to a board (for search). */
function playMove(board: Piece[], m: FullMove): Piece[] {
  const b = board.slice();
  const from = m.path[0];
  const to = m.path[m.path.length - 1];
  let p = b[from];
  b[from] = 0;
  for (const c of m.captures) b[c] = 0;
  if (crowns(p, to)) p *= 2;
  b[to] = p;
  return b;
}

const idOf = (s: CheckersState, side: Side) => (side === 'black' ? s.blackId : s.players.find((p) => p.id !== s.blackId)!.id);
export const sideOfPlayer = (s: CheckersState, id: string): Side => (id === s.blackId ? 'black' : 'white');

function finish(s: CheckersState, winner: string | null, reason: string): CheckersState {
  const score = winner ? { ...s.score, [winner]: (s.score[winner] ?? 0) + 1 } : s.score;
  return { ...s, over: true, winner, draw: winner === null, reason, chain: null, score };
}

function newGame(s: CheckersState, blackId: string, game: number): CheckersState {
  return { ...s, blackId, board: initialBoard(), turn: 'black', chain: null, lastHop: null, moves: [], quiet: 0, winner: null, draw: false, over: false, reason: null, game };
}

export function createCheckers(seats: KitSeat[], seed: number): CheckersState {
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty }));
  const base = { players, score: Object.fromEntries(players.map((p) => [p.id, 0])), seed } as CheckersState;
  return newGame(base, 'p0', 1);
}

export function applyCheckers(s: CheckersState, action: CheckersAction | KitCommonAction, actorId: string): CheckersState {
  if (!s.players.some((p) => p.id === actorId)) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || s.reason === 'abandoned') throw new IllegalMove('the game is still on');
    const [, seed] = nextRandom(s.seed);
    // Colours swap each game.
    return newGame({ ...s, seed }, s.players.find((p) => p.id !== s.blackId)!.id, s.game + 1);
  }
  if (s.over) throw new IllegalMove('the game is over');
  if (action.type === 'RESIGN') return finish(s, s.players.find((p) => p.id !== actorId)!.id, 'resigned');
  if (action.type !== 'MOVE') throw new IllegalMove('unknown action');
  if (idOf(s, s.turn) !== actorId) throw new IllegalMove('not your turn');

  const hop = legalHops(s).find((h) => h.from === action.from && h.to === action.to);
  if (!hop) throw new IllegalMove("that move isn't allowed");

  const board = s.board.slice();
  let piece = board[hop.from];
  const wasMan = !isKing(piece);
  board[hop.from] = 0;
  let captured: number | null = null;
  let capturedPiece: Piece = 0;
  if (hop.capture) {
    captured = at((rowOf(hop.from) + rowOf(hop.to)) / 2, (colOf(hop.from) + colOf(hop.to)) / 2);
    capturedPiece = board[captured];
    board[captured] = 0;
  }
  const crowned = crowns(piece, hop.to);
  if (crowned) piece *= 2;
  board[hop.to] = piece;

  const sep = hop.capture ? 'x' : '-';
  const moves = s.chain !== null ? [...s.moves.slice(0, -1), `${s.moves[s.moves.length - 1]}x${squareNumber(hop.to)}`] : [...s.moves, `${squareNumber(hop.from)}${sep}${squareNumber(hop.to)}`];
  const lastHop = { from: hop.from, to: hop.to, captured, capturedPiece, side: s.turn };
  const quiet = hop.capture || wasMan ? 0 : s.quiet + 1;

  // Keep jumping with the same piece while it can (crowning ends the move).
  if (hop.capture && !crowned && jumpsFrom(board, hop.to).length > 0) {
    return { ...s, board, chain: hop.to, lastHop, moves, quiet };
  }

  const next: CheckersState = { ...s, board, chain: null, turn: other(s.turn), lastHop, moves, quiet };
  if (legalMoves(board, next.turn).length === 0) return finish(next, actorId, 'no-moves');
  if (quiet >= DRAW_PLIES) return finish(next, null, 'forty-moves');
  return next;
}

// ---------------------------------------------------------------------------
// The bot: alpha-beta search over whole moves.

/** Static evaluation from Black's point of view. */
function evaluate(board: Piece[]): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p === 0) continue;
    const r = rowOf(sq);
    const c = colOf(sq);
    let v = isKing(p) ? 175 : 100;
    if (!isKing(p)) {
      v += (p > 0 ? r : 7 - r) * 4; // advancement
      if ((p > 0 && r === 0) || (p < 0 && r === 7)) v += 12; // guarding the back row
    } else {
      v += 6 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)); // kings like the centre
    }
    if (c === 0 || c === 7) v -= 3; // edges are weaker
    score += p > 0 ? v : -v;
  }
  return score;
}

const WIN = 100_000;

interface SearchCtx {
  nodes: number;
  limit: number;
}

function negamax(board: Piece[], side: Side, depth: number, alpha: number, beta: number, ctx: SearchCtx, ply: number): number {
  const moves = legalMoves(board, side);
  if (moves.length === 0) return -WIN + ply;
  // Keep searching through forced captures so exchanges aren't cut off midway.
  if (depth <= 0 && (moves[0].captures.length === 0 || ctx.nodes > ctx.limit)) {
    const e = evaluate(board);
    return side === 'black' ? e : -e;
  }
  ctx.nodes++;
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(playMove(board, m), other(side), depth - 1, -beta, -alpha, ctx, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

const LEVEL: Record<CheckersDifficulty, { depth: number; noise: number; limit: number }> = {
  easy: { depth: 2, noise: 0.35, limit: 2_000 },
  normal: { depth: 5, noise: 0.08, limit: 40_000 },
  hard: { depth: 9, noise: 0, limit: 160_000 },
};

/** The bot's whole move for `side` (choices from `moves`). */
export function chooseMove(board: Piece[], side: Side, moves: FullMove[], level: CheckersDifficulty, rand: () => number): FullMove {
  if (moves.length === 1) return moves[0];
  const cfg = LEVEL[level] ?? LEVEL.normal;
  if (rand() < cfg.noise) return moves[Math.floor(rand() * moves.length)];
  let best: FullMove[] = [];
  // Iterative deepening keeps the deepest completed result within the node budget.
  for (let depth = 1; depth <= cfg.depth; depth++) {
    const ctx = { nodes: 0, limit: cfg.limit };
    let top = -Infinity;
    let picks: FullMove[] = [];
    for (const m of moves) {
      const v = -negamax(playMove(board, m), other(side), depth - 1, -Infinity, Infinity, ctx, 1);
      if (v > top + 0.5) {
        top = v;
        picks = [m];
      } else if (Math.abs(v - top) <= 0.5) picks.push(m);
    }
    best = picks;
    if (ctx.nodes > cfg.limit) break;
  }
  return best[Math.floor(rand() * best.length)];
}

/** The bot's next hop (its chosen move's first hop, or the next hop of a chain). */
export function botHop(s: CheckersState, rand: () => number = Math.random): CheckersAction {
  const me = s.players.find((p) => p.id === idOf(s, s.turn))!;
  const moves = s.chain !== null ? captureSequences(s.board, s.chain) : legalMoves(s.board, s.turn);
  const m = chooseMove(s.board, s.turn, moves, (me.difficulty ?? 'normal') as CheckersDifficulty, rand);
  return { type: 'MOVE', from: m.path[0], to: m.path[1] };
}

export const checkersKit: GameKit<CheckersState, CheckersAction> = {
  seatError: (count) => (count === 2 ? null : 'Checkers is for 2 players'),
  create: (seats, seed) => createCheckers(seats, seed),
  apply: applyCheckers,
  actor: (s) => (s.over ? null : idOf(s, s.turn)),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => botHop(s, rand),
  timeout: (s) => {
    const hop = legalHops(s)[0];
    return { type: 'MOVE', from: hop.from, to: hop.to };
  },
  botDelay: (s) => (s.chain !== null ? 420 : 700),
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  forfeit: (s, id) => (s.over ? { ...s, reason: 'abandoned' } : { ...finish(s, s.players.find((p) => p.id !== id)!.id, 'resigned') }),
  end: (s) => (s.over ? { ...s, reason: 'abandoned' } : finish(s, null, 'abandoned')),
  redact: (s) => s,
  turnMs: 60_000,
};
