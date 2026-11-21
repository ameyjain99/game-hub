/**
 * Chess. The rules - legal moves, check, castling, en passant, promotion,
 * checkmate, stalemate, threefold repetition, the fifty-move rule and
 * insufficient material - come from chess.js. The state keeps the move list
 * and rebuilds the position from it, so repetition is always judged on the
 * whole game.
 *
 * Playing the computer uses Stockfish in the browser (see ui/stockfish.ts);
 * online games are between two people.
 */
import { Chess, type Move, type Square } from 'chess.js';
import { IllegalMove, nextRandom, type GameKit, type KitCommonAction, type KitPlayer, type KitSeat } from '../kit/engine';

export type Color = 'w' | 'b';
export type Promotion = 'q' | 'r' | 'b' | 'n';

export interface PlayedMove {
  from: Square;
  to: Square;
  promotion?: Promotion;
  san: string;
  /** The piece captured, if any (p n b r q). */
  captured?: string;
  color: Color;
}

export type ChessResult = 'checkmate' | 'stalemate' | 'threefold' | 'insufficient' | 'fifty-moves' | 'resigned' | 'agreed' | 'abandoned' | 'time';

export interface ChessState {
  players: KitPlayer[];
  /** Who plays White this game (seat 0 in game one; colours swap each rematch). */
  whiteId: string;
  moves: PlayedMove[];
  /** The current position, for display (the move list stays authoritative). */
  fen: string;
  over: boolean;
  winner: string | null;
  result: ChessResult | null;
  /** A pending draw offer, by this player. */
  drawOffer: string | null;
  /** A pending request to take back their last move, by this player. */
  takeback: string | null;
  game: number;
  score: Record<string, number>;
  seed: number;
}

export type ChessAction =
  | { type: 'MOVE'; from: string; to: string; promotion?: Promotion }
  | { type: 'OFFER_DRAW' }
  | { type: 'ANSWER_DRAW'; accept: boolean }
  /** Ask to take back your last move (a bot always allows it). */
  | { type: 'TAKEBACK' }
  | { type: 'ANSWER_TAKEBACK'; accept: boolean };

export const START_FEN = new Chess().fen();

/** The position after the game's moves, as a chess.js board. */
export function replay(moves: Pick<PlayedMove, 'from' | 'to' | 'promotion'>[]): Chess {
  const chess = new Chess();
  for (const m of moves) chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  return chess;
}

export const colorOf = (s: ChessState, id: string): Color => (id === s.whiteId ? 'w' : 'b');
export const idOfColor = (s: ChessState, c: Color): string => (c === 'w' ? s.whiteId : s.players.find((p) => p.id !== s.whiteId)!.id);
const opponent = (s: ChessState, id: string) => s.players.find((p) => p.id !== id)!.id;

function finish(s: ChessState, winner: string | null, result: ChessResult): ChessState {
  const score = winner ? { ...s.score, [winner]: (s.score[winner] ?? 0) + 1 } : s.score;
  return { ...s, over: true, winner, result, drawOffer: null, score };
}

function newGame(s: ChessState, whiteId: string, game: number): ChessState {
  return { ...s, whiteId, moves: [], fen: START_FEN, over: false, winner: null, result: null, drawOffer: null, takeback: null, game };
}

/** The position with `id`'s last move taken back (and the reply to it, if there was one). */
function undo(s: ChessState, id: string): ChessState {
  const mine = colorOf(s, id);
  const k = s.moves[s.moves.length - 1]?.color === mine ? 1 : 2;
  const moves = s.moves.slice(0, Math.max(0, s.moves.length - k));
  return { ...s, moves, fen: replay(moves).fen(), drawOffer: null, takeback: null };
}

export interface ChessOptions {
  /** Which seat plays White in the first game (default: seat 0). */
  whiteSeat?: number;
  /** Minutes on each player's clock for the whole game (none when absent or 0). */
  clockMin?: number;
}

/** The clock choices a room offers, in minutes (0 is no clock). */
export const CLOCK_MINUTES = [0, 3, 5, 10, 15, 30] as const;

/** The time each player gets under these options, or null for no clock. */
export function bankMs(options: unknown): number | null {
  const min = Number((options as { clockMin?: unknown } | null)?.clockMin ?? 0);
  return (CLOCK_MINUTES as readonly number[]).includes(min) && min > 0 ? min * 60_000 : null;
}

export function createChess(seats: KitSeat[], seed: number, options: ChessOptions = {}): ChessState {
  const players = seats.map((seat, i) => ({ id: `p${i}`, name: seat.name, isAI: seat.isAI, difficulty: seat.difficulty }));
  const base = { players, score: Object.fromEntries(players.map((p) => [p.id, 0])), seed } as ChessState;
  return newGame(base, `p${options.whiteSeat ?? 0}`, 1);
}

