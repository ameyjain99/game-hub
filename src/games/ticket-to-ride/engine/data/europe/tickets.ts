import type { Ticket } from '../../types';

/**
 * Ticket to Ride EUROPE destination tickets — a best-effort reconstruction;
 * verify point values against the physical game and tune here.
 */
const DEFS: [a: string, b: string, points: number][] = [
  ['edinburgh', 'paris', 7],
  ['london', 'berlin', 7],
  ['amsterdam', 'pamplona', 7],
  ['paris', 'wien', 8],
  ['paris', 'zagreb', 7],
  ['zurich', 'budapest', 6],
  ['brest', 'marseille', 7],
  ['frankfurt', 'smolensk', 13],
  ['berlin', 'roma', 9],
  ['berlin', 'bucuresti', 8],
  ['berlin', 'moskva', 12],
  ['kobenhavn', 'erzurum', 21],
  ['stockholm', 'wien', 11],
  ['warszawa', 'smolensk', 6],
  ['riga', 'bucuresti', 10],
  ['essen', 'kyiv', 10],
  ['venezia', 'constantinople', 10],
  ['athina', 'wilno', 11],
  ['roma', 'smyrna', 8],
  ['palermo', 'constantinople', 8],
  ['sarajevo', 'sevastopol', 8],
  ['madrid', 'dieppe', 8],
  ['barcelona', 'munchen', 8],
  ['brest', 'petersburg', 20],
  ['cadiz', 'stockholm', 21],
  ['lisboa', 'danzig', 20],
  ['brest', 'venezia', 8],
  ['smolensk', 'rostov', 8],
  ['angora', 'kharkov', 10],
  ['bruxelles', 'danzig', 9],
  ['amsterdam', 'wilno', 12],
  ['frankfurt', 'kobenhavn', 5],
];

export const EUROPE_TICKETS: Ticket[] = DEFS.map(([a, b, points]) => ({
  id: `${a}__${b}`,
  a,
  b,
  points,
}));
