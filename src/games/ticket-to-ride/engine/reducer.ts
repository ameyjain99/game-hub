import { CARD_COLORS, type CardCombo, type GameState, type Hand, type PlayerState, type TrainCard } from './types';
import { type Action, IllegalActionError } from './actions';
import { drawOne, dealMarket } from './deck';
import { getRoute, routeIsClaimable } from './selectors';
import { cityById, modeFor } from './maps';
import { routePoints, finalScores } from './scoring';
import { payExtra, spentCards, tunnelExtra } from './tunnel';
import { bonusesFor } from './bonuses';

function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      hand: { ...p.hand },
      claimedRouteIds: [...p.claimedRouteIds],
      tickets: [...p.tickets],
      pendingTickets: [...p.pendingTickets],
      stations: [...p.stations],
    })),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    market: [...state.market],
    ticketPile: [...state.ticketPile],
    claimedBy: { ...state.claimedBy },
    log: [...state.log],
  };
}

function currentPlayer(state: GameState): PlayerState {
  return state.players[state.current];
}

const LOG_CAP = 60;
const cityName = (id: string): string => cityById.get(id)?.name ?? id;
/** "is"/"are" agreeing with the subject, so the local "You" seat reads naturally. */
const toBe = (name: string): string => (name === 'You' ? 'are' : 'is');
/** Append a human-readable event to the game log (kept to the last LOG_CAP). */
function pushLog(s: GameState, line: string): void {
  s.log.push(line);
  if (s.log.length > LOG_CAP) s.log.splice(0, s.log.length - LOG_CAP);
}

/** The seat after `from` that is still in the game (skips removed players). */
function nextActive(state: GameState, from: number): number {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (!state.players[i].removed) return i;
  }
  return from; // no one left (caller handles game-over)
}

/** Finalize the just-moved player's turn: handle end trigger and advance. */
function endTurn(state: GameState): GameState {
  const s = clone(state);
  s.drawnThisTurn = 0;

  const mover = s.players[s.current];
  if (s.finalTurnsLeft === null) {
    // The last round gives every still-active player one more turn.
    if (mover.trainsLeft <= 2) s.finalTurnsLeft = s.players.filter((p) => !p.removed).length;
  } else {
    s.finalTurnsLeft -= 1;
    if (s.finalTurnsLeft <= 0) {
      return finishGame(s);
    }
  }

  s.current = nextActive(s, s.current);
  return s;
}

function finishGame(state: GameState): GameState {
  const s = clone(state);
  s.phase = 'game-over';
  s.finalTurnsLeft = 0;
  // Removed players are excluded from scoring (and from the bonus cards).
  const scores = finalScores(s.players.filter((p) => !p.removed), bonusesFor(s.mapId, s.modeId));
  for (const p of s.players) p.score = scores[p.id]?.total ?? 0;
  pushLog(s, 'Game over.');
  return s;
}

/**
 * End the game if no human players are left to drive it — e.g. every human has
 * been removed or replaced by a bot. Otherwise an all-bot game (where Normal
 * bots stop claiming near the end) would never reach the end trigger.
 */
export function finishIfAbandoned(state: GameState): GameState {
  if (state.phase === 'game-over') return state;
  const humanLeft = state.players.some((p) => !p.removed && !p.isAI);
  return humanLeft ? state : finishGame(state);
}

/** Force the game to end now and score it (the caller decides it's abandoned,
 *  e.g. the last connected human dropped). A no-op once already over. */
export function endGame(state: GameState): GameState {
  return state.phase === 'game-over' ? state : finishGame(state);
}

/**
 * Remove a player from the game entirely: return their train cards to the
 * discard pile and their tickets to the pile, free every route and station they
 * claimed (trains go back on the board so others can re-claim), and skip them
 * for the rest of the game. If only one player is left, the game ends.
 */
export function removePlayer(state: GameState, seatIndex: number): GameState {
  const s = clone(state);
  const p = s.players[seatIndex];
  if (!p || p.removed) return s;

  // Train cards back to the discard pile; destination tickets back to the pile.
  const cards: TrainCard[] = [...CARD_COLORS, 'locomotive'];
  for (const c of cards) {
    for (let i = 0; i < p.hand[c]; i++) s.discardPile.push(c);
    p.hand[c] = 0;
  }
  s.ticketPile.push(...p.tickets, ...p.pendingTickets);
  p.tickets = [];
  p.pendingTickets = [];

  // Free every route they claimed — the segments reopen for the other players.
  for (const routeId of p.claimedRouteIds) delete s.claimedBy[routeId];
  p.claimedRouteIds = [];
  p.stations = [];

  p.removed = true;
  p.isAI = false; // never acts again
  p.score = 0;
  pushLog(s, `${p.name} left the game.`);

  if (s.phase === 'game-over') return s;

  // One player (or none) left → wrap up now.
  if (s.players.filter((x) => !x.removed).length <= 1) return finishGame(s);

  // If the game was paused on their turn, hand off to the next active player.
  if (s.current === seatIndex) {
    s.drawnThisTurn = 0;
    s.pendingTunnel = null;
    if (s.phase === 'tunnel-decision' || s.phase === 'draw-tickets') s.phase = 'turn';
    // A pending final-turn counter still counts this skipped turn.
    if (s.finalTurnsLeft !== null) {
      s.finalTurnsLeft -= 1;
      if (s.finalTurnsLeft <= 0) return finishGame(s);
    }
    s.current = nextActive(s, seatIndex);
  }
  return s;
}

