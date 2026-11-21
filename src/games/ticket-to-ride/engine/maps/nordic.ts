import type { GameMap } from './types';
import { NORDIC_CITIES, NORDIC_LAYOUT } from '../data/nordic/cities';
import { NORDIC_ROUTES } from '../data/nordic/routes';
import { NORDIC_TICKETS } from '../data/nordic/tickets';
import { DECK_COMPOSITION } from '../data/deck';

/**
 * The Nordic map: a tight board for 2 or 3, all fjords, ferries and mountain
 * tunnels. Locomotives are kept for the ferries and tunnels (and the one long
 * Arctic line), so they are drawn freely like any other card.
 */
export const NORDIC_MAP: GameMap = {
  id: 'nordic',
  name: 'Nordic',
  cities: NORDIC_CITIES,
  routes: NORDIC_ROUTES,
  modes: [
    {
      id: 'default',
      name: 'Default',
      tickets: NORDIC_TICKETS,
      setupDeal: 5,
      setupKeep: 2,
      setupDiscards: 'box',
      ticketDraw: 3,
      drawDiscards: 'box',
      bonuses: ['most-tickets'],
    },
  ],
  deck: DECK_COMPOSITION,
  startingTrains: 40,
  stationsPerPlayer: 0,
  minPlayers: 2,
  maxPlayers: 3,
  layout: NORDIC_LAYOUT,
  legendAt: [24, 150],
  rules: { locomotivesOnlySpecial: true, freeLocomotives: true, doublesFrom: 3 },
};
