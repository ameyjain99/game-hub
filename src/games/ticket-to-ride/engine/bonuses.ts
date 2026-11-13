import type { MapId, PlayerState } from './types';
import { areConnected, longestPath } from './graph';
import { modeFor, type BonusId } from './maps';
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

/** +15 to the player(s) who completed the most destination tickets; ties all score. */
export const globetrotterBonus: BonusRule = {
  id: 'globetrotter',
  label: 'Globetrotter',
  points: 15,
  award(players: PlayerState[]): Set<string> {
    const completed = new Map(
      players.map((p) => [p.id, p.tickets.filter((t) => areConnected(p.claimedRouteIds, t.a, t.b)).length]),
    );
    const max = Math.max(0, ...completed.values());
    const winners = new Set<string>();
    if (max === 0) return winners;
    for (const [id, n] of completed) if (n === max) winners.add(id);
    return winners;
  },
};

const BONUSES: Record<BonusId, BonusRule> = {
  'longest-path': longestPathBonus,
  globetrotter: globetrotterBonus,
};

/** The bonus cards in play for a map's mode. */
export function bonusesFor(mapId: MapId, modeId?: string): BonusRule[] {
  return modeFor(mapId, modeId).bonuses.map((id) => BONUSES[id]);
}
