import { makeRng, type Rng } from '../../../shared/rng';
import { setupCluedo } from './setup';
import { SUSPECTS, WEAPONS, ROOMS, type Card, type Room, type Suspect, type Weapon, type Triple } from './cards';

/** Turn phases: roll a die → move to a room → decide (suggest/accuse/end); a
 * suggestion may pause on `disprove`; `over` once someone wins or all are out. */
export type Phase = 'roll' | 'move' | 'decide' | 'disprove' | 'over';

/** Bot strength: 'easy' wanders and suggests without a plan (accusing only once
 * certain); 'normal' moves and suggests to learn, and accuses when sure. */
export type CluedoDifficulty = 'easy' | 'normal';

export interface CluedoPlayer {
  id: string;
  /** The character token this player controls. */
  suspect: Suspect;
  /** Current room, or null while in the hallway (game start). */
  room: Room | null;
  /** Private hand of cards. */
  hand: Card[];
  /** Out after a wrong accusation — keeps disproving but can't win. */
  eliminated: boolean;
  isAI: boolean;
  /** Bot strength (bots only); undefined is treated as 'normal'. */
  difficulty?: CluedoDifficulty;
}

/** The outcome of a suggestion: who showed which card (card known only to the
 * suggester and disprover; redaction hides it from everyone else). */
export interface Reveal {
  suggester: string;
  suggestion: Triple;
  disprover: string | null;
  card: Card | null;
}

export interface CluedoState {
  players: CluedoPlayer[];
  current: number;
  phase: Phase;
  /** The hidden murder envelope — stripped from client state by redaction. */
  solution: Triple;
  weaponRooms: Record<Weapon, Room>;
  /** Valid destinations while phase === 'move'. */
  moveOptions: Room[];
  pendingSuggestion: Triple | null;
  pendingDisprover: string | null;
  lastReveal: Reveal | null;
  /** Every resolved suggestion, oldest first (the public game log). */
  history: Reveal[];
  winner: string | null;
  /** Turns taken so far — a safety net so a game can't run forever. */
  turn: number;
  /** Seeded RNG state, advanced on each die roll. */
  rngState: number;
}

/** Place each weapon in a distinct random room. */
function placeWeapons(rng: Rng): Record<Weapon, Room> {
  const rooms = [...ROOMS];
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  }
  const out = {} as Record<Weapon, Room>;
  WEAPONS.forEach((w, i) => {
    out[w] = rooms[i];
  });
  return out;
}

/** Start a new game: deal the envelope + hands, assign suspects, place weapons. */
export function createCluedoGame(
  playerIds: string[],
  opts: { seed: number; ai?: boolean[]; difficulty?: CluedoDifficulty[] },
): CluedoState {
  const rng = makeRng(opts.seed);
  const { solution, hands } = setupCluedo(playerIds, rng);
  const players: CluedoPlayer[] = playerIds.map((id, i) => ({
    id,
    suspect: SUSPECTS[i],
    room: null,
    hand: hands[id],
    eliminated: false,
    isAI: opts.ai?.[i] ?? false,
    difficulty: opts.difficulty?.[i] ?? 'normal',
  }));
  const weaponRooms = placeWeapons(rng);
  return {
    players,
    current: 0,
    phase: 'roll',
    solution,
    weaponRooms,
    moveOptions: [],
    pendingSuggestion: null,
    pendingDisprover: null,
    lastReveal: null,
    history: [],
    winner: null,
    turn: 0,
    rngState: rng.state,
  };
}
