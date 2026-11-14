import { expect, test } from 'vitest';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError } from '../../src/games/ticket-to-ride/engine/actions';
import { finalScores } from '../../src/games/ticket-to-ride/engine/scoring';
import { bonusesFor } from '../../src/games/ticket-to-ride/engine/bonuses';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import type { GameState, Hand, PlayerState } from '../../src/games/ticket-to-ride/engine/types';

function europePlayer(over: Partial<PlayerState>): PlayerState {
  return {
    id: 'p0',
    name: 'P0',
    isAI: false,
    hand: emptyHand(),
    avatar: '',
    trainsLeft: 45,
    claimedRouteIds: [],
    tickets: [],
    pendingTickets: [],
    stationsLeft: 3,
    stations: [],
    score: 0,
    ...over,
  };
}

function europeState(over: Partial<GameState> = {}): GameState {
  return {
    mapId: 'europe',
    modeId: 'default',
    players: [europePlayer({ id: 'p0' }), europePlayer({ id: 'p1', name: 'P1' })],
    current: 0,
    phase: 'turn',
    drawnThisTurn: 0,
    drawPile: [],
    discardPile: [],
    market: [],
    ticketPile: [],
    claimedBy: {},
    finalTurnsLeft: null,
    pendingTunnel: null,
    rngState: 1,
    log: [],
    ...over,
  };
}

const hand = (over: Partial<Hand>): Hand => ({ ...emptyHand(), ...over });

test('placing the first station costs one card and advances the turn', () => {
  const s = europeState({ players: [europePlayer({ hand: hand({ red: 3 }) }), europePlayer({ id: 'p1' })] });
  const next = applyAction(s, {
    type: 'PLACE_STATION',
    city: 'paris',
    combo: { color: 'red', colorCount: 1, locomotives: 0 },
  });
  expect(next.players[0].stations).toEqual(['paris']);
  expect(next.players[0].stationsLeft).toBe(2);
  expect(next.players[0].hand.red).toBe(2);
  expect(next.current).toBe(1);
});

test('the second station costs two matching cards', () => {
  const s = europeState({
    players: [europePlayer({ hand: hand({ red: 3 }), stations: ['paris'], stationsLeft: 2 }), europePlayer({ id: 'p1' })],
  });
  // one card is not enough for the 2nd station
  expect(() =>
    applyAction(s, { type: 'PLACE_STATION', city: 'zurich', combo: { color: 'red', colorCount: 1, locomotives: 0 } }),
  ).toThrow(IllegalActionError);
  const ok = applyAction(s, {
    type: 'PLACE_STATION',
    city: 'zurich',
    combo: { color: 'red', colorCount: 2, locomotives: 0 },
  });
  expect(ok.players[0].stations).toEqual(['paris', 'zurich']);
});

test('cannot place on a city that already has a station', () => {
  const s = europeState({
    players: [europePlayer({ hand: hand({ red: 3 }) }), europePlayer({ id: 'p1', stations: ['paris'] })],
  });
  expect(() =>
    applyAction(s, { type: 'PLACE_STATION', city: 'paris', combo: { color: 'red', colorCount: 1, locomotives: 0 } }),
  ).toThrow(IllegalActionError);
});

test('unused stations score 4 points each', () => {
  const players = [europePlayer({ stationsLeft: 2 }), europePlayer({ id: 'p1', stationsLeft: 0 })];
  const scores = finalScores(players, bonusesFor('europe'));
  expect(scores.p0.stations).toBe(8);
  expect(scores.p1.stations).toBe(0);
});

test("a station borrows a neighbor's route to complete a ticket", () => {
  const p0 = europePlayer({
    stations: ['paris'],
    stationsLeft: 2,
    tickets: [{ id: 'paris__zurich', a: 'paris', b: 'zurich', points: 5 }],
  });
  const p1 = europePlayer({ id: 'p1', stations: [], stationsLeft: 3, claimedRouteIds: ['paris-zurich'] });
  const scores = finalScores([p0, p1], bonusesFor('europe'));
  // paris→zurich is only reachable by borrowing p1's paris-zurich via the station.
  expect(scores.p0.tickets).toBe(5);
  // …and the scoring says which route the station used.
  expect(scores.p0.stationRoutes).toEqual([{ city: 'paris', routeId: 'paris-zurich' }]);
});

test('a station that would not help any ticket borrows nothing', () => {
  const p0 = europePlayer({
    stations: ['paris'],
    stationsLeft: 2,
    tickets: [{ id: 'brest__madrid', a: 'brest', b: 'madrid', points: 8 }],
  });
  const p1 = europePlayer({ id: 'p1', stations: [], stationsLeft: 3, claimedRouteIds: ['paris-zurich'] });
  const scores = finalScores([p0, p1], bonusesFor('europe'));
  expect(scores.p0.stationRoutes).toEqual([{ city: 'paris', routeId: null }]);
});
