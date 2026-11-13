import { useMemo, type ReactNode } from 'react';
import type { City, Route } from '../../engine/types';
import { CITIES } from '../../engine/data/usa/cities';
import { ROUTES } from '../../engine/data/usa/routes';
import { ROUTE_BENDS, bendKey } from '../data/routeCurves';
import type { Bend } from '../geometry';
import { RouteSegment, starPath } from './RouteSegment';
import { CityDot } from './CityDot';
import { COLOR_BORDER, COLOR_HEX, LOCO_STOPS } from '../colors';

/**
 * Key for the special routes, shown only on maps that have them. It sits in the
 * open sea along the bottom edge (between Cadiz and Palermo on the Europe board).
 */
function RouteLegend({ routes }: { routes: Route[] }) {
  const tunnels = routes.some((r) => r.isTunnel);
  const ferries = routes.some((r) => r.locomotivesRequired > 0);
  if (!tunnels && !ferries) return null;
  const slot = (x: number, y: number, loco = false) => (
    <g>
      <rect
        x={x}
        y={y - 5.5}
        width={18}
        height={11}
        rx={2.5}
        fill={loco ? 'url(#locoSlot)' : COLOR_HEX.grey}
        stroke={loco ? '#4a4a4a' : COLOR_BORDER.grey}
        strokeWidth={1.5}
      />
      {loco && <path d={starPath(x + 9, y, 4)} fill="#ffffff" stroke="#00000080" strokeWidth={0.6} />}
    </g>
  );
  const label = { fontSize: 12, fontWeight: 600, fill: '#3d2b1a', dominantBaseline: 'central' } as const;
  let y = 0;
  const rows: ReactNode[] = [];
  if (tunnels) {
    rows.push(
      <g key="tunnel" transform={`translate(0 ${y})`}>
        <rect x={-3} y={-8.5} width={24} height={17} rx={5} fill="none" stroke="#3d2b1a" strokeWidth={1.6} strokeDasharray="3 2" />
        {slot(0, 0)}
        <text x={30} {...label}>Tunnel: may cost extra</text>
      </g>,
    );
    y += 18;
  }
  if (ferries) {
    rows.push(
      <g key="ferry" transform={`translate(0 ${y})`}>
        {slot(0, 0, true)}
        <text x={30} {...label}>Ferry: ★ needs a locomotive</text>
      </g>,
    );
    y += 18;
  }
  return (
    <g data-testid="board-legend" transform={`translate(172 ${692 - y})`} style={{ pointerEvents: 'none' }}>
      {rows}
    </g>
  );
}

interface Props {
  claimedBy: Record<string, string>;
  /** playerId -> display color, for coloring claimed routes. */
  playerColors: Record<string, string>;
  /** playerId -> avatar emoji, for a badge on claimed routes. */
  playerAvatars?: Record<string, string>;
  claimableRouteIds?: Set<string>;
  /** Strongly emphasize (e.g. endpoints of a hovered destination ticket). */
  highlightCityIds?: Set<string>;
  /** Subtly, persistently mark (endpoints of the player's kept tickets). */
  subtleCityIds?: Set<string>;
  onClaimRoute?: (routeId: string) => void;
  /** Routes forming the hovered longest-path chain — drawn brighter and larger. */
  highlightRouteIds?: Set<string>;
  /** The hovered route the chain anchors on (shows the length tooltip). */
  hoverAnchorId?: string | null;
  /** Tooltip text for the anchor route. */
  hoverLabel?: string | null;
  /** Raw hover enter/leave for a route; the parent applies the dwell delay. */
  onRouteHover?: (routeId: string | null) => void;
  /** City id -> owner color of a train station placed there (Europe). */
  stationColors?: Record<string, string>;
  /** Cities that can receive a station right now (placing mode). */
  placeableCityIds?: Set<string>;
  onCityClick?: (cityId: string) => void;
  /** Layout overrides (used by the dev board editor); default to the shipped map data. */
  cities?: City[];
  routes?: Route[];
  bends?: Record<string, Bend>;
  /** Drawn beneath the routes (e.g. a reference image). */
  underlay?: ReactNode;
  /** Drawn above everything (e.g. editor drag handles). */
  children?: ReactNode;
}

