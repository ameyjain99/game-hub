import { expect, test } from 'vitest';
import { createCluedoGame } from '../../../src/games/cluedo/engine/state';
import { reduce } from '../../../src/games/cluedo/engine/reducer';
import { chooseCluedoAction } from '../../../src/games/cluedo/engine/bot';

// Drive a full game with every player a bot and check the deduction holds up:
// the game ends with a correct accusation and nobody ever accuses wrongly.
test.each([1, 2, 3, 42])('all-bot game (seed %i) ends with a correct win and no wrong accusations', (seed) => {
  let state = createCluedoGame(['p1', 'p2', 'p3'], { seed, ai: [true, true, true] });
  let steps = 0;
  while (state.phase !== 'over' && steps < 20000) {
    state = reduce(state, chooseCluedoAction(state));
    steps += 1;
    // A wrong accusation would eliminate someone — the bot must never do that.
    expect(state.players.some((p) => p.eliminated)).toBe(false);
  }
  expect(state.phase).toBe('over');
  expect(state.winner).not.toBeNull();
});
