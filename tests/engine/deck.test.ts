import { describe, it, expect } from 'vitest';
import { buildDrawPile, drawOne, dealMarket, emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import { makeRng } from '../../src/shared/rng';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';

function baseState(over: Partial<GameState> = {}): GameState {
  return {
    mapId: 'usa',
    pendingTunnel: null,
    players: [],
    current: 0,
    phase: 'turn',
    drawnThisTurn: 0,
    drawPile: [],
    discardPile: [],
    market: [],
    ticketPile: [],
    claimedBy: {},
    finalTurnsLeft: null,
    rngState: 1,
    log: [],
    ...over,
  };
}

describe('buildDrawPile', () => {
  it('produces 110 cards and is seed-deterministic', () => {
    const a = buildDrawPile(makeRng(5));
    const b = buildDrawPile(makeRng(5));
    expect(a.length).toBe(110);
    expect(a).toEqual(b);
    expect(a).not.toEqual(buildDrawPile(makeRng(6)));
  });

  it('contains the right composition', () => {
    const pile = buildDrawPile(makeRng(1));
    const locos = pile.filter((c) => c === 'locomotive').length;
    const reds = pile.filter((c) => c === 'red').length;
    expect(locos).toBe(14);
    expect(reds).toBe(12);
  });
});

describe('drawOne', () => {
  it('reshuffles discard when draw pile is empty', () => {
    const s = baseState({ drawPile: [], discardPile: ['red', 'blue', 'green'] });
    const { card, state } = drawOne(s);
    expect(['red', 'blue', 'green']).toContain(card);
    expect(state.discardPile.length).toBe(0);
    expect(state.drawPile.length).toBe(2);
  });

  it('returns null card when both piles empty', () => {
    const { card } = drawOne(baseState({ drawPile: [], discardPile: [] }));
    expect(card).toBeNull();
  });
});

describe('dealMarket', () => {
  it('fills to 5 cards', () => {
    const s = baseState({
      drawPile: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange'],
    });
    const out = dealMarket(s);
    expect(out.market.length).toBe(5);
  });

  it('redeals when 3+ locomotives appear', () => {
    // drawOne pops from the end, so reverse to control the deal order.
    const order = [
      'locomotive',
      'locomotive',
      'locomotive',
      'red',
      'blue',
      'green',
      'yellow',
      'black',
      'white',
      'orange',
      'purple',
      'red',
    ] as const;
    const s = baseState({ drawPile: [...order].reverse() });
    const out = dealMarket(s);
    const locos = out.market.filter((c) => c === 'locomotive').length;
    expect(out.market.length).toBe(5);
    expect(locos).toBeLessThan(3);
  });
});

describe('emptyHand', () => {
  it('is all zero counts', () => {
    expect(emptyHand().red).toBe(0);
    expect(emptyHand().locomotive).toBe(0);
  });
});
