import { describe, expect, test } from 'vitest';
import { createMonopolyGame, type MonopolyState, type PendingTrade } from '../../../src/games/monopoly/engine/state';
import { chooseMonopolyAction, timeoutAction } from '../../../src/games/monopoly/engine/bot';

/** p0 is human, p1 a normal bot. */
function mk(): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true, difficulty: 'normal' },
    ],
    1,
    { randomizeOrder: false },
  );
}

const none = { cash: 0, properties: [] as number[], getOutCards: 0 };

describe('bot auction bidding', () => {
  test('raises in meaningful steps rather than $1 at a time', () => {
    const g = mk();
    g.phase = 'auction';
    g.pendingAuction = { spaceId: 39, participants: [0, 1], passed: [], highBid: 100, highBidder: 0, turn: 1 };
    const act = chooseMonopolyAction(g);
    expect(act.type).toBe('BID');
    if (act.type === 'BID') expect(act.amount).toBeGreaterThanOrEqual(110);
  });
});

describe('bot trade evaluation', () => {
  /** p0 offers cash for p1's Tokyo, which would complete p0's dark-blue set. */
  function offerForTokyo(cash: number): MonopolyState {
    const g = mk();
    g.ownership[37].owner = 'p0';
    g.ownership[39].owner = 'p1';
    g.phase = 'trade';
    const trade: PendingTrade = { from: 'p0', to: 'p1', give: { ...none, cash }, receive: { ...none, properties: [39] } };
    g.pendingTrade = trade;
    return g;
  }

  test('refuses to hand over a set-completing lot for its list price', () => {
    expect(chooseMonopolyAction(offerForTokyo(400))).toEqual({ type: 'RESPOND_TRADE', accept: false });
  });

  test('accepts when paid a real premium for it', () => {
    expect(chooseMonopolyAction(offerForTokyo(1300))).toEqual({ type: 'RESPOND_TRADE', accept: true });
  });

  test('accepts a lot that completes its own set', () => {
    const g = mk();
    g.ownership[1].owner = 'p1'; // bot holds one brown
    g.ownership[3].owner = 'p0';
    g.phase = 'trade';
    g.pendingTrade = { from: 'p0', to: 'p1', give: { ...none, properties: [3] }, receive: { ...none, cash: 80 } };
    expect(chooseMonopolyAction(g)).toEqual({ type: 'RESPOND_TRADE', accept: true });
  });
});

describe('bot liquidity', () => {
  test('pays off a mortgage when it has cash to spare', () => {
    const g = mk();
    g.current = 1; // the bot's turn
    g.phase = 'action';
    g.ownership[1].owner = 'p1';
    g.ownership[1].mortgaged = true;
    expect(chooseMonopolyAction(g)).toEqual({ type: 'UNMORTGAGE', spaceId: 1 });
  });
});

describe('timeoutAction – what an idle human defaults to', () => {
  test('rolls, then declines a purchase, then ends the turn', () => {
    const g = mk();
    expect(timeoutAction(g)).toEqual({ type: 'ROLL' });
    g.phase = 'action';
    g.pendingPurchase = 1;
    expect(timeoutAction(g)).toEqual({ type: 'DECLINE' });
    g.pendingPurchase = null;
    expect(timeoutAction(g)).toEqual({ type: 'END_TURN' });
  });

  test('passes an auction, declines a trade, and tries to roll out of jail', () => {
    const g = mk();
    g.pendingAuction = { spaceId: 1, participants: [0, 1], passed: [], highBid: 0, highBidder: null, turn: 0 };
    expect(timeoutAction(g)).toEqual({ type: 'PASS_BID' });
    g.pendingAuction = null;
    g.pendingTrade = { from: 'p1', to: 'p0', give: none, receive: none };
    expect(timeoutAction(g)).toEqual({ type: 'RESPOND_TRADE', accept: false });
    g.pendingTrade = null;
    g.phase = 'jail';
    g.players[0].inJail = true;
    expect(timeoutAction(g)).toEqual({ type: 'ROLL_JAIL' });
  });
});

describe('bot trade proposals', () => {
  /** The bot (p1) holds Kyoto; p0 holds Tokyo, the lot completing dark blue. */
  function botShortOfSet(): MonopolyState {
    const g = mk();
    g.current = 1;
    g.phase = 'action';
    g.ownership[37].owner = 'p1';
    g.ownership[39].owner = 'p0';
    return g;
  }

  test('offers a premium for the lot that completes its set', () => {
    const act = chooseMonopolyAction(botShortOfSet());
    expect(act.type).toBe('PROPOSE_TRADE');
    if (act.type === 'PROPOSE_TRADE') {
      expect(act.trade.receive.properties).toEqual([39]);
      expect(act.trade.give.cash).toBeGreaterThan(400);
    }
  });

  test('makes at most one offer per turn', () => {
    const g = botShortOfSet();
    g.tradesThisTurn = 1;
    expect(chooseMonopolyAction(g).type).not.toBe('PROPOSE_TRADE');
  });
});
