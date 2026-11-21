import type { City } from '../../types';
import layoutJson from './layout.json';
import { asLayout } from '../layout';

/**
 * Cities of the Nordic map. Positions (0-1000 x 0-700) live in
 * `layout.json`: placed from real latitude and longitude, stretched to fill
 * the board, and tunable in the dev board editor (`/?editor=nordic`).
 * Ids carry the map's prefix so they never clash with another map's cities.
 */
const NAMES: [id: string, name: string][] = [
  ['n-kobenhavn', 'Kobenhavn'],
  ['n-aarhus', 'Aarhus'],
  ['n-aalborg', 'Aalborg'],
  ['n-oslo', 'Oslo'],
  ['n-kristiansand', 'Kristiansand'],
  ['n-stavanger', 'Stavanger'],
  ['n-bergen', 'Bergen'],
  ['n-alesund', 'Alesund'],
  ['n-trondheim', 'Trondheim'],
  ['n-lillehammer', 'Lillehammer'],
  ['n-moirana', 'Mo i Rana'],
  ['n-bodo', 'Bodo'],
  ['n-narvik', 'Narvik'],
  ['n-tromso', 'Tromso'],
  ['n-kirkenes', 'Kirkenes'],
  ['n-alta', 'Alta'],
  ['n-goteborg', 'Goteborg'],
  ['n-karlskrona', 'Karlskrona'],
  ['n-stockholm', 'Stockholm'],
  ['n-orebro', 'Orebro'],
  ['n-norrkoping', 'Norrkoping'],
  ['n-sundsvall', 'Sundsvall'],
  ['n-ostersund', 'Ostersund'],
  ['n-umea', 'Umea'],
  ['n-lulea', 'Lulea'],
  ['n-kiruna', 'Kiruna'],
  ['n-helsinki', 'Helsinki'],
  ['n-turku', 'Turku'],
  ['n-tampere', 'Tampere'],
  ['n-vaasa', 'Vaasa'],
  ['n-oulu', 'Oulu'],
  ['n-kuopio', 'Kuopio'],
  ['n-rovaniemi', 'Rovaniemi'],
  ['n-kajaani', 'Kajaani'],
  ['n-lahti', 'Lahti'],
  ['n-tallinn', 'Tallinn'],
  ['n-murmansk', 'Murmansk'],
];

/** Nordic board layout (city positions + route bends), validated at load. */
export const NORDIC_LAYOUT = asLayout(layoutJson);

export const NORDIC_CITIES: City[] = NAMES.map(([id, name]) => {
  const pos = NORDIC_LAYOUT.cities[id];
  if (!pos) throw new Error(`nordic/layout.json has no position for city "${id}"`);
  return { id, name, x: pos[0], y: pos[1] };
});
