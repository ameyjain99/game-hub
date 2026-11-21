// A game with a round limit ends by net worth; a finished game can be played again.
import { expect, test } from 'vitest';
import { createMonopolyGame } from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';
import { IllegalActionError } from '../../../src/games/monopoly/engine/actions';
import { chooseMonopolyAction } from '../../../src/games/monopoly/engine/bot';
import { adapterFor } from '../../../server/adapters';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, avatar: '', isAI: true, difficulty: 'normal' as const }));

/** Let the bots play until the game ends (or a turn cap, which fails the test). */
function playOut(settings: Parameters<typeof createMonopolyGame>[2]) {
  let s = createMonopolyGame(seats(3), 11, settings);
  for (let i = 0; i < 20_000 && s.phase !== 'over'; i++) s = applyAction(s, chooseMonopolyAction(s));
  return s;
}

test('with a round limit the game stops after the last round and the richest player wins', () => {
  const s = playOut({ roundLimit: 3, randomizeOrder: false });
  expect(s.phase).toBe('over');
  expect(s.round).toBe(4); // three full rounds were played
  expect(s.winner).not.toBeNull();
  expect(s.log.some((l) => l.includes('rounds is over'))).toBe(true);
});

test('without a limit three rounds are nowhere near the end', () => {
  let s = createMonopolyGame(seats(3), 11, { randomizeOrder: false });
  for (let i = 0; i < 20_000 && s.round <= 3 && s.phase !== 'over'; i++) s = applyAction(s, chooseMonopolyAction(s));
  expect(s.phase).not.toBe('over');
});

test('a rematch starts a fresh game for the same players and rules, only once the game is over', () => {
  const live = createMonopolyGame(seats(2), 3, { roundLimit: 1, startingCash: 2000 });
  expect(() => applyAction(live, { type: 'REMATCH' })).toThrow(IllegalActionError);

  const over = playOut({ roundLimit: 1, startingCash: 2000 });
  const again = applyAction(over, { type: 'REMATCH' });
  expect(again.phase).not.toBe('over');
  expect(again.round).toBe(1);
  expect(again.players.map((p) => p.name)).toEqual(over.players.map((p) => p.name));
  expect(again.players.every((p) => p.cash === 2000 && !p.bankrupt)).toBe(true);
  expect(again.settings.roundLimit).toBe(1);

  // Online, the adapter accepts it from anyone at the table once the game is over.
  const a = adapterFor('monopoly');
  expect(a.rematchByVote).toBe(true);
  expect(a.applyAction(live, { type: 'REMATCH' }, { actorId: 'p0' })).toEqual({ error: expect.any(String) });
  expect('game' in a.applyAction(over, { type: 'REMATCH' }, { actorId: 'p1' })).toBe(true);
});
