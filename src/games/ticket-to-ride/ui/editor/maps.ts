import type { City, Route } from '../../engine/types';
import { CITIES, USA_LAYOUT } from '../../engine/data/usa/cities';
import { ROUTES } from '../../engine/data/usa/routes';
import { EUROPE_CITIES, EUROPE_LAYOUT } from '../../engine/data/europe/cities';
import { EUROPE_ROUTES } from '../../engine/data/europe/routes';
import type { BoardLayout } from '../../engine/data/layout';

export interface EditableMap {
  cities: City[];
  routes: Route[];
  layout: BoardLayout;
}

/**
 * Maps the board editor can open at `/?editor=<id>`. Save writes
 * `src/engine/data/<id>.layout.json`, so a new map needs that file plus an entry here.
 */
export const EDITABLE_MAPS: Record<string, EditableMap> = {
  usa: { cities: CITIES, routes: ROUTES, layout: USA_LAYOUT },
  europe: { cities: EUROPE_CITIES, routes: EUROPE_ROUTES, layout: EUROPE_LAYOUT },
};
