import { expect, test } from 'vitest';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError } from '../../src/games/ticket-to-ride/engine/actions';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import type { CardCombo, GameState, Hand, PlayerState, TrainCard } from '../../src/games/ticket-to-ride/engine/types';

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
    modeId: 'default',
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

// ---- Rulebook edge cases (the draw pile's top is its last element) ----

function withHand(hand: Partial<Hand>, drawPile: TrainCard[], discardPile: TrainCard[] = []): GameState {
  const s = europeTurn(0, drawPile);
  s.players[0].hand = { ...emptyHand(), ...hand };
  s.discardPile = discardPile;
  return s;
}

const claimWith = (s: GameState, combo: CardCombo) =>
  applyAction(s, { type: 'CLAIM_ROUTE', routeId: 'paris-zurich', combo });

const RED3: CardCombo = { color: 'red', colorCount: 3, locomotives: 0 };
const LOCO3: CardCombo = { colorCount: 0, locomotives: 3 };

test('a revealed locomotive counts against a coloured claim; other colours do not', () => {
  const s = claimWith(withHand({ red: 5 }, ['blue', 'green', 'locomotive']), RED3); // reveals loco, green, blue
  expect(s.pendingTunnel?.extra).toBe(1);
});

test('claiming with locomotives only: just revealed locomotives count, not colours', () => {
  const s = claimWith(withHand({ locomotive: 5, red: 5 }, ['red', 'red', 'locomotive']), LOCO3); // loco, red, red
  expect(s.pendingTunnel?.extra).toBe(1);
});

test('an all-locomotive claim must pay its extra in locomotives; colour cards do not help', () => {
  const short = claimWith(withHand({ locomotive: 3, red: 5 }, ['red', 'red', 'locomotive']), LOCO3);
  expect(() => applyAction(short, { type: 'RESOLVE_TUNNEL', commit: true })).toThrow(IllegalActionError);

  const enough = claimWith(withHand({ locomotive: 4, red: 5 }, ['red', 'red', 'locomotive']), LOCO3);
  const done = applyAction(enough, { type: 'RESOLVE_TUNNEL', commit: true });
  expect(done.players[0].hand.locomotive).toBe(0);
  expect(done.players[0].hand.red).toBe(5);
});

test('a mixed claim pays its extra in the colour first, then locomotives', () => {
  const combo: CardCombo = { color: 'red', colorCount: 2, locomotives: 1 };
  const spareRed = claimWith(withHand({ red: 3, locomotive: 2 }, ['blue', 'green', 'red']), combo);
  const a = applyAction(spareRed, { type: 'RESOLVE_TUNNEL', commit: true });
  expect([a.players[0].hand.red, a.players[0].hand.locomotive]).toEqual([0, 1]);

  const noSpareRed = claimWith(withHand({ red: 2, locomotive: 2 }, ['blue', 'green', 'red']), combo);
  const b = applyAction(noSpareRed, { type: 'RESOLVE_TUNNEL', commit: true });
  expect([b.players[0].hand.red, b.players[0].hand.locomotive]).toEqual([0, 0]);
});

test('with fewer than three cards left, only those are revealed', () => {
  const s = claimWith(withHand({ red: 5 }, ['red']), RED3);
  expect(s.pendingTunnel?.flipped).toEqual(['red']);
  expect(s.pendingTunnel?.extra).toBe(1);
});

test('with no cards left anywhere, the tunnel is claimed without risk', () => {
  const s = claimWith(withHand({ red: 3 }, []), RED3);
  expect(s.claimedBy['paris-zurich']).toBe('p0');
});

test('an empty draw pile is reshuffled from the discards for the reveal', () => {
  const s = claimWith(withHand({ red: 5 }, [], ['red', 'red', 'red']), RED3);
  expect(s.pendingTunnel?.flipped).toHaveLength(3);
  expect(s.pendingTunnel?.extra).toBe(3);
});

test('the revealed cards are discarded whether the player pays or backs out', () => {
  const pending = claimWith(withHand({ red: 5 }, ['black', 'green', 'red', 'red']), RED3); // red, red, green
  const paid = applyAction(pending, { type: 'RESOLVE_TUNNEL', commit: true });
  expect([...paid.discardPile].sort()).toEqual(['green', 'red', 'red', 'red', 'red', 'red', 'red', 'red'].sort());
  const backed = applyAction(pending, { type: 'RESOLVE_TUNNEL', commit: false });
  expect([...backed.discardPile].sort()).toEqual(['green', 'red', 'red']);
  expect(backed.drawPile).toEqual(['black']);
});
