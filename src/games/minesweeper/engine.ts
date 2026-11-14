/**
 * Minesweeper: clear every square that hides no mine.
 *
 * Opening a square shows how many of its eight neighbours are mines; a square
 * with none opens its neighbours too, so open areas spread on their own. Flag
 * the squares you know are mines. Opening a number whose flags are all placed
 * ("chording") opens its other neighbours in one go. Open a mine and the game
 * is lost; open every safe square and it's won.
 *
 * The mines are laid after the first click, never on or beside it, so every
 * game starts with an open area to work from.
 */
import { shuffle } from '../kit/engine';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';

export const LEVELS: Record<Level, { label: string; cols: number; rows: number; mines: number }> = {
  easy: { label: 'Easy', cols: 9, rows: 9, mines: 10 },
  medium: { label: 'Medium', cols: 16, rows: 16, mines: 40 },
  hard: { label: 'Hard', cols: 30, rows: 16, mines: 99 },
  expert: { label: 'Expert', cols: 30, rows: 24, mines: 160 },
};

export type Status = 'ready' | 'playing' | 'won' | 'lost';

export interface MsState {
  level: Level;
  cols: number;
  rows: number;
  mines: number;
  seed: number;
  /** Where the mines are; empty until the first square is opened. */
  mine: boolean[];
  /** How many mines touch each square. */
  count: number[];
  open: boolean[];
  flag: boolean[];
  status: Status;
  /** The mine that went off. */
  exploded: number | null;
  /** The squares the last move opened, in the order they spread (for the ripple). */
  opened: { cell: number; ring: number }[];
}

export function newGame(level: Level, seed: number): MsState {
  const { cols, rows, mines } = LEVELS[level];
  const n = cols * rows;
  return {
    level,
    cols,
    rows,
    mines,
    seed,
    mine: [],
    count: Array(n).fill(0),
    open: Array(n).fill(false),
    flag: Array(n).fill(false),
    status: 'ready',
    exploded: null,
    opened: [],
  };
}

/** The squares around `cell` (up to eight). */
export function neighbours(s: Pick<MsState, 'cols' | 'rows'>, cell: number): number[] {
  const r = Math.floor(cell / s.cols);
  const c = cell % s.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < s.rows && cc >= 0 && cc < s.cols) out.push(rr * s.cols + cc);
    }
  return out;
}

/** Lay the mines anywhere but the first square and its neighbours. */
function layMines(s: MsState, first: number): MsState {
  const keep = new Set([first, ...neighbours(s, first)]);
  const n = s.cols * s.rows;
  let candidates = Array.from({ length: n }, (_, i) => i).filter((i) => !keep.has(i));
  // A board too small for the safe zone still keeps the first square clear.
  if (candidates.length < s.mines) candidates = Array.from({ length: n }, (_, i) => i).filter((i) => i !== first);
  const [shuffled] = shuffle(candidates, s.seed);
  const mine = Array(n).fill(false);
  for (const i of shuffled.slice(0, s.mines)) mine[i] = true;
  const count = mine.map((_, i) => neighbours(s, i).filter((j) => mine[j]).length);
  return { ...s, mine, count, status: 'playing' };
}

const safeLeft = (s: MsState, open: boolean[]) => open.reduce((n, o, i) => n + (!o && !s.mine[i] ? 1 : 0), 0);

/** Open `cells` (and spread from any zero), returning the next state. */
function reveal(s: MsState, cells: number[]): MsState {
  const open = s.open.slice();
  const opened: MsState['opened'] = [];
  let exploded: number | null = null;
  const queue: { cell: number; ring: number }[] = cells.map((cell) => ({ cell, ring: 0 }));
  while (queue.length) {
    const { cell, ring } = queue.shift()!;
    if (open[cell] || s.flag[cell]) continue;
    open[cell] = true;
    opened.push({ cell, ring });
    if (s.mine[cell]) {
      exploded ??= cell;
      continue;
    }
    if (s.count[cell] === 0) for (const j of neighbours(s, cell)) if (!open[j] && !s.flag[j]) queue.push({ cell: j, ring: ring + 1 });
  }
  if (exploded !== null) {
    // Show every mine; flags stay where they were (wrong ones are marked by the view).
    return { ...s, open: open.map((o, i) => o || (s.mine[i] && !s.flag[i])), status: 'lost', exploded, opened };
  }
  if (safeLeft(s, open) === 0) {
    // Won: the remaining mines are flagged for you.
    return { ...s, open, flag: s.mine.slice(), status: 'won', opened };
  }
  return { ...s, open, opened };
}

/** Open one square (the first one lays the mines). */
export function openCell(s: MsState, cell: number): MsState {
  if (s.status === 'won' || s.status === 'lost' || s.open[cell] || s.flag[cell]) return s;
  const ready = s.status === 'ready' ? layMines(s, cell) : s;
  return reveal(ready, [cell]);
}

/** Put a flag on, or take it off, an unopened square. */
export function toggleFlag(s: MsState, cell: number): MsState {
  if (s.status !== 'playing' && s.status !== 'ready') return s;
  if (s.open[cell]) return s;
  return { ...s, flag: s.flag.map((f, i) => (i === cell ? !f : f)), opened: [] };
}

/** On an open number with as many flags around it as its count: open the rest of its neighbours. */
export function chord(s: MsState, cell: number): MsState {
  if (s.status !== 'playing' || !s.open[cell] || s.count[cell] === 0) return s;
  const around = neighbours(s, cell);
  const flags = around.filter((j) => s.flag[j]).length;
  if (flags !== s.count[cell]) return s;
  const rest = around.filter((j) => !s.open[j] && !s.flag[j]);
  return rest.length ? reveal(s, rest) : s;
}

/** Mines minus flags: the counter shown to the player. */
export const minesLeft = (s: MsState) => s.mines - s.flag.filter(Boolean).length;

/** The neighbours a chord would open, for the press highlight. */
export function chordTargets(s: MsState, cell: number): number[] {
  if (s.status !== 'playing' || !s.open[cell]) return [];
  return neighbours(s, cell).filter((j) => !s.open[j] && !s.flag[j]);
}
