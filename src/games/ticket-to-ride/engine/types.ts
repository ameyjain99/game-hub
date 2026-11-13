export type CardColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'white'
  | 'black';

export const CARD_COLORS: CardColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'white',
  'black',
];

/** A route's required color; 'grey' means any single color. */
export type RouteColor = CardColor | 'grey';

/** A physical train-car card in hand/deck: a color or a wild locomotive. */
export type TrainCard = CardColor | 'locomotive';

export interface City {
  id: string;
  name: string;
  /** Layout coordinates on a 0-1000 x 0-700 board. */
  x: number;
  y: number;
}

export interface Route {
  id: string;
  a: string;
  b: string;
  color: RouteColor;
  length: number;
  /** Locomotives required (ferries); 0 for normal land routes. */
  locomotivesRequired: number;
  /** Both siblings of a double route share this key. */
  parallelGroup?: string;
  /** Europe tunnels: claiming flips 3 cards and may demand extra matching cards. */
  isTunnel?: boolean;
}

export interface Ticket {
  id: string;
  a: string;
  b: string;
  points: number;
}

export type Hand = Record<TrainCard, number>;

export interface PlayerState {
  id: string;
  name: string;
  /** The player's chosen avatar (an emoji); empty string if none. */
  avatar: string;
  isAI: boolean;
  difficulty?: Difficulty;
  hand: Hand;
  trainsLeft: number;
  claimedRouteIds: string[];
  tickets: Ticket[];
  /** Tickets dealt but not yet confirmed (setup or DRAW_TICKETS). */
  pendingTickets: Ticket[];
  /** Train stations not yet placed (Europe). Each unused one scores 4 at game end. */
  stationsLeft: number;
  /** City ids where this player has placed a station. */
  stations: string[];
  score: number;
  /** Removed mid-game: their cards and routes were returned to the pools, and
   *  they take no further turns and are excluded from the final scores. */
  removed?: boolean;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Phase =
  | 'setup-tickets'
  | 'turn'
  | 'draw-tickets'
  | 'tunnel-decision'
  | 'game-over';

/** Which board/game is being played, e.g. 'usa' or 'europe'. */
export type MapId = string;

/** A tunnel claim awaiting the player's decision after the 3-card reveal. */
export interface PendingTunnel {
  routeId: string;
  /** The base payment the player offered. */
  combo: CardCombo;
  /** The 3 cards flipped from the deck (public). */
  flipped: TrainCard[];
  /** Extra matching cards now required to complete the claim. */
  extra: number;
}

export interface GameState {
  /** The map this game is played on. */
  mapId: MapId;
  players: PlayerState[];
  current: number;
  phase: Phase;
  drawnThisTurn: number;
  drawPile: TrainCard[];
  discardPile: TrainCard[];
  market: TrainCard[];
  ticketPile: Ticket[];
  /** routeId -> playerId of the owner. */
  claimedBy: Record<string, string>;
  /** null until the end trigger fires, then counts final turns remaining. */
  finalTurnsLeft: number | null;
  /** Set during the 'tunnel-decision' phase; null otherwise. */
  pendingTunnel: PendingTunnel | null;
  rngState: number;
  log: string[];
}

/** How a player pays for a route: some colored cards + some locomotives. */
export interface CardCombo {
  /** The colored card used (undefined if paid entirely with locomotives). */
  color?: CardColor;
  colorCount: number;
  locomotives: number;
}
