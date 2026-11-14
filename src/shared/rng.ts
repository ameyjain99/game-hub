export interface Rng {
  next(): number;
  state: number;
}

/** mulberry32 – small, fast, deterministic PRNG. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    get state() {
      return s;
    },
    set state(v: number) {
      s = v >>> 0;
    },
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
