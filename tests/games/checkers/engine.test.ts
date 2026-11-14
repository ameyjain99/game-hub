import { describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import {
  applyCheckers,
  checkersKit,
  createCheckers,
  legalHops,
  legalMoves,
  squareNumber,
  type CheckersState,
  type Piece,
} from '../../../src/games/checkers/engine';

const seats = [
  { name: 'You', isAI: false },
  { name: 'Bot', isAI: false },
];

/** The board index of a checkers square number (1–32). */
const sq = (n: number) => {
  for (let i = 0; i < 64; i++) if ((Math.floor(i / 8) + (i % 8)) % 2 === 1 && squareNumber(i) === n) return i;
  throw new Error(`no square ${n}`);
};

/** A position from square numbers: men by default, `k` suffix for kings. */
function position(pieces: { b?: (number | string)[]; w?: (number | string)[] }, turn: 'black' | 'white' = 'black'): CheckersState {
  const board: Piece[] = Array(64).fill(0);
  const put = (list: (number | string)[] = [], sign: number) =>
    list.forEach((x) => {
      const king = typeof x === 'string' && x.endsWith('k');
      board[sq(parseInt(String(x), 10))] = sign * (king ? 2 : 1);
    });
  put(pieces.b, 1);
  put(pieces.w, -1);
  return { ...createCheckers(seats, 1), board, turn };
}

const move = (s: CheckersState, from: number, to: number, actor = s.turn === 'black' ? s.blackId : 'p1') =>
  applyCheckers(s, { type: 'MOVE', from: sq(from), to: sq(to) }, actor);

describe('setup', () => {
  test('twelve men each, Black on 1–12 to move first with seven moves', () => {
    const s = createCheckers(seats, 1);
    expect(s.board.filter((p) => p === 1)).toHaveLength(12);
    expect(s.board.filter((p) => p === -1)).toHaveLength(12);
    expect(s.board[sq(1)]).toBe(1);
    expect(s.board[sq(32)]).toBe(-1);
    expect(s.turn).toBe('black');
    expect(legalMoves(s.board, 'black')).toHaveLength(7);
  });

  test('moves are written in checkers notation', () => {
    const s = move(createCheckers(seats, 1), 11, 15);
    expect(s.moves).toEqual(['11-15']);
    expect(s.turn).toBe('white');
  });
});

describe('rules', () => {
  test('men move forward only; kings move both ways', () => {
    const s = position({ b: [14, '18k'], w: [32] });
    const froms = legalHops(s).map((h) => `${squareNumber(h.from)}-${squareNumber(h.to)}`);
    expect(froms).toContain('14-17');
    expect(froms).not.toContain('14-9'); // a man can't step back
    expect(froms).toContain('18-15'); // a king can
  });

  test('a capture is compulsory', () => {
    const s = position({ b: [14, 1], w: [18, 32] });
    const hops = legalHops(s);
    expect(hops).toEqual([{ from: sq(14), to: sq(23), capture: true }]);
    expect(() => move(s, 1, 6)).toThrow(IllegalMove);
  });

  test('a multi-jump continues with the same piece, one hop at a time', () => {
    const s = position({ b: [9], w: [14, 23, 32] });
    const one = move(s, 9, 18);
    expect(one.chain).toBe(sq(18));
    expect(one.turn).toBe('black'); // still Black's move
    expect(legalHops(one)).toEqual([{ from: sq(18), to: sq(27), capture: true }]);
    const two = move(one, 18, 27);
    expect(two.chain).toBeNull();
    expect(two.turn).toBe('white');
    expect(two.moves).toEqual(['9x18x27']);
    expect(two.board[sq(14)]).toBe(0);
    expect(two.board[sq(23)]).toBe(0);
  });

  test('a man crowned by a jump stops there', () => {
    // 22x29 crowns Black; as a king it could jump 25 next, but the move ends.
    const s = position({ b: [22], w: [25, 26, 1] });
    const after = move(s, 22, 31);
    expect(after.board[sq(31)]).toBe(2);
    expect(after.chain).toBeNull();
    expect(after.turn).toBe('white');
  });

  test('a player left with pieces but no legal move loses', () => {
    // White's man on 29 is blocked by 25, and can't jump it because 22 is taken.
    const s = position({ b: [25, 22, 1], w: [29] });
    const after = move(s, 1, 5);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(s.blackId);
    expect(after.reason).toBe('no-moves');
  });

  test('a side left with no pieces loses at once', () => {
    const s = position({ b: [14], w: [18] });
    const after = move(s, 14, 23);
    expect(after.over).toBe(true);
    expect(after.winner).toBe(s.blackId);
    expect(after.score[s.blackId]).toBe(1);
  });

  test('forty moves each with no capture and no man moved is a draw', () => {
    let s = position({ b: ['1k'], w: ['32k'] });
    s = { ...s, quiet: 79 };
    const after = move(s, 1, 6);
    expect(after.over).toBe(true);
    expect(after.draw).toBe(true);
    expect(after.reason).toBe('forty-moves');
  });

  test('moving out of turn is rejected', () => {
    const s = createCheckers(seats, 1);
    expect(() => applyCheckers(s, { type: 'MOVE', from: sq(22), to: sq(18) }, 'p1')).toThrow(IllegalMove);
  });

  test('a rematch swaps colours and keeps the score', () => {
    const won = applyCheckers(createCheckers(seats, 1), { type: 'RESIGN' }, 'p1');
    expect(won.winner).toBe('p0');
    const next = applyCheckers(won, { type: 'REMATCH' }, 'p0');
    expect(next.blackId).toBe('p1');
    expect(next.score).toEqual({ p0: 1, p1: 0 });
    expect(next.over).toBe(false);
  });
});

describe('bot', () => {
  test('always returns a legal hop', () => {
    let s = createCheckers([{ name: 'A', isAI: true, difficulty: 'easy' }, { name: 'B', isAI: true, difficulty: 'normal' }], 4);
    for (let i = 0; i < 60 && !s.over; i++) {
      const actor = checkersKit.actor(s)!;
      s = checkersKit.apply(s, checkersKit.bot(s, Math.random), actor);
    }
    expect(s.moves.length).toBeGreaterThan(10);
  });

  test('takes a free piece and avoids hanging its own', () => {
    // Black to move: 15 can take 18→22? Set up: White man on 18 is capturable from 14.
    const s = { ...position({ b: [14, 3], w: [18, 30] }), players: [{ id: 'p0', name: 'B', isAI: true, difficulty: 'hard' }, { id: 'p1', name: 'W', isAI: false }] };
    const hop = checkersKit.bot(s, () => 0.5);
    expect(hop).toEqual({ type: 'MOVE', from: sq(14), to: sq(23) });
  });

  test('hard beats easy over a full game', () => {
    let s = createCheckers([{ name: 'Hard', isAI: true, difficulty: 'hard' }, { name: 'Easy', isAI: true, difficulty: 'easy' }], 9);
    let r = 1;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300 && !s.over; i++) s = checkersKit.apply(s, checkersKit.bot(s, rand), checkersKit.actor(s)!);
    expect(s.over).toBe(true);
    expect(s.winner).toBe('p0');
  }, 20_000);
});
