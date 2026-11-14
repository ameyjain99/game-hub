import { describe, expect, test } from 'vitest';
import { LEVELS, chord, minesLeft, neighbours, newGame, openCell, toggleFlag, type MsState } from '../../../src/games/minesweeper/engine';

/** A board with mines at chosen squares (already past the first click). */
function board(cols: number, rows: number, mines: number[]): MsState {
  const s = newGame('easy', 1);
  const n = cols * rows;
  const base = { ...s, cols, rows, mines: mines.length, open: Array(n).fill(false), flag: Array(n).fill(false) };
  const mine = Array(n).fill(false);
  for (const m of mines) mine[m] = true;
  const count = mine.map((_, i) => neighbours(base, i).filter((j) => mine[j]).length);
  return { ...base, mine, count, status: 'playing' };
}

describe('levels', () => {
  test('four levels, from 9×9 with 10 mines to 30×24 with 160', () => {
    expect(Object.keys(LEVELS)).toEqual(['easy', 'medium', 'hard', 'expert']);
    expect(LEVELS.easy).toMatchObject({ cols: 9, rows: 9, mines: 10 });
    expect(LEVELS.expert).toMatchObject({ cols: 30, rows: 24, mines: 160 });
  });
});

describe('the first click', () => {
  test.each(['easy', 'medium', 'hard', 'expert'] as const)('%s: lays the mines away from it and opens an area', (level) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame(level, seed);
      const first = Math.floor((s.cols * s.rows) / 2);
      const after = openCell(s, first);
      expect(after.mine.filter(Boolean)).toHaveLength(s.mines);
      expect(after.mine[first]).toBe(false);
      for (const j of neighbours(s, first)) expect(after.mine[j]).toBe(false);
      expect(after.count[first]).toBe(0);
      expect(after.open.filter(Boolean).length).toBeGreaterThan(1);
      expect(after.status === 'playing' || after.status === 'won').toBe(true);
    }
  });
});

describe('play', () => {
  test('a number opens alone; a zero spreads to its neighbours', () => {
    // Mine in the top-left corner of a 4×4.
    const s = board(4, 4, [0]);
    const one = openCell(s, 1);
    expect(one.open.filter(Boolean)).toHaveLength(1);
    expect(one.count[1]).toBe(1);
    const spread = openCell(s, 15);
    expect(spread.open.filter(Boolean)).toHaveLength(15);
    expect(spread.status).toBe('won');
    expect(spread.flag[0]).toBe(true); // the last mine is flagged for you
  });

  test('the spread keeps the order it travelled in (for the ripple)', () => {
    const after = openCell(board(4, 4, [0]), 15);
    expect(after.opened[0]).toEqual({ cell: 15, ring: 0 });
    expect(Math.max(...after.opened.map((o) => o.ring))).toBeGreaterThan(1);
  });

  test('opening a mine loses and shows every mine', () => {
    const s = board(4, 4, [0, 5]);
    const lost = openCell(s, 5);
    expect(lost.status).toBe('lost');
    expect(lost.exploded).toBe(5);
    expect(lost.open[0]).toBe(true);
  });

  test('flags stop a square opening and count down the mines', () => {
    let s = board(4, 4, [0, 5]);
    s = toggleFlag(s, 0);
    expect(minesLeft(s)).toBe(1);
    expect(openCell(s, 0)).toBe(s);
    s = toggleFlag(s, 0);
    expect(minesLeft(s)).toBe(2);
  });

  test("chording opens the rest of a number's neighbours once its flags are placed", () => {
    let s = board(4, 4, [0]);
    s = openCell(s, 5); // a 1, beside the mine
    expect(chord(s, 5)).toBe(s); // no flag yet
    s = toggleFlag(s, 0);
    const after = chord(s, 5);
    expect(after.open.filter(Boolean).length).toBeGreaterThan(5);
  });

  test('a wrong flag makes a chord set off the mine', () => {
    let s = board(4, 4, [0]);
    s = openCell(s, 5);
    s = toggleFlag(s, 1); // wrong
    expect(chord(s, 5).status).toBe('lost');
  });

  test('a finished game ignores further moves', () => {
    const lost = openCell(board(4, 4, [0, 5]), 5);
    expect(openCell(lost, 15)).toBe(lost);
    expect(toggleFlag(lost, 15)).toBe(lost);
  });
});
