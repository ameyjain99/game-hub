import type { Difficulty, GameState, MapId, PlayerState, Ticket } from './types';
import { makeRng } from '../../../shared/rng';
import { buildDrawPile, dealMarket, drawOne, emptyHand } from './deck';
import { DEFAULT_MAP_ID, getMap, ticketsFor } from './maps';

export interface PlayerConfig {
  name: string;
  isAI: boolean;
  difficulty?: Difficulty;
  /** Chosen avatar (emoji); optional. */
  avatar?: string;
}

const STARTING_HAND = 4;
const SETUP_TICKETS = 3;

function shuffle<T>(arr: T[], rng: { next(): number }): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGame(
  configs: PlayerConfig[],
  seed: number,
  mapId: MapId = DEFAULT_MAP_ID,
  modeId?: string,
): GameState {
  const map = getMap(mapId);
  const tickets = ticketsFor(mapId, modeId);
  if (configs.length < map.minPlayers || configs.length > map.maxPlayers) {
    throw new Error(`${map.name} supports ${map.minPlayers}-${map.maxPlayers} players`);
  }

  const rng = makeRng(seed);

  let state: GameState = {
    mapId,
    players: [],
    current: 0,
    phase: 'setup-tickets',
    drawnThisTurn: 0,
    drawPile: buildDrawPile(rng, map.deck),
    discardPile: [],
    market: [],
    ticketPile: shuffle<Ticket>(tickets, rng),
    claimedBy: {},
    finalTurnsLeft: null,
    pendingTunnel: null,
    rngState: rng.state,
    log: [],
  };

  const players: PlayerState[] = configs.map((c, i) => ({
    id: `p${i}`,
    name: c.name,
    avatar: c.avatar ?? '',
    isAI: c.isAI,
    difficulty: c.difficulty,
    hand: emptyHand(),
    trainsLeft: map.startingTrains,
    claimedRouteIds: [],
    tickets: [],
    pendingTickets: [],
    stationsLeft: map.stationsPerPlayer,
    stations: [],
    score: 0,
  }));

  // Deal starting train cards.
  for (const p of players) {
    for (let i = 0; i < STARTING_HAND; i++) {
      const { card, state: after } = drawOne(state);
      state = after;
      if (card) p.hand[card]++;
    }
  }

  // Deal setup destination tickets from the top of the ticket pile.
  const ticketPile = [...state.ticketPile];
  for (const p of players) {
    p.pendingTickets = ticketPile.splice(0, SETUP_TICKETS);
  }
  state = { ...state, ticketPile, players };

  // Fill the face-up market (with the 3-locomotive redeal rule).
  state = dealMarket(state);

  return state;
}
