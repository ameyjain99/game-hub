import type { GameMap } from './types';
import { CITIES, USA_LAYOUT } from '../data/usa/cities';
import { ROUTES } from '../data/usa/routes';
import { TICKETS } from '../data/usa/tickets';
import { TICKETS_1910, TICKETS_1910_REPRINTS } from '../data/usa/tickets1910';
import { DECK_COMPOSITION } from '../data/deck';

/** The Big Cities of the USA 1910 rulebook's Big Cities mode. */
export const BIG_CITIES = new Set(['chicago', 'dallas', 'houston', 'los-angeles', 'miami', 'new-york', 'seattle']);

/** Ticket to Ride USA base game. No tunnels, ferries, or stations. */
export const USA_MAP: GameMap = {
  id: 'usa',
  name: 'USA',
  cities: CITIES,
  routes: ROUTES,
  // Ticket counts and bonus cards per the USA 1910 rulebook (usa_expansion.pdf).
  modes: [
    {
      id: 'default',
      name: 'Default',
      tickets: TICKETS,
      setupDeal: 3,
      setupKeep: 2,
      setupDiscards: 'bottom',
      ticketDraw: 3,
      bonuses: ['longest-path'],
    },
    {
      id: '1910',
      name: '1910',
      tickets: TICKETS_1910,
      setupDeal: 3,
      setupKeep: 2,
      setupDiscards: 'bottom',
      ticketDraw: 3,
      bonuses: ['globetrotter'],
    },
    {
      id: 'mega',
      name: 'Mega (all)',
      tickets: [...TICKETS_1910, ...TICKETS_1910_REPRINTS],
      setupDeal: 5,
      setupKeep: 3,
      setupDiscards: 'bottom',
      ticketDraw: 4,
      bonuses: ['longest-path', 'globetrotter'],
    },
    {
      // Every ticket naming at least one big city (35 of the 69). The rulebook
      // changes only the tickets, so the standard Longest Path bonus scores.
      id: 'big-cities',
      name: 'Big Cities',
      tickets: [...TICKETS_1910, ...TICKETS_1910_REPRINTS].filter((t) => BIG_CITIES.has(t.a) || BIG_CITIES.has(t.b)),
      setupDeal: 4,
      setupKeep: 2,
      setupDiscards: 'bottom',
      ticketDraw: 4,
      bonuses: ['longest-path'],
    },
  ],
  deck: DECK_COMPOSITION,
  startingTrains: 45,
  stationsPerPlayer: 0,
  minPlayers: 2,
  maxPlayers: 5,
  layout: USA_LAYOUT,
};
