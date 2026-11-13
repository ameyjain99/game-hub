import { makeRng } from '../../../shared/rng';
import { reachableRooms } from './board';
import { firstDisprover } from './suggestion';
import { isCorrectAccusation } from './accusation';
import { ROOMS, type Card, type Room, type Suspect, type Weapon } from './cards';
import type { CluedoState, CluedoPlayer } from './state';

export type CluedoAction =
  | { type: 'roll' }
  | { type: 'move'; room: Room }
  | { type: 'suggest'; suspect: Suspect; weapon: Weapon }
  | { type: 'disprove'; card: Card }
  | { type: 'accuse'; suspect: Suspect; weapon: Weapon; room: Room }
  | { type: 'endTurn' };

/** Next active (non-eliminated) seat after `from`, wrapping; -1 if none remain. */
function nextActive(players: CluedoPlayer[], from: number): number {
  for (let step = 1; step <= players.length; step++) {
    const i = (from + step) % players.length;
    if (!players[i].eliminated) return i;
  }
  return -1;
}

/** Roll one die (1–6) from the seeded state; returns the die and the new state. */
function roll(rngState: number): { die: number; rngState: number } {
  const rng = makeRng(0);
  rng.state = rngState;
  const die = 1 + Math.floor(rng.next() * 6);
  return { die, rngState: rng.state };
}

/** A game this long has stalled (bots circling without learning); close the
 * case unsolved rather than loop forever. */
const MAX_TURNS = 500;

/** Advance to the next active player's roll phase (or end if none remain). */
function passTurn(state: CluedoState): CluedoState {
  const next = nextActive(state.players, state.current);
  const turn = state.turn + 1;
  if (next === -1 || turn >= MAX_TURNS) return { ...state, turn, phase: 'over', winner: null };
  return {
    ...state,
    turn,
    current: next,
    phase: 'roll',
    moveOptions: [],
    pendingSuggestion: null,
    pendingDisprover: null,
    lastReveal: null,
  };
}

export function reduce(state: CluedoState, action: CluedoAction): CluedoState {
  if (state.phase === 'over') return state;
  const me = state.players[state.current];

  switch (action.type) {
    case 'roll': {
      if (state.phase !== 'roll') return state;
      const { die, rngState } = roll(state.rngState);
      const options = me.room === null ? [...ROOMS] : reachableRooms(me.room, die);
      return { ...state, phase: 'move', moveOptions: options, rngState };
    }

    case 'move': {
      if (state.phase !== 'move' || !state.moveOptions.includes(action.room)) return state;
      const players = state.players.map((p, i) => (i === state.current ? { ...p, room: action.room } : p));
      return { ...state, players, phase: 'decide', moveOptions: [] };
    }

    case 'suggest': {
      if (state.phase !== 'decide' || me.room === null) return state;
      // One suggestion per turn.
      if (state.lastReveal && state.lastReveal.suggester === me.id) return state;
      const room = me.room;
      const suggestion = { suspect: action.suspect, weapon: action.weapon, room };
      // Pull the accused suspect's token and the weapon into this room.
      const players = state.players.map((p) =>
        p.suspect === action.suspect ? { ...p, room } : p,
      );
      const weaponRooms = { ...state.weaponRooms, [action.weapon]: room };

      const hands = Object.fromEntries(state.players.map((p) => [p.id, p.hand]));
      const disproof = firstDisprover(
        state.players.map((p) => p.id),
        me.id,
        suggestion,
        hands,
      );

      if (disproof) {
        return {
          ...state,
          players,
          weaponRooms,
          phase: 'disprove',
          pendingSuggestion: suggestion,
          pendingDisprover: disproof.playerId,
          lastReveal: null,
        };
      }
      const reveal = { suggester: me.id, suggestion, disprover: null, card: null };
      return {
        ...state,
        players,
        weaponRooms,
        phase: 'decide',
        pendingSuggestion: null,
        pendingDisprover: null,
        lastReveal: reveal,
        history: [...state.history, reveal],
      };
    }

    case 'disprove': {
      if (state.phase !== 'disprove' || !state.pendingSuggestion || !state.pendingDisprover) return state;
      const disprover = state.players.find((p) => p.id === state.pendingDisprover);
      const s = state.pendingSuggestion;
      const matches: Card[] = [s.suspect, s.weapon, s.room];
      if (!disprover || !disprover.hand.includes(action.card) || !matches.includes(action.card)) {
        return state;
      }
      const reveal = { suggester: me.id, suggestion: s, disprover: disprover.id, card: action.card };
      return {
        ...state,
        phase: 'decide',
        pendingSuggestion: null,
        pendingDisprover: null,
        lastReveal: reveal,
        history: [...state.history, reveal],
      };
    }

    case 'accuse': {
      if (state.phase !== 'decide') return state;
      const accusation = { suspect: action.suspect, weapon: action.weapon, room: action.room };
      if (isCorrectAccusation(accusation, state.solution)) {
        return { ...state, phase: 'over', winner: me.id };
      }
      const players = state.players.map((p, i) => (i === state.current ? { ...p, eliminated: true } : p));
      // Everyone else has accused wrongly: the last detective standing wins.
      const standing = players.filter((p) => !p.eliminated);
      if (standing.length === 1) return { ...state, players, phase: 'over', winner: standing[0].id };
      return passTurn({ ...state, players });
    }

    case 'endTurn': {
      if (state.phase !== 'decide') return state;
      return passTurn(state);
    }

    default:
      return state;
  }
}