function requireTurn(state: GameState): void {
  if (state.phase !== 'turn') {
    throw new IllegalActionError(`cannot act: phase is ${state.phase}`);
  }
}

function removeCards(hand: Hand, combo: CardCombo): void {
  if (combo.colorCount > 0 && combo.color) hand[combo.color] -= combo.colorCount;
  hand.locomotive -= combo.locomotives;
}

/** A second draw needs a deck card or a non-locomotive market card; otherwise the turn ends. */
function canDrawAgain(s: GameState): boolean {
  return s.drawPile.length + s.discardPile.length > 0 || s.market.some((c) => c !== 'locomotive');
}

function applyDrawTrain(state: GameState, action: Extract<Action, { type: 'DRAW_TRAIN' }>): GameState {
  requireTurn(state);

  if (action.source === 'deck') {
    const { card, state: after } = drawOne(state);
    if (card === null) throw new IllegalActionError('no cards left to draw');
    const s = clone(after);
    s.players[s.current].hand[card]++;
    s.drawnThisTurn++;
    // Deck draws are secret — never log the card's color.
    pushLog(s, `${s.players[s.current].name} drew a card from the deck.`);
    return s.drawnThisTurn >= 2 || !canDrawAgain(s) ? endTurn(s) : s;
  }

  // market draw
  const card = state.market[action.index];
  if (card === undefined) throw new IllegalActionError('no such market card');
  if (card === 'locomotive' && state.drawnThisTurn === 1) {
    throw new IllegalActionError('cannot take a face-up locomotive as the second draw');
  }

  const takingFaceUpLoco = card === 'locomotive' && state.drawnThisTurn === 0;

  let s = clone(state);
  s.players[s.current].hand[card]++;
  s.market.splice(action.index, 1);
  s = dealMarket(s);
  // Face-up (market) cards are public, so naming the color is fine.
  pushLog(s, `${s.players[s.current].name} took a face-up ${card} card.`);

  if (takingFaceUpLoco) return endTurn(s); // whole turn
  s.drawnThisTurn++;
  return s.drawnThisTurn >= 2 || !canDrawAgain(s) ? endTurn(s) : s;
}

function applyClaimRoute(
  state: GameState,
  action: Extract<Action, { type: 'CLAIM_ROUTE' }>,
): GameState {
  requireTurn(state);
  if (state.drawnThisTurn !== 0) {
    throw new IllegalActionError('cannot claim a route after drawing this turn');
  }
  const player = currentPlayer(state);
  const route = getRoute(action.routeId);
  if (!route) throw new IllegalActionError('no such route');
  if (!routeIsClaimable(state, action.routeId, player.id)) {
    throw new IllegalActionError('route is not claimable');
  }
  if (player.trainsLeft < route.length) {
    throw new IllegalActionError('not enough trains');
  }

  const { color, colorCount, locomotives } = action.combo;
  if (colorCount + locomotives !== route.length) {
    throw new IllegalActionError('card count does not match route length');
  }
  if (locomotives < route.locomotivesRequired) {
    throw new IllegalActionError('not enough locomotives for this route');
  }
  if (locomotives > player.hand.locomotive) {
    throw new IllegalActionError('not enough locomotives in hand');
  }
  if (colorCount > 0) {
    if (!color) throw new IllegalActionError('missing color for colored payment');
    if (route.color !== 'grey' && color !== route.color) {
      throw new IllegalActionError('wrong color for this route');
    }
    if (player.hand[color] < colorCount) {
      throw new IllegalActionError('not enough colored cards in hand');
    }
  }

  // Tunnels: reveal the top 3 deck cards; they may demand extra matching cards.
  if (route.isTunnel) {
    let cur = state;
    const flipped: TrainCard[] = [];
    for (let i = 0; i < 3; i++) {
      const { card, state: after } = drawOne(cur);
      if (card === null) break;
      flipped.push(card);
      cur = after;
    }
    const extra = tunnelExtra(flipped, action.combo);

    if (extra === 0) {
      // Nothing extra owed — complete the claim immediately.
      const s = clone(cur);
      const p = s.players[s.current];
      removeCards(p.hand, action.combo);
      s.discardPile.push(...spentCards(action.combo), ...flipped);
      s.claimedBy[route.id] = p.id;
      p.claimedRouteIds.push(route.id);
      p.trainsLeft -= route.length;
      p.score += routePoints(route.length);
      pushLog(s, `${p.name} claimed the tunnel ${cityName(route.a)} → ${cityName(route.b)}.`);
      return endTurn(s);
    }

    // Extra owed — hand the decision to the player.
    const s = clone(cur);
    s.pendingTunnel = { routeId: route.id, combo: action.combo, flipped, extra };
    s.phase = 'tunnel-decision';
    pushLog(s, `${s.players[s.current].name} ${toBe(s.players[s.current].name)} going through a tunnel…`);
    return s;
  }

  const s = clone(state);
  const p = s.players[s.current];
  removeCards(p.hand, action.combo);
  s.discardPile.push(...spentCards(action.combo));

  s.claimedBy[route.id] = p.id;
  p.claimedRouteIds.push(route.id);
  p.trainsLeft -= route.length;
  p.score += routePoints(route.length);
  pushLog(s, `${p.name} claimed ${cityName(route.a)} → ${cityName(route.b)}.`);

  return endTurn(s);
}

