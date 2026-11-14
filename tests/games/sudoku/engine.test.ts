import { describe, expect, test } from 'vitest';
import { CLUES, PEERS, applySudoku, clashes, completedGroups, countSolutions, generate, newGame, type SudokuState } from '../../../src/games/sudoku/engine';

const validGrid = (g: number[]) => g.every((v, i) => v >= 1 && v <= 9 && PEERS[i].every((j) => g[j] !== v));

describe('generator', () => {
  test.each(['easy', 'medium', 'hard', 'expert'] as const)('%s: a valid, uniquely solvable puzzle near its clue count', (level) => {
    const { puzzle, solution } = generate(level, 42);
    expect(validGrid(solution)).toBe(true);
    puzzle.forEach((v, i) => v && expect(v).toBe(solution[i]));
    expect(countSolutions(puzzle)).toBe(1);
    const clues = puzzle.filter(Boolean).length;
    expect(clues).toBeGreaterThanOrEqual(CLUES[level]);
    expect(clues).toBeLessThanOrEqual(CLUES[level] + 4);
  });

  test('different seeds give different puzzles', () => {
    expect(generate('easy', 1).puzzle).not.toEqual(generate('easy', 2).puzzle);
  });

  test('every cell has 20 peers', () => {
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
  });
});

describe('play', () => {
  const blank = (s: SudokuState) => s.puzzle.findIndex((v) => v === 0);

  test("a right number stays and clears that digit from its peers' notes", () => {
    let s = newGame('easy', 7);
    const cell = blank(s);
    const peer = PEERS[cell].find((j) => s.puzzle[j] === 0)!;
    const right = s.solution[cell];
    s = applySudoku(s, { type: 'NOTE', cell: peer, value: right });
    expect(s.notes[peer]).toBe(1 << right);
    s = applySudoku(s, { type: 'SET', cell, value: right });
    expect(s.values[cell]).toBe(right);
    expect(s.notes[peer]).toBe(0);
    expect(s.mistakes).toBe(0);
  });

  test('a wrong number counts a mistake; three end the game', () => {
    let s = newGame('easy', 7);
    const cell = blank(s);
    const wrong = (s.solution[cell] % 9) + 1;
    for (let k = 0; k < 3; k++) {
      s = applySudoku(s, { type: 'ERASE', cell });
      s = applySudoku(s, { type: 'SET', cell, value: wrong });
    }
    expect(s.mistakes).toBe(3);
    expect(s.lost).toBe(true);
  });

  test("clues can't be changed", () => {
    const s = newGame('easy', 7);
    const clue = s.puzzle.findIndex(Boolean);
    expect(applySudoku(s, { type: 'SET', cell: clue, value: 1 })).toBe(s);
  });

  test('filling every cell correctly wins; a hint fills one', () => {
    let s = newGame('medium', 3);
    s = applySudoku(s, { type: 'HINT', cell: blank(s) });
    expect(s.hints).toBe(1);
    s.puzzle.forEach((v, i) => {
      if (!v) s = applySudoku(s, { type: 'SET', cell: i, value: s.solution[i] });
    });
    expect(s.won).toBe(true);
    expect(completedGroups(s, 0)).toHaveLength(3);
  });

  test('a clash with a peer is detected', () => {
    const values = Array(81).fill(0);
    values[0] = 5;
    values[8] = 5;
    expect(clashes(values, 0)).toBe(true);
    expect(clashes(values, 40)).toBe(false);
  });
});
