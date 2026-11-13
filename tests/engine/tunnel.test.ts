import { expect, test } from 'vitest';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError } from '../../src/games/ticket-to-ride/engine/actions';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import type { GameState, PlayerState, TrainCard } from '../../src/games/ticket-to-ride/engine/types';

// 'paris-zurich' is a grey, length-3 tunnel on the Europe map.
function europeTurn(red: number, drawPile: TrainCard[]): GameState {
  const mk = (id: string, r = 0): PlayerState => ({
    id,
    name: id,
    isAI: false,
    hand: { ...emptyHand(), red: r },
    avatar: '',
    trainsLeft: 45,
    claimedRouteIds: [],
    tickets: [],
    pendingTickets: [],
    stationsLeft: 0,
    stations: [],
    score: 0,
  });
  return {
    mapId: 'europe',
    players: [mk('p0', red), mk('p1')],
    current: 0,
    phase: 'turn',
    drawnThisTurn: 0,
    drawPile,
    discardPile: [],
    market: [],
    ticketPile: [],
    claimedBy: {},
    finalTurnsLeft: null,
    pendingTunnel: null,
    rngState: 1,
    log: [],
  };
}

const claim = (s: GameState) =>
  applyAction(s, {
    type: 'CLAIM_ROUTE',
    routeId: 'paris-zurich',
    combo: { color: 'red', colorCount: 3, locomotives: 0 },
  });

test('tunnel with no matching flips completes immediately', () => {
  const next = claim(europeTurn(5, ['green', 'blue', 'white'])); // flips: white,blue,green
  expect(next.phase).not.toBe('tunnel-decision');
  expect(next.claimedBy['paris-zurich']).toBe('p0');
  expect(next.players[0].hand.red).toBe(2); // paid the 3 base
  expect(next.current).toBe(1);
});

test('tunnel with matching flips asks for a decision; committing pays the extra', () => {
  const pending = claim(europeTurn(5, ['black', 'green', 'red', 'red'])); // flips: red,red,green
  expect(pending.phase).toBe('tunnel-decision');
  expect(pending.pendingTunnel?.extra).toBe(2);
  expect(pending.claimedBy['paris-zurich']).toBeUndefined(); // not claimed yet
  expect(pending.players[0].hand.red).toBe(5); // nothing spent yet

  const done = applyAction(pending, { type: 'RESOLVE_TUNNEL', commit: true });
  expect(done.claimedBy['paris-zurich']).toBe('p0');
  expect(done.players[0].hand.red).toBe(0); // 3 base + 2 extra
  expect(done.current).toBe(1);
});

test('cancelling a tunnel keeps the cards and spends the turn', () => {
  const pending = claim(europeTurn(5, ['black', 'green', 'red', 'red']));
  const cancelled = applyAction(pending, { type: 'RESOLVE_TUNNEL', commit: false });
  expect(cancelled.claimedBy['paris-zurich']).toBeUndefined();
  expect(cancelled.players[0].hand.red).toBe(5);
  expect(cancelled.current).toBe(1);
});

test('unaffordable extra: commit is illegal, cancel still works', () => {
  const pending = claim(europeTurn(3, ['black', 'green', 'red', 'red'])); // only 3 red, extra 2
  expect(pending.phase).toBe('tunnel-decision');
  expect(() => applyAction(pending, { type: 'RESOLVE_TUNNEL', commit: true })).toThrow(
    IllegalActionError,
  );
  const cancelled = applyAction(pending, { type: 'RESOLVE_TUNNEL', commit: false });
  expect(cancelled.players[0].hand.red).toBe(3);
});
