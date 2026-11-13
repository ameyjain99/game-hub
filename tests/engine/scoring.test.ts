import { describe, it, expect } from 'vitest';
import { routePoints, ticketDelta, finalScores } from '../../src/games/ticket-to-ride/engine/scoring';
import { longestPathBonus } from '../../src/games/ticket-to-ride/engine/bonuses';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import type { PlayerState } from '../../src/games/ticket-to-ride/engine/types';

function player(over: Partial<PlayerState>): PlayerState {
  return {
    id: 'p',
    name: 'P',
    isAI: false,
    hand: emptyHand(),
    avatar: '',
    trainsLeft: 0,
    claimedRouteIds: [],
    tickets: [],
    pendingTickets: [],
    stationsLeft: 0,
    stations: [],
    score: 0,
    ...over,
  };
}

describe('routePoints', () => {
  it('matches the official curve', () => {
    expect([1, 2, 3, 4, 5, 6].map(routePoints)).toEqual([1, 2, 4, 7, 10, 15]);
  });
});

describe('ticketDelta', () => {
  it('adds completed and subtracts uncompleted tickets', () => {
    // Boston-NY + NY-Washington connects boston..washington
    const done = player({
      claimedRouteIds: ['boston-new-york', 'new-york-washington'],
      tickets: [{ id: 't', a: 'boston', b: 'washington', points: 8 }],
    });
    expect(ticketDelta(done)).toBe(8);

    const missed = player({
      claimedRouteIds: [],
      tickets: [{ id: 't', a: 'boston', b: 'washington', points: 8 }],
    });
    expect(ticketDelta(missed)).toBe(-8);
  });
});

describe('longestPathBonus', () => {
  it('awards +10 to all players tied for longest path', () => {
    const p1 = player({ id: 'p1', claimedRouteIds: ['montreal-new-york'] }); // len 3
    const p2 = player({ id: 'p2', claimedRouteIds: ['saint-louis-pittsburgh'] }); // len 5
    const p3 = player({ id: 'p3', claimedRouteIds: ['helena-denver'] }); // len 4
    const awarded = longestPathBonus.award([p1, p2, p3]);
    expect(awarded.has('p2')).toBe(true);
    expect(awarded.has('p1')).toBe(false);

    // tie: two players both at length 5
    const q1 = player({ id: 'q1', claimedRouteIds: ['saint-louis-pittsburgh'] }); // 5
    const q2 = player({ id: 'q2', claimedRouteIds: ['helena-omaha'] }); // 5
    const tied = longestPathBonus.award([q1, q2]);
    expect(tied.has('q1')).toBe(true);
    expect(tied.has('q2')).toBe(true);
  });
});

describe('finalScores', () => {
  it('totals routes + tickets + bonuses', () => {
    // p1: one length-5 route (10 pts) + completed 8-pt ticket + longest bonus 10 = 28
    const p1 = player({
      id: 'p1',
      claimedRouteIds: ['helena-omaha'], // len 5 -> 10 pts, also longest
      tickets: [{ id: 't', a: 'helena', b: 'omaha', points: 8 }],
    });
    // p2: one length-2 route (2 pts), no tickets, no bonus
    const p2 = player({ id: 'p2', claimedRouteIds: ['boston-new-york'] });
    const scores = finalScores([p1, p2], [longestPathBonus]);
    expect(scores.p1).toEqual({ routes: 10, tickets: 8, bonuses: 10, stations: 0, total: 28 });
    expect(scores.p2).toEqual({ routes: 2, tickets: 0, bonuses: 0, stations: 0, total: 2 });
  });
});