function applyResolveTunnel(
  state: GameState,
  action: Extract<Action, { type: 'RESOLVE_TUNNEL' }>,
): GameState {
  if (state.phase !== 'tunnel-decision' || !state.pendingTunnel) {
    throw new IllegalActionError('no tunnel awaiting a decision');
  }
  const pt = state.pendingTunnel;
  const route = getRoute(pt.routeId)!;

  const s = clone(state);
  const p = s.players[s.current];
  s.discardPile.push(...pt.flipped); // flipped cards are always discarded
  s.pendingTunnel = null;
  s.phase = 'turn';

  if (!action.commit) {
    pushLog(s, `${p.name} backed out of the tunnel ${cityName(route.a)} → ${cityName(route.b)}.`);
    return endTurn(s); // aborted: keep cards, no claim, turn is spent
  }

  const extraCards = payExtra(p.hand, pt.combo, pt.extra);
  if (!extraCards) throw new IllegalActionError('cannot afford the tunnel');

  removeCards(p.hand, pt.combo);
  for (const c of extraCards) p.hand[c]--;
  s.discardPile.push(...spentCards(pt.combo), ...extraCards);

  s.claimedBy[route.id] = p.id;
  p.claimedRouteIds.push(route.id);
  p.trainsLeft -= route.length;
  p.score += routePoints(route.length);
  pushLog(s, `${p.name} claimed the tunnel ${cityName(route.a)} → ${cityName(route.b)}.`);

  return endTurn(s);
}

/** How many cards the player's next station costs: 1, then 2, then 3. */
export function stationCost(player: PlayerState): number {
  return player.stations.length + 1;
}

function applyPlaceStation(
  state: GameState,
  action: Extract<Action, { type: 'PLACE_STATION' }>,
): GameState {
  requireTurn(state);
  if (state.drawnThisTurn !== 0) {
    throw new IllegalActionError('cannot place a station after drawing this turn');
  }
  const player = currentPlayer(state);
  if (player.stationsLeft <= 0) throw new IllegalActionError('no stations left');
  if (!cityById.has(action.city)) throw new IllegalActionError('no such city');
  if (state.players.some((p) => p.stations.includes(action.city))) {
    throw new IllegalActionError('city already has a station');
  }

  const cost = stationCost(player);
  const { color, colorCount, locomotives } = action.combo;
  if (colorCount + locomotives !== cost) {
    throw new IllegalActionError(`station costs ${cost} matching cards`);
  }
  if (locomotives > player.hand.locomotive) {
    throw new IllegalActionError('not enough locomotives in hand');
  }
  if (colorCount > 0) {
    if (!color) throw new IllegalActionError('missing color for colored payment');
    if (player.hand[color] < colorCount) throw new IllegalActionError('not enough colored cards');
  }

  const s = clone(state);
  const p = s.players[s.current];
  removeCards(p.hand, action.combo);
  s.discardPile.push(...spentCards(action.combo));
  p.stations.push(action.city);
  p.stationsLeft -= 1;
  pushLog(s, `${p.name} placed a station at ${cityName(action.city)}.`);
  return endTurn(s);
}

function applyDrawTickets(state: GameState): GameState {
  requireTurn(state);
  if (state.drawnThisTurn !== 0) {
    throw new IllegalActionError('cannot draw tickets after drawing cards this turn');
  }
  if (state.ticketPile.length === 0) throw new IllegalActionError('no tickets left');

  const s = clone(state);
  const offered = s.ticketPile.splice(0, modeFor(s.mapId, s.modeId).ticketDraw);
  s.players[s.current].pendingTickets = offered;
  s.phase = 'draw-tickets';
  pushLog(s, `${s.players[s.current].name} ${toBe(s.players[s.current].name)} choosing destination tickets…`);
  return s;
}

