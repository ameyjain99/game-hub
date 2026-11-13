/**
 * A game's icon in the GameHub two-tone style: a thick white stroke with a thin
 * accent-coloured stroke on the same path, so on an accent-coloured tile it reads
 * as a hollow "twin line" glyph. Paths are from the GameHub design.
 */
const PATHS: Record<string, { d: string; outer: number }> = {
  'ticket-to-ride': { d: 'M6 50C26 50 30 14 58 14', outer: 13 },
  monopoly: { d: 'M14 54V29L32 13L50 29V54Z', outer: 12 },
  cluedo: { d: 'M10 27a17 17 0 1 0 34 0a17 17 0 1 0 -34 0M39 39L57 57', outer: 12 },
  catan: { d: 'M32 7L54 19.5V44.5L32 57L10 44.5V19.5Z', outer: 12 },
};

export function GameIcon({ gameId, accent, size = 44 }: { gameId: string; accent: string; size?: number }) {
  const p = PATHS[gameId];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" strokeLinejoin="miter">
        <path d={p.d} stroke="#FFFFFF" strokeWidth={p.outer} />
        <path d={p.d} stroke={accent} strokeWidth={4} />
      </g>
    </svg>
  );
}
