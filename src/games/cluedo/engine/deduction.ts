import { SUSPECTS, WEAPONS, ROOMS, type Card, type Suspect, type Weapon, type Room } from './cards';
import type { RedactedCluedoState } from './redact';

export interface NotebookFacts {
  /** Cards you can prove each player holds (your own hand + cards shown to you). */
  knownByPlayer: Record<string, Card[]>;
  /** Cards in each category not yet accounted for – still candidates for the envelope. */
  stillPossible: { suspects: Suspect[]; weapons: Weapon[]; rooms: Room[] };
}

/**
 * The facts a player can legitimately know, derived from their redacted view:
 * their own hand, and any card a disprover showed them. Pure – safe to reuse
 * for the human's notebook online, where only the redacted view is available.
 */
export function notebookFacts(view: RedactedCluedoState): NotebookFacts {
  const knownByPlayer: Record<string, Card[]> = {};

  const you = view.players.find((p) => p.id === view.you);
  if (you?.hand) knownByPlayer[view.you] = [...you.hand];

  // A revealed card in the log is only visible to you if you took part; its
  // disprover therefore holds it.
  for (const r of view.history) {
    if (r.card && r.disprover) {
      (knownByPlayer[r.disprover] ??= []).push(r.card);
    }
  }
  for (const id of Object.keys(knownByPlayer)) {
    knownByPlayer[id] = [...new Set(knownByPlayer[id])];
  }

  const held = new Set<Card>(Object.values(knownByPlayer).flat());
  return {
    knownByPlayer,
    stillPossible: {
      suspects: SUSPECTS.filter((s) => !held.has(s)),
      weapons: WEAPONS.filter((w) => !held.has(w)),
      rooms: ROOMS.filter((r) => !held.has(r)),
    },
  };
}
