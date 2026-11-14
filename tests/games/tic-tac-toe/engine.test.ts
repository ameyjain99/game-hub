import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import {
  applyTtt,
  createTtt,
  strategyMoves,
  ticTacToeKit,
  winningLine,
  type Cell,
  type Mark,
  type TttState,
} from '../../../src/games/tic-tac-toe/engine';

const seats = (bot = false) => [
  { name: 'You', isAI: false },
  { name: 'Bot 1', isAI: bot, difficulty: 'hard' },
];

function play(s: TttState, ...cells: number[]): TttState {
  for (const cell of cells) s = applyTtt(s, { type: 'PLACE', cell }, s.turn);
  return s;
}

describe('rules', () => {
  test('p0 opens the first round as X; turns alternate', () => {
    const s = createTtt(seats(), 1);
    expect(s.xId).toBe('p0');
    expect(s.turn).toBe('p0');
    const after = play(s, 4);
    expect(after.board[4]).toBe('X');
    expect(after.turn).toBe('p1');
  });

  test('rejects a move out of turn or onto a taken square', () => {
    const s = play(createTtt(seats(), 1), 4);
    expect(() => applyTtt(s, { type: 'PLACE', cell: 0 }, 'p0')).toThrow(IllegalMove);
    expect(() => applyTtt(s, { type: 'PLACE', cell: 4 }, 'p1')).toThrow(IllegalMove);
  });

  test('three in a row wins the round and scores it', () => {
    const s = play(createTtt(seats(), 1), 0, 3, 1, 4, 2);
    expect(s.roundOver).toBe(true);
    expect(s.winner).toBe('p0');
    expect(s.winLine).toEqual([0, 1, 2]);
    expect(s.score).toEqual({ p0: 1, p1: 0 });
    expect(ticTacToeKit.actor(s)).toBeNull();
  });

  test('a full board with no line is a draw', () => {
    // X O X / X O O / O X X
    const s = play(createTtt(seats(), 1), 0, 1, 2, 4, 3, 5, 7, 6, 8);
    expect(s.roundOver).toBe(true);
    expect(s.winner).toBeNull();
    expect(s.draws).toBe(1);
  });

  test('the next round alternates who starts and keeps the score', () => {
    const won = play(createTtt(seats(), 1), 0, 3, 1, 4, 2);
    const next = applyTtt(won, { type: 'REMATCH' }, 'p1');
    expect(next.round).toBe(2);
    expect(next.xId).toBe('p1');
    expect(next.turn).toBe('p1');
    expect(next.board.every((c) => c === null)).toBe(true);
    expect(next.score).toEqual({ p0: 1, p1: 0 });
  });

  test('a forfeit closes the series for good', () => {
    const s = ticTacToeKit.forfeit(createTtt(seats(), 1), 'p1');
    expect(s.closed).toBe(true);
    expect(s.score.p0).toBe(1);
    expect(() => applyTtt(s, { type: 'REMATCH' }, 'p0')).toThrow(IllegalMove);
  });
});

describe('Newell & Simon strategy', () => {
  test('takes a win, then blocks a loss', () => {
    const board: Cell[] = ['X', 'X', null, 'O', 'O', null, null, null, null];
    expect(strategyMoves(board, 'X')).toEqual([2]);
    expect(strategyMoves(board, 'O')).toEqual([5]);
  });

  test('answers opposite corners with a side, not a corner', () => {
    // X in two opposite corners, O in the centre: a corner reply loses to a fork.
    const board: Cell[] = ['X', null, null, null, 'O', null, null, null, 'X'];
    for (const cell of strategyMoves(board, 'O')) expect([1, 3, 5, 7]).toContain(cell);
  });

  /** Whether the strategy can lose from here, trying every opponent reply and
   *  every move the strategy allows. */
  function canLose(board: Cell[], botMark: Mark, toMove: Mark): boolean {
    const line = winningLine(board);
    if (line) return board[line[0]] !== botMark;
    const open = board.flatMap((c, i) => (c === null ? [i] : []));
    if (open.length === 0) return false;
    const next = (i: number) => board.map((c, j) => (j === i ? toMove : c));
    const nextMark: Mark = toMove === 'X' ? 'O' : 'X';
    const choices = toMove === botMark ? strategyMoves(board, botMark) : open;
    return choices.some((i) => canLose(next(i), botMark, nextMark));
  }

  test('never loses as X, against every possible game', () => {
    expect(canLose(Array(9).fill(null), 'X', 'X')).toBe(false);
  });

  test('never loses as O, against every possible game', () => {
    expect(canLose(Array(9).fill(null), 'O', 'X')).toBe(false);
  });
});

describe('kit', () => {
  test('the bot plays a legal move for whoever is to move', () => {
    let s = createTtt(seats(true), 7);
    s = play(s, 0);
    const action = ticTacToeKit.bot(s, () => 0.5);
    expect(action.type).toBe('PLACE');
    expect(s.board[action.cell]).toBeNull();
  });

  test('only two seats can play', () => {
    expect(ticTacToeKit.seatError(2)).toBeNull();
    expect(ticTacToeKit.seatError(3)).not.toBeNull();
  });
});
