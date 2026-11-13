import type { Rng } from '../../../shared/rng';
import { SUSPECTS, WEAPONS, ROOMS, type Card, type Triple } from './cards';

export interface CluedoSetup {
  /** The hidden murder envelope. */
  solution: Triple;
  /** Each player's dealt cards, keyed by player id. */
  hands: Record<string, Card[]>;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng.next() * items.length)];
}

/** Fisher-Yates shuffle in place, using the seeded rng. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Draw the murder envelope (one suspect, one weapon, one room) and deal the
 * remaining 18 cards round-robin to the players.
 */
export function setupCluedo(playerIds: string[], rng: Rng): CluedoSetup {
  const solution: Triple = {
    suspect: pick(SUSPECTS, rng),
    weapon: pick(WEAPONS, rng),
    room: pick(ROOMS, rng),
  };

  const rest: Card[] = [
    ...SUSPECTS.filter((s) => s !== solution.suspect),
    ...WEAPONS.filter((w) => w !== solution.weapon),
    ...ROOMS.filter((r) => r !== solution.room),
  ];
  shuffle(rest, rng);

  const hands: Record<string, Card[]> = {};
  for (const id of playerIds) hands[id] = [];
  rest.forEach((card, i) => hands[playerIds[i % playerIds.length]].push(card));

  return { solution, hands };
}
