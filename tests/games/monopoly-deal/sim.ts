import { nextRandom } from '../../../src/games/kit/engine';
import { mdKit, type MdOptions, type MdState } from '../../../src/games/monopoly-deal/engine';

/** A seeded source of random numbers for the bots. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    const [r, next] = nextRandom(s);
    s = next;
    return r;
  };
}

/** Bots of the given levels play one whole game; returns the final state. */
export function playOut(levels: string[], seed: number, options: MdOptions = {}): MdState {
  let s = mdKit.create(levels.map((difficulty, i) => ({ name: `B${i}`, isAI: true, difficulty })), seed, options);
  const rand = seeded(seed ^ 0x9e3779b9);
  for (let step = 0; step < 20000 && !mdKit.isOver(s); step++) s = mdKit.apply(s, mdKit.bot(s, rand), mdKit.actor(s)!);
  return s;
}
