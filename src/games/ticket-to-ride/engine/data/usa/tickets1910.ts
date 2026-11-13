import type { Ticket } from '../../types';

type Def = [a: string, b: string, points: number];

/**
 * The 35 new destination tickets of the USA 1910 expansion (1910 logo).
 * Values match the Board Game Arena implementation and an independent engine
 * (fernandomsilva/Ticket-to-Ride-Engine), which agree on every card.
 */
const NEW_1910: Def[] = [
  ['calgary', 'nashville', 14],
  ['chicago', 'atlanta', 5],
  ['chicago', 'boston', 7],
  ['chicago', 'new-york', 5],
  ['denver', 'saint-louis', 6],
  ['duluth', 'dallas', 7],
  ['houston', 'washington', 10],
  ['kansas-city', 'boston', 11],
  ['las-vegas', 'miami', 21],
  ['las-vegas', 'new-york', 19],
  ['los-angeles', 'atlanta', 15],
  ['los-angeles', 'calgary', 12],
  ['los-angeles', 'oklahoma-city', 9],
  ['montreal', 'dallas', 13],
  ['montreal', 'raleigh', 7],
  ['nashville', 'new-york', 6],
  ['new-york', 'miami', 10],
  ['omaha', 'new-orleans', 8],
  ['phoenix', 'boston', 19],
  ['pittsburgh', 'new-orleans', 8],
  ['portland', 'houston', 16],
  ['portland', 'pittsburgh', 19],
  ['salt-lake-city', 'chicago', 11],
  ['salt-lake-city', 'kansas-city', 7],
  ['san-francisco', 'sault-ste-marie', 17],
  ['san-francisco', 'washington', 21],
  ['sault-ste-marie', 'miami', 12],
  ['seattle', 'las-vegas', 10],
  ['seattle', 'oklahoma-city', 14],
  ['saint-louis', 'miami', 8],
  ['toronto', 'charleston', 6],
  ['vancouver', 'denver', 11],
  ['vancouver', 'duluth', 13],
  ['washington', 'atlanta', 4],
  ['winnipeg', 'santa-fe', 10],
];

/**
 * The expansion's large-format reprints of the original deck, used by the Mega
 * Game: the 30 standard tickets (4 revised downward: Los Angeles-Miami 19,
 * Los Angeles-New York 20, Sault St. Marie-Oklahoma City 8, Seattle-New York 20)
 * plus 4 from the Mystery Train promo (Boston-Washington, Montreal-Chicago,
 * Vancouver-Portland, Winnipeg-Omaha).
 */
const REPRINTS: Def[] = [
  ['boston', 'miami', 12],
  ['boston', 'washington', 4],
  ['calgary', 'phoenix', 13],
  ['calgary', 'salt-lake-city', 7],
  ['chicago', 'new-orleans', 7],
  ['chicago', 'santa-fe', 9],
  ['dallas', 'new-york', 11],
  ['denver', 'el-paso', 4],
  ['denver', 'pittsburgh', 11],
  ['duluth', 'el-paso', 10],
  ['duluth', 'houston', 8],
  ['helena', 'los-angeles', 8],
  ['kansas-city', 'houston', 5],
  ['los-angeles', 'chicago', 16],
  ['los-angeles', 'miami', 19],
  ['los-angeles', 'new-york', 20],
  ['montreal', 'atlanta', 9],
  ['montreal', 'chicago', 7],
  ['montreal', 'new-orleans', 13],
  ['new-york', 'atlanta', 6],
  ['portland', 'nashville', 17],
  ['portland', 'phoenix', 11],
  ['san-francisco', 'atlanta', 17],
  ['sault-ste-marie', 'nashville', 8],
  ['sault-ste-marie', 'oklahoma-city', 8],
  ['seattle', 'los-angeles', 9],
  ['seattle', 'new-york', 20],
  ['toronto', 'miami', 10],
  ['vancouver', 'montreal', 20],
  ['vancouver', 'portland', 2],
  ['vancouver', 'santa-fe', 13],
  ['winnipeg', 'houston', 12],
  ['winnipeg', 'little-rock', 11],
  ['winnipeg', 'omaha', 6],
];

const toTickets = (defs: Def[], prefix: string): Ticket[] =>
  defs.map(([a, b, points]) => ({ id: `${prefix}${a}__${b}`, a, b, points }));

export const TICKETS_1910: Ticket[] = toTickets(NEW_1910, '1910:');
export const TICKETS_1910_REPRINTS: Ticket[] = toTickets(REPRINTS, '');
