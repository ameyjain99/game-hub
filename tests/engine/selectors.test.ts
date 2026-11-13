import { describe, it, expect } from 'vitest';
import { routeIsClaimable, canPayFor, getRoute } from '../../src/games/ticket-to-ride/engine/selectors';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import type { GameState, Hand, PlayerState } from '../../src/games/ticket-to-ride/engine/types';

function state(over: Partial<GameState> & { playerCount?: number } = {}): GameState {
  const playerCount = over.playerCount ?? 2;
  const players: PlayerState[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    isAI: false,
    hand: emptyHand(),
    avatar: '',
    trainsLeft: 45,
    claimedRouteIds: [],
    tickets: [],
    pendingTickets: [],
    stationsLeft: 0,
    stations: [],
    score: 0,
  }));
  const { playerCount: _pc, ...rest } = over;
  return {
    mapId: 'usa',
    modeId: 'default',
    pendingTunnel: null,
    players,
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
    ...rest,
  };
}

function handOf(over: Partial<Hand>): Hand {
  return { ...emptyHand(), ...over };
}

describe('routeIsClaimable', () => {
  it('is false for an already-claimed route', () => {
    const s = state({ claimedBy: { 'boston-new-york': 'p1' } });
    expect(routeIsClaimable(s, 'boston-new-york', 'p0')).toBe(false);
  });

  it('blocks the sibling of a double route in a 2-player game', () => {
    // 'boston-new-york' and 'boston-new-york-2' are a double route.
    const s = state({ playerCount: 2, claimedBy: { 'boston-new-york': 'p1' } });
    expect(routeIsClaimable(s, 'boston-new-york-2', 'p0')).toBe(false);
  });

  it('allows the sibling of a double route in a 4-player game (for a different player)', () => {
    const s = state({ playerCount: 4, claimedBy: { 'boston-new-york': 'p1' } });
    expect(routeIsClaimable(s, 'boston-new-york-2', 'p0')).toBe(true);
  });

  it('never lets one player own both siblings', () => {
    const s = state({ playerCount: 4, claimedBy: { 'boston-new-york': 'p0' } });
    expect(routeIsClaimable(s, 'boston-new-york-2', 'p0')).toBe(false);
  });
});

describe('canPayFor', () => {
  const bostonNy = getRoute('boston-new-york')!; // yellow, length 2
  const okcLittleRock = getRoute('oklahoma-city-little-rock')!; // grey, length 2

  it('pays a colored route with exact-color cards', () => {
    const combos = canPayFor(handOf({ yellow: 2 }), bostonNy);
    expect(combos).toContainEqual({ color: 'yellow', colorCount: 2, locomotives: 0 });
  });

  it('uses locomotives as wild', () => {
    const combos = canPayFor(handOf({ yellow: 1, locomotive: 1 }), bostonNy);
    expect(combos).toContainEqual({ color: 'yellow', colorCount: 1, locomotives: 1 });
    // all-locomotive combo also legal
    const allLoco = canPayFor(handOf({ locomotive: 2 }), bostonNy);
    expect(allLoco).toContainEqual({ colorCount: 0, locomotives: 2 });
  });

  it('pays a grey route with any single color', () => {
    const combos = canPayFor(handOf({ green: 2 }), okcLittleRock);
    expect(combos).toContainEqual({ color: 'green', colorCount: 2, locomotives: 0 });
    // wrong: mixing two different colors is not offered
    const mixed = canPayFor(handOf({ green: 1, blue: 1 }), okcLittleRock);
    expect(mixed.every((c) => c.colorCount <= 1)).toBe(true);
    expect(mixed.some((c) => c.colorCount === 2)).toBe(false);
  });

  it('returns [] when the hand cannot pay', () => {
    expect(canPayFor(handOf({ red: 1 }), bostonNy)).toEqual([]);
  });
});
