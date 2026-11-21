// The stacking house rule, and hands turned face up when a hand ends.
import { expect, test } from 'vitest';
import { applyLastCard, createLastCard, fits, lastCardKit, type Card, type Face, type LcState } from '../../../src/games/last-card/engine';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
const card = (id: number, face: Face): Card => ({ id, light: face, dark: null });
const draw2 = (id: number, color: Face['color'] = 'red') => card(id, { kind: 'draw', color, value: 2 });
const num = (id: number, value: number, color: Face['color'] = 'red') => card(id, { kind: 'number', color, value });

/** A three-player hand with chosen hands, red in play, seat 0 to move. */
function rigged(stack: boolean, hands: Card[][]): LcState {
  const s = createLastCard(seats(3), 4, { variant: 'classic', stack });
  return {
    ...s,
    turn: 0,
    direction: 1,
    color: 'red',
    drawn: null,
    exposed: null,
    discard: [num(900, 5)],
    players: s.players.map((p, i) => ({ ...p, hand: hands[i], handCount: hands[i].length })),
  };
}

test('without stacking, a Draw 2 makes the next player draw two at once and miss the turn', () => {
  let s = rigged(false, [[draw2(1), num(2, 1), num(3, 2)], [draw2(4), num(5, 3)], [num(6, 4), num(7, 6)]]);
  s = applyLastCard(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(s.players[1].hand).toHaveLength(4);
  expect(s.owed).toBe(0);
  expect(s.turn).toBe(2);
});

test('with stacking, a Draw 2 can be answered with a Draw 2, and whoever cannot answer draws the lot', () => {
  let s = rigged(true, [[draw2(1), num(2, 1), num(3, 2)], [draw2(4, 'blue'), num(5, 3)], [num(6, 4), num(7, 6)]]);
  s = applyLastCard(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(s.owed).toBe(2);
  expect(s.turn).toBe(1); // p1 must answer, not miss the turn
  // Only another Draw 2 may be played now.
  expect(fits(s, s.players[1].hand[0].light!, s.players[1].hand)).toBe(true);
  expect(fits(s, s.players[1].hand[1].light!, s.players[1].hand)).toBe(false);

  s = applyLastCard(s, { type: 'PLAY', card: 4 }, 'p1');
  expect(s.owed).toBe(4);
  expect(s.turn).toBe(2);

  // p2 has no Draw 2: draws four and the turn passes on.
  s = applyLastCard(s, { type: 'DRAW' }, 'p2');
  expect(s.players[2].hand).toHaveLength(6);
  expect(s.owed).toBe(0);
  expect(s.turn).toBe(0);
});

test('going out on a stacked draw card still makes the next player take the cards before the count', () => {
  let s = rigged(true, [[draw2(1)], [num(5, 3)], [num(6, 4)]]);
  s = applyLastCard(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(s.over).toBe(true);
  expect(s.players[1].hand).toHaveLength(3);
});

test('hands are hidden during play and turned face up when the hand ends', () => {
  let s = rigged(false, [[num(1, 5)], [num(5, 3), num(8, 9)], [num(6, 4)]]);
  expect(lastCardKit.redact(s, 'p0').players[1].hand).toEqual([]);
  s = applyLastCard(s, { type: 'PLAY', card: 1 }, 'p0');
  expect(s.over).toBe(true);
  const seen = lastCardKit.redact(s, 'p0');
  expect(seen.players[1].hand.map((c) => c.light!.value)).toEqual([3, 9]);
  expect(seen.score.p0).toBe(3 + 9 + 4);
});
