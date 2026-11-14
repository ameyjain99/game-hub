/**
 * Sudoku: fill the 9×9 grid so every row, column and 3×3 box holds 1–9 once.
 *
 * Puzzles are generated fresh: a random complete grid, then clues are removed
 * one at a time in random order, keeping only removals that leave exactly one
 * solution, until the difficulty's clue count is reached.
 */
import { shuffle } from '../kit/engine';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** Clues left in the puzzle for each difficulty. */
export const CLUES: Record<Difficulty, number> = { easy: 42, medium: 34, hard: 29, expert: 25 };

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** The 20 cells sharing a row, column or box with each cell. */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))),
);

const ALL = 0x3fe; // bits 1–9
const bit = (v: number) => 1 << v;

/** The digits still allowed in each cell, as bitmasks. */
function candidates(grid: number[]): number[] {
  return grid.map((v, i) => {
    if (v) return 0;
    let m = ALL;
    for (const j of PEERS[i]) if (grid[j]) m &= ~bit(grid[j]);
    return m;
  });
}

const popcount = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};

/**
 * Count solutions, stopping at `limit`. `order` (optional) shuffles the digits
 * tried, which turns the solver into a random grid filler.
 */
function solve(grid: number[], limit: number, out?: number[][], order?: number[]): number {
  const cand = candidates(grid);
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const n = popcount(cand[i]);
    if (n === 0) return 0;
    if (n < bestCount) {
      bestCount = n;
      best = i;
      if (n === 1) break;
    }
  }
  if (best < 0) {
    out?.push(grid.slice());
    return 1;
  }
  let found = 0;
  for (const v of order ?? [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    if (!(cand[best] & bit(v))) continue;
    grid[best] = v;
    found += solve(grid, limit - found, out, order);
    grid[best] = 0;
    if (found >= limit) break;
  }
  return found;
}

/** How many solutions a puzzle has (0, 1, or 2 meaning "more than one"). */
export const countSolutions = (puzzle: number[]) => solve(puzzle.slice(), 2);

export interface Puzzle {
  puzzle: number[];
  solution: number[];
}

/** A fresh puzzle with a unique solution. */
export function generate(difficulty: Difficulty, seed: number): Puzzle {
  let s = seed;
  // A random full grid: fill the three diagonal boxes freely, then solve with shuffled digits.
  const grid = Array(81).fill(0);
  for (const b of [0, 4, 8]) {
    let digits: number[];
    [digits, s] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], s);
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    digits.forEach((d, k) => (grid[(r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)] = d));
  }
  let order: number[];
  [order, s] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], s);
  const out: number[][] = [];
  solve(grid, 1, out, order);
  const solution = out[0];

  // Dig: remove clues in random order while the answer stays unique.
  const puzzle = solution.slice();
  let cells: number[];
  [cells, s] = shuffle(Array.from({ length: 81 }, (_, i) => i), s);
  let clues = 81;
  for (const i of cells) {
    if (clues <= CLUES[difficulty]) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle) !== 1) puzzle[i] = keep;
    else clues--;
  }
  return { puzzle, solution };
}

// ---------------------------------------------------------------------------
// A game in progress.

export interface SudokuState {
  difficulty: Difficulty;
  puzzle: number[];
  solution: number[];
  values: number[];
  /** Pencil marks, as bitmasks of digits 1–9. */
  notes: number[];
  mistakes: number;
  /** 0 = no limit. */
  mistakeLimit: number;
  hints: number;
  won: boolean;
  lost: boolean;
}

export type SudokuAction =
  | { type: 'SET'; cell: number; value: number }
  | { type: 'NOTE'; cell: number; value: number }
  | { type: 'ERASE'; cell: number }
  | { type: 'HINT'; cell: number };

export function newGame(difficulty: Difficulty, seed: number, mistakeLimit = 3): SudokuState {
  const { puzzle, solution } = generate(difficulty, seed);
  return { difficulty, puzzle, solution, values: puzzle.slice(), notes: Array(81).fill(0), mistakes: 0, mistakeLimit, hints: 0, won: false, lost: false };
}

const solved = (s: SudokuState, values: number[]) => values.every((v, i) => v === s.solution[i]);

/** Place `value` and clear it from the pencil marks of the cell's peers. */
function place(s: SudokuState, cell: number, value: number): Pick<SudokuState, 'values' | 'notes'> {
  const values = s.values.map((v, i) => (i === cell ? value : v));
  const notes = s.notes.map((m, i) => (i === cell ? 0 : PEERS[cell].includes(i) ? m & ~bit(value) : m));
  return { values, notes };
}

export function applySudoku(s: SudokuState, a: SudokuAction): SudokuState {
  if (s.won || s.lost) return s;
  if (s.puzzle[a.cell]) return s; // a clue can't change
  switch (a.type) {
    case 'SET': {
      if (a.value < 1 || a.value > 9) return s;
      if (s.values[a.cell] === a.value) return s;
      const next = { ...s, ...place(s, a.cell, a.value) };
      if (a.value !== s.solution[a.cell]) {
        const mistakes = s.mistakes + 1;
        return { ...next, mistakes, lost: s.mistakeLimit > 0 && mistakes >= s.mistakeLimit };
      }
      return { ...next, won: solved(s, next.values) };
    }
    case 'NOTE': {
      if (s.values[a.cell]) return s;
      return { ...s, notes: s.notes.map((m, i) => (i === a.cell ? m ^ bit(a.value) : m)) };
    }
    case 'ERASE': {
      if (!s.values[a.cell] && !s.notes[a.cell]) return s;
      return { ...s, values: s.values.map((v, i) => (i === a.cell ? 0 : v)), notes: s.notes.map((m, i) => (i === a.cell ? 0 : m)) };
    }
    case 'HINT': {
      if (s.values[a.cell] === s.solution[a.cell]) return s;
      const next = { ...s, ...place(s, a.cell, s.solution[a.cell]), hints: s.hints + 1 };
      return { ...next, won: solved(s, next.values) };
    }
  }
}

/** Whether a placed value clashes with a peer (shown in red). */
export const clashes = (values: number[], i: number) => values[i] !== 0 && PEERS[i].some((j) => values[j] === values[i]);

/** The groups (rows, columns, boxes) through `cell` that are now complete and correct. */
export function completedGroups(s: SudokuState, cell: number): number[][] {
  const groups = [
    Array.from({ length: 9 }, (_, k) => rowOf(cell) * 9 + k),
    Array.from({ length: 9 }, (_, k) => k * 9 + colOf(cell)),
    Array.from({ length: 81 }, (_, j) => j).filter((j) => boxOf(j) === boxOf(cell)),
  ];
  return groups.filter((g) => g.every((j) => s.values[j] === s.solution[j]));
}
