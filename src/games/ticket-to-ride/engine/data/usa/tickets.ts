import type { Ticket } from '../../types';

/** 30 destination tickets of the Ticket to Ride USA base game. */
const DEFS: [a: string, b: string, points: number][] = [
  ['denver', 'el-paso', 4],
  ['kansas-city', 'houston', 5],
  ['new-york', 'atlanta', 6],
  ['chicago', 'new-orleans', 7],
  ['calgary', 'salt-lake-city', 7],
  ['helena', 'los-angeles', 8],
  ['duluth', 'houston', 8],
  ['sault-ste-marie', 'nashville', 8],
  ['montreal', 'atlanta', 9],
  ['sault-ste-marie', 'oklahoma-city', 9],
  ['seattle', 'los-angeles', 9],
  ['chicago', 'santa-fe', 9],
  ['duluth', 'el-paso', 10],
  ['toronto', 'miami', 10],
  ['portland', 'phoenix', 11],
  ['dallas', 'new-york', 11],
  ['denver', 'pittsburgh', 11],
  ['winnipeg', 'little-rock', 11],
  ['winnipeg', 'houston', 12],
  ['boston', 'miami', 12],
  ['vancouver', 'santa-fe', 13],
  ['calgary', 'phoenix', 13],
  ['montreal', 'new-orleans', 13],
  ['los-angeles', 'chicago', 16],
  ['portland', 'nashville', 17],
  ['san-francisco', 'atlanta', 17],
  ['vancouver', 'montreal', 20],
  ['los-angeles', 'miami', 20],
  ['los-angeles', 'new-york', 21],
  ['seattle', 'new-york', 22],
];

export const TICKETS: Ticket[] = DEFS.map(([a, b, points]) => ({
  id: `${a}__${b}`,
  a,
  b,
  points,
}));
