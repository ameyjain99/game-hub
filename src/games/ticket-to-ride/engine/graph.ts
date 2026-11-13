import { routeById } from './maps';

const ROUTE_BY_ID = routeById;

interface Edge {
  to: string;
  length: number;
  edgeId: string;
}

function buildAdjacency(routeIds: string[]): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  const add = (from: string, to: string, length: number, edgeId: string) => {
    const list = adj.get(from) ?? [];
    list.push({ to, length, edgeId });
    adj.set(from, list);
  };
  for (const id of routeIds) {
    const r = ROUTE_BY_ID.get(id);
    if (!r) continue;
    add(r.a, r.b, r.length, id);
    add(r.b, r.a, r.length, id);
  }
  return adj;
}

/** Whether cities a and b are connected through the given claimed routes. */
export function areConnected(routeIds: string[], a: string, b: string): boolean {
  if (a === b) return true;
  const adj = buildAdjacency(routeIds);
  const seen = new Set<string>([a]);
  const stack = [a];
  while (stack.length) {
    const node = stack.pop()!;
    for (const edge of adj.get(node) ?? []) {
      if (edge.to === b) return true;
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        stack.push(edge.to);
      }
    }
  }
  return false;
}

/**
 * Route ids of one longest continuous path, in travel order, using each claimed
 * edge at most once. Cities may be revisited. Exhaustive DFS — fine at map scale.
 */
export function longestPathRoutes(routeIds: string[]): string[] {
  const adj = buildAdjacency(routeIds);
  const used = new Set<string>();
  const trail: string[] = [];
  let best: string[] = [];
  let bestLen = 0;

  const dfs = (node: string, acc: number) => {
    if (acc > bestLen) {
      bestLen = acc;
      best = [...trail];
    }
    for (const edge of adj.get(node) ?? []) {
      if (used.has(edge.edgeId)) continue;
      used.add(edge.edgeId);
      trail.push(edge.edgeId);
      dfs(edge.to, acc + edge.length);
      trail.pop();
      used.delete(edge.edgeId);
    }
  };

  for (const node of adj.keys()) dfs(node, 0);
  return best;
}

/** Longest continuous path (sum of segment lengths); see `longestPathRoutes`. */
export function longestPath(routeIds: string[]): number {
  return longestPathRoutes(routeIds).reduce((sum, id) => sum + ROUTE_BY_ID.get(id)!.length, 0);
}

/**
 * Route ids of the longest continuous trail that passes through `edgeId` (same
 * edge-disjoint, city-revisiting sense as `longestPathRoutes`). Returns [] if
 * `edgeId` isn't among `routeIds`. Exhaustive DFS — fine at map scale, and only
 * runs on a settled hover, not per frame.
 */
export function longestPathThrough(routeIds: string[], edgeId: string): string[] {
  if (!routeIds.includes(edgeId)) return [];
  const adj = buildAdjacency(routeIds);
  const used = new Set<string>();
  const trail: string[] = [];
  let best: string[] = [];
  let bestLen = 0;

  const dfs = (node: string, acc: number) => {
    if (used.has(edgeId) && acc > bestLen) {
      bestLen = acc;
      best = [...trail];
    }
    for (const edge of adj.get(node) ?? []) {
      if (used.has(edge.edgeId)) continue;
      used.add(edge.edgeId);
      trail.push(edge.edgeId);
      dfs(edge.to, acc + edge.length);
      trail.pop();
      used.delete(edge.edgeId);
    }
  };

  for (const node of adj.keys()) dfs(node, 0);
  return best;
}
