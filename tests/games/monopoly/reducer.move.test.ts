import { describe, expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction, advanceToSpace } from '../../../src/games/monopoly/engine/reducer';

function mk(seed = 1, overrides?: Parameters<typeof createMonopolyGame>[2]): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    seed,
    { randomizeOrder: false, ...overrides },
  );
}

/** A seed whose next roll on a fresh game comes up doubles. */
function seedWithDoubles(): number {
  for (let s = 1; s < 5000; s++) {
    const out = applyAction(mk(s), { type: 'ROLL' });
    if (out.dice![0] === out.dice![1]) return s;
  }
  throw new Error('no doubles seed found');
}

describe('ROLL and movement', () => {
  test('rolling sets dice and advances the current token', () => {
    const g = mk(5); // seed 5's first roll lands on a plain property (no card relocation)
    const out = applyAction(g, { type: 'ROLL' });
    expect(out.dice).not.toBeNull();
    const total = out.dice![0] + out.dice![1];
    expect(out.players[currentSeat(g)].position).toBe(total % 40);
    expect(out.phase).not.toBe('roll');
  });

  test('passing Go pays $200', () => {
    const g = mk();
    g.players[currentSeat(g)].position = 39;
    const out = applyAction(g, { type: 'ROLL' });
    const total = out.dice![0] + out.dice![1];
    expect(out.players[currentSeat(g)].position).toBe((39 + total) % 40);
    // cash rose by 200 (plus no spend — unowned landings only set pendingPurchase)
    expect(out.players[currentSeat(g)].cash).toBe(1500 + 200);
  });

  test('three consecutive doubles sends the player to jail', () => {
    const seat = 0;
    const g = mk(seedWithDoubles());
    g.doubles = 2;
    const out = applyAction(g, { type: 'ROLL' });
    expect(out.players[seat].inJail).toBe(true);
    expect(out.players[seat].position).toBe(10);
    expect(out.doubles).toBe(0);
  });
});

describe('landing dispatch (advanceToSpace)', () => {
  test('landing on an unowned ownable space offers a purchase', () => {
    const g = mk();
    const out = advanceToSpace(g, currentSeat(g), 1, false);
    expect(out.pendingPurchase).toBe(1);
    expect(out.phase).toBe('action');
  });

  test('collecting Go pays salary, doubled on exact landing with the house rule', () => {
    const g = mk();
    const out = advanceToSpace(g, currentSeat(g), 0, true);
    expect(out.players[currentSeat(g)].cash).toBe(1500 + 200);

    const dbl = mk(1, { doubleGoSalary: true });
    const out2 = advanceToSpace(dbl, currentSeat(dbl), 0, true);
    expect(out2.players[currentSeat(dbl)].cash).toBe(1500 + 400);
  });

  test('landing on Go To Jail jails the player at position 10', () => {
    const g = mk();
    const out = advanceToSpace(g, currentSeat(g), 30, false);
    expect(out.players[currentSeat(g)].inJail).toBe(true);
    expect(out.players[currentSeat(g)].position).toBe(10);
  });

  test('landing on your own property is a no-op purchase-wise', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    const out = advanceToSpace(g, currentSeat(g), 1, false);
    expect(out.pendingPurchase).toBeNull();
    expect(out.players[currentSeat(g)].cash).toBe(1500);
  });
});
