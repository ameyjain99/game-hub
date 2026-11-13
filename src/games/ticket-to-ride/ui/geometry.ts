export interface Pt {
  x: number;
  y: number;
}

/** A route's bow: how far its midpoint sits from the straight chord's midpoint (board units). */
export type Bend = readonly [dx: number, dy: number];

export interface Curve {
  length: number;
  /** Point and unit tangent at arc-length distance `s` from the start (clamped). */
  at(s: number): { x: number; y: number; ux: number; uy: number };
}

const SAMPLES = 48;

/** SVG polyline points along a (possibly bent) route, offset sideways by `side`. */
export function curvePoints(a: Pt, b: Pt, bend: Bend, side = 0, steps = 16): string {
  const c = makeCurve(a, b, bend);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const p = c.at((c.length * i) / steps);
    return `${(p.x - p.uy * side).toFixed(1)},${(p.y + p.ux * side).toFixed(1)}`;
  }).join(' ');
}

/**
 * Quadratic Bézier from `a` to `b` that passes through the chord midpoint
 * shifted by `bend`. A `[0, 0]` bend is the straight segment.
 */
export function makeCurve(a: Pt, b: Pt, bend: Bend): Curve {
  // B(0.5) = (a + 2c + b) / 4, so for B(0.5) = mid + bend the control is mid + 2*bend.
  const cx = (a.x + b.x) / 2 + 2 * bend[0];
  const cy = (a.y + b.y) / 2 + 2 * bend[1];
  const point = (t: number) => {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
  };
  const deriv = (t: number) => ({
    x: 2 * (1 - t) * (cx - a.x) + 2 * t * (b.x - cx),
    y: 2 * (1 - t) * (cy - a.y) + 2 * t * (b.y - cy),
  });

  // Arc-length table so cars can be spaced evenly along the curve.
  const cum = [0];
  let prev = point(0);
  for (let i = 1; i <= SAMPLES; i++) {
    const p = point(i / SAMPLES);
    cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const length = cum[SAMPLES];

  return {
    length,
    at(s) {
      const d = Math.min(Math.max(s, 0), length);
      let i = 1;
      while (i < SAMPLES && cum[i] < d) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (i - 1 + (d - cum[i - 1]) / seg) / SAMPLES;
      const p = point(t);
      const v = deriv(t);
      const m = Math.hypot(v.x, v.y) || 1;
      return { x: p.x, y: p.y, ux: v.x / m, uy: v.y / m };
    },
  };
}
