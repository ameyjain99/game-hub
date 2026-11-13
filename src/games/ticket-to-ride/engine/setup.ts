import type { Difficulty, GameState, MapId, PlayerState, Ticket } from './types';
import { makeRng } from '../../../shared/rng';
import { buildDrawPile, dealMarket, drawOne, emptyHand } from './deck';
import { DEFAULT_MAP_ID, getMap, modeFor, type GameMode } from './maps';

export interface PlayerConfig {
  name: string;
  isAI: boolean;
  difficulty?: Difficulty;
  /** Chosen avatar (emoji); optional. */
  avatar?: string;
}

const STARTING_HAND = 4;

function shuffle<T>(arr: T[], rng: { next(): number }): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle a mode's tickets and deal each player's setup hand: up to
 * `setupLong` long tickets, topped up to `setupDeal` with regular ones. The
 * draw pile keeps only the undealt regular tickets; undealt long tickets
 * leave the game, as the rulebook puts them back in the box.
 */
export function dealSetupTickets(
  mode: GameMode,
  playerCount: number,
  rng: { next(): number },
): { hands: Ticket[][]; pile: Ticket[] } {
  const long = shuffle(mode.tickets.filter((t) => t.long), rng);
  const pile = shuffle(mode.tickets.filter((t) => !t.long), rng);
  const hands = Array.from({ length: playerCount }, () => {
    const dealtLong = long.splice(0, mode.setupLong ?? 0);
    return [...dealtLong, ...pile.splice(0, mode.setupDeal - dealtLong.length)];
  });
  return { hands, pile };
}

export function createGame(
  configs: PlayerConfig[],
  seed: number,
  mapId: MapId = DEFAULT_MAP_ID,
  modeId?: string,
): GameState {
  const map = getMap(mapId);
  const mode = modeFor(mapId, modeId);
  if (configs.length < map.minPlayers || configs.length > map.maxPlayers) {
    throw new Error(`${map.name} supports ${map.minPlayers}-${map.maxPlayers} players`);
  }

  const rng = makeRng(seed);
  // Same RNG order as always (train deck, then tickets) so seeds replay identically.
  const drawPile = buildDrawPile(rng, map.deck);
  const tickets = dealSetupTickets(mode, configs.length, rng);

  let state: GameState = {
    mapId,
    modeId: mode.id,
    players: [],
    current: 0,
    phase: 'setup-tickets',
    drawnThisTurn: 0,
    drawPile,
    discardPile: [],
    market: [],
    ticketPile: tickets.pile,
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

  players.forEach((p, i) => (p.pendingTickets = tickets.hands[i]));
  state = { ...state, players };

  // Fill the face-up market (with the 3-locomotive redeal rule).
  state = dealMarket(state);

  return state;
}
