import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { buildDictionary, setDictionary } from '../../../src/games/wordgrid/dictionary';
import {
  CENTRE,
  LETTERS,
  N,
  PREMIUMS,
  applyWordgrid,
  createWordgrid,
  evaluate,
  generateMoves,
  wordgridKit,
  type Tile,
  type WgState,
} from '../../../src/games/wordgrid/engine';

beforeAll(() => {
  setDictionary(buildDictionary(readFileSync('public/words/enable.txt', 'utf8')));
});

const seats = (n = 2) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
let tileId = 500;
const rack = (letters: string): Tile[] => letters.split('').map((letter) => ({ id: tileId++, letter }));
const withRack = (s: WgState, seat: number, r: Tile[]): WgState => ({ ...s, players: s.players.map((p, i) => (i === seat ? { ...p, rack: r, rackCount: r.length } : p)) });
/** Lay `word` from `start` across (or down). */
const lay = (s: WgState, seat: number, word: string, start: number, down = false) => {
  const r = rack(word);
  const s2 = withRack(s, seat, [...r, ...rack('EEEEEEE').slice(0, Math.max(0, 7 - r.length))]);
  return applyWordgrid(s2, { type: 'PLAY', tiles: r.map((t, i) => ({ id: t.id, cell: start + i * (down ? N : 1) })) }, s.players[seat].id);
};

describe('the set', () => {
  test("100 tiles with two blanks; GameHub's premium squares are symmetric", () => {
    expect(Object.values(LETTERS).reduce((n, [c]) => n + c, 0)).toBe(100);
    expect(LETTERS['?'][0]).toBe(2);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      expect(PREMIUMS[r * N + c]).toBe(PREMIUMS[c * N + r]);
      expect(PREMIUMS[r * N + c]).toBe(PREMIUMS[(N - 1 - r) * N + c]);
    }
    expect(PREMIUMS[CENTRE]).toBe('DW');
    expect(PREMIUMS.filter((p) => p === 'TW')).toHaveLength(8);
  });

  test('seven tiles each, the rest in the bag', () => {
    const s = createWordgrid(seats(3), 1);
    expect(s.players.every((p) => p.rack.length === 7)).toBe(true);
    expect(s.bag.length).toBe(79);
  });
});

describe('laying words', () => {
  test('the first word must cover the centre and is doubled there', () => {
    const s = createWordgrid(seats(), 1);
    expect(() => lay(s, 0, 'CAT', 0)).toThrow(/centre/);
    const after = lay(s, 0, 'CAT', CENTRE - 1);
    // C3 + A1 + T1 = 5, doubled on the centre star.
    expect(after.players[0].score).toBe(10);
    expect(after.last?.words).toEqual([{ word: 'CAT', score: 10 }]);
    expect(after.players[0].rack).toHaveLength(7);
    expect(after.turn).toBe(1);
  });

  test('words must be real, in one line, and joined to what is down', () => {
    let s = lay(createWordgrid(seats(), 1), 0, 'CAT', CENTRE - 1);
    expect(() => lay(s, 1, 'XQZ', CENTRE + N)).toThrow(IllegalMove);
    expect(() => lay(s, 1, 'DOG', 0)).toThrow(/Join/);
    // T and E under the A of CAT make ATE down.
    s = lay(s, 1, 'TE', CENTRE + N, true);
    expect(s.last?.words?.map((w) => w.word)).toEqual(['ATE']);
  });

  test('cross words count, and premiums only under new tiles', () => {
    const board = createWordgrid(seats(), 1).board;
    const r = evaluate(board, [
      { cell: CENTRE, letter: 'H', blank: false },
      { cell: CENTRE + 1, letter: 'I', blank: false },
    ]);
    expect('error' in r ? r.error : r.score).toBe((3 + 1) * 2);
  });

  test('a blank scores nothing and stands for the letter chosen', () => {
    let s = createWordgrid(seats(), 1);
    const r = [...rack('C?T'), ...rack('EEEE')];
    s = withRack(s, 0, r);
    const after = applyWordgrid(s, { type: 'PLAY', tiles: [{ id: r[0].id, cell: CENTRE - 1 }, { id: r[1].id, cell: CENTRE, letter: 'a' }, { id: r[2].id, cell: CENTRE + 1 }] }, 'p0');
    expect(after.board[CENTRE]).toMatchObject({ letter: 'A', blank: true });
    expect(after.players[0].score).toBe((3 + 0 + 1) * 2);
  });

  test('using all seven tiles earns 50 more', () => {
    const s = lay(createWordgrid(seats(), 1), 0, 'RETAINS', CENTRE - 3);
    expect(s.last?.bingo).toBe(true);
    expect(s.players[0].score).toBeGreaterThan(50);
  });

  test('swapping needs seven in the bag; six scoreless turns end the game', () => {
    let s = createWordgrid(seats(), 1);
    const before = s.players[0].rack.map((t) => t.id);
    s = applyWordgrid(s, { type: 'EXCHANGE', ids: before.slice(0, 3) }, 'p0');
    expect(s.players[0].rack.map((t) => t.id)).not.toEqual(before);
    expect(s.bag).toHaveLength(100 - 14); // the bag keeps its size
    for (let k = 0; k < 5; k++) s = applyWordgrid(s, { type: 'PASS' }, s.players[s.turn].id);
    expect(s.over).toBe(true);
    expect(s.final).not.toBeNull();
  });

  test('racks and the bag are hidden from others', () => {
    const v = wordgridKit.redact(createWordgrid(seats(), 1), 'p0');
    expect(v.players[0].rack).toHaveLength(7);
    expect(v.players[1].rack).toEqual([]);
    expect(v.players[1].rackCount).toBe(7);
    expect(v.bag).toEqual([]);
  });
});

describe('the bot', () => {
  test('finds legal opening moves through the centre', () => {
    const board = createWordgrid(seats(), 1).board;
    const moves = generateMoves(board, rack('RETAINS'));
    expect(moves.length).toBeGreaterThan(100);
    for (const m of moves.slice(0, 50)) expect(m.tiles.some((t) => t.cell === CENTRE)).toBe(true);
    expect(Math.max(...moves.map((m) => m.score))).toBeGreaterThanOrEqual(50); // a seven-letter word
  });

  test('every move it finds is accepted by the rules', () => {
    let s = createWordgrid(Array.from({ length: 2 }, (_, i) => ({ name: `B${i}`, isAI: true, difficulty: i ? 'hard' : 'normal' })), 3);
    for (let i = 0; i < 12 && !s.over; i++) s = wordgridKit.apply(s, wordgridKit.bot(s), wordgridKit.actor(s)!);
    expect(s.history.filter((m) => m.kind === 'play').length).toBeGreaterThan(5);
    expect(s.board.filter(Boolean).length).toBeGreaterThan(15);
  }, 30_000);
});
