import type { Ticket } from '../../types';

type Def = [a: string, b: string, points: number];

/**
 * The 40 regular destination tickets of Ticket to Ride Europe (blue background).
 * City pairs and point values cross-checked between two open-source
 * implementations (thoun/tickettoride on Board Game Arena and
 * fernandomsilva/Ticket-to-Ride-Engine), which agree on every card.
 */
const REGULAR: Def[] = [
  ['athina', 'angora', 5],
  ['budapest', 'sofia', 5],
  ['frankfurt', 'kobenhavn', 5],
  ['rostov', 'erzurum', 5],
  ['sofia', 'smyrna', 5],
  ['kyiv', 'petersburg', 6],
  ['warszawa', 'smolensk', 6],
  ['zagreb', 'brindisi', 6],
  ['zurich', 'brindisi', 6],
  ['zurich', 'budapest', 6],
  ['amsterdam', 'pamplona', 7],
  ['brest', 'marseille', 7],
  ['edinburgh', 'paris', 7],
  ['london', 'berlin', 7],
  ['paris', 'zagreb', 7],
  ['barcelona', 'bruxelles', 8],
  ['barcelona', 'munchen', 8],
  ['berlin', 'bucuresti', 8],
  ['brest', 'venezia', 8],
  ['kyiv', 'sochi', 8],
  ['madrid', 'dieppe', 8],
  ['madrid', 'zurich', 8],
  ['marseille', 'essen', 8],
  ['palermo', 'constantinople', 8],
  ['paris', 'wien', 8],
  ['roma', 'smyrna', 8],
  ['sarajevo', 'sevastopol', 8],
  ['smolensk', 'rostov', 8],
  ['berlin', 'roma', 9],
  ['bruxelles', 'danzig', 9],
  ['angora', 'kharkov', 10],
  ['essen', 'kyiv', 10],
  ['london', 'wien', 10],
  ['riga', 'bucuresti', 10],
  ['venezia', 'constantinople', 10],
  ['athina', 'wilno', 11],
  ['stockholm', 'wien', 11],
  ['amsterdam', 'wilno', 12],
  ['berlin', 'moskva', 12],
  ['frankfurt', 'smolensk', 13],
];

/**
 * The 6 long-route tickets (green background), dealt from their own deck: each
 * player gets 1 long + 3 regular at setup, and undealt long tickets leave the
 * game. Same two-source cross-check as the regular tickets.
 */
const LONG: Def[] = [
  ['cadiz', 'stockholm', 21],
  ['edinburgh', 'athina', 21],
  ['kobenhavn', 'erzurum', 21],
  ['brest', 'petersburg', 20],
  ['lisboa', 'danzig', 20],
  ['palermo', 'moskva', 20],
];

const toTicket = ([a, b, points]: Def, long = false): Ticket => ({
  id: `${a}__${b}`,
  a,
  b,
  points,
  ...(long ? { long: true } : {}),
});

export const EUROPE_TICKETS: Ticket[] = [...REGULAR.map((d) => toTicket(d)), ...LONG.map((d) => toTicket(d, true))];
