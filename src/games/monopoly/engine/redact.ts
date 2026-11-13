import type { MonopolyState } from './state';

/**
 * Monopoly is almost fully open information: money, positions, ownership,
 * buildings, mortgages and held Get-Out cards are all public. The only hidden
 * state is the Chance/Community Chest deck order (and the RNG that drives dice),
 * so redaction just strips those. `playerId` is unused but kept for the adapter's
 * uniform `redactFor(game, playerId)` signature.
 */
export function redactFor(state: MonopolyState, _playerId: string): MonopolyState {
  return {
    ...state,
    chanceOrder: [],
    chestOrder: [],
    chancePtr: 0,
    chestPtr: 0,
    rngState: 0,
  };
}
