import { describe, expect, test } from 'vitest';
import { createMonopolyGame, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';

function auctionFor(space: number, cash?: number[]): MonopolyState {
  const g = createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    1,
    { randomizeOrder: false },
  );
  if (cash) g.players.forEach((p, i) => (p.cash = cash[i]));
  g.pendingPurchase = space;
  g.phase = 'action';
  return applyAction(g, { type: 'DECLINE' }); // opens the auction
}

describe('auctions', () => {
  test('the high bidder wins the lot and pays their bid', () => {
    let g = auctionFor(1); // Jakarta
    g = applyAction(g, { type: 'BID', amount: 10 }); // seat 0
    g = applyAction(g, { type: 'BID', amount: 20 }); // seat 1
    g = applyAction(g, { type: 'PASS_BID' }); // seat 0 drops
    expect(g.ownership[1].owner).toBe('p1');
    expect(g.players[1].cash).toBe(1500 - 20);
    expect(g.pendingAuction).toBeNull();
    expect(g.phase).toBe('action');
  });

  test('everyone passing leaves the lot unsold', () => {
    let g = auctionFor(1);
    g = applyAction(g, { type: 'PASS_BID' });
    g = applyAction(g, { type: 'PASS_BID' });
    expect(g.ownership[1].owner).toBeNull();
    expect(g.pendingAuction).toBeNull();
  });

  test('a single remaining bidder wins at their standing bid', () => {
    let g = auctionFor(1);
    g = applyAction(g, { type: 'BID', amount: 50 }); // seat 0
    g = applyAction(g, { type: 'PASS_BID' }); // seat 1 drops
    expect(g.ownership[1].owner).toBe('p0');
    expect(g.players[0].cash).toBe(1500 - 50);
  });

  test('a bid above the bidder cash is rejected', () => {
    const g = auctionFor(1, [5, 1500]);
    expect(() => applyAction(g, { type: 'BID', amount: 10 })).toThrow();
  });

  test('a bid at or below the standing bid is rejected', () => {
    let g = auctionFor(1);
    g = applyAction(g, { type: 'BID', amount: 10 });
    expect(() => applyAction(g, { type: 'BID', amount: 10 })).toThrow();
  });
});
