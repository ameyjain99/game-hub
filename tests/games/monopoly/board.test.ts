import { describe, expect, test } from 'vitest';
import { BOARD, type Space, type ColorGroup } from '../../../src/games/monopoly/engine/board';
import { CHANCE, CHEST } from '../../../src/games/monopoly/engine/cards';

const properties = (): Space[] => BOARD.filter((s) => s.kind === 'property');

describe('board', () => {
  test('has 40 spaces starting with Go', () => {
    expect(BOARD).toHaveLength(40);
    expect(BOARD[0].kind).toBe('go');
    // ids match their index
    BOARD.forEach((s, i) => expect(s.id).toBe(i));
  });

  test('railroads sit at 5/15/25/35 priced 200 with 25/50/100/200 rent', () => {
    for (const i of [5, 15, 25, 35]) {
      expect(BOARD[i].kind).toBe('railroad');
      expect(BOARD[i].price).toBe(200);
      expect(BOARD[i].rent).toEqual([25, 50, 100, 200]);
    }
  });

  test('utilities sit at 12/28 priced 150', () => {
    for (const i of [12, 28]) {
      expect(BOARD[i].kind).toBe('utility');
      expect(BOARD[i].price).toBe(150);
    }
  });

  test('corners are placed correctly', () => {
    expect(BOARD[10].kind).toBe('jail');
    expect(BOARD[20].kind).toBe('free-parking');
    expect(BOARD[30].kind).toBe('go-to-jail');
  });

  test('every property has group, price, houseCost and a 6-tier rent table', () => {
    for (const p of properties()) {
      expect(p.group).toBeDefined();
      expect(p.price).toBeGreaterThan(0);
      expect(p.houseCost).toBeGreaterThan(0);
      expect(p.rent).toHaveLength(6);
    }
  });

  test('there are 22 properties with the standard group sizes', () => {
    expect(properties()).toHaveLength(22);
    const sizes: Record<ColorGroup, number> = {
      brown: 2,
      lightblue: 3,
      pink: 3,
      orange: 3,
      red: 3,
      yellow: 3,
      green: 3,
      darkblue: 2,
    };
    for (const [group, n] of Object.entries(sizes)) {
      expect(properties().filter((p) => p.group === group)).toHaveLength(n);
    }
  });
});

describe('cards', () => {
  test('each deck has 16 cards with exactly one get-out-of-jail-free', () => {
    expect(CHANCE).toHaveLength(16);
    expect(CHEST).toHaveLength(16);
    expect(CHANCE.filter((c) => c.effect.kind === 'get-out-free')).toHaveLength(1);
    expect(CHEST.filter((c) => c.effect.kind === 'get-out-free')).toHaveLength(1);
  });

  test('card ids are unique within a deck', () => {
    expect(new Set(CHANCE.map((c) => c.id)).size).toBe(16);
    expect(new Set(CHEST.map((c) => c.id)).size).toBe(16);
  });
});
