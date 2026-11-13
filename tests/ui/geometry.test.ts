import { describe, it, expect } from 'vitest';
import { makeCurve } from '../../src/games/ticket-to-ride/ui/geometry';
import { ROUTE_BENDS, bendKey } from '../../src/games/ticket-to-ride/ui/data/routeCurves';
import { ROUTES } from '../../src/games/ticket-to-ride/engine/data/usa/routes';

const A = { x: 0, y: 0 };
const B = { x: 100, y: 0 };

describe('makeCurve', () => {
  it('is a straight line with uniform speed when there is no bend', () => {
    const c = makeCurve(A, B, [0, 0]);
    expect(c.length).toBeCloseTo(100, 5);
    const p = c.at(25);
    expect(p.x).toBeCloseTo(25, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.ux).toBeCloseTo(1, 5);
    expect(p.uy).toBeCloseTo(0, 5);
  });

  it('passes through the chord midpoint shifted by the bend', () => {
    const c = makeCurve(A, B, [0, -20]);
    const mid = c.at(c.length / 2);
    expect(mid.x).toBeCloseTo(50, 1);
    expect(mid.y).toBeCloseTo(-20, 1);
    // symmetric bow: tangent at the middle is parallel to the chord
    expect(mid.uy).toBeCloseTo(0, 2);
  });

  it('is longer than the chord when bent and spans both endpoints', () => {
    const c = makeCurve(A, B, [0, 30]);
    expect(c.length).toBeGreaterThan(100);
    expect(c.at(0).x).toBeCloseTo(0, 5);
    const end = c.at(c.length);
    expect(end.x).toBeCloseTo(100, 5);
    expect(end.y).toBeCloseTo(0, 5);
  });

  it('spaces points evenly by arc length', () => {
    const c = makeCurve(A, B, [10, 40]);
    // Distance actually travelled along the curve between two arc-length positions.
    const travelled = (s0: number, s1: number) => {
      let d = 0;
      let prev = c.at(s0);
      for (let k = 1; k <= 50; k++) {
        const p = c.at(s0 + ((s1 - s0) * k) / 50);
        d += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
      }
      return d;
    };
    const step = c.length / 6;
    for (let i = 0; i < 6; i++) expect(travelled(i * step, (i + 1) * step)).toBeCloseTo(step, 0);
  });
});

describe('ROUTE_BENDS', () => {
  it('only references existing routes (by id or double-route group)', () => {
    const keys = new Set(ROUTES.map(bendKey));
    for (const k of Object.keys(ROUTE_BENDS)) expect(keys.has(k)).toBe(true);
  });
});
