import type { GameState } from './types';
import { getMap } from './maps';
import { routeIsClaimable } from './selectors';

/**
 * The fewest train pieces a player still has to lay to join two cities: their
 * own routes are free, a route they could still claim costs its length, and a
 * route that is taken (or closed to them) can't be used. Infinity when there is
 * no way through any more.
 */
export function trainsNeeded(state: GameState, playerId: string, from: string, to: string): number {
  const links = new Map<string, { to: string; cost: number }[]>();
  const link = (a: string, b: string, cost: number) => links.set(a, [...(links.get(a) ?? []), { to: b, cost }]);
  for (const r of getMap(state.mapId).routes) {
    const cost = state.claimedBy[r.id] === playerId ? 0 : routeIsClaimable(state, r.id, playerId) ? r.length : null;
    if (cost === null) continue;
    link(r.a, r.b, cost);
    link(r.b, r.a, cost);
  }
  const best = new Map<string, number>([[from, 0]]);
  const open = new Set([from]);
  while (open.size > 0) {
    let at = '';
    for (const c of open) if (at === '' || best.get(c)! < best.get(at)!) at = c;
    if (at === to) return best.get(at)!;
    open.delete(at);
    for (const e of links.get(at) ?? []) {
      const d = best.get(at)! + e.cost;
      if (d < (best.get(e.to) ?? Infinity)) {
        best.set(e.to, d);
        open.add(e.to);
      }
    }
  }
  return Infinity;
}
