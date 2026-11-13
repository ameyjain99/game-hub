import { describe, it, expect } from 'vitest';
import { heuristicAction, rankActions } from '../../src/games/ticket-to-ride/ai/hardHeuristic';
import { legalActions, getRoute } from '../../src/games/ticket-to-ride/engine/selectors';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';
import { makeState, ticket } from './helpers';

describe('heuristicAction', () => {
  it('claims the route that completes a ticket', () => {
    const s = makeState({
      owned: { p0: ['boston-new-york'] },
      tickets: { p0: [ticket('boston', 'washington', 7)] },
      hands: { p0: { orange: 2 } },
    });
    expect(heuristicAction(s, 'p0')).toMatchObject({ type: 'CLAIM_ROUTE', routeId: 'new-york-washington' });
  });

  it('draws a face-up card in a colour the plan needs', () => {
    const base = makeState({ tickets: { p0: [ticket('boston', 'washington', 7)] }, hands: { p0: {} } });
    const s: GameState = { ...base, market: ['white', 'orange', 'white', 'white', 'white'] };
    expect(heuristicAction(s, 'p0')).toEqual({ type: 'DRAW_TRAIN', source: 'market', index: 1 });
  });

  it('keeps an already-connected ticket and refuses an unreachable one', () => {
    const base = makeState({
      owned: { p0: ['boston-new-york', 'new-york-washington'] },
      trainsLeft: { p0: 10 },
    });
    const s: GameState = {
      ...base,
      phase: 'draw-tickets',
      players: base.players.map((p) =>
        p.id === 'p0'
          ? { ...p, pendingTickets: [ticket('boston', 'washington', 7), ticket('seattle', 'miami', 22)] }
          : p,
      ),
    };
    expect(heuristicAction(s, 'p0')).toEqual({ type: 'KEEP_TICKETS', keptIds: ['boston__washington'] });
  });

  it('does not keep all three starting tickets (completion is never certain)', () => {
    const base = makeState();
    const pending = [ticket('boston', 'washington', 7), ticket('new-york', 'washington', 4), ticket('seattle', 'miami', 22)];
    const s: GameState = {
      ...base,
      phase: 'setup-tickets',
      players: base.players.map((p) => (p.id === 'p0' ? { ...p, pendingTickets: pending } : p)),
    };
    const action = heuristicAction(s, 'p0');
    expect(legalActions(s, 'p0')).toContainEqual(action);
    expect(action.type).toBe('CONFIRM_SETUP_TICKETS');
    const kept = action.type === 'CONFIRM_SETUP_TICKETS' ? action.keptIds.length : 0;
    expect(kept).toBeGreaterThanOrEqual(1);
    expect(kept).toBeLessThan(3);
  });

  it('draws instead of spending cards and trains on an off-plan blocking claim', () => {
    // Saint Louis–Chicago (2, green) is under pressure from two opponent routes,
    // but it is not on p0's plan (Boston → Washington), so p0 keeps drawing.
    const base = makeState({
      owned: { p1: ['duluth-chicago', 'kansas-city-saint-louis'] },
      tickets: { p0: [ticket('boston', 'washington', 7)] },
      hands: { p0: { green: 2 } },
    });
    const s: GameState = { ...base, market: ['white', 'white', 'white', 'white', 'black'] };
    expect(heuristicAction(s, 'p0')).toEqual({ type: 'DRAW_TRAIN', source: 'deck' });
  });

  it('does not spend spare trains on a short route mid-game', () => {
    // No tickets left to build and plenty of trains: save up for long routes.
    const base = makeState({ trainsLeft: { p0: 30 }, hands: { p0: { red: 2 } } });
    const s: GameState = { ...base, market: ['white', 'white', 'white', 'white', 'black'] };
    expect(heuristicAction(s, 'p0')).toEqual({ type: 'DRAW_TRAIN', source: 'deck' });
  });

  it('spends its last trains on the highest-scoring affordable route', () => {
    const s = makeState({ trainsLeft: { p0: 3 }, hands: { p0: { red: 3 } } });
    const action = heuristicAction(s, 'p0');
    expect(action.type).toBe('CLAIM_ROUTE');
    if (action.type === 'CLAIM_ROUTE') expect(getRoute(action.routeId)!.length).toBe(3);
  });

  it('ranks every legal action, best first', () => {
    const s = makeState({ tickets: { p0: [ticket('boston', 'washington', 7)] } });
    const ranked = rankActions(s, 'p0');
    expect(ranked).toHaveLength(legalActions(s, 'p0').length);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it('plays full 2p and 4p games legally and quickly', () => {
    let decisions = 0;
    const t0 = performance.now();
    for (const n of [2, 4]) {
      for (const seed of [1, 2, 3]) {
        let s = createGame(Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: true })), seed);
        for (let moves = 0; s.phase !== 'game-over'; moves++) {
          expect(moves).toBeLessThan(3000);
          const id = s.phase === 'setup-tickets' ? s.players.find((p) => p.pendingTickets.length)!.id : s.players[s.current].id;
          const action = heuristicAction(s, id);
          expect(legalActions(s, id)).toContainEqual(action);
          s = applyAction(s, action);
          decisions++;
        }
      }
    }
    // Search uses this as its playout policy, so it must stay cheap.
    expect((performance.now() - t0) / decisions).toBeLessThan(1);
  });
});
