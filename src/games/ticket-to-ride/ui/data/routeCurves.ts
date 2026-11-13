import type { Route } from '../../engine/types';
import type { Bend } from '../geometry';
import { USA_LAYOUT } from '../../engine/data/usa/cities';

/** Both rails of a double route share one curve (offset either side of it). */
export function bendKey(route: Route): string {
  return route.parallelGroup ?? route.id;
}

/**
 * Per-route bows traced from the printed USA board (`bends` in `usa.layout.json`):
 * `[dx, dy]` is how far the route's midpoint sits from the straight line between
 * its cities (board units). Routes not listed are straight. Edit them in the dev
 * board editor (`npm run dev`, then open `/?editor=usa`), whose Save rewrites the JSON.
 */
export const ROUTE_BENDS: Record<string, Bend> = USA_LAYOUT.bends;
