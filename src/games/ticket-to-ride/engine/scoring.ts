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
  /** Each built station (in build order) and the opponent route it borrowed for
   *  scoring – null when borrowing would not have helped any ticket. */
  stationRoutes: { city: string; routeId: string | null }[];
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
 * The borrowed routes are chosen for the most points, then the most tickets;
 * a station borrows nothing unless that improves on not borrowing.
 */
function bestStationTickets(
  player: PlayerState,
  players: PlayerState[],
): TicketResult & { borrowed: (string | null)[] } {
  if (player.stations.length === 0) return { ...ticketDeltaWith(player, []), borrowed: [] };
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

  let best: TicketResult & { borrowed: (string | null)[] } = { delta: -Infinity, completed: 0, borrowed: [] };
  const search = (i: number, choice: (string | null)[]) => {
    if (i === optionsPerCity.length) {
      const r = ticketDeltaWith(player, choice.filter((id): id is string => id !== null));
      if (r.delta > best.delta || (r.delta === best.delta && r.completed > best.completed)) {
        best = { ...r, borrowed: choice };
      }
      return;
    }
    for (const opt of optionsPerCity[i]) search(i + 1, [...choice, opt]);
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
    const { delta: tickets, completed: ticketsCompleted, borrowed } = bestStationTickets(p, players);
    let bonus = 0;
    for (const a of awardedByRule) if (a.ids.has(p.id)) bonus += a.points;
    const stations = STATION_POINTS * p.stationsLeft;
    out[p.id] = {
      routes,
      tickets,
      ticketsCompleted,
      bonuses: bonus,
      stations,
      stationRoutes: p.stations.map((city, i) => ({ city, routeId: borrowed[i] ?? null })),
      total: routes + tickets + bonus + stations,
    };
  }
  return out;
}
