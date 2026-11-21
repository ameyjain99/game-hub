import type { GameMap } from './types';
import { INDIA_CITIES, INDIA_LAYOUT } from '../data/india/cities';
import { INDIA_ROUTES } from '../data/india/routes';
import { INDIA_TICKETS } from '../data/india/tickets';
import { DECK_COMPOSITION } from '../data/deck';

/**
 * The India map, for 2 to 4: a crowded network of short routes and loops. The
 * Grand Tour rewards joining a ticket's cities twice over, by two ways that
 * share no route.
 */
export const INDIA_MAP: GameMap = {
  id: 'india',
  name: 'India',
  cities: INDIA_CITIES,
  routes: INDIA_ROUTES,
  modes: [
    {
      id: 'default',
      name: 'Default',
      tickets: INDIA_TICKETS,
      setupDeal: 4,
      setupKeep: 2,
      setupDiscards: 'bottom',
      ticketDraw: 3,
      bonuses: ['longest-path', 'grand-tour'],
    },
  ],
  deck: DECK_COMPOSITION,
  startingTrains: 45,
  stationsPerPlayer: 0,
  minPlayers: 2,
  maxPlayers: 4,
  layout: INDIA_LAYOUT,
  legendAt: [40, 684],
};
