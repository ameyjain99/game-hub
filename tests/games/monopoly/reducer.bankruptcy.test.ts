import { describe, expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import {
  applyAction,
  advanceToSpace,
  finishIfAbandoned,
  removePlayer,
} from '../../../src/games/monopoly/engine/reducer';

function mk(n: number, allAI = false): MonopolyState {
  return createMonopolyGame(
    Array.from({ length: n }, (_, i) => ({ avatar: `a${i}`, isAI: allAI || i > 0 })),
    1,
    { randomizeOrder: false },
  );
}

describe('bankruptcy', () => {
  test('an unpayable rent bankrupts the payer and hands assets to the creditor', () => {
    const g = mk(2);
    // p1 owns the full lightblue set with a hotel on Lisbon -> rent 550.
    for (const id of [6, 8, 9]) g.ownership[id].owner = 'p1';
    g.ownership[6].houses = 5;
    g.players[0].cash = 100;
    g.ownership[1].owner = 'p0'; // p0's only asset
    const out = advanceToSpace(g, currentSeat(g), 6, false);
    expect(out.players[0].bankrupt).toBe(true);
    expect(out.ownership[1].owner).toBe('p1'); // asset transferred to creditor
    expect(out.players[1].cash).toBe(1500 + 100); // plus the debtor's remaining cash
    expect(out.winner).toBe('p1'); // last solvent player
    expect(out.phase).toBe('over');
  });

  test('with players still solvent the game continues', () => {
    const g = mk(3);
    for (const id of [6, 8, 9]) g.ownership[id].owner = 'p2';
    g.ownership[6].houses = 5;
    g.players[0].cash = 10;
    const out = advanceToSpace(g, currentSeat(g), 6, false);
    expect(out.players[0].bankrupt).toBe(true);
    expect(out.winner).toBeNull();
    expect(out.phase).not.toBe('over');
  });

  test('a player can mortgage out of a shortfall instead of going bankrupt', () => {
    const g = mk(2);
    g.ownership[9].owner = 'p1'; // single lightblue, base rent 8... too small
    // Give p1 a pricier rent: own Edinburgh (14) base 12 -> still small. Use a house.
    g.ownership[9].houses = 0;
    g.players[0].cash = 5;
    g.ownership[1].owner = 'p0'; // brown, mortgage value 30
    const out = advanceToSpace(g, currentSeat(g), 9, false); // rent 8 > cash 5, raisable 35
    expect(out.players[0].bankrupt).toBe(false);
    expect(out.players[0].cash).toBeLessThan(0);
    expect(out.pendingDebt).not.toBeNull();
    const recovered = applyAction(out, { type: 'MORTGAGE', spaceId: 1 });
    expect(recovered.players[0].cash).toBeGreaterThanOrEqual(0);
    expect(recovered.pendingDebt).toBeNull();
  });
});

describe('turn advancement', () => {
  test('END_TURN skips a bankrupt player', () => {
    const g = mk(3);
    g.players[1].bankrupt = true;
    g.phase = 'action';
    g.dice = [1, 2]; // not doubles -> advance
    const out = applyAction(g, { type: 'END_TURN' });
    expect(currentSeat(out)).toBe(2);
  });

  test('rolling doubles grants another roll instead of advancing', () => {
    const g = mk(2);
    g.phase = 'action';
    g.dice = [3, 3];
    g.doubles = 1;
    const out = applyAction(g, { type: 'END_TURN' });
    expect(currentSeat(out)).toBe(0);
    expect(out.phase).toBe('roll');
  });
});

describe('abandonment helpers', () => {
  test('finishIfAbandoned ends a game with no human players left', () => {
    const allBots = finishIfAbandoned(mk(2, true));
    expect(allBots.phase).toBe('over');
    const withHuman = finishIfAbandoned(mk(2));
    expect(withHuman.phase).not.toBe('over');
  });

  test('removePlayer bankrupts a seat and frees its properties', () => {
    const g = mk(3);
    g.ownership[1].owner = 'p1';
    g.ownership[1].houses = 2;
    const out = removePlayer(g, 1);
    expect(out.players[1].bankrupt).toBe(true);
    expect(out.ownership[1].owner).toBeNull();
    expect(out.ownership[1].houses).toBe(0);
  });
});
