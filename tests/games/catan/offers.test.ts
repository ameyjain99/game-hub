// A trade offer is put to the whole table at once; anyone may come back with other terms.
import { expect, test } from 'vitest';
import { IllegalMove } from '../../../src/games/kit/engine';
import { emptyHand, catanKit, type CatanState } from '../../../src/games/catan/engine';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));

/** A three-player game in p0's main phase, hands set by the test. */
function table(hands: Partial<Record<string, Partial<ReturnType<typeof emptyHand>>>>): CatanState {
  const s = catanKit.create(seats(3), 5, { mode: 'base' });
  return {
    ...s,
    phase: 'main',
    turn: 0,
    players: s.players.map((p) => ({ ...p, hand: { ...emptyHand(), ...(hands[p.id] ?? {}) } })),
  } as CatanState;
}

test('everyone asked can answer in any order, and the offerer can trade as soon as someone says yes', () => {
  let s = table({ p0: { lumber: 2 }, p1: { grain: 1 }, p2: { grain: 1 } });
  s = catanKit.apply(s, { type: 'OFFER', give: { lumber: 1 }, get: { grain: 1 } }, 'p0');
  expect(s.offer!.asked).toEqual(['p1', 'p2']);

  // p2 answers before p1.
  s = catanKit.apply(s, { type: 'ANSWER', accept: true }, 'p2');
  expect(s.offer!.asked).toEqual(['p1']);
  // p0 does not have to wait for p1.
  s = catanKit.apply(s, { type: 'CLOSE_OFFER', with: 'p2' }, 'p0');
  expect(s.phase).toBe('main');
  expect(s.players[0].hand).toMatchObject({ lumber: 1, grain: 1 });
  expect(s.players[2].hand).toMatchObject({ lumber: 1, grain: 0 });
});

test('a player can counter with other terms, and the offerer can take the counter', () => {
  let s = table({ p0: { lumber: 2, brick: 1 }, p1: { grain: 1, wool: 1 }, p2: {} });
  s = catanKit.apply(s, { type: 'OFFER', give: { lumber: 1 }, get: { grain: 1 } }, 'p0');
  // p1 would rather give wool, and wants brick for it.
  s = catanKit.apply(s, { type: 'COUNTER', give: { wool: 1 }, get: { brick: 1 } }, 'p1');
  expect(s.offer!.counters!.p1).toEqual({ give: { wool: 1 }, get: { brick: 1 } });
  expect(s.offer!.asked).not.toContain('p1');
  // A counter you can't pay for is refused.
  expect(() => catanKit.apply(s, { type: 'COUNTER', give: { ore: 3 }, get: { brick: 1 } }, 'p2')).toThrow(IllegalMove);

  s = catanKit.apply(s, { type: 'CLOSE_OFFER', with: 'p1', counter: true }, 'p0');
  expect(s.players[0].hand).toMatchObject({ lumber: 2, brick: 0, wool: 1 });
  expect(s.players[1].hand).toMatchObject({ grain: 1, wool: 0, brick: 1 });
});
