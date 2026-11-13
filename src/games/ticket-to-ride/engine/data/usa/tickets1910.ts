import type { Ticket } from '../../types';

/**
 * USA "1910" expansion destination tickets — a best-effort reconstruction using
 * the base USA cities; verify point values against the physical game and tune here.
 */
const DEFS: [a: string, b: string, points: number][] = [
  ['boston', 'miami', 12],
  ['calgary', 'phoenix', 13],
  ['vancouver', 'santa-fe', 13],
  ['montreal', 'new-orleans', 13],
  ['toronto', 'miami', 10],
  ['duluth', 'el-paso', 10],
  ['winnipeg', 'houston', 12],
  ['sault-ste-marie', 'oklahoma-city', 9],
  ['seattle', 'new-york', 22],
  ['portland', 'nashville', 17],
  ['san-francisco', 'atlanta', 17],
  ['los-angeles', 'chicago', 16],
  ['denver', 'pittsburgh', 11],
  ['winnipeg', 'little-rock', 11],
  ['vancouver', 'montreal', 20],
  ['los-angeles', 'miami', 20],
  ['new-york', 'atlanta', 6],
  ['chicago', 'new-orleans', 7],
  ['calgary', 'salt-lake-city', 7],
  ['helena', 'los-angeles', 8],
  ['denver', 'el-paso', 4],
  ['kansas-city', 'houston', 5],
  ['chicago', 'santa-fe', 9],
  ['seattle', 'los-angeles', 9],
  ['dallas', 'new-york', 11],
  ['portland', 'phoenix', 11],
  ['montreal', 'atlanta', 9],
  ['pittsburgh', 'oklahoma-city', 9],
  ['saint-louis', 'dallas', 7],
  ['atlanta', 'duluth', 8],
];

export const TICKETS_1910: Ticket[] = DEFS.map(([a, b, points]) => ({
  id: `1910:${a}__${b}`,
  a,
  b,
  points,
}));
