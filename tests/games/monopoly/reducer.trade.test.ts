import { describe, expect, test } from 'vitest';
import {
  createMonopolyGame,
  type MonopolyState,
  type PendingTrade,
} from '../../../src/games/monopoly/engine/state';
import { applyAction } from '../../../src/games/monopoly/engine/reducer';

function mk(): MonopolyState {
  const g = createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    1,
    { randomizeOrder: false },
  );
  g.phase = 'action';
  return g;
}

const empty = { cash: 0, properties: [], getOutCards: 0 };

describe('trading', () => {
  test('a cash + property swap transfers atomically on accept', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    g.ownership[3].owner = 'p1';
    const trade: PendingTrade = {
      from: 'p0',
      to: 'p1',
      give: { ...empty, properties: [1] },
      receive: { ...empty, cash: 100, properties: [3] },
    };
    const proposed = applyAction(g, { type: 'PROPOSE_TRADE', trade });
    expect(proposed.pendingTrade).not.toBeNull();
    expect(proposed.phase).toBe('trade');

    const done = applyAction(proposed, { type: 'RESPOND_TRADE', accept: true });
    expect(done.ownership[1].owner).toBe('p1');
    expect(done.ownership[3].owner).toBe('p0');
    expect(done.players[0].cash).toBe(1500 + 100);
    expect(done.players[1].cash).toBe(1500 - 100);
    expect(done.pendingTrade).toBeNull();
    expect(done.phase).toBe('action');
  });

  test('declining leaves both sides unchanged', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    const trade: PendingTrade = {
      from: 'p0',
      to: 'p1',
      give: { ...empty, properties: [1] },
      receive: { ...empty, cash: 100 },
    };
    const proposed = applyAction(g, { type: 'PROPOSE_TRADE', trade });
    const done = applyAction(proposed, { type: 'RESPOND_TRADE', accept: false });
    expect(done.ownership[1].owner).toBe('p0');
    expect(done.players[1].cash).toBe(1500);
    expect(done.pendingTrade).toBeNull();
  });

  test('accept is re-validated and rejected if the proposer no longer owns a lot', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    g.ownership[3].owner = 'p1';
    const trade: PendingTrade = {
      from: 'p0',
      to: 'p1',
      give: { ...empty, properties: [1] },
      receive: { ...empty, properties: [3] },
    };
    const proposed = applyAction(g, { type: 'PROPOSE_TRADE', trade });
    proposed.ownership[1].owner = 'p1'; // proposer loses the lot before the response
    const done = applyAction(proposed, { type: 'RESPOND_TRADE', accept: true });
    expect(done.ownership[3].owner).toBe('p1'); // no partial transfer
    expect(done.pendingTrade).toBeNull();
  });

  test('a mortgaged lot in a trade charges the receiver the 10% fee', () => {
    const g = mk();
    g.ownership[1].owner = 'p0';
    g.ownership[1].mortgaged = true; // brown, mortgage value 30 -> fee 3
    const trade: PendingTrade = {
      from: 'p0',
      to: 'p1',
      give: { ...empty, properties: [1] },
      receive: { ...empty },
    };
    const proposed = applyAction(g, { type: 'PROPOSE_TRADE', trade });
    const done = applyAction(proposed, { type: 'RESPOND_TRADE', accept: true });
    expect(done.ownership[1].owner).toBe('p1');
    expect(done.ownership[1].mortgaged).toBe(true);
    expect(done.players[1].cash).toBe(1500 - 3);
  });
});
