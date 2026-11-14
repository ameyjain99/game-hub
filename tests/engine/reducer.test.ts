import { describe, it, expect } from 'vitest';
import { applyAction, removePlayer, finishIfAbandoned } from '../../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError } from '../../src/games/ticket-to-ride/engine/actions';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import { ticket } from '../ai/helpers';
import type { GameState, Hand, PlayerState } from '../../src/games/ticket-to-ride/engine/types';

function player(over: Partial<PlayerState>): PlayerState {
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
    stationsLeft: 0,
    stations: [],
    score: 0,
    ...over,
  };
}

function hand(over: Partial<Hand>): Hand {
  return { ...emptyHand(), ...over };
}

function turnState(over: Partial<GameState> = {}): GameState {
  return {
    mapId: 'usa',
    modeId: 'default',
    pendingTunnel: null,
    players: [player({ id: 'p0' }), player({ id: 'p1', name: 'P1' })],
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

describe('removePlayer', () => {
  it('returns the player\'s cards and tickets, frees their routes, and hands off their turn', () => {
    const t = ticket('boston', 'miami', 7);
    const s = turnState({
      players: [
        player({ id: 'p0', hand: hand({ red: 3, locomotive: 1 }), claimedRouteIds: ['boston-new-york'], tickets: [t] }),
        player({ id: 'p1', name: 'P1' }),
        player({ id: 'p2', name: 'P2' }),
      ],
      current: 0,
      claimedBy: { 'boston-new-york': 'p0' },
    });

    const r = removePlayer(s, 0);
    const p0 = r.players[0];
    expect(p0.removed).toBe(true);
    expect(p0.claimedRouteIds).toEqual([]);
    expect(r.claimedBy['boston-new-york']).toBeUndefined(); // route reopened
    expect(r.discardPile).toHaveLength(4); // 3 red + 1 loco returned
    expect(r.ticketPile).toContainEqual(t);
    expect(p0.hand.red).toBe(0);
    expect(r.phase).toBe('turn');
    expect(r.current).toBe(1); // play handed to the next active seat
  });

  it('ends the game when only one player is left, excluding the removed one from scores', () => {
    const s = turnState({
      players: [player({ id: 'p0' }), player({ id: 'p1', name: 'P1' })],
      current: 0,
    });
    const r = removePlayer(s, 1);
    expect(r.phase).toBe('game-over');
    expect(r.players[1].removed).toBe(true);
    expect(r.players[1].score).toBe(0); // removed → excluded from scoring
    expect(typeof r.players[0].score).toBe('number');
  });

  it('is skipped in turn order once removed', () => {
    const s = turnState({
      players: [
        player({ id: 'p0', hand: hand({ yellow: 2 }) }),
        player({ id: 'p1', name: 'P1' }),
        player({ id: 'p2', name: 'P2' }),
      ],
      current: 0,
    });
    const afterRemove = removePlayer(s, 1); // remove the middle player (not current)
    expect(afterRemove.current).toBe(0); // current unaffected when it isn't their turn
    // p0 claims a route, ending their turn – play should skip removed p1 to p2.
    const r = applyAction(afterRemove, {
      type: 'CLAIM_ROUTE',
      routeId: 'boston-new-york',
      combo: { color: 'yellow', colorCount: 2, locomotives: 0 },
    });
    expect(r.current).toBe(2);
  });
});

describe('finishIfAbandoned', () => {
  it('ends the game when no human players remain', () => {
    const s = turnState({
      players: [player({ id: 'p0', isAI: true }), player({ id: 'p1', name: 'P1', isAI: true })],
    });
    expect(finishIfAbandoned(s).phase).toBe('game-over');
  });

  it('leaves the game running while a human is still in it', () => {
    const s = turnState({
      players: [player({ id: 'p0', isAI: false }), player({ id: 'p1', name: 'P1', isAI: true })],
    });
    expect(finishIfAbandoned(s).phase).toBe('turn');
  });

  it('treats a removed human as gone (all-bot game ends)', () => {
    const s = turnState({
      players: [player({ id: 'p0', isAI: false, removed: true }), player({ id: 'p1', name: 'P1', isAI: true })],
    });
    expect(finishIfAbandoned(s).phase).toBe('game-over');
  });
});

describe('CLAIM_ROUTE', () => {
  it('rejects an already-claimed route', () => {
    const s = turnState({
      players: [player({ id: 'p0', hand: hand({ yellow: 2 }) }), player({ id: 'p1' })],
      claimedBy: { 'boston-new-york': 'p1' },
    });
    expect(() =>
      applyAction(s, {
        type: 'CLAIM_ROUTE',
        routeId: 'boston-new-york',
        combo: { color: 'yellow', colorCount: 2, locomotives: 0 },
      }),
    ).toThrow(IllegalActionError);
  });

  it('rejects mismatched cards', () => {
    const s = turnState({
      players: [player({ id: 'p0', hand: hand({ red: 2 }) }), player({ id: 'p1' })],
    });
    expect(() =>
      applyAction(s, {
        type: 'CLAIM_ROUTE',
        routeId: 'boston-new-york', // yellow
        combo: { color: 'red', colorCount: 2, locomotives: 0 },
      }),
    ).toThrow(IllegalActionError);
  });

  it('claims a route: discards cards, decrements trains, adds score, advances turn', () => {
    const s = turnState({
      players: [player({ id: 'p0', hand: hand({ yellow: 2 }) }), player({ id: 'p1' })],
    });
    const next = applyAction(s, {
      type: 'CLAIM_ROUTE',
      routeId: 'boston-new-york', // yellow, length 2 -> 2 pts
      combo: { color: 'yellow', colorCount: 2, locomotives: 0 },
    });
    const p0 = next.players[0];
    expect(p0.hand.yellow).toBe(0);
    expect(p0.trainsLeft).toBe(43);
    expect(p0.score).toBe(2);
    expect(next.claimedBy['boston-new-york']).toBe('p0');
    expect(next.discardPile.filter((c) => c === 'yellow').length).toBe(2);
    expect(next.current).toBe(1); // turn advanced
  });
});

describe('DRAW_TRAIN', () => {
  it('two blind draws advance to the next player', () => {
    const s = turnState({ drawPile: ['red', 'blue', 'green'] });
    const a = applyAction(s, { type: 'DRAW_TRAIN', source: 'deck' });
    expect(a.current).toBe(0);
    expect(a.drawnThisTurn).toBe(1);
    const b = applyAction(a, { type: 'DRAW_TRAIN', source: 'deck' });
    expect(b.current).toBe(1);
    expect(b.drawnThisTurn).toBe(0);
    expect(Object.values(b.players[0].hand).reduce((x, y) => x + y, 0)).toBe(2);
  });

  it('taking a face-up locomotive ends the turn immediately', () => {
    const s = turnState({ market: ['locomotive', 'red', 'blue', 'green', 'yellow'], drawPile: ['black'] });
    const a = applyAction(s, { type: 'DRAW_TRAIN', source: 'market', index: 0 });
    expect(a.current).toBe(1);
    expect(a.players[0].hand.locomotive).toBe(1);
    expect(a.market.length).toBe(5); // refilled
  });

  it('rejects taking a face-up locomotive as the second draw', () => {
    const s = turnState({
      market: ['locomotive', 'red', 'blue', 'green', 'yellow'],
      drawPile: ['black', 'white'],
      drawnThisTurn: 1,
    });
    expect(() => applyAction(s, { type: 'DRAW_TRAIN', source: 'market', index: 0 })).toThrow(
      IllegalActionError,
    );
  });
});

describe('tickets', () => {
  it('DRAW_TICKETS then KEEP_TICKETS with >=1 ends the turn', () => {
    const s = turnState({
      ticketPile: [
        { id: 't1', a: 'boston', b: 'miami', points: 12 },
        { id: 't2', a: 'denver', b: 'el-paso', points: 4 },
        { id: 't3', a: 'toronto', b: 'miami', points: 10 },
      ],
    });
    const drawn = applyAction(s, { type: 'DRAW_TICKETS' });
    expect(drawn.phase).toBe('draw-tickets');
    expect(drawn.players[0].pendingTickets.length).toBe(3);

    const kept = applyAction(drawn, { type: 'KEEP_TICKETS', keptIds: ['t1'] });
    expect(kept.phase).toBe('turn');
    expect(kept.players[0].tickets.map((t) => t.id)).toEqual(['t1']);
    expect(kept.ticketPile.length).toBe(2); // t2, t3 returned to bottom
    expect(kept.current).toBe(1);
  });

  it('KEEP_TICKETS with none kept is illegal', () => {
    const s = turnState({
      phase: 'draw-tickets',
      players: [
        player({ id: 'p0', pendingTickets: [{ id: 't1', a: 'boston', b: 'miami', points: 12 }] }),
        player({ id: 'p1' }),
      ],
    });
    expect(() => applyAction(s, { type: 'KEEP_TICKETS', keptIds: [] })).toThrow(IllegalActionError);
  });
});

describe('end trigger', () => {
  it('dropping to <=2 trains starts final turns and ends after one more round', () => {
    // p0 has 2 trains and a length-2 yellow route to claim -> drops to 0, triggers.
    const s = turnState({
      players: [
        player({ id: 'p0', hand: hand({ yellow: 2 }), trainsLeft: 2 }),
        player({ id: 'p1', hand: hand({ red: 2 }), trainsLeft: 45 }),
      ],
      drawPile: ['black', 'white', 'green', 'blue'],
    });
    const afterClaim = applyAction(s, {
      type: 'CLAIM_ROUTE',
      routeId: 'boston-new-york',
      combo: { color: 'yellow', colorCount: 2, locomotives: 0 },
    });
    expect(afterClaim.finalTurnsLeft).toBe(2); // players.length
    expect(afterClaim.current).toBe(1);

    // p1 takes final turn (2 blind draws)
    let g = applyAction(afterClaim, { type: 'DRAW_TRAIN', source: 'deck' });
    g = applyAction(g, { type: 'DRAW_TRAIN', source: 'deck' });
    expect(g.finalTurnsLeft).toBe(1);
    expect(g.current).toBe(0);

    // p0 takes its final turn -> game over
    g = applyAction(g, { type: 'DRAW_TRAIN', source: 'deck' });
    g = applyAction(g, { type: 'DRAW_TRAIN', source: 'deck' });
    expect(g.phase).toBe('game-over');
  });
});

describe('setup tickets', () => {
  it('all players confirming (keep >=2) starts the game', () => {
    const mk = (id: string) =>
      player({
        id,
        pendingTickets: [
          { id: `${id}-a`, a: 'boston', b: 'miami', points: 12 },
          { id: `${id}-b`, a: 'denver', b: 'el-paso', points: 4 },
          { id: `${id}-c`, a: 'toronto', b: 'miami', points: 10 },
        ],
      });
    const s = turnState({ phase: 'setup-tickets', players: [mk('p0'), mk('p1')] });

    const a = applyAction(s, {
      type: 'CONFIRM_SETUP_TICKETS',
      playerId: 'p0',
      keptIds: ['p0-a', 'p0-b'],
    });
    expect(a.phase).toBe('setup-tickets'); // still waiting on p1
    expect(a.players[0].tickets.length).toBe(2);
    // the unkept ticket goes to the bottom of the pile
    expect(a.ticketPile.length).toBe(s.ticketPile.length + 1);
    expect(a.ticketPile[a.ticketPile.length - 1].id).toBe('p0-c');

    const b = applyAction(a, {
      type: 'CONFIRM_SETUP_TICKETS',
      playerId: 'p1',
      keptIds: ['p1-a', 'p1-b', 'p1-c'],
    });
    expect(b.phase).toBe('turn');
    expect(b.current).toBe(0);
  });

  it('keeping fewer than 2 setup tickets is illegal', () => {
    const s = turnState({
      phase: 'setup-tickets',
      players: [
        player({
          id: 'p0',
          pendingTickets: [
            { id: 'p0-a', a: 'boston', b: 'miami', points: 12 },
            { id: 'p0-b', a: 'denver', b: 'el-paso', points: 4 },
            { id: 'p0-c', a: 'toronto', b: 'miami', points: 10 },
          ],
        }),
        player({ id: 'p1' }),
      ],
    });
    expect(() =>
      applyAction(s, { type: 'CONFIRM_SETUP_TICKETS', playerId: 'p0', keptIds: [] }),
    ).toThrow(IllegalActionError);
    expect(() =>
      applyAction(s, { type: 'CONFIRM_SETUP_TICKETS', playerId: 'p0', keptIds: ['p0-a'] }),
    ).toThrow(IllegalActionError);
    const kept = applyAction(s, { type: 'CONFIRM_SETUP_TICKETS', playerId: 'p0', keptIds: ['p0-a', 'p0-c'] });
    expect(kept.players[0].tickets.map((t) => t.id)).toEqual(['p0-a', 'p0-c']);
  });
});

