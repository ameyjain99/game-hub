import type { MapId, PlayerState } from './types';
import { areConnected, longestPath, twoPaths } from './graph';
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

/** +10 to the player(s) who completed the most destination tickets; ties all score. */
export const mostTicketsBonus: BonusRule = { ...globetrotterBonus, id: 'most-tickets', points: 10 };

/** What the Grand Tour pays for 0, 1, 2... qualifying tickets (five or more pay the same). */
export const GRAND_TOUR_POINTS = [0, 5, 10, 20, 30, 40];

/** A player's tickets whose two cities are joined by two paths that share no route. */
export function grandTourTickets(player: PlayerState) {
  return player.tickets.filter((t) => twoPaths(player.claimedRouteIds, t.a, t.b));
}

/**
 * The Grand Tour: every ticket whose cities you joined twice over, by two
 * paths sharing no route, counts. One or two such tickets pay 5 each, the next
 * three 10 each, to a most of 40.
 */
export const grandTourBonus: BonusRule = {
  id: 'grand-tour',
  label: 'Grand Tour',
  points: 0,
  award(players: PlayerState[]): Set<string> {
    return new Set(players.filter((p) => grandTourTickets(p).length > 0).map((p) => p.id));
  },
  score(player: PlayerState): number {
    return GRAND_TOUR_POINTS[Math.min(grandTourTickets(player).length, GRAND_TOUR_POINTS.length - 1)];
  },
};

const BONUSES: Record<BonusId, BonusRule> = {
  'longest-path': longestPathBonus,
  globetrotter: globetrotterBonus,
  'most-tickets': mostTicketsBonus,
  'grand-tour': grandTourBonus,
};

/** The bonus cards in play for a map's mode. */
export function bonusesFor(mapId: MapId, modeId?: string): BonusRule[] {
  return modeFor(mapId, modeId).bonuses.map((id) => BONUSES[id]);
}
