import type { GameMap } from './types';
import { rulebookUrl } from './rulebook';
import { EUROPE_CITIES, EUROPE_LAYOUT } from '../data/europe/cities';
import { EUROPE_ROUTES } from '../data/europe/routes';
import { EUROPE_TICKETS } from '../data/europe/tickets';
import { DECK_COMPOSITION } from '../data/deck';

/** Ticket to Ride Europe: tunnels, ferries, and 3 train stations per player. */
export const EUROPE_MAP: GameMap = {
  id: 'europe',
  name: 'Europe',
  cities: EUROPE_CITIES,
  routes: EUROPE_ROUTES,
  modes: [{ id: 'default', name: 'Default', tickets: EUROPE_TICKETS, rulebook: rulebookUrl('europe.pdf') }],
  deck: DECK_COMPOSITION,
  startingTrains: 45,
  stationsPerPlayer: 3,
  minPlayers: 2,
  maxPlayers: 5,
  layout: EUROPE_LAYOUT,
};
