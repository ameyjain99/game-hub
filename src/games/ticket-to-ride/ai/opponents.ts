import type { GameState } from '../engine/types';
import { getMap } from '../engine/maps';
import { getRoute } from '../engine/selectors';

/**
 * Opponent pressure on each unclaimed route: how many opponent-owned routes
 * touch its two cities. Uses only public information (claimed routes). In 4–5
 * player games a double route keeps a spare rail, so its pressure is halved.
 */
export function threatMap(state: GameState, playerId: string): Map<string, number> {
  const touching = new Map<string, number>();
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const id of p.claimedRouteIds) {
      const r = getRoute(id)!;
      touching.set(r.a, (touching.get(r.a) ?? 0) + 1);
      touching.set(r.b, (touching.get(r.b) ?? 0) + 1);
    }
  }
  const spareRail = state.players.length >= 4;
  const out = new Map<string, number>();
  for (const r of getMap(state.mapId).routes) {
    if (state.claimedBy[r.id]) continue;
    let w = (touching.get(r.a) ?? 0) + (touching.get(r.b) ?? 0);
    if (w === 0) continue;
    if (r.parallelGroup && spareRail) w /= 2;
    out.set(r.id, w);
  }
  return out;
}
