import { BOARD, OWNABLE_IDS } from './board';
import {
  currentPlayer,
  type MonopolyDifficulty,
  type MonopolyPlayer,
  type MonopolyState,
  type PendingTrade,
} from './state';
import { Action } from './actions';
import { applyAction } from './reducer';
import { canBuild, canMortgage, canSellHouse, canUnmortgage, legalBid, unmortgageCost } from './selectors';

/** The player who must act now: a trade recipient, the current bidder, or the
 *  player whose turn it is. Undefined once the game is over. */
export function monopolyActor(state: MonopolyState): string | undefined {
  if (state.phase === 'over') return undefined;
  if (state.pendingTrade) return state.pendingTrade.to;
  if (state.pendingAuction) return state.players[state.pendingAuction.turn].id;
  return currentPlayer(state).id;
}

function actingPlayer(state: MonopolyState): MonopolyPlayer | undefined {
  const id = monopolyActor(state);
  return state.players.find((p) => p.id === id);
}

/** Cash a bot keeps in reserve by difficulty – higher tiers manage liquidity. */
function reserve(d: MonopolyDifficulty | undefined): number {
  return d === 'easy' ? 0 : d === 'hard' ? 200 : 100;
}

const ownedBy = (state: MonopolyState, id: string): number[] =>
  OWNABLE_IDS.filter((s) => state.ownership[s].owner === id);

/** The lots that form a set with `id`: its colour group, or all railroads /
 *  both utilities. */
function setOf(id: number): number[] {
  const sp = BOARD[id];
  return OWNABLE_IDS.filter((x) =>
    sp.kind === 'property' ? BOARD[x].group === sp.group : BOARD[x].kind === sp.kind,
  );
}

/**
 * What a trade is worth to the responder, valued by what it does to sets rather
 * than list prices – the classic digital-Monopoly failure is a bot that sells the
 * lot completing your monopoly for face value. A lot that completes the
 * responder's own set counts 3×; handing the proposer a completed set costs the
 * responder an extra 2× that lot. So an even set-for-set swap nets out to ~0.
 */
export function tradeGain(state: MonopolyState, t: PendingTrade): number {
  const ownerAfter = (id: number): string | null =>
    t.give.properties.includes(id) ? t.to : t.receive.properties.includes(id) ? t.from : state.ownership[id].owner;
  const completesFor = (playerId: string, id: number) => setOf(id).every((x) => ownerAfter(x) === playerId);
  const price = (id: number) => BOARD[id].price ?? 0;

  let gain = t.give.cash - t.receive.cash + 50 * (t.give.getOutCards - t.receive.getOutCards);
  for (const id of t.give.properties) {
    const sharesSet = setOf(id).some((x) => x !== id && state.ownership[x].owner === t.to);
    gain += price(id) * (completesFor(t.to, id) ? 3 : sharesSet ? 1.4 : 1);
  }
  for (const id of t.receive.properties) {
    const brokeSet = setOf(id).some((x) => x !== id && state.ownership[x].owner === t.to);
    gain -= price(id) * (brokeSet ? 1.4 : 1);
    if (completesFor(t.from, id)) gain -= price(id) * 2;
  }
  return gain;
}

function wouldAccept(state: MonopolyState, responder: MonopolyPlayer, t: PendingTrade): boolean {
  if (responder.difficulty === 'easy' || responder.cash < t.receive.cash) return false;
  return tradeGain(state, t) >= (responder.difficulty === 'hard' ? 50 : 0);
}

function respondToTrade(state: MonopolyState, me: MonopolyPlayer): Action {
  return { type: 'RESPOND_TRADE', accept: wouldAccept(state, me, state.pendingTrade!) };
}

const tradable = (state: MonopolyState, id: number) => state.ownership[id].houses === 0;

/**
 * A set-completing offer this bot could make, or null. It looks for a colour
 * group it's one lot short of, and offers either a lot that completes the
 * holder's own set (a mutual swap) or a cash premium. Offers to other bots are
 * only made when they'd be accepted; offers to humans are rate-limited.
 */
function proposeBotTrade(state: MonopolyState, me: MonopolyPlayer): PendingTrade | null {
  if (me.difficulty === 'easy' || state.tradesThisTurn > 0) return null;
  const groups = [...new Set(OWNABLE_IDS.filter((id) => BOARD[id].kind === 'property').map((id) => BOARD[id].group))];
  for (const g of groups) {
    const lots = OWNABLE_IDS.filter((id) => BOARD[id].group === g);
    const missing = lots.filter((id) => state.ownership[id].owner !== me.id);
    if (missing.length !== 1) continue;
    const want = missing[0];
    const holderId = state.ownership[want].owner;
    const holder = state.players.find((p) => p.id === holderId);
    if (!holder || holder.bankrupt || !tradable(state, want)) continue;
    if (!holder.isAI && state.turns % 6 !== 0) continue; // don't pester humans every turn

    const price = BOARD[want].price ?? 0;
    const candidates: PendingTrade[] = [];
    // Mutual swap: one of my lots that completes the holder's set.
    for (const mine of OWNABLE_IDS.filter((id) => state.ownership[id].owner === me.id && tradable(state, id))) {
      if (lots.includes(mine)) continue;
      const theirSet = setOf(mine).filter((x) => x !== mine);
      if (theirSet.length > 0 && theirSet.every((x) => state.ownership[x].owner === holder.id)) {
        const topUp = Math.max(0, price - (BOARD[mine].price ?? 0));
        candidates.push({ from: me.id, to: holder.id, give: { cash: topUp, properties: [mine], getOutCards: 0 }, receive: { cash: 0, properties: [want], getOutCards: 0 } });
      }
    }
    // Cash premium.
    const cash = price * 3 + 20;
    if (me.cash - cash >= reserve(me.difficulty)) {
      candidates.push({ from: me.id, to: holder.id, give: { cash, properties: [], getOutCards: 0 }, receive: { cash: 0, properties: [want], getOutCards: 0 } });
    }
    for (const t of candidates) {
      if (me.cash < t.give.cash) continue;
      if (holder.isAI && !wouldAccept(state, holder, t)) continue;
      return t;
    }
  }
  return null;
}

