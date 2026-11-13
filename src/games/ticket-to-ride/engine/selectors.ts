import type { CardCombo, GameState, Hand, Route, RouteColor } from './types';
import { CARD_COLORS } from './types';
import { getMap, modeFor, routeById } from './maps';
import { canAffordTunnel } from './tunnel';
import type { Action } from './actions';

export function getRoute(routeId: string): Route | undefined {
  return routeById.get(routeId);
}

/** Whether a player could legally claim this route right now (ignoring cards/trains). */
export function routeIsClaimable(state: GameState, routeId: string, playerId: string): boolean {
  const route = routeById.get(routeId);
  if (!route) return false;
  if (state.claimedBy[routeId]) return false;

  if (route.parallelGroup) {
    const siblings = getMap(state.mapId).routes.filter(
      (r) => r.parallelGroup === route.parallelGroup && r.id !== routeId,
    );
    const playerCount = state.players.length;
    for (const sib of siblings) {
      const owner = state.claimedBy[sib.id];
      if (!owner) continue;
      // A player may never own both siblings.
      if (owner === playerId) return false;
      // In 2-3 player games, only one of a double route may be used at all.
      if (playerCount <= 3) return false;
    }
  }
  return true;
}

/**
 * All legal ways to pay for a route with the given hand.
 * Locomotives are wild; grey routes accept any single color.
 */
export function canPayFor(hand: Hand, route: Route): CardCombo[] {
  const combos: CardCombo[] = [];
  const len = route.length;
  const minLoco = route.locomotivesRequired;
  const maxLoco = Math.min(len, hand.locomotive);

  const candidateColors: RouteColor[] = route.color === 'grey' ? CARD_COLORS : [route.color];

  const seen = new Set<string>();
  const push = (combo: CardCombo) => {
    const key = `${combo.color ?? '_'}:${combo.colorCount}:${combo.locomotives}`;
    if (!seen.has(key)) {
      seen.add(key);
      combos.push(combo);
    }
  };

  for (let loco = minLoco; loco <= maxLoco; loco++) {
    const colorCount = len - loco;
    if (colorCount === 0) {
      push({ colorCount: 0, locomotives: loco });
      continue;
    }
    for (const color of candidateColors) {
      if (color === 'grey') continue;
      if (hand[color] >= colorCount) {
        push({ color, colorCount, locomotives: loco });
      }
    }
  }
  return combos;
}

/** Non-empty subsets of ids with at least `min` elements. */
function subsets(ids: string[], min: number): string[][] {
  const out: string[][] = [];
  const n = ids.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const chosen: string[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) chosen.push(ids[i]);
    if (chosen.length >= min) out.push(chosen);
  }
  return out;
}

/** Every legal action for the given player in the current state. */
export function legalActions(state: GameState, playerId: string): Action[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const isCurrent = state.players[state.current]?.id === playerId;

  if (state.phase === 'setup-tickets') {
    // Any player who still has pending setup tickets may confirm, keeping at
    // least the mode's minimum.
    if (player.pendingTickets.length === 0) return [];
    const ids = player.pendingTickets.map((t) => t.id);
    return subsets(ids, modeFor(state.mapId, state.modeId).setupKeep).map((keptIds) => ({
      type: 'CONFIRM_SETUP_TICKETS' as const,
      playerId,
      keptIds,
    }));
  }

  if (state.phase === 'tunnel-decision') {
    if (!isCurrent || !state.pendingTunnel) return [];
    const { combo, extra } = state.pendingTunnel;
    const actions: Action[] = [{ type: 'RESOLVE_TUNNEL', commit: false }];
    if (canAffordTunnel(player.hand, combo, extra)) {
      actions.unshift({ type: 'RESOLVE_TUNNEL', commit: true });
    }
    return actions;
  }

  if (!isCurrent) return [];

  if (state.phase === 'draw-tickets') {
    const ids = player.pendingTickets.map((t) => t.id);
    return subsets(ids, 1).map((keptIds) => ({ type: 'KEEP_TICKETS' as const, keptIds }));
  }

  if (state.phase !== 'turn') return [];

  const actions: Action[] = [];
  const deckHasCards = state.drawPile.length + state.discardPile.length > 0;
  const midDraw = state.drawnThisTurn === 1;

  // Draw from deck (blind).
  if (deckHasCards) actions.push({ type: 'DRAW_TRAIN', source: 'deck' });

  // Draw a face-up market card.
  state.market.forEach((card, index) => {
    if (midDraw && card === 'locomotive') return; // can't take a loco as 2nd draw
    actions.push({ type: 'DRAW_TRAIN', source: 'market', index });
  });

  // Claiming and drawing tickets are full-turn actions (only before any draw).
  if (!midDraw) {
    for (const route of getMap(state.mapId).routes) {
      if (player.trainsLeft < route.length) continue;
      if (!routeIsClaimable(state, route.id, playerId)) continue;
      for (const combo of canPayFor(player.hand, route)) {
        actions.push({ type: 'CLAIM_ROUTE', routeId: route.id, combo });
      }
    }
    if (state.ticketPile.length > 0) actions.push({ type: 'DRAW_TICKETS' });

    // Train stations (Europe): place on any unoccupied city.
    if (player.stationsLeft > 0) {
      const cost = player.stations.length + 1;
      const occupied = new Set(state.players.flatMap((p) => p.stations));
      const synthetic: Route = { id: '', a: '', b: '', color: 'grey', length: cost, locomotivesRequired: 0 };
      const combos = canPayFor(player.hand, synthetic);
      if (combos.length > 0) {
        const combo = combos[0];
        for (const city of getMap(state.mapId).cities) {
          if (!occupied.has(city.id)) actions.push({ type: 'PLACE_STATION', city: city.id, combo });
        }
      }
    }
  }

  return actions;
}

/** Which player, if any, the AI should act for right now (setup or turn). */
export function aiActor(state: GameState): string | null {
  if (state.phase === 'game-over') return null;
  if (state.phase === 'setup-tickets') {
    const p = state.players.find((x) => x.isAI && x.pendingTickets.length > 0);
    return p?.id ?? null;
  }
  const cur = state.players[state.current];
  return cur?.isAI ? cur.id : null;
}