/** Why a game that chess.js reports as over ended. */
function endOf(chess: Chess): ChessResult | null {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'insufficient';
  if (chess.isThreefoldRepetition()) return 'threefold';
  if (chess.isDrawByFiftyMoves()) return 'fifty-moves';
  return null;
}

export function applyChess(s: ChessState, action: ChessAction | KitCommonAction, actorId: string): ChessState {
  if (!s.players.some((p) => p.id === actorId)) throw new IllegalMove('not in this game');
  if (action.type === 'REMATCH') {
    if (!s.over || s.result === 'abandoned') throw new IllegalMove('the game is still on');
    const [, seed] = nextRandom(s.seed);
    return newGame({ ...s, seed }, opponent(s, s.whiteId), s.game + 1);
  }
  if (s.over) throw new IllegalMove('the game is over');
  switch (action.type) {
    case 'RESIGN':
      return finish(s, opponent(s, actorId), 'resigned');
    case 'OFFER_DRAW':
      if (s.drawOffer) throw new IllegalMove('a draw is already on offer');
      return { ...s, drawOffer: actorId };
    case 'ANSWER_DRAW':
      if (!s.drawOffer || s.drawOffer === actorId) throw new IllegalMove('no draw offer to answer');
      return action.accept ? finish(s, null, 'agreed') : { ...s, drawOffer: null };
    case 'TAKEBACK': {
      if (s.takeback) throw new IllegalMove('a take-back is already being asked for');
      if (!s.moves.some((m) => m.color === colorOf(s, actorId))) throw new IllegalMove('you have no move to take back');
      const them = s.players.find((p) => p.id !== actorId)!;
      return them.isAI ? undo(s, actorId) : { ...s, takeback: actorId };
    }
    case 'ANSWER_TAKEBACK':
      if (!s.takeback || s.takeback === actorId) throw new IllegalMove('no take-back to answer');
      return action.accept ? undo(s, s.takeback) : { ...s, takeback: null };
    case 'MOVE': {
      const chess = replay(s.moves);
      if (idOfColor(s, chess.turn()) !== actorId) throw new IllegalMove('not your turn');
      let move: Move;
      try {
        move = chess.move({ from: action.from, to: action.to, promotion: action.promotion });
      } catch {
        throw new IllegalMove("that move isn't legal");
      }
      const played: PlayedMove = {
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
        ...(move.promotion ? { promotion: move.promotion as Promotion } : {}),
        ...(move.captured ? { captured: move.captured } : {}),
      };
      // A move answers (declines) an opponent's draw offer; your own stays open.
      const drawOffer = s.drawOffer === actorId ? s.drawOffer : null;
      // Playing on turns down a take-back that was being asked for.
      const next: ChessState = { ...s, moves: [...s.moves, played], fen: chess.fen(), drawOffer, takeback: null };
      const end = endOf(chess);
      if (end) return finish(next, end === 'checkmate' ? actorId : null, end);
      return next;
    }
    default:
      throw new IllegalMove('unknown action');
  }
}

/** A simple stand-in mover (captures first) for a bot seat without Stockfish. */
export function fallbackMove(s: ChessState, rand: () => number = Math.random): ChessAction {
  const chess = replay(s.moves);
  const moves = chess.moves({ verbose: true });
  const value: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const scored = moves.map((m) => ({ m, v: (m.captured ? value[m.captured] * 10 - value[m.piece] : 0) + (m.san.includes('+') ? 2 : 0) + rand() }));
  scored.sort((a, b) => b.v - a.v);
  const m = scored[0].m;
  return { type: 'MOVE', from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion as Promotion } : {}) };
}

export const chessKit: GameKit<ChessState, ChessAction> = {
  seatError: (count) => (count === 2 ? null : 'Chess is for 2 players'),
  create: (seats, seed, options) => createChess(seats, seed, (options ?? {}) as ChessOptions),
  apply: applyChess,
  actor: (s) => (s.over ? null : idOfColor(s, s.moves.length % 2 === 0 ? 'w' : 'b')),
  players: (s) => s.players,
  isOver: (s) => s.over,
  bot: (s, rand) => fallbackMove(s, rand),
  timeout: (s) => fallbackMove(s),
  botDelay: () => 250,
  setBot: (s, id, difficulty) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, isAI: true, difficulty } : p)) }),
  // Leaving after the game ends closes the table (no rematch with an empty seat).
  forfeit: (s, id) => (s.over ? { ...s, result: 'abandoned' } : finish(s, opponent(s, id), 'resigned')),
  end: (s) => (s.over ? s : finish(s, null, 'abandoned')),
  redact: (s) => s,
  // Chess is played untimed; a player who walks away can be removed by the other.
  untimed: true,
  bankMs,
  flag: (s, id) => (s.over ? s : finish(s, opponent(s, id), 'time')),
};
