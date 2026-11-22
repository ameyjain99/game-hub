import type { City, MapId, Route } from '../types';
import type { BonusId, GameMap, GameMode, MapRules } from './types';
import { USA_MAP } from './usa';
import { EUROPE_MAP } from './europe';
import { NORDIC_MAP } from './nordic';
import { INDIA_MAP } from './india';

export type { BonusId, GameMap, GameMode, MapRules };

/** All playable maps, keyed by id. New maps register here. */
const MAPS: Record<MapId, GameMap> = {
  usa: USA_MAP,
  europe: EUROPE_MAP,
  nordic: NORDIC_MAP,
  india: INDIA_MAP,
};

export const MAP_LIST: GameMap[] = Object.values(MAPS);
export const DEFAULT_MAP_ID: MapId = 'usa';

export function getMap(id: MapId): GameMap {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map "${id}"`);
  return m;
}

/** The special rules of a map (none for the standard game). */
export const rulesOf = (mapId: MapId): MapRules => MAPS[mapId]?.rules ?? {};

/** The special rules of the map a route is on. */
export const rulesForRoute = (routeId: string): MapRules => MAP_LIST.find((m) => m.routes.some((r) => r.id === routeId))?.rules ?? {};

/** The mode to use for a map: the named one, or the default one. */
export function modeFor(mapId: MapId, modeId?: string): GameMode {
  const map = getMap(mapId);
  return (modeId && map.modes.find((m) => m.id === modeId)) || map.modes[0];
}

// Global id lookups across every map. Route and city ids are unique across
// maps (each map uses distinct city names), so a union lookup is unambiguous
// and lets id-only helpers like getRoute/getCity stay map-agnostic.
const allRoutes: Route[] = MAP_LIST.flatMap((m) => m.routes);
const allCities: City[] = MAP_LIST.flatMap((m) => m.cities);
export const routeById = new Map<string, Route>(allRoutes.map((r) => [r.id, r]));
export const cityById = new Map<string, City>(allCities.map((c) => [c.id, c]));
