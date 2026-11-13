import { describe, expect, test } from 'vitest';
import { createMonopolyGame, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';

function mk(overrides?: Parameters<typeof createMonopolyGame>[2]): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    1,
    { randomizeOrder: false, ...overrides },
  );
}

/** p0 (the current player) owns the full lightblue set, in `action` phase. */
function withLightblue(): MonopolyState {
  const g = mk();
  for (const id of [6, 8, 9]) g.ownership[id].owner = 'p0';
  g.phase = 'action';
  return g;
}

describe('building', () => {
  test('BUILD takes a house from the bank and charges the house cost', () => {
    const g = withLightblue();
    const out = applyAction(g, { type: 'BUILD', spaceId: 6 });
    expect(out.ownership[6].houses).toBe(1);
    expect(out.housesLeft).toBe(31);
    expect(out.players[0].cash).toBe(1500 - 50);
  });

  test('the 4-houses-to-hotel conversion returns 4 houses and takes a hotel', () => {
    const g = withLightblue();
    for (const id of [6, 8, 9]) g.ownership[id].houses = 4;
    g.housesLeft = 10;
    const out = applyAction(g, { type: 'BUILD', spaceId: 6 });
    expect(out.ownership[6].houses).toBe(5);
    expect(out.hotelsLeft).toBe(11);
    expect(out.housesLeft).toBe(14);
  });

  test('BUILD throws when the bank has no houses left', () => {
    const g = withLightblue();
    g.housesLeft = 0;
    expect(() => applyAction(g, { type: 'BUILD', spaceId: 6 })).toThrow();
  });

  test('BUILD throws when it would break even build', () => {
    const g = withLightblue();
    g.ownership[6].houses = 1; // others still 0
    expect(() => applyAction(g, { type: 'BUILD', spaceId: 6 })).toThrow();
  });
});

describe('mortgaging', () => {
  test('MORTGAGE pays out half the price', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    g.phase = 'action';
    const out = applyAction(g, { type: 'MORTGAGE', spaceId: 1 });
    expect(out.ownership[1].mortgaged).toBe(true);
    expect(out.players[0].cash).toBe(1500 + 30);
  });

  test('MORTGAGE throws when the group still has buildings', () => {
    const g = withLightblue();
    g.ownership[8].houses = 1;
    expect(() => applyAction(g, { type: 'MORTGAGE', spaceId: 6 })).toThrow();
  });

  test('UNMORTGAGE costs the mortgage value plus 10%', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    g.ownership[1].mortgaged = true;
    g.players[0].cash = 100;
    g.phase = 'action';
    const out = applyAction(g, { type: 'UNMORTGAGE', spaceId: 1 });
    expect(out.ownership[1].mortgaged).toBe(false);
    expect(out.players[0].cash).toBe(100 - 33);
  });
});
