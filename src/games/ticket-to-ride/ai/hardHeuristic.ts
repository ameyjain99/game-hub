import type { Action } from '../engine/actions';
import type { CardColor, GameState, PlayerState, Ticket } from '../engine/types';
import { CARD_COLORS } from '../engine/types';
import { getRoute, legalActions } from '../engine/selectors';
import { routePoints } from '../engine/scoring';
import { areConnected } from '../engine/graph';
import { planTickets, type Plan } from './planner';
import { threatMap } from './opponents';

/**
 * Tunable weights, tuned against Normal with `npm run bench:ai` (2p, seats
 * alternated). Each value's comment notes what the measurements showed.
 */
export const W = {
  /** Base score of a claim on the ticket plan (always beats any draw). */
  planned: 100,
  /** Urgency per unit of opponent pressure, on planned claims (≈ neutral either way). */
  urgency: 8,
  /**
   * Bonus per unit of opponent pressure for a short off-plan claim. Off: blanket
   * blocking burned trains and turns (win rate 9.5% → 32.5% when disabled).
   */
  block: 0,
  /** Longest route worth claiming purely to block. */
  blockMaxLength: 2,
  /** Cost per locomotive spent on a claim (keep wilds for hard routes). */
  locoCost: 1.5,
  /** Points-per-train risk charged when choosing tickets. */
  ticketRisk: 0.45,
  /** Points charged per kept ticket — completion is never certain (keeps 2, not 3). */
  perTicket: 10,
  /** Only draw new tickets with at least this many trains left. Never: mid-game tickets were completed only 41–65%. */
  drawTicketsMinTrains: Infinity,
  /** Endgame once our trains, or any opponent's, fall to this. */
  endgameTrains: 6,
  /** In the endgame, spend trains even if the plan can no longer be finished. */
  spendWhenStranded: true,
  /** Outside the endgame, only spend spare trains on routes at least this long (short routes score poorly per train). */
  spendMinLength: 4,
  /** Ticket-path bias toward long routes (better points per train); see planTickets. */
  planBias: 0.4,
};

export interface Scored {
  action: Action;
  score: number;
}

/** Cards still missing, per colour, to claim every planned route (grey routes take our most plentiful spare colour). */
function missingColours(plan: Plan, player: PlayerState): Map<CardColor, number> {
  const need = new Map<CardColor, number>();
  const greys: number[] = [];
  for (const id of plan.routeIds) {
    const r = getRoute(id)!;
    if (r.color === 'grey') greys.push(r.length);
    else need.set(r.color, (need.get(r.color) ?? 0) + r.length);
  }
  for (const len of greys) {
    let best: CardColor = CARD_COLORS[0];
    let spare = -Infinity;
    for (const c of CARD_COLORS) {
      const s = player.hand[c] - (need.get(c) ?? 0);
      if (s > spare) ((spare = s), (best = c));
    }
    need.set(best, (need.get(best) ?? 0) + len);
  }
  const missing = new Map<CardColor, number>();
  for (const [c, n] of need) if (n > player.hand[c]) missing.set(c, n - player.hand[c]);
  return missing;
}

/** Value of ending up with `kept` added to the player's tickets. */
function ticketChoiceValue(state: GameState, player: PlayerState, kept: Ticket[]): number {
  const all = [...player.tickets, ...kept];
  const plan = planTickets(state, player, all, W.planBias);
  const sum = (ts: Ticket[]) => ts.reduce((s, t) => s + t.points, 0);
  const connected = all.filter((t) => areConnected(player.claimedRouteIds, t.a, t.b));
  return (
    sum(plan.reachable) +
    sum(connected) -
    sum(plan.blocked) -
    W.ticketRisk * plan.trainsNeeded -
    W.perTicket * kept.length
  );
}

/** Every legal action for `playerId`, scored and sorted best first (ties keep legal-action order). */
export function rankActions(state: GameState, playerId: string): Scored[] {
  const player = state.players.find((p) => p.id === playerId)!;
  const scored: Scored[] = legalActions(state, playerId).map((action) => ({ action, score: 0 }));

  if (state.phase === 'setup-tickets' || state.phase === 'draw-tickets') {
    for (const s of scored) {
      const keptIds = (s.action as Extract<Action, { keptIds: string[] }>).keptIds;
      s.score = ticketChoiceValue(state, player, player.pendingTickets.filter((t) => keptIds.includes(t.id)));
    }
    return scored.sort((x, y) => y.score - x.score);
  }

  const plan = planTickets(state, player, player.tickets, W.planBias);
  const threat = threatMap(state, playerId);
  const missing = missingColours(plan, player);
  const totalMissing = [...missing.values()].reduce((a, b) => a + b, 0);
  const endgame =
    state.finalTurnsLeft !== null || state.players.some((p) => p.trainsLeft <= W.endgameTrains);
  const canDrawTickets =
    plan.routeIds.size === 0 &&
    !endgame &&
    player.trainsLeft >= W.drawTicketsMinTrains &&
    state.ticketPile.length > 0;
  const spending = endgame || (plan.routeIds.size === 0 && !canDrawTickets);
  const protectPlan = !(endgame && W.spendWhenStranded);

  for (const s of scored) {
    const a = s.action;
    if (a.type === 'CLAIM_ROUTE') {
      const r = getRoute(a.routeId)!;
      const pts = routePoints(r.length);
      const pressure = threat.get(r.id) ?? 0;
      let score: number;
      if (plan.routeIds.has(r.id)) score = W.planned + pts + W.urgency * pressure;
      else if (protectPlan && player.trainsLeft - r.length < plan.trainsNeeded) score = -100;
      else if (spending && (endgame || r.length >= W.spendMinLength)) score = 50 + pts;
      else if (r.length <= W.blockMaxLength && pressure > 0) score = 5 + W.block * pressure;
      else score = pts - 30;
      s.score = score - W.locoCost * a.combo.locomotives;
    } else if (a.type === 'DRAW_TICKETS') {
      s.score = canDrawTickets ? 60 : -100;
    } else if (a.type === 'DRAW_TRAIN') {
      if (a.source === 'deck') s.score = 10;
      else if (a.source === 'market') {
        const card = state.market[a.index];
        const m = card === 'locomotive' ? 0 : (missing.get(card) ?? 0);
        s.score = card === 'locomotive' ? (totalMissing >= 3 ? 11 : 8) : m > 0 ? 12 + Math.min(m, 4) : 4;
      }
    }
  }
  return scored.sort((x, y) => y.score - x.score);
}

/** The Hard bot's decision: the top-ranked legal action. */
export function heuristicAction(state: GameState, playerId: string): Action {
  return rankActions(state, playerId)[0].action;
}
