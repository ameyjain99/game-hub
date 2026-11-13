import { describe, expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction, advanceToSpace, removePlayer } from '../../../src/games/monopoly/engine/reducer';
import { CHANCE } from '../../../src/games/monopoly/engine/cards';

function mk(n = 2): MonopolyState {
  return createMonopolyGame(
    Array.from({ length: n }, (_, i) => ({ avatar: `a${i}`, isAI: i > 0 })),
    1,
    { randomizeOrder: false },
  );
}

describe('management is limited to the current player own turn', () => {
  test('nobody can build while a trade offer is pending', () => {
    const g = mk();
    for (const id of [6, 8, 9]) g.ownership[id].owner = 'p0';
    g.phase = 'trade';
    g.pendingTrade = {
      from: 'p0',
      to: 'p1',
      give: { cash: 0, properties: [], getOutCards: 0 },
      receive: { cash: 10, properties: [], getOutCards: 0 },
    };
    expect(() => applyAction(g, { type: 'BUILD', spaceId: 6 })).toThrow();
  });

  test('nobody can mortgage while an auction is running', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    g.phase = 'auction';
    g.pendingAuction = { spaceId: 3, participants: [0, 1], passed: [], highBid: 0, highBidder: null, turn: 1 };
    expect(() => applyAction(g, { type: 'MORTGAGE', spaceId: 1 })).toThrow();
  });

  test('jail options are only available at the start of a jailed turn', () => {
    const g = mk();
    g.players[0].inJail = true;
    g.phase = 'action'; // e.g. after a failed roll for doubles
    expect(() => applyAction(g, { type: 'PAY_JAIL' })).toThrow();
    expect(() => applyAction(g, { type: 'ROLL_JAIL' })).toThrow();
  });
});

describe('bankruptcy hands the turn on', () => {
  test('a player bankrupted on their own turn is skipped, even after rolling doubles', () => {
    const g = mk(3);
    for (const id of [6, 8, 9]) g.ownership[id].owner = 'p1';
    g.ownership[6].houses = 5; // rent 550
    g.players[0].cash = 10;
    g.dice = [3, 3];
    g.doubles = 1;
    const out = advanceToSpace(g, currentSeat(g), 6, false);
    expect(out.players[0].bankrupt).toBe(true);
    expect(currentSeat(out)).toBe(1);
    expect(out.phase).toBe('roll');
  });

  test('a "pay each player" card stops paying once the payer is bankrupt', () => {
    const g = mk(4);
    g.players[0].cash = 60; // can pay one $50, not three
    const idx = CHANCE.findIndex((c) => c.id === 'ch-chairman');
    g.chanceOrder = [idx, ...Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== idx)];
    const out = advanceToSpace(g, currentSeat(g), 7, false);
    expect(out.players[0].bankrupt).toBe(true);
    expect(out.players[3].cash).toBe(1500); // never paid by a bankrupt player
  });
});

describe('removing a player mid sub-phase', () => {
  test('a removed bidder is dropped from the auction and play continues', () => {
    const g = mk(3);
    g.phase = 'auction';
    g.pendingAuction = { spaceId: 1, participants: [0, 1, 2], passed: [], highBid: 0, highBidder: null, turn: 1 };
    const out = removePlayer(g, 1);
    expect(out.pendingAuction!.passed).toContain(1);
    expect(out.pendingAuction!.turn).toBe(2);
  });

  test('a trade involving a removed player is cancelled', () => {
    const g = mk(3);
    g.phase = 'trade';
    g.pendingTrade = {
      from: 'p0',
      to: 'p1',
      give: { cash: 0, properties: [], getOutCards: 0 },
      receive: { cash: 10, properties: [], getOutCards: 0 },
    };
    const out = removePlayer(g, 1);
    expect(out.pendingTrade).toBeNull();
    expect(out.phase).toBe('action');
  });
});
