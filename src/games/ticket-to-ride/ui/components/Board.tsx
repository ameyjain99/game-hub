import { useMemo, type ReactNode } from 'react';
import type { City, Route } from '../../engine/types';
import { CITIES } from '../../engine/data/usa/cities';
import { ROUTES } from '../../engine/data/usa/routes';
import { ROUTE_BENDS, bendKey } from '../data/routeCurves';
import type { Bend } from '../geometry';
import { RouteSegment } from './RouteSegment';
import { CityDot } from './CityDot';

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
