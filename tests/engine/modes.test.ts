import { describe, expect, it } from 'vitest';
import { cityById, modeFor } from '../../src/games/ticket-to-ride/engine/maps';
import { TICKETS } from '../../src/games/ticket-to-ride/engine/data/usa/tickets';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { IllegalActionError } from '../../src/games/ticket-to-ride/engine/actions';
import { legalActions } from '../../src/games/ticket-to-ride/engine/selectors';
import { globetrotterBonus } from '../../src/games/ticket-to-ride/engine/bonuses';
import { chooseAction } from '../../src/games/ticket-to-ride/ai/bot';
import type { GameState, Ticket } from '../../src/games/ticket-to-ride/engine/types';
import { makeState, ticket } from '../ai/helpers';

/** Order-free city pair, so a ticket matches however its ends are listed. */
const pair = (t: Pick<Ticket, 'a' | 'b'>) => [t.a, t.b].sort().join('|');
const valueOf = (tickets: Ticket[], a: string, b: string) =>
  tickets.find((t) => pair(t) === pair({ a, b }))?.points;

const twoHumans = [
  { name: 'A', isAI: false },
  { name: 'B', isAI: false },
];

describe('USA 1910 tickets (rulebook: 35 new tickets with the 1910 logo)', () => {
  const tickets = modeFor('usa', '1910').tickets;

  it('has 35 tickets with unique ids, between cities on the USA map', () => {
    expect(tickets).toHaveLength(35);
    expect(new Set(tickets.map((t) => t.id)).size).toBe(35);
    for (const t of tickets) {
      expect(cityById.has(t.a), t.a).toBe(true);
      expect(cityById.has(t.b), t.b).toBe(true);
    }
  });

  it('shares no route with the original tickets', () => {
    const original = new Set(TICKETS.map(pair));
    expect(tickets.filter((t) => original.has(pair(t)))).toEqual([]);
  });

  it('carries the printed point values', () => {
    expect(valueOf(tickets, 'las-vegas', 'miami')).toBe(21);
    expect(valueOf(tickets, 'washington', 'atlanta')).toBe(4);
    expect(valueOf(tickets, 'calgary', 'nashville')).toBe(14);
    expect(valueOf(tickets, 'los-angeles', 'oklahoma-city')).toBe(9);
    expect(valueOf(tickets, 'san-francisco', 'washington')).toBe(21);
  });
});

describe('Mega Game tickets (rulebook: all 69 tickets)', () => {
  const tickets = modeFor('usa', 'mega').tickets;
  const new1910 = new Set(modeFor('usa', '1910').tickets.map(pair));
  const reprints = tickets.filter((t) => !new1910.has(pair(t)));

  it('has 69 tickets with unique ids: the 35 new ones plus 34 reprints', () => {
    expect(tickets).toHaveLength(69);
    expect(new Set(tickets.map((t) => t.id)).size).toBe(69);
    expect(tickets.filter((t) => new1910.has(pair(t)))).toHaveLength(35);
    expect(reprints).toHaveLength(34);
  });

  it('reprints the 30 original tickets, 4 of them revised downward', () => {
    const revised = TICKETS.filter((t) => valueOf(reprints, t.a, t.b) !== t.points).map((t) => [
      pair(t),
      t.points,
      valueOf(reprints, t.a, t.b),
    ]);
    expect(revised).toEqual([
      [pair({ a: 'sault-ste-marie', b: 'oklahoma-city' }), 9, 8],
      [pair({ a: 'los-angeles', b: 'miami' }), 20, 19],
      [pair({ a: 'los-angeles', b: 'new-york' }), 21, 20],
      [pair({ a: 'seattle', b: 'new-york' }), 22, 20],
    ]);
  });

  it('adds the 4 Mystery Train tickets', () => {
    const original = new Set(TICKETS.map(pair));
    const mystery = reprints.filter((t) => !original.has(pair(t)));
    expect(mystery.map((t) => [pair(t), t.points]).sort()).toEqual(
      [
        [pair({ a: 'boston', b: 'washington' }), 4],
        [pair({ a: 'montreal', b: 'chicago' }), 7],
        [pair({ a: 'vancouver', b: 'portland' }), 2],
        [pair({ a: 'winnipeg', b: 'omaha' }), 6],
      ].sort(),
    );
  });

  it('matches the rulebook Big Cities count (35 tickets touch a big city)', () => {
    const big = new Set(['chicago', 'dallas', 'houston', 'los-angeles', 'miami', 'new-york', 'seattle']);
    expect(tickets.filter((t) => big.has(t.a) || big.has(t.b))).toHaveLength(35);
  });
});

/** Every player keeps the minimum, so the game is in its first turn. */
function started(modeId: string, keep: number): GameState {
  let g = createGame(twoHumans, 1, 'usa', modeId);
  for (const p of g.players) {
    const keptIds = p.pendingTickets.slice(0, keep).map((t) => t.id);
    g = applyAction(g, { type: 'CONFIRM_SETUP_TICKETS', playerId: p.id, keptIds });
  }
  return g;
}

