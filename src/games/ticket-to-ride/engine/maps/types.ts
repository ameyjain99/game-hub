import type { City, MapId, Route, Ticket, TrainCard } from '../types';
import type { BoardLayout } from '../data/layout';

/** End-game bonus cards a mode can put in play (see `bonuses.ts`). */
export type BonusId = 'longest-path' | 'globetrotter';

/**
 * A way to play a map. Every map has at least one mode (the first, "Default");
 * some add more (e.g. USA 1910, Mega). A mode sets the destination-ticket deck,
 * how tickets are dealt and drawn, which bonus cards score, and its rulebook.
 */
export interface GameMode {
  id: string;
  name: string;
  tickets: Ticket[];
  /** Tickets dealt to each player at setup, and how many they must keep. */
  setupDeal: number;
  setupKeep: number;
  /**
   * How many of the setup deal come from the long-ticket deck (tickets with
   * `long`); the rest are regular. Undealt long tickets leave the game. When the
   * deck has no long tickets, the whole deal is regular.
   */
  setupLong?: number;
  /** Where unkept setup tickets go: under the ticket pile, or out of the game. */
  setupDiscards: 'bottom' | 'box';
  /** Tickets drawn on a draw-tickets turn (the player keeps at least 1). */
  ticketDraw: number;
  bonuses: BonusId[];
  /** URL of the rulebook PDF (see `rulebookUrl`), opened in a new tab. */
  rulebook?: string;
}

/** A complete board/game definition: data + rules parameters for one map. */
export interface GameMap {
  id: MapId;
  name: string;
  cities: City[];
  routes: Route[];
  /** Playable modes; the first is the default. */
  modes: GameMode[];
  /** Full train-card deck composition. */
  deck: Record<TrainCard, number>;
  startingTrains: number;
  /** Train stations each player starts with (Europe: 3; USA: 0). */
  stationsPerPlayer: number;
  minPlayers: number;
  maxPlayers: number;
  layout: BoardLayout;
}