function applyKeepTickets(
  state: GameState,
  action: Extract<Action, { type: 'KEEP_TICKETS' }>,
): GameState {
  if (state.phase !== 'draw-tickets') {
    throw new IllegalActionError('not currently choosing tickets');
  }
  const player = currentPlayer(state);
  const pendingIds = new Set(player.pendingTickets.map((t) => t.id));
  if (action.keptIds.length < 1) throw new IllegalActionError('must keep at least one ticket');
  if (!action.keptIds.every((id) => pendingIds.has(id))) {
    throw new IllegalActionError('kept ticket not among the offered tickets');
  }

  const s = clone(state);
  const p = s.players[s.current];
  const kept = p.pendingTickets.filter((t) => action.keptIds.includes(t.id));
  const returned = p.pendingTickets.filter((t) => !action.keptIds.includes(t.id));
  p.tickets.push(...kept);
  p.pendingTickets = [];
  s.ticketPile.push(...returned); // returned to the bottom of the pile
  s.phase = 'turn';
  pushLog(s, `${p.name} kept ${kept.length} destination ticket${kept.length === 1 ? '' : 's'}.`);
  return endTurn(s);
}

function applyConfirmSetupTickets(
  state: GameState,
  action: Extract<Action, { type: 'CONFIRM_SETUP_TICKETS' }>,
): GameState {
  if (state.phase !== 'setup-tickets') {
    throw new IllegalActionError('not in setup');
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) throw new IllegalActionError('no such player');
  if (player.pendingTickets.length === 0) {
    throw new IllegalActionError('player already confirmed setup tickets');
  }
  const { setupKeep } = modeFor(state.mapId, state.modeId);
  if (new Set(action.keptIds).size < setupKeep) {
    throw new IllegalActionError(`must keep at least ${setupKeep} tickets`);
  }
  const pendingIds = new Set(player.pendingTickets.map((t) => t.id));
  if (!action.keptIds.every((id) => pendingIds.has(id))) {
    throw new IllegalActionError('kept ticket not among the dealt tickets');
  }

  const s = clone(state);
  const p = s.players.find((x) => x.id === action.playerId)!;
  p.tickets.push(...p.pendingTickets.filter((t) => action.keptIds.includes(t.id)));
  // Unkept setup tickets go to the bottom of the pile, as with a mid-game draw.
  s.ticketPile.push(...p.pendingTickets.filter((t) => !action.keptIds.includes(t.id)));
  p.pendingTickets = [];
  pushLog(s, `${p.name} ${toBe(p.name)} ready.`);

  if (s.players.every((x) => x.pendingTickets.length === 0)) {
    s.phase = 'turn';
    s.current = 0;
    pushLog(s, 'The game begins!');
  }
  return s;
}

/**
 * Forfeit the current player's turn (server-issued on a turn-timer timeout).
 * Picks the safe default for whatever the player was mid-doing: back out of a
 * tunnel, auto-keep the first offered ticket, otherwise just end the turn.
 */
function applySkipTurn(state: GameState): GameState {
  if (state.phase === 'tunnel-decision') {
    return applyResolveTunnel(withTimeoutLog(state), { type: 'RESOLVE_TUNNEL', commit: false });
  }
  if (state.phase === 'draw-tickets') {
    const first = currentPlayer(state).pendingTickets[0];
    if (!first) throw new IllegalActionError('no tickets to keep');
    return applyKeepTickets(withTimeoutLog(state), { type: 'KEEP_TICKETS', keptIds: [first.id] });
  }
  if (state.phase !== 'turn') throw new IllegalActionError('cannot skip in this phase');
  return endTurn(withTimeoutLog(state));
}

/** Clone + note that the current player's turn timed out. */
function withTimeoutLog(state: GameState): GameState {
  const s = clone(state);
  pushLog(s, `${currentPlayer(s).name} ran out of time.`);
  return s;
}

/** Pure reducer: validates and applies an action, returning a new state. */
export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'CONFIRM_SETUP_TICKETS':
      return applyConfirmSetupTickets(state, action);
    case 'DRAW_TRAIN':
      return applyDrawTrain(state, action);
    case 'CLAIM_ROUTE':
      return applyClaimRoute(state, action);
    case 'RESOLVE_TUNNEL':
      return applyResolveTunnel(state, action);
    case 'PLACE_STATION':
      return applyPlaceStation(state, action);
    case 'DRAW_TICKETS':
      return applyDrawTickets(state);
    case 'KEEP_TICKETS':
      return applyKeepTickets(state, action);
    case 'SKIP_TURN':
      return applySkipTurn(state);
  }
}
