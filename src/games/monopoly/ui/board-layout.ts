import type { ColorGroup } from '../engine/board';

/** Grid cell (1-indexed row/col in an 11×11 board) for a space index. The ring
 *  runs clockwise from Go at the bottom-right corner. */
export function cellPos(i: number): { row: number; col: number } {
  if (i <= 10) return { row: 11, col: 11 - i };
  if (i <= 20) return { row: 21 - i, col: 1 };
  if (i <= 30) return { row: 1, col: i - 19 };
  return { row: i - 29, col: 11 };
}

/** The strip colour for a property group. */
export const GROUP_COLOR: Record<ColorGroup, string> = {
  brown: '#8B5A2B',
  lightblue: '#8FD3F4',
  pink: '#D9479B',
  orange: '#E8821A',
  red: '#D93A3F',
  yellow: '#F2C200',
  green: '#2F9E62',
  darkblue: '#2651C9',
};

/** A colour set's name, as players say it. */
export const GROUP_LABEL: Record<ColorGroup, string> = {
  brown: 'Brown',
  lightblue: 'Light blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  darkblue: 'Dark blue',
};

/** Which edge of the board a space sits on (corners are their own kind). */
export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export function sideOf(i: number): Side {
  if (i % 10 === 0) return 'corner';
  if (i < 10) return 'bottom';
  if (i < 20) return 'left';
  if (i < 30) return 'top';
  return 'right';
}

/* The board grid is `1.55fr repeat(9, 1fr) 1.55fr` in both directions (see
   monopoly.css), so a track's position can be computed without measuring. */
const CORNER = 1.55;
const TRACK = CORNER * 2 + 9;
const trackStart = (n: number) => (n === 1 ? 0 : CORNER + (n - 2));
const trackSize = (n: number) => (n === 1 || n === 11 ? CORNER : 1);
const centre = (n: number) => (trackStart(n) + trackSize(n) / 2) / TRACK;
/** A point `f` of the way across track `n` (0 = its start edge, 1 = its end). */
const along = (n: number, f: number) => (trackStart(n) + trackSize(n) * f) / TRACK;

/**
 * Where a token stands on a square, as fractions of the board (0–1), and the
 * axis several tokens on that square fan out along. Tokens keep to the outer
 * edge, away from the colour strip, as on a printed board.
 */
export function tokenAnchor(i: number): { x: number; y: number; axis: 'x' | 'y' } {
  const { row, col } = cellPos(i);
  switch (sideOf(i)) {
    case 'corner':
      return { x: centre(col), y: along(row, 0.82), axis: 'x' };
    case 'bottom':
      return { x: centre(col), y: along(row, 0.85), axis: 'x' };
    case 'top':
      return { x: centre(col), y: along(row, 0.15), axis: 'x' };
    case 'left':
      return { x: along(col, 0.15), y: centre(row), axis: 'y' };
    case 'right':
      return { x: along(col, 0.85), y: centre(row), axis: 'y' };
  }
}

/** The longest move a roll makes; anything longer is a jump, not a walk. */
const MAX_ROLL = 12;

/**
 * The squares a token visits moving `from` → `to`. A dice-length forward move
 * walks every square (wrapping past Go); a backward move, a long card jump, or a
 * `direct` move (sent to jail) goes straight to the destination.
 */
export function movePath(from: number, to: number, direct = false): number[] {
  if (from === to) return [];
  const steps = (to - from + 40) % 40;
  if (direct || steps > MAX_ROLL) return [to];
  return Array.from({ length: steps }, (_, k) => (from + k + 1) % 40);
}

/** A token's label: a bot's number ("Bot 2" → "2"), else the name's initial. */
export function tokenLabel(name: string): string {
  const digits = name.match(/\d+$/);
  return digits ? digits[0] : name.trim().slice(0, 1).toUpperCase();
}

/** A stable token colour per seat index. */
const TOKENS = ['#D93A3F', '#2651C9', '#2F9E62', '#E8821A', '#7C4DBA', '#00897B'];
export const tokenColor = (seat: number): string => TOKENS[seat % TOKENS.length];