export function Board({
  claimedBy,
  playerColors,
  playerAvatars,
  claimableRouteIds,
  highlightCityIds,
  subtleCityIds,
  onClaimRoute,
  highlightRouteIds,
  hoverAnchorId,
  hoverLabel,
  onRouteHover,
  stationColors,
  placeableCityIds,
  onCityClick,
  cities = CITIES,
  routes = ROUTES,
  bends = ROUTE_BENDS,
  underlay,
  children,
}: Props) {
  const cityById = useMemo(() => {
    const m = new Map<string, City>();
    for (const c of cities) m.set(c.id, c);
    return m;
  }, [cities]);

  // Draw the hovered chain last so its enlarged cars and tooltip sit above neighbours.
  const orderedRoutes = useMemo(() => {
    if (!highlightRouteIds || highlightRouteIds.size === 0) return routes;
    return [
      ...routes.filter((r) => !highlightRouteIds.has(r.id)),
      ...routes.filter((r) => highlightRouteIds.has(r.id)),
    ];
  }, [routes, highlightRouteIds]);

  return (
    <svg
      className="board"
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Ticket to Ride board"
    >
      <defs>
        <filter id="trainShadow" x="-20%" y="-40%" width="140%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <linearGradient id="parchment" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe6ce" />
          <stop offset="1" stopColor="#ddd0ac" />
        </linearGradient>
        {/* Ferry slots that need a locomotive wear the locomotive card's rainbow. */}
        <linearGradient id="locoSlot" x1="0" y1="0" x2="1" y2="1">
          {LOCO_STOPS.map((c, i) => (
            <stop key={c} offset={i / (LOCO_STOPS.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      {/* Parchment map with a gold frame, echoing the printed board. */}
      <rect x={0} y={0} width={1000} height={700} fill="url(#parchment)" rx={12} />
      <rect
        x={7}
        y={7}
        width={986}
        height={686}
        rx={9}
        fill="none"
        stroke="#b98f45"
        strokeWidth={3}
        strokeOpacity={0.7}
      />
      {underlay}
      <g className="routes">
        {orderedRoutes.map((route) => {
          const from = cityById.get(route.a)!;
          const to = cityById.get(route.b)!;
          const owner = claimedBy[route.id];
          const ownerColor = owner ? playerColors[owner] ?? '#666' : null;
          const claimable = claimableRouteIds?.has(route.id) ?? false;
          return (
            <RouteSegment
              key={route.id}
              route={route}
              from={from}
              to={to}
              bend={bends[bendKey(route)]}
              ownerColor={ownerColor}
              ownerAvatar={owner ? playerAvatars?.[owner] : undefined}
              claimable={claimable}
              onClick={claimable && onClaimRoute ? () => onClaimRoute(route.id) : undefined}
              highlighted={highlightRouteIds?.has(route.id) ?? false}
              label={hoverAnchorId === route.id ? hoverLabel ?? null : null}
              onHoverStart={onRouteHover ? () => onRouteHover(route.id) : undefined}
              onHoverEnd={onRouteHover ? () => onRouteHover(null) : undefined}
            />
          );
        })}
      </g>
      <RouteLegend routes={routes} />
      <g className="cities">
        {cities.map((c) => {
          const placeable = placeableCityIds?.has(c.id) ?? false;
          return (
            <CityDot
              key={c.id}
              city={c}
              highlighted={highlightCityIds?.has(c.id)}
              subtle={subtleCityIds?.has(c.id)}
              stationColor={stationColors?.[c.id]}
              placeable={placeable}
              onClick={placeable && onCityClick ? () => onCityClick(c.id) : undefined}
            />
          );
        })}
      </g>
      {children}
    </svg>
  );
}
