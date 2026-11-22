import { DEALER_ID, nextRandom } from '../../../src/games/kit/engine';
import { ekKit, type EkOptions, type EkState } from '../../../src/games/exploding-kittens/engine';

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
export function playOut(levels: string[], seed: number, options: EkOptions = {}): EkState {
  let s = ekKit.create(levels.map((difficulty, i) => ({ name: `B${i}`, isAI: true, difficulty })), seed, options);
  const rand = seeded(seed ^ 0x9e3779b9);
  for (let step = 0; step < 5000 && !ekKit.isOver(s); step++) {
    const auto = ekKit.auto!(s);
    s = auto ? ekKit.apply(s, auto.action, DEALER_ID) : ekKit.apply(s, ekKit.bot(s, rand), ekKit.actor(s)!);
  }
  return s;
}
