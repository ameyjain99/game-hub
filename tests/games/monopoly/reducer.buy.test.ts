import { describe, expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction, advanceToSpace } from '../../../src/games/monopoly/engine/reducer';

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

describe('buying and declining', () => {
  test('BUY transfers cash and ownership', () => {
    const g = mk();
    g.pendingPurchase = 1; // Jakarta, $60
    g.phase = 'action';
    const out = applyAction(g, { type: 'BUY' });
    expect(out.ownership[1].owner).toBe('p0');
    expect(out.players[0].cash).toBe(1500 - 60);
    expect(out.pendingPurchase).toBeNull();
  });

  test('DECLINE opens an auction for all non-bankrupt players when auctions are on', () => {
    const g = mk();
    g.pendingPurchase = 1;
    g.phase = 'action';
    const out = applyAction(g, { type: 'DECLINE' });
    expect(out.pendingAuction).not.toBeNull();
    expect(out.pendingAuction!.spaceId).toBe(1);
    expect(out.pendingAuction!.participants).toHaveLength(2);
    expect(out.phase).toBe('auction');
    expect(out.pendingPurchase).toBeNull();
  });

  test('DECLINE just drops the purchase when auctions are off', () => {
    const g = mk({ auctions: false });
    g.pendingPurchase = 1;
    g.phase = 'action';
    const out = applyAction(g, { type: 'DECLINE' });
    expect(out.pendingAuction).toBeNull();
    expect(out.pendingPurchase).toBeNull();
    expect(out.phase).toBe('action');
  });
});

describe('rent and tax on landing', () => {
  test('rent auto-transfers from lander to owner', () => {
    const g = mk();
    g.ownership[6].owner = 'p1'; // Lisbon, base rent 6
    const out = advanceToSpace(g, currentSeat(g), 6, false);
    expect(out.players[0].cash).toBe(1500 - 6);
    expect(out.players[1].cash).toBe(1500 + 6);
  });

  test('tax is deducted, and feeds + is collected from the Free Parking pot when the jackpot is on', () => {
    const plain = mk();
    const t = advanceToSpace(plain, currentSeat(plain), 4, false); // Income Tax $200
    expect(t.players[0].cash).toBe(1500 - 200);

    const jackpot = mk({ freeParkingJackpot: true });
    const paid = advanceToSpace(jackpot, currentSeat(jackpot), 4, false);
    expect(paid.freeParkingPot).toBe(200);

    jackpot.freeParkingPot = 150;
    const collected = advanceToSpace(jackpot, currentSeat(jackpot), 20, false); // Free Parking
    expect(collected.players[0].cash).toBe(1500 + 150);
    expect(collected.freeParkingPot).toBe(0);
  });
});
