import type { City } from '../../types';
import layoutJson from './layout.json';
import { asLayout } from '../layout';

/**
 * Cities of the Ticket to Ride EUROPE map. Positions (0-1000 x 0-700) live in
 * `europe.layout.json` – generated from real geography and tunable in the dev
 * board editor (`npm run dev`, then open `/?editor=europe`).
 */
const NAMES: [id: string, name: string][] = [
  ['edinburgh', 'Edinburgh'],
  ['london', 'London'],
  ['dieppe', 'Dieppe'],
  ['brest', 'Brest'],
  ['paris', 'Paris'],
  ['amsterdam', 'Amsterdam'],
  ['bruxelles', 'Bruxelles'],
  ['frankfurt', 'Frankfurt'],
  ['essen', 'Essen'],
  ['berlin', 'Berlin'],
  ['danzig', 'Danzig'],
  ['warszawa', 'Warszawa'],
  ['wilno', 'Wilno'],
  ['riga', 'Riga'],
  ['petersburg', 'Petersburg'],
  ['stockholm', 'Stockholm'],
  ['kobenhavn', 'Kobenhavn'],
  ['lisboa', 'Lisboa'],
  ['cadiz', 'Cadiz'],
  ['madrid', 'Madrid'],
  ['barcelona', 'Barcelona'],
  ['pamplona', 'Pamplona'],
  ['marseille', 'Marseille'],
  ['zurich', 'Zurich'],
  ['munchen', 'Munchen'],
  ['venezia', 'Venezia'],
  ['roma', 'Roma'],
  ['palermo', 'Palermo'],
  ['brindisi', 'Brindisi'],
  ['zagreb', 'Zagreb'],
  ['wien', 'Wien'],
  ['budapest', 'Budapest'],
  ['sarajevo', 'Sarajevo'],
  ['sofia', 'Sofia'],
  ['bucuresti', 'Bucuresti'],
  ['constantinople', 'Constantinople'],
  ['smyrna', 'Smyrna'],
  ['angora', 'Angora'],
  ['erzurum', 'Erzurum'],
  ['sevastopol', 'Sevastopol'],
  ['rostov', 'Rostov'],
  ['kharkov', 'Kharkov'],
  ['kyiv', 'Kyiv'],
  ['moskva', 'Moskva'],
  ['smolensk', 'Smolensk'],
  ['sochi', 'Sochi'],
  ['athina', 'Athina'],
];

/** Europe board layout (city positions + route bends), validated at load. */
export const EUROPE_LAYOUT = asLayout(layoutJson);

export const EUROPE_CITIES: City[] = NAMES.map(([id, name]) => {
  const pos = EUROPE_LAYOUT.cities[id];
  if (!pos) throw new Error(`europe.layout.json has no position for city "${id}"`);
  return { id, name, x: pos[0], y: pos[1] };
});
