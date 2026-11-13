import { describe, expect, test } from 'vitest';
import { createMonopolyGame, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import {
  rentFor,
  ownsFullSet,
  canBuild,
  canMortgage,
  canRaise,
  legalBid,
} from '../../../src/games/monopoly/engine/selectors';

function game(overrides?: Parameters<typeof createMonopolyGame>[2]): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    1,
    { randomizeOrder: false, ...overrides },
  );
}

/** p1 owns the given spaces. */
function own(g: MonopolyState, ids: number[], owner = 'p1') {
  for (const id of ids) g.ownership[id].owner = owner;
}

describe('rentFor', () => {
  test('base property rent, with the full-set ×2 bonus honouring the toggle', () => {
    const g = game();
    own(g, [6]); // single lightblue
    expect(rentFor(g, 6, 7)).toBe(6);

    const full = game();
    own(full, [6, 8, 9]); // full lightblue set, unbuilt
    expect(rentFor(full, 6, 7)).toBe(12); // doubled

    const noDouble = game({ doubleRentFullSet: false });
    own(noDouble, [6, 8, 9]);
    expect(rentFor(noDouble, 6, 7)).toBe(6);
  });

  test('house and hotel tiers come from the rent table', () => {
    const g = game();
    own(g, [6, 8, 9]);
    g.ownership[6].houses = 3;
    expect(rentFor(g, 6, 7)).toBe(270);
    g.ownership[6].houses = 5; // hotel
    expect(rentFor(g, 6, 7)).toBe(550);
  });

  test('railroad rent scales with the number owned', () => {
    const g = game();
    own(g, [5]);
    expect(rentFor(g, 5, 7)).toBe(25);
    own(g, [15]);
    expect(rentFor(g, 5, 7)).toBe(50);
  });

  test('utility rent is dice × 4 for one, × 10 for both', () => {
    const g = game();
    own(g, [12]);
    expect(rentFor(g, 12, 7)).toBe(28);
    own(g, [28]);
    expect(rentFor(g, 12, 7)).toBe(70);
  });

  test('mortgaged property earns no rent', () => {
    const g = game();
    own(g, [6]);
    g.ownership[6].mortgaged = true;
    expect(rentFor(g, 6, 7)).toBe(0);
  });

  test('no rent while the owner is jailed when that house rule is on', () => {
    const g = game({ noRentInJail: true });
    own(g, [6]);
    g.players[1].inJail = true;
    expect(rentFor(g, 6, 7)).toBe(0);
  });
});

describe('building legality', () => {
  test('ownsFullSet requires every lot in the group', () => {
    const g = game();
    own(g, [11, 13], 'p0');
    expect(ownsFullSet(g, 'p0', 'pink')).toBe(false);
    own(g, [14], 'p0');
    expect(ownsFullSet(g, 'p0', 'pink')).toBe(true);
  });

  test('canBuild needs the full set, even build, and bank stock', () => {
    const g = game();
    own(g, [11, 13, 14], 'p0'); // full pink
    expect(canBuild(g, 'p0', 11)).toBe(true);
    g.ownership[11].houses = 1; // now uneven vs 13/14
    expect(canBuild(g, 'p0', 11)).toBe(false);
    expect(canBuild(g, 'p0', 13)).toBe(true);

    const noStock = game();
    own(noStock, [11, 13, 14], 'p0');
    noStock.housesLeft = 0;
    expect(canBuild(noStock, 'p0', 11)).toBe(false);
  });

  test('canMortgage forbids mortgaging a group that still has buildings', () => {
    const g = game();
    own(g, [11, 13, 14], 'p0');
    expect(canMortgage(g, 11)).toBe(true);
    g.ownership[13].houses = 1;
    expect(canMortgage(g, 11)).toBe(false);
  });
});

describe('cash raising', () => {
  test('canRaise counts cash plus mortgage and building sell value', () => {
    const g = game();
    g.players[0].cash = 100;
    own(g, [1], 'p0'); // brown, price 60 -> mortgage value 30
    expect(canRaise(g, 'p0')).toBe(130);
  });

  test('legalBid floors at highBid+1 and caps at the bidder cash', () => {
    const g = game();
    g.players[0].cash = 50;
    expect(legalBid(g, 'p0', 10)).toEqual({ min: 11, max: 50 });
  });
});
