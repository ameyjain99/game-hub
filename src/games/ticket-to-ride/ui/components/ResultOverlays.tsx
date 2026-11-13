import type { PlayerState } from '../../engine/types';
import { cityById } from '../../engine/maps';
import { getRoute } from '../../engine/selectors';
import { areConnected, longestPathRoutes } from '../../engine/graph';
import { ROUTE_BENDS, bendKey } from '../data/routeCurves';
import { curvePoints } from '../geometry';
import { railSide } from './RouteSegment';

const CITY = cityById;

/** Gold outline beneath a player's longest continuous path (a Board `underlay`). */
export function LongestPathOutline({ player }: { player: PlayerState }) {
  return (
    <g pointerEvents="none">
      {longestPathRoutes(player.claimedRouteIds).map((id) => {
        const r = getRoute(id)!;
        const points = curvePoints(CITY.get(r.a)!, CITY.get(r.b)!, ROUTE_BENDS[bendKey(r)] ?? [0, 0], railSide(r));
        return (
          <polyline
            key={id}
            className="longest-path"
            points={points}
            fill="none"
            stroke="#f2c31d"
            strokeOpacity={0.85}
            strokeWidth={22}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

/** Rings on a player's ticket endpoints: green if completed, red if failed (failed wins on a shared city). */
export function TicketRings({ player }: { player: PlayerState }) {
  const status = new Map<string, 'done' | 'missing'>();
  for (const t of player.tickets) {
    const s = areConnected(player.claimedRouteIds, t.a, t.b) ? 'done' : 'missing';
    for (const c of [t.a, t.b]) if (status.get(c) !== 'missing') status.set(c, s);
  }
  return (
    <g pointerEvents="none">
      {[...status].map(([id, s]) => {
        const c = CITY.get(id)!;
        return (
          <circle
            key={id}
            className={`ticket-ring ${s}`}
            data-city-id={id}
            cx={c.x}
            cy={c.y}
            r={11}
            fill="none"
            stroke={s === 'done' ? '#2fa84f' : '#e2483b'}
            strokeWidth={3.5}
          />
        );
      })}
    </g>
  );
}
