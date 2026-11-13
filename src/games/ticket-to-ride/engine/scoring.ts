import type { PlayerState } from './types';
import { routeById } from './maps';
import { areConnected } from './graph';

const ROUTE_BY_ID = routeById;

const POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };

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
  bonuses: number;
  /** Points from unused train stations (Europe): 4 each. */
  stations: number;
  total: number;
}

const STATION_POINTS = 4;

/** Ticket delta if the player's network is extended by some extra edges. */
function ticketDeltaWith(player: PlayerState, extraEdges: string[]): number {
  const edges = extraEdges.length ? [...player.claimedRouteIds, ...extraEdges] : player.claimedRouteIds;
  let delta = 0;
  for (const t of player.tickets) {
    delta += areConnected(edges, t.a, t.b) ? t.points : -t.points;
  }
  return delta;
}

/**
 * Best ticket delta given the player's stations: each station city may borrow
 * one route (owned by another player) leaving that city, for connectivity only.
 */
function bestStationTickets(player: PlayerState, players: PlayerState[]): number {
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

  let best = -Infinity;
  const search = (i: number, acc: string[]) => {
    if (i === optionsPerCity.length) {
      best = Math.max(best, ticketDeltaWith(player, acc));
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
    const tickets = bestStationTickets(p, players);
    let bonus = 0;
    for (const a of awardedByRule) if (a.ids.has(p.id)) bonus += a.points;
    const stations = STATION_POINTS * p.stationsLeft;
    out[p.id] = { routes, tickets, bonuses: bonus, stations, total: routes + tickets + bonus + stations };
  }
  return out;
}
