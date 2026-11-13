import type { CardColor, GameState, PlayerState, Route } from '../engine/types';
import { CARD_COLORS } from '../engine/types';
import { getMap, routeById } from '../engine/maps';
import { routeIsClaimable } from '../engine/selectors';
import { areConnected } from '../engine/graph';

interface Edge {
  to: string;
  routeId: string;
  cost: number;
  route: Route;
}

/**
 * Adjacency for planning: owned routes are free, routes still claimable by the
 * player cost their length, everything else is impassable.
 */
function planningGraph(state: GameState, player: PlayerState): Map<string, Edge[]> {
  const owned = new Set(player.claimedRouteIds);
  const adj = new Map<string, Edge[]>();
  const add = (from: string, to: string, e: Omit<Edge, 'to'>) => {
    const list = adj.get(from) ?? [];
    list.push({ to, ...e });
    adj.set(from, list);
  };
  for (const r of getMap(state.mapId).routes) {
    let cost: number;
    if (owned.has(r.id)) cost = 0;
    else if (routeIsClaimable(state, r.id, player.id)) cost = r.length;
    else continue;
    add(r.a, r.b, { routeId: r.id, cost, route: r });
    add(r.b, r.a, { routeId: r.id, cost, route: r });
  }
  return adj;
}

/** Dijkstra returning the route ids on the cheapest path from a to b (or null). */
function cheapestPath(adj: Map<string, Edge[]>, a: string, b: string): string[] | null {
  const dist = new Map<string, number>([[a, 0]]);
  const prev = new Map<string, { node: string; routeId: string }>();
  const visited = new Set<string>();

  while (visited.size < dist.size) {
    let node: string | null = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!visited.has(n) && d < best) ((best = d), (node = n));
    if (node === null) break;
    visited.add(node);
    if (node === b) break;
    for (const e of adj.get(node) ?? []) {
      const nd = (dist.get(node) ?? Infinity) + e.cost;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, { node, routeId: e.routeId });
      }
    }
  }

  if (!dist.has(b)) return null;
  const path: string[] = [];
  let cur = b;
  while (cur !== a) {
    const step = prev.get(cur);
    if (!step) return null;
    path.push(step.routeId);
    cur = step.node;
  }
  return path;
}

/** Route ids the player should aim to build to complete its incomplete tickets. */
export function targetRouteIds(state: GameState, player: PlayerState): Set<string> {
  const owned = new Set(player.claimedRouteIds);
  const adj = planningGraph(state, player);
  const targets = new Set<string>();
  for (const t of player.tickets) {
    if (areConnected(player.claimedRouteIds, t.a, t.b)) continue;
    const path = cheapestPath(adj, t.a, t.b);
    if (!path) continue;
    for (const id of path) if (!owned.has(id)) targets.add(id);
  }
  return targets;
}

/** Colors the player wants to draw, weighted by how many are still needed. */
export function desiredColors(
  player: PlayerState,
  targets: Set<string>,
): Map<CardColor, number> {
  const want = new Map<CardColor, number>();
  const bump = (c: CardColor, n: number) => want.set(c, (want.get(c) ?? 0) + n);
  for (const id of targets) {
    const r = routeById.get(id);
    if (!r) continue;
    if (r.color === 'grey') {
      // grey: reinforce whatever color the player already has the most of
      let bestColor: CardColor = 'red';
      let bestCount = -1;
      for (const c of CARD_COLORS) {
        if (player.hand[c] > bestCount) {
          bestCount = player.hand[c];
          bestColor = c;
        }
      }
      bump(bestColor, r.length);
    } else {
      bump(r.color, r.length);
    }
  }
  return want;
}
