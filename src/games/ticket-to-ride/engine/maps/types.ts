import type { City, MapId, Route, Ticket, TrainCard } from '../types';
import type { BoardLayout } from '../data/layout';

/**
 * A way to play a map. Every map has at least one mode (the first, "Default");
 * some add more (e.g. USA 1910, Mega). A mode swaps the destination-ticket set
 * and links its rulebook.
 */
export interface GameMode {
  id: string;
  name: string;
  tickets: Ticket[];
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