describe.each([
  { modeId: 'default', deal: 3, keep: 2, draw: 3 },
  { modeId: '1910', deal: 3, keep: 2, draw: 3 },
  { modeId: 'mega', deal: 5, keep: 3, draw: 4 },
])('$modeId mode ticket rules', ({ modeId, deal, keep, draw }) => {
  it(`deals ${deal} tickets to each player and records the mode`, () => {
    const g = createGame(twoHumans, 1, 'usa', modeId);
    expect(g.modeId).toBe(modeId);
    for (const p of g.players) expect(p.pendingTickets).toHaveLength(deal);
  });

  it(`requires keeping at least ${keep} distinct starting tickets`, () => {
    const g = createGame(twoHumans, 1, 'usa', modeId);
    const ids = g.players[0].pendingTickets.map((t) => t.id);
    const confirm = (keptIds: string[]) =>
      applyAction(g, { type: 'CONFIRM_SETUP_TICKETS', playerId: 'p0', keptIds });
    expect(() => confirm(ids.slice(0, keep - 1))).toThrow(IllegalActionError);
    expect(() => confirm(Array(keep).fill(ids[0]))).toThrow(IllegalActionError);
    expect(confirm(ids.slice(0, keep)).players[0].tickets).toHaveLength(keep);
  });

  it(`offers only starting choices that keep at least ${keep}`, () => {
    const g = createGame(twoHumans, 1, 'usa', modeId);
    const sizes = legalActions(g, 'p0').map((a) => (a.type === 'CONFIRM_SETUP_TICKETS' ? a.keptIds.length : 0));
    expect(Math.min(...sizes)).toBe(keep);
  });

  it.each(['easy', 'normal', 'hard'] as const)('a %s bot keeps a legal number of starting tickets', (difficulty) => {
    const g = createGame(twoHumans, 1, 'usa', modeId);
    const action = chooseAction(g, 'p0', difficulty);
    expect(action.type).toBe('CONFIRM_SETUP_TICKETS');
    expect(() => applyAction(g, action)).not.toThrow();
  });

  it(`draws ${draw} tickets when a player takes destination tickets`, () => {
    const g = applyAction(started(modeId, keep), { type: 'DRAW_TICKETS' });
    expect(g.players[0].pendingTickets).toHaveLength(draw);
  });
});

describe('end-game bonus cards by mode', () => {
  /**
   * Last turn of a game: p0 has the longest path (Boston-New York-Washington, 4)
   * and no tickets; p1 has Montreal-Boston (2) and completed the one ticket.
   */
  function lastTurn(modeId: string): GameState {
    const s = makeState({
      owned: { p0: ['boston-new-york', 'new-york-washington'], p1: ['montreal-boston'] },
      tickets: { p1: [ticket('montreal', 'boston', 2)] },
    });
    return { ...s, modeId, finalTurnsLeft: 1 };
  }
  const finish = (s: GameState) => {
    let g = applyAction(s, { type: 'DRAW_TRAIN', source: 'deck' });
    g = applyAction(g, { type: 'DRAW_TRAIN', source: 'deck' });
    expect(g.phase).toBe('game-over');
    return g.players.map((p) => p.score);
  };

  it('default: only Longest Path (+10)', () => {
    expect(finish(lastTurn('default'))).toEqual([4 + 10, 2 + 2]);
  });

  it('1910: Globetrotter (+15) replaces Longest Path', () => {
    expect(finish(lastTurn('1910'))).toEqual([4, 2 + 2 + 15]);
  });

  it('mega: both bonus cards are in play', () => {
    expect(finish(lastTurn('mega'))).toEqual([4 + 10, 2 + 2 + 15]);
  });
});

describe('Globetrotter (most completed tickets)', () => {
  const players = (completed: number[]) =>
    makeState({
      players: completed.length,
      owned: { p0: ['boston-new-york'], p1: ['boston-new-york'], p2: ['boston-new-york'] },
      tickets: Object.fromEntries(
        completed.map((n, i) => [
          `p${i}`,
          [...Array(3)].map((_, k) => (k < n ? ticket('boston', 'new-york', 2) : ticket('seattle', 'miami', 22))),
        ]),
      ),
    }).players;

  it('goes to the player with the most completed tickets', () => {
    expect(globetrotterBonus.award(players([1, 3, 2]))).toEqual(new Set(['p1']));
  });

  it('goes to every tied player', () => {
    expect(globetrotterBonus.award(players([2, 2, 1]))).toEqual(new Set(['p0', 'p1']));
  });

  it('goes to no one when nobody completed a ticket', () => {
    expect(globetrotterBonus.award(players([0, 0]))).toEqual(new Set());
  });
});
