import { describe, expect, test } from 'vitest';
import { createMonopolyGame } from '../../../src/games/monopoly/engine/state';
import { redactFor } from '../../../src/games/monopoly/engine/redact';

describe('redactFor', () => {
  test('hides deck order and the RNG but keeps all public game state', () => {
    const g = createMonopolyGame(
      [
        { avatar: 'a', isAI: false },
        { avatar: 'b', isAI: true },
      ],
      1,
      { randomizeOrder: false },
    );
    g.players[1].getOutCards = 1;
    g.ownership[1].owner = 'p0';
    g.ownership[1].houses = 2;

    const view = redactFor(g, 'p0');
    // Hidden: deck order + pointers + rng.
    expect(view.chanceOrder).toEqual([]);
    expect(view.chestOrder).toEqual([]);
    expect(view.rngState).toBe(0);
    // Visible: money, positions, ownership, buildings, held jail cards.
    expect(view.players[0].cash).toBe(g.players[0].cash);
    expect(view.players[1].getOutCards).toBe(1);
    expect(view.ownership[1]).toEqual({ owner: 'p0', houses: 2, mortgaged: false });
  });
});
