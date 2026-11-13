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

/** Which edge of the board a space sits on (corners are their own kind). */
export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export function sideOf(i: number): Side {
  if (i % 10 === 0) return 'corner';
  if (i < 10) return 'bottom';
  if (i < 20) return 'left';
  if (i < 30) return 'top';
  return 'right';
}

/** A token's label: a bot's number ("Bot 2" → "2"), else the name's initial. */
export function tokenLabel(name: string): string {
  const digits = name.match(/\d+$/);
  return digits ? digits[0] : name.trim().slice(0, 1).toUpperCase();
}

/** A stable token colour per seat index. */
const TOKENS = ['#D93A3F', '#2651C9', '#2F9E62', '#E8821A', '#7C4DBA', '#00897B'];
export const tokenColor = (seat: number): string => TOKENS[seat % TOKENS.length];
