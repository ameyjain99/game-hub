/**
 * Board geometry for Snakes & Ladders: where each square sits (squares run
 * boustrophedon from the bottom-left), and the SVG shapes of the ladders and
 * snakes, on a 1000×1000 board.
 */

/** A square's grid cell: column 0–9 from the left, row 0–9 from the top. */
export function cellOf(n: number): { col: number; row: number } {
  const i = n - 1;
  const band = Math.floor(i / 10);
  const col = band % 2 === 0 ? i % 10 : 9 - (i % 10);
  return { col, row: 9 - band };
}

/** A square's centre in board units (1000 across); square 0 sits just off the board, left of 1. */
export function centreOf(n: number): { x: number; y: number } {
  if (n <= 0) return { x: -45, y: 950 };
  const { col, row } = cellOf(n);
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

/** The squares in display order: top row first, left to right. */
export const SQUARES_BY_CELL: number[] = Array.from({ length: 100 }, (_, k) => {
  const row = Math.floor(k / 10);
  const col = k % 10;
  const band = 9 - row;
  return band * 10 + (band % 2 === 0 ? col : 9 - col) + 1;
});

type P = { x: number; y: number };

/** The two rails and the rungs of a ladder from `foot` to `top`. */
export function ladderShape(foot: number, top: number): { rails: string[]; rungs: string[] } {
  const a = centreOf(foot);
  const b = centreOf(top);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * 17;
  const py = ux * 17;
  // The ends sit a little inside each square.
  const s = { x: a.x - ux * 18, y: a.y - uy * 18 };
  const e = { x: b.x + ux * 18, y: b.y + uy * 18 };
  const rails = [
    `M${s.x + px} ${s.y + py}L${e.x + px} ${e.y + py}`,
    `M${s.x - px} ${s.y - py}L${e.x - px} ${e.y - py}`,
  ];
  const rungs: string[] = [];
  const total = len + 36;
  const count = Math.max(2, Math.floor(total / 38));
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const cx = s.x + (e.x - s.x) * t;
    const cy = s.y + (e.y - s.y) * t;
    rungs.push(`M${cx + px} ${cy + py}L${cx - px} ${cy - py}`);
  }
  return { rails, rungs };
}

/**
 * A snake from its head (on the higher square) to its tail: a body that waves
 * along the way and tapers to the tail, the spots along its back, and its head.
 */
export function snakeShape(head: number, tail: number, waves?: number) {
  const a = centreOf(head);
  const b = centreOf(tail);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const n = waves ?? Math.max(1.25, Math.round((len / 230) * 2) / 2);
  const amp = Math.min(34, 14 + len / 30);
  const steps = 48;
  const centre: P[] = [];
  const normal: P[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Calm near the head, waving along the body.
    const env = Math.sin(Math.min(1, t * 3) * (Math.PI / 2));
    const off = Math.sin(t * n * Math.PI * 2) * amp * env;
    centre.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
  }
  for (let i = 0; i <= steps; i++) {
    const p = centre[Math.max(0, i - 1)];
    const q = centre[Math.min(steps, i + 1)];
    const tx = q.x - p.x;
    const ty = q.y - p.y;
    const l = Math.hypot(tx, ty) || 1;
    normal.push({ x: -ty / l, y: tx / l });
  }
  const width = (t: number) => 15 * (1 - t) ** 0.7 + 2.5;
  const left = centre.map((c, i) => ({ x: c.x + normal[i].x * width(i / steps), y: c.y + normal[i].y * width(i / steps) }));
  const right = centre.map((c, i) => ({ x: c.x - normal[i].x * width(i / steps), y: c.y - normal[i].y * width(i / steps) }));
  const pt = (p: P) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const body = `M${pt(left[0])}${left.slice(1).map((p) => `L${pt(p)}`).join('')}${right.reverse().map((p) => `L${pt(p)}`).join('')}Z`;
  const spine = `M${pt(centre[0])}${centre.slice(1).map((p) => `L${pt(p)}`).join('')}`;
  // The head faces back up the body's first stretch.
  const hx = centre[0].x - centre[3].x;
  const hy = centre[0].y - centre[3].y;
  const angle = (Math.atan2(hy, hx) * 180) / Math.PI;
  return { body, spine, head: centre[0], angle };
}
