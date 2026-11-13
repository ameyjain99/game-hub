import { describe, it, expect } from 'vitest';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { legalActions } from '../../src/games/ticket-to-ride/engine/selectors';
import { finalScores } from '../../src/games/ticket-to-ride/engine/scoring';
import { DEFAULT_BONUSES } from '../../src/games/ticket-to-ride/engine/bonuses';
import { makeRng } from '../../src/shared/rng';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';

function cardsInPlay(s: GameState): number {
  const inHands = s.players.reduce(
    (sum, p) => sum + Object.values(p.hand).reduce((a, b) => a + b, 0),
    0,
  );
  return inHands + s.drawPile.length + s.market.length + s.discardPile.length;
}

function actorWithActions(s: GameState): string | null {
  if (s.phase === 'setup-tickets') {
    const p = s.players.find((x) => x.pendingTickets.length > 0);
    return p ? p.id : null;
  }
  return s.players[s.current]?.id ?? null;
}

describe('full random legal game', () => {
  it('completes without illegal moves and conserves cards', () => {
    for (const seed of [1, 2, 7, 13, 42]) {
      const rng = makeRng(seed);
      let s = createGame(
        [
          { name: 'A', isAI: false },
          { name: 'B', isAI: true },
          { name: 'C', isAI: true },
        ],
        seed,
      );

      let iterations = 0;
      const CAP = 3000;
      while (s.phase !== 'game-over' && iterations < CAP) {
        iterations++;
        const actorId = actorWithActions(s);
        expect(actorId).not.toBeNull();
        const actions = legalActions(s, actorId!);
        expect(actions.length).toBeGreaterThan(0);
        const choice = actions[Math.floor(rng.next() * actions.length)];
        s = applyAction(s, choice);

        expect(cardsInPlay(s)).toBe(110);
        for (const p of s.players) expect(p.trainsLeft).toBeGreaterThanOrEqual(0);
      }

      expect(s.phase).toBe('game-over');
      expect(iterations).toBeLessThan(CAP);

      const scores = finalScores(s.players, DEFAULT_BONUSES);
      for (const p of s.players) expect(typeof scores[p.id].total).toBe('number');
    }
  });
});
