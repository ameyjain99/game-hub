// Showing your cards after an uncontested win, face-up all-ins, and win chances.
import { expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { createPoker, pokerKit, redactPoker, type PokerAction, type PokerState } from '../../../src/games/poker/engine';
import { winChances } from '../../../src/games/poker/equity';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
const act = (s: PokerState, a: PokerAction) => pokerKit.apply(s, a, s.players[s.toAct!].id);

test('the winner of a hand nobody called may show their cards; nobody else may', () => {
  let s = createPoker(seats(2), 5, { variant: 'holdem' });
  s = act(s, { type: 'FOLD' });
  expect(s.phase).toBe('result');
  expect(s.result!.showdown).toBe(false);
  const winner = Object.keys(s.result!.won)[0];
  const loser = s.players.find((p) => p.id !== winner)!.id;

  // Hidden from the other player until shown.
  expect(redactPoker(s, loser).players.find((p) => p.id === winner)!.hole.every((c) => c === null)).toBe(true);
  expect(() => pokerKit.apply(s, { type: 'SHOW' }, loser)).toThrow(IllegalMove);
  s = pokerKit.apply(s, { type: 'SHOW' }, winner);
  expect(redactPoker(s, loser).players.find((p) => p.id === winner)!.hole.every(Boolean)).toBe(true);
  expect(() => pokerKit.apply(s, { type: 'SHOW' }, winner)).toThrow(IllegalMove); // once is enough
});

test('when everyone is all in before the board is out, the hands are face up for the table', () => {
  let s = createPoker(seats(2), 9, { variant: 'holdem' });
  const first = s.players[s.toAct!];
  s = act(s, { type: 'RAISE', to: first.stack + first.bet });
  s = act(s, { type: 'CALL' });
  expect(s.phase).toBe('dealing');
  const other = s.players.find((p) => p.id !== first.id)!.id;
  expect(redactPoker(s, other).players.find((p) => p.id === first.id)!.hole.every(Boolean)).toBe(true);
});

test('win chances add up to one, and a made hand against a dead one is certain', () => {
  const rand = (() => {
    let x = 7;
    return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
  })();
  const even = winChances('holdem', [{ id: 'a', hole: ['AS', 'AH'] }, { id: 'b', hole: ['KS', 'KH'] }], [], rand, 300);
  expect(even.a + even.b).toBeCloseTo(1, 5);
  expect(even.a).toBeGreaterThan(0.7); // aces are a big favourite over kings

  // Board complete: quad aces beat kings full, no dealing needed.
  const done = winChances('holdem', [{ id: 'a', hole: ['AS', 'AH'] }, { id: 'b', hole: ['KS', 'KH'] }], ['AD', 'AC', 'KD', '2S', '3H']);
  expect(done).toEqual({ a: 1, b: 0 });
});
