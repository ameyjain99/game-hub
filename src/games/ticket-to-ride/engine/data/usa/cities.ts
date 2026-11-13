import type { City } from '../../types';
import layoutJson from './layout.json';
import { asLayout } from '../layout';

/**
 * 36 cities of the Ticket to Ride USA map. Board positions (0-1000 x 0-700,
 * x: west->east, y: north->south) live in `usa.layout.json`, which the dev
 * board editor (`npm run dev`, then open `/?editor=usa`) rewrites on Save.
 */
const NAMES: [id: string, name: string][] = [
  ['vancouver', 'Vancouver'],
  ['seattle', 'Seattle'],
  ['portland', 'Portland'],
  ['san-francisco', 'San Francisco'],
  ['los-angeles', 'Los Angeles'],
  ['las-vegas', 'Las Vegas'],
  ['salt-lake-city', 'Salt Lake City'],
  ['helena', 'Helena'],
  ['calgary', 'Calgary'],
  ['winnipeg', 'Winnipeg'],
  ['duluth', 'Duluth'],
  ['phoenix', 'Phoenix'],
  ['santa-fe', 'Santa Fe'],
  ['denver', 'Denver'],
  ['el-paso', 'El Paso'],
  ['omaha', 'Omaha'],
  ['kansas-city', 'Kansas City'],
  ['oklahoma-city', 'Oklahoma City'],
  ['dallas', 'Dallas'],
  ['houston', 'Houston'],
  ['little-rock', 'Little Rock'],
  ['new-orleans', 'New Orleans'],
  ['saint-louis', 'Saint Louis'],
  ['chicago', 'Chicago'],
  ['sault-ste-marie', 'Sault St. Marie'],
  ['toronto', 'Toronto'],
  ['pittsburgh', 'Pittsburgh'],
  ['nashville', 'Nashville'],
  ['atlanta', 'Atlanta'],
  ['charleston', 'Charleston'],
  ['miami', 'Miami'],
  ['montreal', 'Montreal'],
  ['boston', 'Boston'],
  ['new-york', 'New York'],
  ['washington', 'Washington'],
  ['raleigh', 'Raleigh'],
];

/** USA board layout (city positions + route bends), validated at load. */
export const USA_LAYOUT = asLayout(layoutJson);

export const CITIES: City[] = NAMES.map(([id, name]) => {
  const pos = USA_LAYOUT.cities[id];
  if (!pos) throw new Error(`usa.layout.json has no position for city "${id}"`);
  return { id, name, x: pos[0], y: pos[1] };
});
