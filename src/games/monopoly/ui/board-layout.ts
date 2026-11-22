import type { ColorGroup } from '../engine/board';

/** Grid cell (1-indexed row/col) for a space index, on a board with `side`
 *  squares to a side (10 on the standard board's 11×11 grid, 13 on Mega's
 *  14×14). The ring runs clockwise from Go at the bottom-right corner. */
export function cellPos(i: number, side = 10): { row: number; col: number } {
  const last = side + 1;
  if (i <= side) return { row: last, col: last - i };
  if (i <= side * 2) return { row: side * 2 + 1 - i, col: 1 };
  if (i <= side * 3) return { row: 1, col: i - side * 2 + 1 };
  return { row: i - side * 3 + 1, col: last };
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

export function sideOf(i: number, side = 10): Side {
  if (i % side === 0) return 'corner';
  if (i < side) return 'bottom';
  if (i < side * 2) return 'left';
  if (i < side * 3) return 'top';
  return 'right';
}

/* The board grid is `1.55fr repeat(side - 1, 1fr) 1.55fr` in both directions
   (see monopoly.css), so a track's position can be computed without measuring. */
const CORNER = 1.55;
function tracks(side: number) {
  const total = CORNER * 2 + (side - 1);
  const start = (n: number) => (n === 1 ? 0 : CORNER + (n - 2));
  const size = (n: number) => (n === 1 || n === side + 1 ? CORNER : 1);
  return {
    centre: (n: number) => (start(n) + size(n) / 2) / total,
    /** A point `f` of the way across track `n` (0 = its start edge, 1 = its end). */
    along: (n: number, f: number) => (start(n) + size(n) * f) / total,
  };
}

/**
 * Where a token stands on a square, as fractions of the board (0-1), and the
 * axis several tokens on that square fan out along. Tokens keep to the outer
 * edge, away from the colour strip, as on a printed board.
 */
export function tokenAnchor(i: number, side = 10): { x: number; y: number; axis: 'x' | 'y' } {
  const { row, col } = cellPos(i, side);
  const { centre, along } = tracks(side);
  switch (sideOf(i, side)) {
    case 'corner':
      return { x: centre(col), y: along(row, 0.78), axis: 'x' };
    case 'bottom':
      return { x: centre(col), y: along(row, 0.8), axis: 'x' };
    case 'top':
      return { x: centre(col), y: along(row, 0.2), axis: 'x' };
    case 'left':
      return { x: along(col, 0.2), y: centre(row), axis: 'y' };
    case 'right':
      return { x: along(col, 0.8), y: centre(row), axis: 'y' };
  }
}

/** The longest move a roll makes (two dice, or three with Mega's speed die); anything longer is a jump, not a walk. */
const maxRoll = (side: number) => (side > 10 ? 15 : 12);

/**
 * The squares a token visits moving `from` → `to`. A dice-length forward move
 * walks every square (wrapping past Go); a backward move, a long card jump, or a
 * `direct` move (sent to jail) goes straight to the destination.
 */
export function movePath(from: number, to: number, direct = false, side = 10): number[] {
  if (from === to) return [];
  const size = side * 4;
  const steps = (to - from + size) % size;
  if (direct || steps > maxRoll(side)) return [to];
  return Array.from({ length: steps }, (_, k) => (from + k + 1) % size);
}

/** A token's label: a bot's number ("Bot 2" → "2"), else the name's initial. */
export function tokenLabel(name: string): string {
  const digits = name.match(/\d+$/);
  return digits ? digits[0] : name.trim().slice(0, 1).toUpperCase();
}

/** A stable token colour per seat index. */
const TOKENS = ['#D93A3F', '#2651C9', '#2F9E62', '#E8821A', '#7C4DBA', '#00897B'];
export const tokenColor = (seat: number): string => TOKENS[seat % TOKENS.length];
