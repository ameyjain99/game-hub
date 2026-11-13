import { describe, expect, test } from 'vitest';
import { createMonopolyGame, DEFAULT_SETTINGS } from '../../../src/games/monopoly/engine/state';
import { OWNABLE_IDS } from '../../../src/games/monopoly/engine/board';

const configs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ avatar: `a${i}`, isAI: i > 0 }));

describe('createMonopolyGame', () => {
  test('deals starting cash and places everyone on Go', () => {
    const g = createMonopolyGame(configs(4), 1);
    expect(g.players).toHaveLength(4);
    for (const p of g.players) {
      expect(p.cash).toBe(DEFAULT_SETTINGS.startingCash);
      expect(p.position).toBe(0);
      expect(p.inJail).toBe(false);
      expect(p.bankrupt).toBe(false);
      expect(p.getOutCards).toBe(0);
    }
    expect(g.phase).toBe('roll');
  });

  test('assigns p0..pN ids in seat order', () => {
    const g = createMonopolyGame(configs(3), 1);
    expect(g.players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
  });

  test('starts with a full bank of 32 houses and 12 hotels', () => {
    const g = createMonopolyGame(configs(2), 1);
    expect(g.housesLeft).toBe(32);
    expect(g.hotelsLeft).toBe(12);
  });

  test('every ownable space starts unowned', () => {
    const g = createMonopolyGame(configs(2), 1);
    expect(Object.keys(g.ownership)).toHaveLength(OWNABLE_IDS.length);
    for (const id of OWNABLE_IDS) {
      expect(g.ownership[id]).toEqual({ owner: null, houses: 0, mortgaged: false });
    }
  });

  test('shuffles both decks deterministically from the seed', () => {
    const a = createMonopolyGame(configs(2), 42);
    const b = createMonopolyGame(configs(2), 42);
    const sorted = (xs: number[]) => [...xs].sort((m, n) => m - n);
    expect(sorted(a.chanceOrder)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(sorted(a.chestOrder)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(a.chanceOrder).toEqual(b.chanceOrder);
    expect(a.chestOrder).toEqual(b.chestOrder);
  });

  test('applies setting overrides', () => {
    const g = createMonopolyGame(configs(2), 1, { startingCash: 1000, auctions: false });
    expect(g.players[0].cash).toBe(1000);
    expect(g.settings.auctions).toBe(false);
    expect(g.settings.mortgaging).toBe(true); // untouched defaults remain
  });
});