function decideJail(me: MonopolyPlayer): Action {
  if (me.getOutCards > 0) return { type: 'USE_JAIL_CARD' };
  return { type: 'ROLL_JAIL' };
}

function decideAuction(state: MonopolyState, me: MonopolyPlayer): Action {
  const a = state.pendingAuction!;
  const price = BOARD[a.spaceId].price ?? 0;
  const willing = Math.floor(price * (me.difficulty === 'easy' ? 0.6 : 1));
  const { min, max } = legalBid(state, me.id, a.highBid);
  const ceiling = Math.min(willing, max);
  if (min > ceiling) return { type: 'PASS_BID' };
  // Raise in sensible steps so auctions resolve in a handful of bids.
  const step = price >= 200 ? 20 : 10;
  return { type: 'BID', amount: Math.max(min, Math.min(a.highBid + step, ceiling)) };
}

/** Settle a shortfall: sell buildings / mortgage, or declare bankruptcy. */
function settleDebt(state: MonopolyState, me: MonopolyPlayer): Action {
  const built = ownedBy(state, me.id).find((id) => canSellHouse(state, me.id, id));
  if (built !== undefined) return { type: 'SELL_HOUSE', spaceId: built };
  const lot = ownedBy(state, me.id).find((id) => canMortgage(state, id));
  if (lot !== undefined) return { type: 'MORTGAGE', spaceId: lot };
  return { type: 'DECLARE_BANKRUPTCY' };
}

function decidePurchase(state: MonopolyState, me: MonopolyPlayer): Action {
  const price = BOARD[state.pendingPurchase!].price ?? 0;
  if (me.cash - price >= reserve(me.difficulty)) return { type: 'BUY' };
  // Buy a cheap lot even into the reserve rather than let it go.
  if (me.difficulty !== 'easy' && me.cash >= price && price <= 120) return { type: 'BUY' };
  if (me.cash >= price && me.difficulty === 'easy') return { type: 'BUY' };
  return { type: 'DECLINE' };
}

/** A buildable lot for a bot that keeps its reserve, or undefined. */
function bestBuild(state: MonopolyState, me: MonopolyPlayer): number | undefined {
  if (me.difficulty === 'easy') return undefined; // easy bots don't develop
  const buildable = ownedBy(state, me.id).filter(
    (id) =>
      canBuild(state, me.id, id) &&
      me.cash - BOARD[id].houseCost! >= reserve(me.difficulty),
  );
  // Prefer the pricier groups (steeper rent) first.
  buildable.sort((a, b) => (BOARD[b].price ?? 0) - (BOARD[a].price ?? 0));
  return buildable[0];
}

function decideAction(state: MonopolyState, me: MonopolyPlayer): Action {
  if (state.pendingDebt && me.cash < 0) return settleDebt(state, me);
  if (state.pendingPurchase !== null) return decidePurchase(state, me);
  const offer = proposeBotTrade(state, me);
  if (offer) return { type: 'PROPOSE_TRADE', trade: offer };
  const build = bestBuild(state, me);
  if (build !== undefined) return { type: 'BUILD', spaceId: build };
  // Redeem a mortgage (so it earns rent and its group can build) when flush.
  if (me.difficulty !== 'easy') {
    const redeem = ownedBy(state, me.id).find(
      (id) => canUnmortgage(state, me.id, id) && me.cash - unmortgageCost(id) >= reserve(me.difficulty) + 150,
    );
    if (redeem !== undefined) return { type: 'UNMORTGAGE', spaceId: redeem };
  }
  return { type: 'END_TURN' };
}

/** Pick a legal action for whichever seat must act. */
export function chooseMonopolyAction(state: MonopolyState): Action {
  const me = actingPlayer(state);
  if (!me) return { type: 'END_TURN' };
  if (state.pendingTrade) return respondToTrade(state, me);
  if (state.pendingAuction) return decideAuction(state, me);
  if (state.phase === 'jail') return decideJail(me);
  if (state.phase === 'roll') return { type: 'ROLL' };
  return decideAction(state, me);
}

/**
 * What an idle human defaults to when their turn clock runs out: the cautious
 * choice at each step – never spends their money on their behalf.
 */
export function timeoutAction(state: MonopolyState): Action {
  const me = actingPlayer(state);
  if (state.pendingTrade) return { type: 'RESPOND_TRADE', accept: false };
  if (state.pendingAuction) return { type: 'PASS_BID' };
  if (state.phase === 'jail') return { type: 'ROLL_JAIL' };
  if (state.phase === 'roll') return { type: 'ROLL' };
  if (me && state.pendingDebt && me.cash < 0) return settleDebt(state, me);
  if (state.pendingPurchase !== null) return { type: 'DECLINE' };
  return { type: 'END_TURN' };
}

/** Play out bot turns until a human must act or the game ends. */
export function advanceMonopolyAi(state: MonopolyState): MonopolyState {
  let s = state;
  for (let guard = 0; s.phase !== 'over' && guard < 1_000_000; guard++) {
    const actor = s.players.find((p) => p.id === monopolyActor(s));
    if (!actor || !actor.isAI) break;
    s = applyAction(s, chooseMonopolyAction(s));
  }
  return s;
}
