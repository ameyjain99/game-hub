import { describe, it, expect } from 'vitest';
import { claimableSet, cheapestPath, planTickets } from '../../src/games/ticket-to-ride/ai/planner';
import { routeIsClaimable, legalActions } from '../../src/games/ticket-to-ride/engine/selectors';
import { ROUTES } from '../../src/games/ticket-to-ride/engine/data/usa/routes';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { makeRng } from '../../src/shared/rng';
import type { GameState } from '../../src/games/ticket-to-ride/engine/types';
import { makeState, ticket } from './helpers';

const byLength = (r: { length: number }) => r.length;

describe('cheapestPath', () => {
  it('finds the cheapest route chain on an open board', () => {
    const p = cheapestPath('usa', 'boston', 'washington', byLength)!;
    expect(p.cost).toBe(4); // Boston–New York (2) + New York–Washington (2)
    expect(p.routeIds).toHaveLength(2);
  });

  it('returns null when every way in is impassable', () => {
    expect(cheapestPath('usa', 'boston', 'miami', (r) => (r.a === 'miami' || r.b === 'miami' ? null : r.length))).toBeNull();
  });
});

describe('planTickets', () => {
  it('shares track between overlapping tickets', () => {
    const s = makeState({ tickets: { p0: [ticket('boston', 'washington', 7), ticket('new-york', 'washington', 4)] } });
    const plan = planTickets(s, s.players[0]);
    expect(plan.trainsNeeded).toBe(4); // not 6: New York–Washington is shared
    expect(plan.reachable).toHaveLength(2);
    expect(plan.blocked).toHaveLength(0);
  });

  it('treats owned routes as free and skips completed tickets', () => {
    const s = makeState({
      owned: { p0: ['boston-new-york'] },
      tickets: { p0: [ticket('boston', 'new-york', 3), ticket('boston', 'washington', 7)] },
    });
    const plan = planTickets(s, s.players[0]);
    expect(plan.trainsNeeded).toBe(2);
    expect(plan.reachable.map((t) => t.id)).toEqual(['boston__washington']);
  });

  it('marks a ticket blocked when opponents own every way in', () => {
    const s = makeState({
      owned: { p1: ['new-orleans-miami', 'atlanta-miami', 'charleston-miami'] },
      tickets: { p0: [ticket('boston', 'miami', 12)] },
    });
    const plan = planTickets(s, s.players[0]);
    expect(plan.blocked.map((t) => t.id)).toEqual(['boston__miami']);
    expect(plan.routeIds.size).toBe(0);
  });

  it('lengthBias prefers a long route that scores more per train', () => {
    const s = makeState({ tickets: { p0: [ticket('duluth', 'toronto', 10)] } });
    // Fewest trains: Duluth–Sault St. Marie (3) + Sault St. Marie–Toronto (2) = 5 trains, 6 points.
    const fewest = planTickets(s, s.players[0]);
    expect([...fewest.routeIds].sort()).toEqual(['duluth-sault-ste-marie', 'sault-ste-marie-toronto']);
    expect(fewest.trainsNeeded).toBe(5);
    // With a bias: the direct Duluth–Toronto (6 trains, 15 points).
    const biased = planTickets(s, s.players[0], s.players[0].tickets, 0.4);
    expect([...biased.routeIds]).toEqual(['duluth-toronto']);
    expect(biased.trainsNeeded).toBe(6);
  });

  it('marks a ticket blocked when it needs more trains than the player has', () => {
    const s = makeState({ tickets: { p0: [ticket('boston', 'washington', 7)] }, trainsLeft: { p0: 3 } });
    expect(planTickets(s, s.players[0]).blocked).toHaveLength(1);
  });
});

describe('claimableSet', () => {
  it('matches routeIsClaimable on real mid-game states (2 and 4 players)', () => {
    for (const n of [2, 4]) {
      const rng = makeRng(n);
      let s: GameState = createGame(Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: true })), n);
      for (let move = 0; move < 400 && s.phase !== 'game-over'; move++) {
        const id = s.phase === 'setup-tickets' ? s.players.find((p) => p.pendingTickets.length)!.id : s.players[s.current].id;
        if (move % 10 === 0) {
          for (const p of s.players) {
            const set = claimableSet(s, p.id);
            for (const r of ROUTES) expect(set.has(r.id)).toBe(routeIsClaimable(s, r.id, p.id));
          }
        }
        const actions = legalActions(s, id);
        s = applyAction(s, actions[Math.floor(rng.next() * actions.length)]);
      }
    }
  });
});
