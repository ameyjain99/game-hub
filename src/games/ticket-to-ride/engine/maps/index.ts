import type { City, MapId, Route } from '../types';
import type { BonusId, GameMap, GameMode } from './types';
import { USA_MAP } from './usa';
import { EUROPE_MAP } from './europe';

export type { BonusId, GameMap, GameMode };

/** All playable maps, keyed by id. New maps register here. */
export const MAPS: Record<MapId, GameMap> = {
  usa: USA_MAP,
  europe: EUROPE_MAP,
};

export const MAP_LIST: GameMap[] = Object.values(MAPS);
export const DEFAULT_MAP_ID: MapId = 'usa';

export function getMap(id: MapId): GameMap {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map "${id}"`);
  return m;
}

/** The mode to use for a map: the named one, or the default (first). */
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
