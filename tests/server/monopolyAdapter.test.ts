import { describe, expect, test } from 'vitest';
import { adapterFor } from '../../server/adapters';
import type { MonopolyState } from '../../src/games/monopoly/engine/state';

const adapter = adapterFor('monopoly');

function newGame(n = 3) {
  const configs = Array.from({ length: n }, (_, i) => ({
    name: `P${i}`,
    isAI: i === n - 1, // last seat is a bot
    avatar: `a${i}`,
    difficulty: 'normal',
  }));
  return adapter.createGame(configs, 1, { randomizeOrder: false }) as MonopolyState;
}

describe('monopolyAdapter', () => {
  test('validates the 2–6 seat range', () => {
    expect(adapter.validateSeatCount(1, {})).not.toBeNull();
    expect(adapter.validateSeatCount(2, {})).toBeNull();
    expect(adapter.validateSeatCount(6, {})).toBeNull();
    expect(adapter.validateSeatCount(7, {})).not.toBeNull();
  });

  test('createGame produces a playable game resting on the first human', () => {
    const g = newGame();
    expect(g.phase).not.toBe('over');
    expect(adapter.turnActorId(g)).toBe('p0');
  });

  test('rejects an action that is not the actor turn', () => {
    const g = newGame();
    const res = adapter.applyAction(g, { type: 'ROLL' }, { actorId: 'p1' });
    expect(res).toHaveProperty('error');
  });

  test('applies a legal roll from the current actor', () => {
    const g = newGame();
    const res = adapter.applyAction(g, { type: 'ROLL' }, { actorId: 'p0' });
    expect(res).toHaveProperty('game');
  });

  test('replaceWithAi flips a seat and the game keeps going while a human remains', () => {
    const g = newGame();
    const out = adapter.replaceWithAi(g, 0, 'normal') as MonopolyState;
    expect(out.players[0].isAI).toBe(true);
    expect(out.phase).not.toBe('over'); // p1 is still human
  });

  test('redactFor strips the deck order', () => {
    const g = newGame();
    const view = adapter.redactFor(g, 'p0') as MonopolyState;
    expect(view.chanceOrder).toEqual([]);
  });
});
