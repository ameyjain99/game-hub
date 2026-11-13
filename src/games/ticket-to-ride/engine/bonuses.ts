import type { PlayerState } from './types';
import { longestPath } from './graph';
import type { BonusRule } from './scoring';

/** +10 to the player(s) with the longest continuous path; ties all score. */
export const longestPathBonus: BonusRule = {
  id: 'longest-path',
  label: 'Longest Path',
  points: 10,
  award(players: PlayerState[]): Set<string> {
    let max = 0;
    const lengths = new Map<string, number>();
    for (const p of players) {
      const len = longestPath(p.claimedRouteIds);
      lengths.set(p.id, len);
      if (len > max) max = len;
    }
    const winners = new Set<string>();
    if (max === 0) return winners;
    for (const [id, len] of lengths) if (len === max) winners.add(id);
    return winners;
  },
};

/** Default bonus set for the USA base game. */
export const DEFAULT_BONUSES: BonusRule[] = [longestPathBonus];
