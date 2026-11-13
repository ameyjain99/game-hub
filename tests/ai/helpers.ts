import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';
import { getRoute } from '../../src/games/ticket-to-ride/engine/selectors';
import type { GameState, Hand, Ticket } from '../../src/games/ticket-to-ride/engine/types';

export const ticket = (a: string, b: string, points: number): Ticket => ({ id: `${a}__${b}`, a, b, points });

export interface StateOptions {
  players?: number;
  /** playerId -> route ids they own */
  owned?: Record<string, string[]>;
  tickets?: Record<string, Ticket[]>;
  /** playerId -> exact hand (unlisted cards are 0) */
  hands?: Record<string, Partial<Hand>>;
  trainsLeft?: Record<string, number>;
}

/** A mid-game `turn`-phase state (p0 to move) built from a seeded game. */
export function makeState(opts: StateOptions = {}): GameState {
  const n = opts.players ?? 2;
  const base = createGame(
    Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: true, difficulty: 'hard' as const })),
    1,
  );
  const claimedBy: Record<string, string> = {};
  const players = base.players.map((p) => {
    const owned = opts.owned?.[p.id] ?? [];
    for (const id of owned) claimedBy[id] = p.id;
    const used = owned.reduce((sum, id) => sum + getRoute(id)!.length, 0);
    return {
      ...p,
      pendingTickets: [],
      claimedRouteIds: [...owned],
      tickets: opts.tickets?.[p.id] ?? [],
      hand: opts.hands?.[p.id] ? { ...emptyHand(), ...opts.hands[p.id] } : p.hand,
      trainsLeft: opts.trainsLeft?.[p.id] ?? p.trainsLeft - used,
    };
  });
  return { ...base, phase: 'turn', current: 0, drawnThisTurn: 0, claimedBy, players };
}
