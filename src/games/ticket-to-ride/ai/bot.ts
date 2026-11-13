import type { Difficulty, GameState, TrainCard } from '../engine/types';
import type { Action } from '../engine/actions';
import { legalActions, getRoute } from '../engine/selectors';
import { routePoints } from '../engine/scoring';
import { areConnected } from '../engine/graph';
import { modeFor } from '../engine/maps';
import { targetRouteIds, desiredColors } from './heuristics';
import { heuristicAction } from './hardHeuristic';

/**
 * Choose a legal action for an AI player. Always returns a member of
 * legalActions(state, playerId). Easy and Normal are greedy heuristics; Hard
 * plans all its tickets together (see hardHeuristic.ts).
 */
export function chooseAction(
  state: GameState,
  playerId: string,
  difficulty: Difficulty,
): Action {
  const actions = legalActions(state, playerId);
  if (actions.length === 0) throw new Error('no legal actions for AI');

  // Tunnel decision (any difficulty): complete the claim if it can be afforded.
  if (state.phase === 'tunnel-decision') {
    return actions.find((a) => a.type === 'RESOLVE_TUNNEL' && a.commit) ?? actions[0];
  }

  if (difficulty === 'hard') return heuristicAction(state, playerId);
  const player = state.players.find((p) => p.id === playerId)!;

  // Keep ids in pending order so they match legalActions' subset enumeration.
  const inPendingOrder = (chosen: Set<string>): string[] =>
    player.pendingTickets.filter((t) => chosen.has(t.id)).map((t) => t.id);
  const topByPoints = (n: number): Set<string> =>
    new Set(
      [...player.pendingTickets].sort((a, b) => b.points - a.points).slice(0, n).map((t) => t.id),
    );

  // Setup: keep the mode's minimum, highest value first (and complete them —
  // that's where the points are). Undisciplined easy will fail to finish them.
  if (state.phase === 'setup-tickets') {
    const keep = modeFor(state.mapId, state.modeId).setupKeep;
    return { type: 'CONFIRM_SETUP_TICKETS', playerId, keptIds: inPendingOrder(topByPoints(keep)) };
  }

  // Choosing among freshly drawn tickets: keep every one already satisfied by
  // the current network (free points); otherwise keep the lowest-value single
  // (must keep >= 1, so minimise the downside if it goes unbuilt).
  if (state.phase === 'draw-tickets') {
    const connected = player.pendingTickets.filter((t) =>
      areConnected(player.claimedRouteIds, t.a, t.b),
    );
    if (connected.length > 0) {
      return { type: 'KEEP_TICKETS', keptIds: connected.map((t) => t.id) };
    }
    const cheapest = [...player.pendingTickets].sort((a, b) => a.points - b.points)[0];
    return { type: 'KEEP_TICKETS', keptIds: [cheapest.id] };
  }

  const targets = targetRouteIds(state, player);
  // Normal plays out the endgame conservatively: once it's down to its last few
  // trains it stops claiming routes (which would hasten the ≤2-train trigger) and
  // only draws cards. It won't strive to end the game.
  const hoardCards = difficulty === 'normal' && player.trainsLeft < 10;
  const claims = hoardCards
    ? []
    : actions.filter(
        (a): a is Extract<Action, { type: 'CLAIM_ROUTE' }> => a.type === 'CLAIM_ROUTE',
      );

  // Score each available claim.
  const scoreClaim = (a: Extract<Action, { type: 'CLAIM_ROUTE' }>): number => {
    const route = getRoute(a.routeId)!;
    let score = routePoints(route.length);
    if (targets.has(a.routeId)) score += 100; // advancing a ticket is the priority
    // prefer combos that spend fewer locomotives (keep wilds for hard routes)
    score -= a.combo.locomotives * 0.5;
    return score;
  };

  if (claims.length > 0) {
    const best = claims.reduce((a, b) => (scoreClaim(b) > scoreClaim(a) ? b : a));
    const route = getRoute(best.routeId)!;
    const advancesTicket = targets.has(best.routeId);

    if (advancesTicket) return best;

    // Easy is undisciplined: it grabs point-routes even while its destination
    // tickets are unfinished, so it burns the trains it needed and misses
    // tickets (a scoring penalty).
    if (difficulty === 'easy') return best;

    // Normal finishes its tickets first, then claims extra routes for points —
    // a little wasteful, leaving the shortest leftovers (and some trains) unused.
    if (targets.size === 0 && route.length >= 3) return best;
  }

  // Otherwise draw cards. Easy and Normal draw blindly from the deck; the
  // face-up choice below is only the fallback once the deck is empty.
  const blindDeckDraw = actions.find((a) => a.type === 'DRAW_TRAIN' && a.source === 'deck');
  if (blindDeckDraw) return blindDeckDraw;

  const want = desiredColors(player, targets);
  const marketDraws = actions.filter(
    (a): a is Extract<Action, { type: 'DRAW_TRAIN'; source: 'market'; index: number }> =>
      a.type === 'DRAW_TRAIN' && a.source === 'market',
  );

  const cardValue = (card: TrainCard): number => {
    if (card === 'locomotive') return 3;
    return (want.get(card) ?? 0) + 0.1; // small baseline so any card beats nothing
  };

  let bestDraw: Action | null = null;
  let bestVal = 0;
  for (const d of marketDraws) {
    const card = state.market[d.index];
    const val = cardValue(card);
    if (val > bestVal) {
      bestVal = val;
      bestDraw = d;
    }
  }

  const deckDraw = actions.find(
    (a) => a.type === 'DRAW_TRAIN' && a.source === 'deck',
  );

  // Blind deck draw is worth ~1.2 (unknown but flexible); take market only if better.
  if (bestDraw && bestVal >= 1.2) return bestDraw;
  if (deckDraw) return deckDraw;
  if (bestDraw) return bestDraw;

  // Fallbacks: any claim, else first legal action.
  if (claims.length > 0) return claims.reduce((a, b) => (scoreClaim(b) > scoreClaim(a) ? b : a));
  return actions[0];
}
