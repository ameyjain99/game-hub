import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/shared/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('returns floats in [0,1)', () => {
    const r = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('resumes from a saved state', () => {
    const a = makeRng(99);
    a.next();
    a.next();
    const saved = a.state;
    const nextFromA = a.next();
    const b = makeRng(0);
    b.state = saved;
    expect(b.next()).toBe(nextFromA);
  });
});
