/**
 * A game's icon in the GameHub two-tone style: a thick white stroke with a thin
 * accent-coloured stroke on the same path, so on an accent-coloured tile it reads
 * as a hollow "twin line" glyph. One bold shape per game on a 64-unit grid.
 * Points that are too small to carry a line (dice pips, chips, a marble) are
 * solid white `dots` instead.
 */
interface IconSpec {
  d: string;
  /** Width of the white stroke; the accent channel is always 4. */
  outer?: number;
  /** Solid white dots as [cx, cy, r]. */
  dots?: [number, number, number][];
  /** Thin solid white lines with round ends and no accent line (for lines that cross, or shapes too small for the twin line). */
  plain?: boolean;
  /** A small solid white shape (a letter on a tile), for marks too fine to carry the twin line. */
  fill?: string;
}

const PATHS: Record<string, IconSpec> = {
  // Strategy
  'ticket-to-ride': { d: 'M6 50C26 50 30 14 58 14', outer: 13 },
  // A single hex tile.
  catan: { d: 'M32 7L54 19.5V44.5L32 57L10 44.5V19.5Z' },
  chess: { d: 'M23 17a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M26 33H38L45 56H19Z' },
  checkers: { d: 'M9 22a23 11 0 1 0 46 0a23 11 0 1 0 -46 0M9 22V42a23 11 0 0 0 46 0V22' },
  sequence: {
    d: 'M30.9 52.9L52.9 30.9A14 14 0 0 0 33.1 11.1L11.1 33.1A14 14 0 0 0 30.9 52.9Z',
    dots: [
      [22, 42, 4],
      [32, 32, 4],
      [42, 22, 4],
    ],
  },
  // Roll & race
  monopoly: { d: 'M14 54V29L32 13L50 29V54Z' },
  // The board's four yards, one in each corner, each holding its four tokens.
  ludo: {
    d: 'M9 5H23A4 4 0 0 1 27 9V23A4 4 0 0 1 23 27H9A4 4 0 0 1 5 23V9A4 4 0 0 1 9 5ZM41 5H55A4 4 0 0 1 59 9V23A4 4 0 0 1 55 27H41A4 4 0 0 1 37 23V9A4 4 0 0 1 41 5ZM9 37H23A4 4 0 0 1 27 41V55A4 4 0 0 1 23 59H9A4 4 0 0 1 5 55V41A4 4 0 0 1 9 37ZM41 37H55A4 4 0 0 1 59 41V55A4 4 0 0 1 55 59H41A4 4 0 0 1 37 55V41A4 4 0 0 1 41 37Z',
    outer: 3,
    plain: true,
    dots: [
      [11.4, 11.4, 2.2],
      [20.6, 11.4, 2.2],
      [11.4, 20.6, 2.2],
      [20.6, 20.6, 2.2],
      [43.4, 11.4, 2.2],
      [52.6, 11.4, 2.2],
      [43.4, 20.6, 2.2],
      [52.6, 20.6, 2.2],
      [11.4, 43.4, 2.2],
      [20.6, 43.4, 2.2],
      [11.4, 52.6, 2.2],
      [20.6, 52.6, 2.2],
      [43.4, 43.4, 2.2],
      [52.6, 43.4, 2.2],
      [43.4, 52.6, 2.2],
      [52.6, 52.6, 2.2],
    ],
  },
  parcheesi: { d: 'M22 8H42V22H56V42H42V56H22V42H8V22H22Z' },
  // The Jackaroo board's marble track: a square with a loop out at each corner.
  jackaroo: {
    d: 'M37.51 18L46.14 9.37L54.63 17.86L46 26.49V37.51L54.63 46.14L46.14 54.63L37.51 46H26.49L17.86 54.63L9.37 46.14L18 37.51V26.49L9.37 17.86L17.86 9.37L26.49 18Z',
  },
  'snakes-and-ladders': {
    d: 'M8 6V58M28 6V58M8 23H28M8 41H28M47 17C55 22 55 28 47 34S39 46 47 51L50 58',
    dots: [[46, 11, 6]],
  },
  // Cards
  poker: {
    d: 'M32 11.7C39.2 21.6 50.9 27 50.9 36.9A8.55 8.55 0 0 1 35.6 42.3L39.2 55.8H24.8L28.4 42.3A8.55 8.55 0 0 1 13.1 36.9C13.1 27 24.8 21.6 32 11.7Z',
  },
  'uno': { d: 'M8 17L28 11L37 45L17 51ZM31 14H55V50H31' },
  solitaire: { d: 'M8 40V6H38M22 20H54V56H22Z' },
  // Words & puzzles
  // A letter tile: a small A with room round it.
  scrabble: {
    d: 'M14 6H50A8 8 0 0 1 58 14V50A8 8 0 0 1 50 58H14A8 8 0 0 1 6 50V14A8 8 0 0 1 14 6Z',
    fill: 'M29.4 19H34.6L43 45H37.6L36 39.6H28L26.4 45H21ZM29.4 35H34.6L32 26.2Z',
  },
  sudoku: { d: 'M6 6H58V58H6ZM23.3 6V58M40.7 6V58M6 23.3H58M6 40.7H58' },
  // A mine: a round body, a short fuse and its spark.
  minesweeper: { d: 'M10 39a16 16 0 1 0 32 0a16 16 0 1 0 -32 0M38.5 27.5L46 20', dots: [[53, 13, 4.5]] },
  // Just the grid: two lines down, two across. Crossing twin lines break up, so these are plain.
  'tic-tac-toe': { d: 'M23 9V55M41 9V55M9 23H55M9 41H55', outer: 6, plain: true },
  // Party & deduction
  cluedo: { d: 'M10 27a17 17 0 1 0 34 0a17 17 0 1 0 -34 0M39 39L57 57' },
  imposter: {
    d: 'M6 24C6 18 14 17 32 21C50 17 58 18 58 24C58 38 51 46 42 46C36 46 34 39 32 39C30 39 28 46 22 46C13 46 6 38 6 24Z',
  },
  // Skill & arcade
  carrom: { d: 'M8 8H44V44H8ZM35 44a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' },
  'paper-io': { d: 'M8 32H32V56H8ZM20 32V10H50V34', dots: [[50, 42, 6]] },
  minecraft: { d: 'M32 8L53 20V44L32 56L11 44V20ZM11 20L32 32L53 20M32 32V56' },
};

export function GameIcon({ gameId, accent, size = 44 }: { gameId: string; accent: string; size?: number }) {
  const p = PATHS[gameId];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" strokeLinejoin="miter" strokeLinecap={p.plain ? 'round' : 'butt'}>
        <path d={p.d} stroke="#FFFFFF" strokeWidth={p.outer ?? 12} />
        {!p.plain && <path d={p.d} stroke={accent} strokeWidth={4} />}
      </g>
      {p.fill && <path d={p.fill} fill="#FFFFFF" fillRule="evenodd" />}
      {p.dots?.map(([cx, cy, r]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="#FFFFFF" />)}
    </svg>
  );
}
