import type { GameState, MapId, PlayerState, Route, Ticket } from '../engine/types';
import { getMap } from '../engine/maps';
import { areConnected } from '../engine/graph';
import { routePoints } from '../engine/scoring';

interface MapIndex {
  /** The other rail of each double route. */
  sibling: Map<string, string>;
  length: Map<string, number>;
  adj: Map<string, { to: string; route: Route }[]>;
}

const INDEX = new Map<MapId, MapIndex>();

/** Precomputed, memoized per-map route structures used by the planner. */
function indexFor(mapId: MapId): MapIndex {
  const cached = INDEX.get(mapId);
  if (cached) return cached;

  const routes = getMap(mapId).routes;
  const sibling = new Map<string, string>();
  for (const r of routes) {
    if (!r.parallelGroup) continue;
    const sib = routes.find((o) => o.parallelGroup === r.parallelGroup && o.id !== r.id);
    if (sib) sibling.set(r.id, sib.id);
  }

  const length = new Map(routes.map((r) => [r.id, r.length]));

  const adj = new Map<string, { to: string; route: Route }[]>();
  for (const r of routes) {
    for (const [from, to] of [
      [r.a, r.b],
      [r.b, r.a],
    ]) {
      const list = adj.get(from) ?? [];
      list.push({ to, route: r });
      adj.set(from, list);
    }
  }

  const idx: MapIndex = { sibling, length, adj };
  INDEX.set(mapId, idx);
  return idx;
}

/**
 * Every route `playerId` could legally claim (ignoring cards and trains).
 * Same rule as the engine's `routeIsClaimable`, computed for all routes at once.
 */
export function claimableSet(state: GameState, playerId: string): Set<string> {
  const { sibling } = indexFor(state.mapId);
  const out = new Set<string>();
  const fewPlayers = state.players.length <= 3;
  for (const r of getMap(state.mapId).routes) {
    if (state.claimedBy[r.id]) continue;
    const sib = sibling.get(r.id);
    const sibOwner = sib ? state.claimedBy[sib] : undefined;
    if (sibOwner && (sibOwner === playerId || fewPlayers)) continue;
    out.add(r.id);
  }
  return out;
}

/** Dijkstra: the cheapest a→b chain under `cost` (null = impassable), or null. */
export function cheapestPath(
  mapId: MapId,
  a: string,
  b: string,
  cost: (r: Route) => number | null,
): { routeIds: string[]; cost: number } | null {
  const { adj } = indexFor(mapId);
  const dist = new Map<string, number>([[a, 0]]);
  const prev = new Map<string, { node: string; routeId: string }>();
  const done = new Set<string>();
  while (true) {
    let node: string | null = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < best) ((best = d), (node = n));
    if (node === null) return null;
    if (node === b) break;
    done.add(node);
    for (const { to, route } of adj.get(node) ?? []) {
      const c = cost(route);
      if (c === null) continue;
      if (best + c < (dist.get(to) ?? Infinity)) {
        dist.set(to, best + c);
        prev.set(to, { node, routeId: route.id });
      }
    }
  }
  const routeIds: string[] = [];
  for (let cur = b; cur !== a; ) {
    const step = prev.get(cur)!;
    routeIds.push(step.routeId);
    cur = step.node;
  }
  return { routeIds, cost: dist.get(b)! };
}

/** What it still takes to complete a set of tickets. */
export interface Plan {
  /** Unclaimed routes the plan still needs. */
  routeIds: Set<string>;
  /** Total length of those routes. */
  trainsNeeded: number;
  /** Incomplete tickets the plan completes. */
  reachable: Ticket[];
  /** Incomplete tickets that can't be completed (no path, or not enough trains). */
  blocked: Ticket[];
}

/**
 * Plan all incomplete tickets together, highest value first: routes already
 * owned or planned cost nothing, so overlapping tickets share track.
 * `lengthBias` (0–0.6) makes long routes – which score more points per train –
 * cheaper to path through; `trainsNeeded` always counts real trains.
 */
export function planTickets(
  state: GameState,
  player: PlayerState,
  tickets: Ticket[] = player.tickets,
  lengthBias = 0,
): Plan {
  const { length } = indexFor(state.mapId);
  const claimable = claimableSet(state, player.id);
  const owned = new Set(player.claimedRouteIds);
  const planned = new Set<string>();
  const cost = (r: Route) =>
    owned.has(r.id) || planned.has(r.id)
      ? 0
      : claimable.has(r.id)
        ? r.length - lengthBias * (routePoints(r.length) - r.length)
        : null;

  let trainsNeeded = 0;
  const reachable: Ticket[] = [];
  const blocked: Ticket[] = [];
  for (const t of [...tickets].sort((x, y) => y.points - x.points)) {
    if (areConnected(player.claimedRouteIds, t.a, t.b)) continue;
    const path = cheapestPath(state.mapId, t.a, t.b, cost);
    const newIds = path ? path.routeIds.filter((id) => !owned.has(id) && !planned.has(id)) : [];
    const trains = newIds.reduce((n, id) => n + length.get(id)!, 0);
    if (!path || trainsNeeded + trains > player.trainsLeft) {
      blocked.push(t);
      continue;
    }
    for (const id of newIds) planned.add(id);
    trainsNeeded += trains;
    reachable.push(t);
  }
  return { routeIds: planned, trainsNeeded, reachable, blocked };
}
