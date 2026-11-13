import { SUSPECTS, WEAPONS, ROOMS, type Card, type Suspect, type Weapon, type Room } from './cards';
import type { CluedoState } from './state';
import type { CluedoAction } from './reducer';

/** Cards this bot knows are held by someone (so: not in the solution): its own
 * hand, plus cards shown to it when it was the suggester. */
function knownHeld(state: CluedoState, meId: string): Set<Card> {
  const me = state.players.find((p) => p.id === meId);
  const held = new Set<Card>(me?.hand ?? []);
  for (const r of state.history) {
    if (r.suggester === meId && r.card) held.add(r.card);
  }
  return held;
}

/** The lone remaining candidate in a category, if exactly one is unaccounted for. */
function soleRemaining<T extends Card>(items: readonly T[], held: Set<Card>): T | undefined {
  const remaining = items.filter((i) => !held.has(i));
  return remaining.length === 1 ? remaining[0] : undefined;
}

/** What the bot can prove about the solution from its own knowledge. */
function deduce(state: CluedoState, meId: string): Partial<Record<'suspect' | 'weapon' | 'room', Card>> {
  const me = state.players.find((p) => p.id === meId);
  const myHand = new Set<Card>(me?.hand ?? []);
  const out: Partial<Record<'suspect' | 'weapon' | 'room', Card>> = {};

  // An own suggestion that NOBODY disproved: any named card the bot doesn't hold
  // itself must be in the envelope.
  for (const r of state.history) {
    if (r.suggester === meId && r.disprover === null) {
      if (!myHand.has(r.suggestion.suspect)) out.suspect = r.suggestion.suspect;
      if (!myHand.has(r.suggestion.weapon)) out.weapon = r.suggestion.weapon;
      if (!myHand.has(r.suggestion.room)) out.room = r.suggestion.room;
    }
  }

  const held = knownHeld(state, meId);
  out.suspect ??= soleRemaining(SUSPECTS, held);
  out.weapon ??= soleRemaining(WEAPONS, held);
  out.room ??= soleRemaining(ROOMS, held);
  return out;
}

export function chooseCluedoAction(state: CluedoState): CluedoAction {
  switch (state.phase) {
    case 'roll':
      return { type: 'roll' };

    case 'move': {
      const me = state.players[state.current];
      // Prefer entering a room the bot hasn't yet ruled out, to learn about it
      // (easy picks from the far end of the options, so it explores less evenly).
      const held = knownHeld(state, me.id);
      const unknown = state.moveOptions.filter((r) => !held.has(r));
      const pick = me.difficulty === 'easy' ? unknown[unknown.length - 1] : unknown[0];
      return { type: 'move', room: pick ?? state.moveOptions[0] };
    }

    case 'decide': {
      const me = state.players[state.current];
      const easy = me.difficulty === 'easy';

      // Accuse the moment the solution is certain.
      const d = deduce(state, me.id);
      if (d.suspect && d.weapon && d.room) {
        return {
          type: 'accuse',
          suspect: d.suspect as Suspect,
          weapon: d.weapon as Weapon,
          room: d.room as Room,
        };
      }
      // One suggestion per turn, then end it.
      if (state.lastReveal && state.lastReveal.suggester === me.id) {
        return { type: 'endTurn' };
      }
      const unknownOf = <T extends Card>(items: readonly T[]) => items.filter((c) => !knownHeld(state, me.id).has(c));
      if (easy) {
        // Less sharp than normal: names unseen cards from the far end of the list.
        const us = unknownOf(SUSPECTS);
        const uw = unknownOf(WEAPONS);
        return {
          type: 'suggest',
          suspect: (us[us.length - 1] ?? SUSPECTS[0]) as Suspect,
          weapon: (uw[uw.length - 1] ?? WEAPONS[0]) as Weapon,
        };
      }
      const held = knownHeld(state, me.id);
      const suspect = (SUSPECTS.find((s) => !held.has(s)) ?? SUSPECTS[0]) as Suspect;
      const weapon = (WEAPONS.find((w) => !held.has(w)) ?? WEAPONS[0]) as Weapon;
      return { type: 'suggest', suspect, weapon };
    }

    case 'disprove': {
      const disprover = state.players.find((p) => p.id === state.pendingDisprover);
      const s = state.pendingSuggestion;
      const named: Card[] = s ? [s.suspect, s.weapon, s.room] : [];
      const card = disprover?.hand.find((c) => named.includes(c));
      if (card) return { type: 'disprove', card };
      return { type: 'endTurn' };
    }

    default:
      return { type: 'endTurn' };
  }
}

/** What an idle human defaults to when their turn clock runs out: roll, take the
 *  first room offered, end the turn without suggesting, and — since a disprover
 *  must show a card — show the first one that matches. */
export function cluedoTimeoutAction(state: CluedoState): CluedoAction {
  switch (state.phase) {
    case 'roll':
      return { type: 'roll' };
    case 'move':
      return { type: 'move', room: state.moveOptions[0] };
    case 'disprove': {
      const disprover = state.players.find((p) => p.id === state.pendingDisprover);
      const s = state.pendingSuggestion;
      const named: Card[] = s ? [s.suspect, s.weapon, s.room] : [];
      const card = disprover?.hand.find((c) => named.includes(c));
      return card ? { type: 'disprove', card } : { type: 'endTurn' };
    }
    default:
      return { type: 'endTurn' };
  }
}
