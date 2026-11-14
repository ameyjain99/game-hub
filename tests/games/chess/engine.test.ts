import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { applyChess, chessKit, createChess, type ChessState } from '../../../src/games/chess/engine';

const seats = [
  { name: 'You', isAI: false },
  { name: 'Friend', isAI: false },
];

/** Play moves given as "e2e4" (with an optional promotion letter). */
function play(s: ChessState, ...uci: string[]): ChessState {
  for (const m of uci) {
    const actor = chessKit.actor(s)!;
    s = applyChess(s, { type: 'MOVE', from: m.slice(0, 2), to: m.slice(2, 4), ...(m[4] ? { promotion: m[4] as 'q' } : {}) }, actor);
  }
  return s;
}

describe('chess rules (via chess.js)', () => {
  test('White (seat 0) moves first; moves are recorded in SAN', () => {
    const s = play(createChess(seats, 1), 'e2e4', 'e7e5', 'g1f3');
    expect(s.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(chessKit.actor(s)).toBe('p1');
  });

  test('rejects illegal moves and moves out of turn', () => {
    const s = createChess(seats, 1);
    expect(() => applyChess(s, { type: 'MOVE', from: 'e2', to: 'e5' }, 'p0')).toThrow(IllegalMove);
    expect(() => applyChess(s, { type: 'MOVE', from: 'e7', to: 'e5' }, 'p1')).toThrow(IllegalMove);
  });

  test("scholar's mate ends the game for White", () => {
    const s = play(createChess(seats, 1), 'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7');
    expect(s.over).toBe(true);
    expect(s.result).toBe('checkmate');
    expect(s.winner).toBe('p0');
    expect(s.moves[s.moves.length - 1].san).toBe('Qxf7#');
    expect(s.score.p0).toBe(1);
  });

  test('a pawn promotes to the piece chosen', () => {
    const s = play(createChess(seats, 1), 'a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6b7', 'b8c6', 'b7a8n');
    expect(s.moves[s.moves.length - 1].san).toBe('bxa8=N');
    expect(s.moves[s.moves.length - 1].promotion).toBe('n');
  });

  test('threefold repetition is a draw', () => {
    const s = play(createChess(seats, 1), 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(s.over).toBe(true);
    expect(s.result).toBe('threefold');
    expect(s.winner).toBeNull();
  });

  test('a draw can be offered, declined by a move, and accepted', () => {
    let s = applyChess(createChess(seats, 1), { type: 'OFFER_DRAW' }, 'p0');
    expect(s.drawOffer).toBe('p0');
    expect(() => applyChess(s, { type: 'ANSWER_DRAW', accept: true }, 'p0')).toThrow(IllegalMove);
    s = play(s, 'e2e4');
    expect(s.drawOffer).toBe('p0'); // your own offer stands after your move
    s = play(s, 'e7e5');
    expect(s.drawOffer).toBeNull(); // the reply declines it
    s = applyChess(s, { type: 'OFFER_DRAW' }, 'p0');
    s = applyChess(s, { type: 'ANSWER_DRAW', accept: true }, 'p1');
    expect(s.over).toBe(true);
    expect(s.result).toBe('agreed');
  });

  test('resigning hands the win over; a rematch swaps colours', () => {
    const s = applyChess(createChess(seats, 1), { type: 'RESIGN' }, 'p0');
    expect(s.winner).toBe('p1');
    const next = applyChess(s, { type: 'REMATCH' }, 'p0');
    expect(next.whiteId).toBe('p1');
    expect(next.moves).toEqual([]);
    expect(chessKit.actor(next)).toBe('p1');
  });

  test('you can choose to play Black against the computer', () => {
    const s = createChess(seats, 1, { whiteSeat: 1 });
    expect(s.whiteId).toBe('p1');
    expect(chessKit.actor(s)).toBe('p1');
  });

  test('the stand-in bot always plays a legal move', () => {
    let s = createChess([{ name: 'A', isAI: true }, { name: 'B', isAI: true }], 1);
    for (let i = 0; i < 80 && !s.over; i++) s = chessKit.apply(s, chessKit.bot(s), chessKit.actor(s)!);
    expect(s.moves.length).toBeGreaterThan(10);
  });
});
