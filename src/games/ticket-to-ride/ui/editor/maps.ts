import type { City, Route } from '../../engine/types';
import { CITIES, USA_LAYOUT } from '../../engine/data/usa/cities';
import { ROUTES } from '../../engine/data/usa/routes';
import { EUROPE_CITIES, EUROPE_LAYOUT } from '../../engine/data/europe/cities';
import { EUROPE_ROUTES } from '../../engine/data/europe/routes';
import { NORDIC_CITIES, NORDIC_LAYOUT } from '../../engine/data/nordic/cities';
import { NORDIC_ROUTES } from '../../engine/data/nordic/routes';
import { INDIA_CITIES, INDIA_LAYOUT } from '../../engine/data/india/cities';
import { INDIA_ROUTES } from '../../engine/data/india/routes';
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
  nordic: { cities: NORDIC_CITIES, routes: NORDIC_ROUTES, layout: NORDIC_LAYOUT },
  india: { cities: INDIA_CITIES, routes: INDIA_ROUTES, layout: INDIA_LAYOUT },
};
