import { describe, expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction, advanceToSpace } from '../../../src/games/monopoly/engine/reducer';
import { CHANCE } from '../../../src/games/monopoly/engine/cards';

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

/** Force a specific Chance card to be drawn first. */
function chanceFirst(g: MonopolyState, cardId: string) {
  const idx = CHANCE.findIndex((c) => c.id === cardId);
  g.chanceOrder = [idx, ...Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== idx)];
  g.chancePtr = 0;
}

function seedWithDoubles(): number {
  for (let s = 1; s < 5000; s++) {
    const out = applyAction(mk(s), { type: 'ROLL' });
    if (out.dice![0] === out.dice![1]) return s;
  }
  throw new Error('no doubles seed');
}

describe('drawing cards', () => {
  test('an advance-to card moves and collects Go when passed', () => {
    const g = mk();
    chanceFirst(g, 'ch-go'); // Advance to Go, collect $200
    const out = advanceToSpace(g, currentSeat(g), 7, false); // land on Chance
    expect(out.players[0].position).toBe(0);
    expect(out.players[0].cash).toBe(1500 + 200);
  });

  test('a nearest-station card lands on the next railroad', () => {
    const g = mk();
    chanceFirst(g, 'ch-rail1');
    const out = advanceToSpace(g, currentSeat(g), 7, false); // from Chance@7 -> station 15
    expect(out.players[0].position).toBe(15);
    expect(out.pendingPurchase).toBe(15);
  });

  test('a repairs card charges per house and hotel', () => {
    const g = mk();
    chanceFirst(g, 'ch-repairs'); // $25/house, $100/hotel
    g.ownership[6].owner = 'p0';
    g.ownership[6].houses = 3;
    g.ownership[9].owner = 'p0';
    g.ownership[9].houses = 5; // hotel
    const out = advanceToSpace(g, currentSeat(g), 7, false);
    expect(out.players[0].cash).toBe(1500 - (25 * 3 + 100 * 1));
  });

  test('a Get-Out-of-Jail card is gained and then consumable', () => {
    const g = mk();
    chanceFirst(g, 'ch-free');
    const gained = advanceToSpace(g, currentSeat(g), 7, false);
    expect(gained.players[0].getOutCards).toBe(1);
    expect(gained.chanceJailOut).toBe(true);

    gained.players[0].inJail = true;
    gained.phase = 'jail';
    const used = applyAction(gained, { type: 'USE_JAIL_CARD' });
    expect(used.players[0].getOutCards).toBe(0);
    expect(used.players[0].inJail).toBe(false);
    expect(used.chanceJailOut).toBe(false);
  });
});

describe('jail actions', () => {
  test('PAY_JAIL frees the player for $50', () => {
    const g = mk();
    g.players[0].inJail = true;
    g.phase = 'jail';
    const out = applyAction(g, { type: 'PAY_JAIL' });
    expect(out.players[0].cash).toBe(1500 - 50);
    expect(out.players[0].inJail).toBe(false);
    expect(out.phase).toBe('roll');
  });

  test('ROLL_JAIL frees on doubles', () => {
    const g = mk(seedWithDoubles());
    g.players[0].inJail = true;
    g.phase = 'jail';
    const out = applyAction(g, { type: 'ROLL_JAIL' });
    expect(out.players[0].inJail).toBe(false);
    expect(out.players[0].position).not.toBe(10);
  });

  test('ROLL_JAIL forces the $50 payment after the third failed roll', () => {
    // seed 1's first roll is not doubles
    const g = mk(1);
    g.players[0].inJail = true;
    g.players[0].jailRolls = 2;
    g.phase = 'jail';
    const out = applyAction(g, { type: 'ROLL_JAIL' });
    expect(out.players[0].inJail).toBe(false);
    expect(out.players[0].cash).toBe(1500 - 50);
  });
});
