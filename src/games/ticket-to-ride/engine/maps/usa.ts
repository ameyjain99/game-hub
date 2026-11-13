import type { GameMap } from './types';
import { rulebookUrl } from './rulebook';
import { CITIES, USA_LAYOUT } from '../data/usa/cities';
import { ROUTES } from '../data/usa/routes';
import { TICKETS } from '../data/usa/tickets';
import { TICKETS_1910, TICKETS_1910_REPRINTS } from '../data/usa/tickets1910';
import { DECK_COMPOSITION } from '../data/deck';

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
      ticketDraw: 3,
      bonuses: ['longest-path'],
      rulebook: rulebookUrl('usa.pdf'),
    },
    {
      id: '1910',
      name: '1910',
      tickets: TICKETS_1910,
      setupDeal: 3,
      setupKeep: 2,
      ticketDraw: 3,
      bonuses: ['globetrotter'],
      rulebook: rulebookUrl('usa_expansion.pdf'),
    },
    {
      id: 'mega',
      name: 'Mega (all)',
      tickets: [...TICKETS_1910, ...TICKETS_1910_REPRINTS],
      setupDeal: 5,
      setupKeep: 3,
      ticketDraw: 4,
      bonuses: ['longest-path', 'globetrotter'],
      rulebook: rulebookUrl('usa_expansion.pdf'),
    },
  ],
  deck: DECK_COMPOSITION,
  startingTrains: 45,
  stationsPerPlayer: 0,
  minPlayers: 2,
  maxPlayers: 5,
  layout: USA_LAYOUT,
};
