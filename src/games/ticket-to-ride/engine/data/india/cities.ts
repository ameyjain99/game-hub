import type { City } from '../../types';
import layoutJson from './layout.json';
import { asLayout } from '../layout';

/**
 * Cities of the India map. Positions (0-1000 x 0-700) live in
 * `layout.json`: placed from real latitude and longitude, stretched to fill
 * the board, and tunable in the dev board editor (`/?editor=india`).
 * Ids carry the map's prefix so they never clash with another map's cities.
 */
const NAMES: [id: string, name: string][] = [
  ['i-karachi', 'Karachi'],
  ['i-lahore', 'Lahore'],
  ['i-srinagar', 'Srinagar'],
  ['i-shimla', 'Shimla'],
  ['i-delhi', 'Delhi'],
  ['i-jaipur', 'Jaipur'],
  ['i-jodhpur', 'Jodhpur'],
  ['i-ahmedabad', 'Ahmedabad'],
  ['i-agra', 'Agra'],
  ['i-lucknow', 'Lucknow'],
  ['i-kathmandu', 'Kathmandu'],
  ['i-varanasi', 'Varanasi'],
  ['i-patna', 'Patna'],
  ['i-siliguri', 'Siliguri'],
  ['i-guwahati', 'Guwahati'],
  ['i-dibrugarh', 'Dibrugarh'],
  ['i-imphal', 'Imphal'],
  ['i-dhaka', 'Dhaka'],
  ['i-chittagong', 'Chittagong'],
  ['i-kolkata', 'Kolkata'],
  ['i-ranchi', 'Ranchi'],
  ['i-bhopal', 'Bhopal'],
  ['i-indore', 'Indore'],
  ['i-nagpur', 'Nagpur'],
  ['i-raipur', 'Raipur'],
  ['i-bhubaneswar', 'Bhubaneswar'],
  ['i-mumbai', 'Mumbai'],
  ['i-pune', 'Pune'],
  ['i-hyderabad', 'Hyderabad'],
  ['i-vizag', 'Visakhapatnam'],
  ['i-goa', 'Goa'],
  ['i-bengaluru', 'Bengaluru'],
  ['i-mangaluru', 'Mangaluru'],
  ['i-chennai', 'Chennai'],
  ['i-kochi', 'Kochi'],
  ['i-madurai', 'Madurai'],
  ['i-colombo', 'Colombo'],
];

/** India board layout (city positions + route bends), validated at load. */
export const INDIA_LAYOUT = asLayout(layoutJson);

export const INDIA_CITIES: City[] = NAMES.map(([id, name]) => {
  const pos = INDIA_LAYOUT.cities[id];
  if (!pos) throw new Error(`india/layout.json has no position for city "${id}"`);
  return { id, name, x: pos[0], y: pos[1] };
});
