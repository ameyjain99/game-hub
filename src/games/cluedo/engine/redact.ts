import type { Card, Room, Suspect, Weapon, Triple } from './cards';
import type { CluedoState, Phase } from './state';

export interface RedactedPlayer {
  id: string;
  suspect: Suspect;
  room: Room | null;
  eliminated: boolean;
  isAI: boolean;
  handCount: number;
  /** Only present for the viewing player. */
  hand?: Card[];
}

export interface RedactedReveal {
  suggester: string;
  suggestion: Triple;
  disprover: string | null;
  /** Null unless the viewer is the suggester or the disprover. */
  card: Card | null;
}

/** Client-visible game state: no solution, no other players' hands, and the
 * shown card only for those entitled to see it. */
export interface RedactedCluedoState {
  you: string;
  players: RedactedPlayer[];
  current: number;
  phase: Phase;
  weaponRooms: Record<Weapon, Room>;
  moveOptions: Room[];
  pendingSuggestion: Triple | null;
  pendingDisprover: string | null;
  lastReveal: RedactedReveal | null;
  history: RedactedReveal[];
  winner: string | null;
  /** The murder envelope — null until the game is over, then shown to everyone. */
  solution: Triple | null;
}

/** Hide a reveal's shown card from everyone but its suggester and disprover. */
function redactReveal(r: { suggester: string; suggestion: Triple; disprover: string | null; card: Card | null }, viewerId: string): RedactedReveal {
  const canSee = viewerId === r.suggester || viewerId === r.disprover;
  return { suggester: r.suggester, suggestion: r.suggestion, disprover: r.disprover, card: canSee ? r.card : null };
}

/** Produce the state a single player is allowed to see. */
export function redactFor(state: CluedoState, viewerId: string): RedactedCluedoState {
  const players: RedactedPlayer[] = state.players.map((p) => ({
    id: p.id,
    suspect: p.suspect,
    room: p.room,
    eliminated: p.eliminated,
    isAI: p.isAI,
    handCount: p.hand.length,
    ...(p.id === viewerId ? { hand: p.hand } : {}),
  }));

  return {
    you: viewerId,
    players,
    current: state.current,
    phase: state.phase,
    weaponRooms: state.weaponRooms,
    moveOptions: state.moveOptions,
    pendingSuggestion: state.pendingSuggestion,
    pendingDisprover: state.pendingDisprover,
    lastReveal: state.lastReveal ? redactReveal(state.lastReveal, viewerId) : null,
    history: state.history.map((r) => redactReveal(r, viewerId)),
    winner: state.winner,
    solution: state.phase === 'over' ? state.solution : null,
  };
}
