import { describe, expect, test } from 'vitest';
import { createMonopolyGame, type MonopolyState, type MonopolyDifficulty } from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';
import { chooseMonopolyAction, monopolyActor, advanceMonopolyAi } from '../../../src/games/monopoly/engine/bot';

function bots(n: number, difficulty: MonopolyDifficulty): MonopolyState {
  return createMonopolyGame(
    Array.from({ length: n }, (_, i) => ({ avatar: `a${i}`, isAI: true, difficulty })),
    7,
    { randomizeOrder: false },
  );
}

describe('advanceMonopolyAi', () => {
  test('a full bot-vs-bot game runs to completion with a winner', () => {
    const end = advanceMonopolyAi(bots(3, 'normal'));
    expect(end.phase).toBe('over');
    expect(end.winner).not.toBeNull();
  });

  test('monopolyActor points at the sub-phase actor', () => {
    const g = bots(2, 'normal');
    g.pendingPurchase = 1;
    g.phase = 'action';
    const auction = applyAction(g, { type: 'DECLINE' });
    expect(monopolyActor(auction)).toBe(g.players[auction.pendingAuction!.turn].id);
  });
});

describe('difficulty behaviour', () => {
  test('a normal bot builds only when it owns the full set', () => {
    const full = bots(2, 'normal');
    for (const id of [6, 8, 9]) full.ownership[id].owner = 'p0';
    full.phase = 'action';
    full.pendingPurchase = null;
    expect(chooseMonopolyAction(full).type).toBe('BUILD');

    const partial = bots(2, 'normal');
    for (const id of [6, 8]) partial.ownership[id].owner = 'p0';
    partial.phase = 'action';
    partial.pendingPurchase = null;
    expect(chooseMonopolyAction(partial).type).not.toBe('BUILD');
  });

  test('an easy bot never proposes a trade', () => {
    const g = bots(2, 'easy');
    for (const id of [6, 8, 9]) g.ownership[id].owner = 'p0';
    g.phase = 'action';
    g.pendingPurchase = null;
    expect(chooseMonopolyAction(g).type).not.toBe('PROPOSE_TRADE');
  });

  test('a bot in an auction either bids within budget or passes', () => {
    const g = bots(2, 'normal');
    g.pendingPurchase = 1;
    g.phase = 'action';
    const auction = applyAction(g, { type: 'DECLINE' });
    const act = chooseMonopolyAction(auction);
    expect(['BID', 'PASS_BID']).toContain(act.type);
    if (act.type === 'BID') {
      expect(act.amount).toBeGreaterThan(auction.pendingAuction!.highBid);
      expect(act.amount).toBeLessThanOrEqual(g.players[auction.pendingAuction!.turn].cash);
    }
  });
});
