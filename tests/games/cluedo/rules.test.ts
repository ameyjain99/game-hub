import { describe, expect, test } from 'vitest';
import { createCluedoGame, type CluedoState } from '../../../src/games/cluedo/engine/state';
import { reduce } from '../../../src/games/cluedo/engine/reducer';
import { chooseCluedoAction } from '../../../src/games/cluedo/engine/bot';
import { redactFor } from '../../../src/games/cluedo/engine/redact';
import { SUSPECTS, WEAPONS, ROOMS, type Card } from '../../../src/games/cluedo/engine/cards';

function inKitchen(): CluedoState {
  const g = createCluedoGame(['a', 'b', 'c'], { seed: 3 });
  return { ...g, phase: 'decide', players: g.players.map((p, i) => (i === 0 ? { ...p, room: 'Kitchen' } : p)) };
}

/** Make a suggestion and, if someone must disprove, have them show a card. */
function suggestAndResolve(g: CluedoState): CluedoState {
  let s = reduce(g, { type: 'suggest', suspect: SUSPECTS[0], weapon: WEAPONS[0] });
  if (s.phase === 'disprove') {
    const d = s.players.find((p) => p.id === s.pendingDisprover)!;
    const named: Card[] = [s.pendingSuggestion!.suspect, s.pendingSuggestion!.weapon, s.pendingSuggestion!.room];
    s = reduce(s, { type: 'disprove', card: d.hand.find((c) => named.includes(c))! });
  }
  return s;
}

describe('Cluedo rules', () => {
  test('only one suggestion per turn', () => {
    const once = suggestAndResolve(inKitchen());
    expect(once.history).toHaveLength(1);
    const twice = reduce(once, { type: 'suggest', suspect: SUSPECTS[1], weapon: WEAPONS[1] });
    expect(twice.history).toHaveLength(1);
    expect(twice.phase).toBe('decide');
  });

  test('the last player standing wins when everyone else has accused wrongly', () => {
    const g = inKitchen();
    const wrong = { ...g.solution, room: ROOMS.find((r) => r !== g.solution.room)! };
    const setup: CluedoState = { ...g, players: g.players.map((p, i) => (i === 1 ? { ...p, eliminated: true } : p)) };
    const out = reduce(setup, { type: 'accuse', ...wrong });
    expect(out.phase).toBe('over');
    expect(out.winner).toBe('c');
  });

  test('the answer is hidden from players until the game ends, then revealed to all', () => {
    const g = inKitchen();
    expect(redactFor(g, 'a').solution).toBeNull();
    const over: CluedoState = { ...g, phase: 'over', winner: 'b' };
    expect(redactFor(over, 'a').solution).toEqual(g.solution);
  });

  test('a game that runs past the turn limit ends rather than looping forever', () => {
    const g: CluedoState = { ...inKitchen(), turn: 499 };
    const out = reduce(g, { type: 'endTurn' });
    expect(out.phase).toBe('over');
  });
});

describe('easy bots', () => {
  test.each([1, 2, 3, 7, 42])('an all-easy game (seed %i) finishes', (seed) => {
    let s = createCluedoGame(['p1', 'p2', 'p3'], { seed, ai: [true, true, true], difficulty: ['easy', 'easy', 'easy'] });
    for (let steps = 0; s.phase !== 'over' && steps < 20000; steps++) s = reduce(s, chooseCluedoAction(s));
    expect(s.phase).toBe('over');
  });
});
