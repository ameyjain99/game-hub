import type { PlayerState } from './types';
import { routeById } from './maps';
import { areConnected } from './graph';

const ROUTE_BY_ID = routeById;

const POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15, 8: 21 };

export function routePoints(length: number): number {
  return POINTS[length] ?? 0;
}

/** Sum of ticket values: completed add, uncompleted subtract. */
export function ticketDelta(player: PlayerState): number {
  let delta = 0;
  for (const t of player.tickets) {
    delta += areConnected(player.claimedRouteIds, t.a, t.b) ? t.points : -t.points;
  }
  return delta;
}

/** Total points from a player's claimed routes. */
export function routeScore(player: PlayerState): number {
  let total = 0;
  for (const id of player.claimedRouteIds) {
    const r = ROUTE_BY_ID.get(id);
    if (r) total += routePoints(r.length);
  }
  return total;
}

/** An end-game bonus rule. `award` returns the ids of players who receive it. */
export interface BonusRule {
  id: string;
  label: string;
  points: number;
  award(players: PlayerState[]): Set<string>;
}

export interface ScoreBreakdown {
  routes: number;
  tickets: number;
  /** Tickets completed (counting routes borrowed through stations); breaks ties. */
  ticketsCompleted: number;
  bonuses: number;
  /** Points from unused train stations (Europe): 4 each. */
  stations: number;
  total: number;
}

const STATION_POINTS = 4;

interface TicketResult {
  delta: number;
  completed: number;
}

/** Ticket delta and completed count if the player's network is extended by some extra edges. */
function ticketDeltaWith(player: PlayerState, extraEdges: string[]): TicketResult {
  const edges = extraEdges.length ? [...player.claimedRouteIds, ...extraEdges] : player.claimedRouteIds;
  let delta = 0;
  let completed = 0;
  for (const t of player.tickets) {
    const done = areConnected(edges, t.a, t.b);
    delta += done ? t.points : -t.points;
    if (done) completed++;
  }
  return { delta, completed };
}

/**
 * Best ticket result given the player's stations: each station city may borrow
 * one route (owned by another player) leaving that city, for connectivity only.
 * The player picks the borrowed routes for the most points, then most tickets.
 */
function bestStationTickets(player: PlayerState, players: PlayerState[]): TicketResult {
  if (player.stations.length === 0) return ticketDeltaWith(player, []);
  const othersRoutes = players
    .filter((q) => q.id !== player.id)
    .flatMap((q) => q.claimedRouteIds);
  const optionsPerCity = player.stations.map((city) => {
    const incident = othersRoutes.filter((id) => {
      const r = ROUTE_BY_ID.get(id);
      return r && (r.a === city || r.b === city);
    });
    return [null as string | null, ...incident];
  });

  let best: TicketResult = { delta: -Infinity, completed: 0 };
  const search = (i: number, acc: string[]) => {
    if (i === optionsPerCity.length) {
      const r = ticketDeltaWith(player, acc);
      if (r.delta > best.delta || (r.delta === best.delta && r.completed > best.completed)) best = r;
      return;
    }
    for (const opt of optionsPerCity[i]) search(i + 1, opt ? [...acc, opt] : acc);
  };
  search(0, []);
  return best;
}

export function finalScores(
  players: PlayerState[],
  bonuses: BonusRule[],
): Record<string, ScoreBreakdown> {
  const awardedByRule = bonuses.map((b) => ({ points: b.points, ids: b.award(players) }));
  const out: Record<string, ScoreBreakdown> = {};
  for (const p of players) {
    const routes = routeScore(p);
    const { delta: tickets, completed: ticketsCompleted } = bestStationTickets(p, players);
    let bonus = 0;
    for (const a of awardedByRule) if (a.ids.has(p.id)) bonus += a.points;
    const stations = STATION_POINTS * p.stationsLeft;
    out[p.id] = {
      routes,
      tickets,
      ticketsCompleted,
      bonuses: bonus,
      stations,
      total: routes + tickets + bonus + stations,
    };
  }
  return out;
}
