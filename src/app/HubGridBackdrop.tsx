/**
 * The decorative grid behind the hero: rounded squares with gaps, mostly dark
 * with a scatter of game-accent colours, on a plane tilted in 3D so it recedes
 * into the screen from the bottom-left toward the top-right, fading at the edges.
 * Purely cosmetic (aria-hidden); colours are deterministic so it never flickers.
 */
const COLS = 11;
const ROWS = 9;

// Weighted palette: mostly near-black / grey, a sprinkle of the four game accents
// (plus a rare white) so the colour pops read as intentional, not noisy.
const PALETTE = [
  '#141419', '#141419', '#141419', '#141419', '#17171d', '#17171d', '#1d1d24', '#1d1d24',
  '#101014', '#0e0e12',
  '#D93A3F', '#2F9E62', '#7C4DBA', '#E8701A', '#2f8fd0', '#ececee',
];

// A tiny deterministic PRNG (mulberry32) so the layout is stable across renders
// without pulling in Math.random (which would also change every reload).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261026);
const CELLS = Array.from({ length: COLS * ROWS }, () => PALETTE[Math.floor(rand() * PALETTE.length)]);

export function HubGridBackdrop() {
  return (
    <div className="hub-backdrop" aria-hidden="true">
      <div className="hub-grid-plane" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {CELLS.map((color, i) => (
          <span key={i} className="hub-cell" style={{ background: color }} />
        ))}
      </div>
    </div>
  );
}
