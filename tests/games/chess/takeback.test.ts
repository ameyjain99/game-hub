// Taking a move back in Chess and Checkers, and replaying a checkers game from its notation.
import { expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { chessKit, createChess, START_FEN } from '../../../src/games/chess/engine';
import { checkersKit, createCheckers, legalHops, replayCheckers } from '../../../src/games/checkers/engine';

const humans = [{ name: 'A', isAI: false }, { name: 'B', isAI: false }];

test('chess: the opponent decides on a take-back; allowing it undoes the move and its reply', () => {
  let s = createChess(humans, 1);
  expect(() => chessKit.apply(s, { type: 'TAKEBACK' }, 'p0')).toThrow(IllegalMove); // nothing played yet
  s = chessKit.apply(s, { type: 'MOVE', from: 'e2', to: 'e4' }, 'p0');
  s = chessKit.apply(s, { type: 'MOVE', from: 'e7', to: 'e5' }, 'p1');

  s = chessKit.apply(s, { type: 'TAKEBACK' }, 'p0');
  expect(s.takeback).toBe('p0');
  expect(() => chessKit.apply(s, { type: 'ANSWER_TAKEBACK', accept: true }, 'p0')).toThrow(IllegalMove); // not your own
  const refused = chessKit.apply(s, { type: 'ANSWER_TAKEBACK', accept: false }, 'p1');
  expect(refused.moves).toHaveLength(2);
  expect(refused.takeback).toBeNull();

  const allowed = chessKit.apply(s, { type: 'ANSWER_TAKEBACK', accept: true }, 'p1');
  expect(allowed.moves).toHaveLength(0); // White's move and Black's reply are both gone
  expect(allowed.fen).toBe(START_FEN);
});

test('chess: a bot always allows it, and playing on drops a pending request', () => {
  let s = createChess([{ name: 'A', isAI: false }, { name: 'Bot', isAI: true }], 1);
  s = chessKit.apply(s, { type: 'MOVE', from: 'd2', to: 'd4' }, 'p0');
  s = chessKit.apply(s, { type: 'TAKEBACK' }, 'p0');
  expect(s.moves).toHaveLength(0);

  let h = createChess(humans, 1);
  h = chessKit.apply(h, { type: 'MOVE', from: 'e2', to: 'e4' }, 'p0');
  h = chessKit.apply(h, { type: 'TAKEBACK' }, 'p0');
  h = chessKit.apply(h, { type: 'MOVE', from: 'e7', to: 'e5' }, 'p1');
  expect(h.takeback).toBeNull();
});

test('checkers: a game replayed from its notation gives the same board, and a take-back restores it', () => {
  let s = createCheckers(humans, 1);
  const before = s;
  for (let i = 0; i < 12 && !s.over; i++) {
    const hop = legalHops(s)[0];
    s = checkersKit.apply(s, { type: 'MOVE', from: hop.from, to: hop.to }, checkersKit.actor(s)!);
  }
  if (s.chain === null) expect(replayCheckers(s.moves).board).toEqual(s.board);
  expect(replayCheckers([]).board).toEqual(before.board);

  // One move each, then Black takes theirs back: both moves are undone.
  let t = createCheckers(humans, 1);
  const first = legalHops(t)[0];
  t = checkersKit.apply(t, { type: 'MOVE', from: first.from, to: first.to }, 'p0');
  const reply = legalHops(t)[0];
  t = checkersKit.apply(t, { type: 'MOVE', from: reply.from, to: reply.to }, 'p1');
  t = checkersKit.apply(t, { type: 'TAKEBACK' }, 'p0');
  t = checkersKit.apply(t, { type: 'ANSWER_TAKEBACK', accept: true }, 'p1');
  expect(t.moves).toEqual([]);
  expect(t.board).toEqual(before.board);
  expect(t.turn).toBe('black');
});
