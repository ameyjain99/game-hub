import { makeRng } from '../../../shared/rng';
import { BOARD, GO_SALARY, GO_TO_JAIL_ID, JAIL_ID } from './board';
import { CHANCE, CHEST, type CardEffect } from './cards';
import {
  currentPlayer,
  currentSeat,
  type MonopolyPlayer,
  type MonopolyState,
  type PendingTrade,
  type TradeBundle,
} from './state';
import { Action, IllegalActionError } from './actions';
import {
  rentFor,
  canBuild,
  canSellHouse,
  canMortgage,
  canUnmortgage,
  mortgageValue,
  unmortgageCost,
  canRaise,
  netWorth,
} from './selectors';

const clone = (state: MonopolyState): MonopolyState => structuredClone(state);

const seatOf = (draft: MonopolyState, playerId: string): number =>
  draft.players.findIndex((p) => p.id === playerId);

function illegal(msg: string): never {
  throw new IllegalActionError(msg);
}

/** How many events the public log keeps. */
const LOG_LIMIT = 60;

/** A player token in a log line; the UI swaps it for their display name. */
const tag = (draft: MonopolyState, seat: number): string => `{${draft.players[seat].id}}`;

/** Append to the public event log, keeping only the most recent entries. */
function note(draft: MonopolyState, line: string): void {
  draft.log.push(line);
  if (draft.log.length > LOG_LIMIT) draft.log.splice(0, draft.log.length - LOG_LIMIT);
}

/** Roll two dice off the seeded RNG, advancing `rngState` in place. */
function drawDice(draft: MonopolyState): [number, number] {
  const rng = makeRng(draft.rngState);
  const d1 = Math.floor(rng.next() * 6) + 1;
  const d2 = Math.floor(rng.next() * 6) + 1;
  draft.rngState = rng.state;
  return [d1, d2];
}

function sendToJail(draft: MonopolyState, seat: number): void {
  note(draft, `${tag(draft, seat)} went to jail`);
  const p = draft.players[seat];
  p.position = JAIL_ID;
  p.inJail = true;
  p.jailRolls = 0;
  draft.doubles = 0;
}

/**
 * Move `seat` to `newPos` (paying Go salary when `collectGo`) and resolve the
 * landed space. Mutates the draft. Rent/tax/card/free-parking handling is layered
 * in by later tasks; this wires the dispatch and purchase offer.
 */
export function landOn(
  draft: MonopolyState,
  seat: number,
  newPos: number,
  collectGo: boolean,
): void {
  const p = draft.players[seat];
  p.position = newPos;
  if (collectGo) {
    p.cash += GO_SALARY;
    note(draft, `${tag(draft, seat)} passed Go and collected $${GO_SALARY}`);
  }

  const sp = BOARD[newPos];
  switch (sp.kind) {
    case 'go-to-jail':
      sendToJail(draft, seat);
      break;
    case 'go':
      if (draft.settings.doubleGoSalary) {
        p.cash += GO_SALARY; // doubles the exact-landing salary
        note(draft, `${tag(draft, seat)} landed right on Go: another $${GO_SALARY}`);
      }
      break;
    case 'property':
    case 'railroad':
    case 'utility': {
      const own = draft.ownership[newPos];
      if (own.owner === null) {
        draft.pendingPurchase = newPos;
      } else if (own.owner !== p.id && !own.mortgaged) {
        payRentOnLanding(draft, seat, newPos);
      }
      break;
    }
    case 'tax':
      payTax(draft, seat, newPos);
      break;
    case 'free-parking':
      collectFreeParking(draft, seat);
      break;
    case 'chance':
    case 'chest':
      drawCard(draft, seat, sp.kind);
      break;
    default:
      break;
  }
  if (draft.phase !== 'over') draft.phase = 'action';
}

const diceTotal = (draft: MonopolyState): number =>
  draft.dice ? draft.dice[0] + draft.dice[1] : 0;

const ownedIds = (draft: MonopolyState, ownerId: string): number[] =>
  Object.keys(draft.ownership)
    .map(Number)
    .filter((id) => draft.ownership[id].owner === ownerId);

/** Settle a debt. If the debtor cannot cover it even by liquidating everything,
 *  they go bankrupt to the creditor (or the bank). Otherwise the money moves and,
 *  if that leaves them negative, a pendingDebt flags that they must liquidate. */
function pay(
  draft: MonopolyState,
  debtorSeat: number,
  creditorSeat: number | null,
  amount: number,
  toPot = false,
): void {
  const debtor = draft.players[debtorSeat];
  if (amount > canRaise(draft, debtor.id)) {
    bankrupt(draft, debtorSeat, creditorSeat);
    return;
  }
  debtor.cash -= amount;
  if (toPot) draft.freeParkingPot += amount;
  else if (creditorSeat !== null) draft.players[creditorSeat].cash += amount;
  if (debtor.cash < 0) {
    // The current player may liquidate interactively; anyone else (forced card
    // payments) must settle now so no seat is left stuck off-turn.
    if (debtorSeat === currentSeat(draft)) draft.pendingDebt = { debtor: debtorSeat, creditor: creditorSeat };
    else liquidateToZero(draft, debtorSeat);
  }
}

/** Crudely raise a seat's cash to ≥0 by selling buildings then mortgaging. */
function liquidateToZero(draft: MonopolyState, seat: number): void {
  const id = draft.players[seat].id;
  let guard = 0;
  while (draft.players[seat].cash < 0 && guard++ < 200) {
    const built = ownedIds(draft, id).find(
      (s) => BOARD[s].kind === 'property' && draft.ownership[s].houses > 0,
    );
    if (built !== undefined) {
      const own = draft.ownership[built];
      draft.players[seat].cash += Math.floor(BOARD[built].houseCost! / 2);
      if (own.houses === 5) {
        own.houses = 4;
        draft.hotelsLeft += 1;
        draft.housesLeft -= 4;
      } else {
        own.houses -= 1;
        draft.housesLeft += 1;
      }
      continue;
    }
    const lot = ownedIds(draft, id).find((s) => !draft.ownership[s].mortgaged);
    if (lot !== undefined) {
      draft.ownership[lot].mortgaged = true;
      draft.players[seat].cash += mortgageValue(lot);
      continue;
    }
    break;
  }
}

function credit(draft: MonopolyState, seat: number, amount: number): void {
  draft.players[seat].cash += amount;
}

/** Hand everything the bankrupt owes to the creditor, or back to the bank. */
function bankrupt(draft: MonopolyState, debtorSeat: number, creditorSeat: number | null): void {
  const debtor = draft.players[debtorSeat];
  const ids = ownedIds(draft, debtor.id);
  note(draft, `${tag(draft, debtorSeat)} went bankrupt`);
  if (creditorSeat !== null) {
    const cr = draft.players[creditorSeat];
    if (debtor.cash > 0) cr.cash += debtor.cash;
    for (const id of ids) draft.ownership[id].owner = cr.id; // buildings & mortgage carry over
    cr.getOutCards += debtor.getOutCards;
  } else {
    for (const id of ids) {
      const own = draft.ownership[id];
      if (BOARD[id].kind === 'property') {
        if (own.houses === 5) draft.hotelsLeft += 1;
        else draft.housesLeft += own.houses;
      }
      own.owner = null;
      own.houses = 0;
      own.mortgaged = false;
    }
    if (debtor.getOutCards > 0) {
      draft.chanceJailOut = false;
      draft.chestJailOut = false;
    }
  }
  debtor.cash = 0;
  debtor.getOutCards = 0;
  debtor.bankrupt = true;
  draft.pendingDebt = null;
  checkWin(draft);
}

function checkWin(draft: MonopolyState): void {
  const alive = draft.players.filter((p) => !p.bankrupt);
  if (alive.length === 1) {
    draft.winner = alive[0].id;
    draft.phase = 'over';
  }
}

function payRentOnLanding(draft: MonopolyState, seat: number, spaceId: number): void {
  const owner = draft.ownership[spaceId].owner!;
  const ownerSeat = seatOf(draft, owner);
  const rent = rentFor(draft, spaceId, diceTotal(draft));
  note(draft, `${tag(draft, seat)} paid $${rent} rent to ${tag(draft, ownerSeat)}`);
  pay(draft, seat, ownerSeat, rent);
}

function payTax(draft: MonopolyState, seat: number, spaceId: number): void {
  const amount = BOARD[spaceId].taxAmount ?? 0;
  note(draft, `${tag(draft, seat)} paid $${amount} ${BOARD[spaceId].name}`);
  pay(draft, seat, null, amount, draft.settings.freeParkingJackpot);
}

function collectFreeParking(draft: MonopolyState, seat: number): void {
  if (!draft.settings.freeParkingJackpot) return;
  if (draft.freeParkingPot > 0) note(draft, `${tag(draft, seat)} collected the $${draft.freeParkingPot} Free Parking jackpot`);
  draft.players[seat].cash += draft.freeParkingPot;
  draft.freeParkingPot = 0;
}

/** The next railroad/utility at or after `from` (wrapping), with Go collected if wrapped. */
function nearest(from: number, kind: 'railroad' | 'utility'): { pos: number; wrapped: boolean } {
  for (let step = 1; step <= 40; step++) {
    const pos = (from + step) % 40;
    if (BOARD[pos].kind === kind) return { pos, wrapped: from + step >= 40 };
  }
  return { pos: from, wrapped: false };
}

function applyCardEffect(draft: MonopolyState, seat: number, deck: 'chance' | 'chest', effect: CardEffect): void {
  const p = draft.players[seat];
  switch (effect.kind) {
    case 'move-to':
      landOn(draft, seat, effect.space, effect.collectGo ?? false);
      break;
    case 'move-rel': {
      const pos = (p.position + effect.delta + 40) % 40;
      landOn(draft, seat, pos, false); // going back never collects Go
      break;
    }
    case 'nearest': {
      const { pos, wrapped } = nearest(p.position, effect.target);
      landOn(draft, seat, pos, wrapped);
      break;
    }
    case 'collect':
      credit(draft, seat, effect.amount);
      break;
    case 'pay':
      pay(draft, seat, null, effect.amount);
      break;
    case 'pay-per-building': {
      let houses = 0;
      let hotels = 0;
      for (const id of Object.keys(draft.ownership).map(Number)) {
        const own = draft.ownership[id];
        if (own.owner !== p.id) continue;
        if (own.houses === 5) hotels += 1;
        else houses += own.houses;
      }
      pay(draft, seat, null, effect.perHouse * houses + effect.perHotel * hotels);
      break;
    }
    case 'jail':
      sendToJail(draft, seat);
      break;
    case 'get-out-free':
      p.getOutCards += 1;
      if (deck === 'chance') draft.chanceJailOut = true;
      else draft.chestJailOut = true;
      break;
    case 'collect-from-each':
      for (let i = 0; i < draft.players.length; i++) {
        if (i === seat || draft.players[i].bankrupt) continue;
        pay(draft, i, seat, effect.amount);
      }
      break;
    case 'pay-each':
      for (let i = 0; i < draft.players.length; i++) {
        if (draft.players[seat].bankrupt) break;
        if (i === seat || draft.players[i].bankrupt) continue;
        pay(draft, seat, i, effect.amount);
      }
      break;
  }
}

function drawCard(draft: MonopolyState, seat: number, deck: 'chance' | 'chest'): void {
  const cards = deck === 'chance' ? CHANCE : CHEST;
  const order = deck === 'chance' ? draft.chanceOrder : draft.chestOrder;
  const jailOut = deck === 'chance' ? draft.chanceJailOut : draft.chestJailOut;
  let ptr = deck === 'chance' ? draft.chancePtr : draft.chestPtr;

  // Cycle the shuffled order; skip the Get-Out card while a player holds it.
  let card = cards[order[ptr]];
  for (let guard = 0; guard < order.length && card.effect.kind === 'get-out-free' && jailOut; guard++) {
    ptr = (ptr + 1) % order.length;
    card = cards[order[ptr]];
  }
  const nextPtr = (ptr + 1) % order.length;
  if (deck === 'chance') draft.chancePtr = nextPtr;
  else draft.chestPtr = nextPtr;

  note(draft, `${tag(draft, seat)} drew ${deck === 'chance' ? 'Chance' : 'Community Chest'}: ${card.text}`);
  draft.lastCard = { deck, text: card.text, playerId: draft.players[seat].id, atRoll: draft.rollSeq };
  applyCardEffect(draft, seat, deck, card.effect);
}

/** Open a bank auction for a declined/unaffordable lot, open to all solvent
 *  players in turn order starting from the current player. */
function openAuction(draft: MonopolyState, spaceId: number): void {
  const current = currentSeat(draft);
  note(draft, `${BOARD[spaceId].name} goes up for auction`);
  const order = draft.turnOrder;
  const start = order.indexOf(current);
  const participants: number[] = [];
  for (let i = 0; i < order.length; i++) {
    const seat = order[(start + i) % order.length];
    if (!draft.players[seat].bankrupt) participants.push(seat);
  }
  draft.pendingAuction = {
    spaceId,
    participants,
    passed: [],
    highBid: 0,
    highBidder: null,
    turn: participants[0],
  };
  draft.pendingPurchase = null;
  draft.phase = 'auction';
}

function resolveAuction(draft: MonopolyState): void {
  const a = draft.pendingAuction!;
  if (a.highBidder !== null) {
    const seat = a.highBidder;
    draft.players[seat].cash -= a.highBid;
    draft.ownership[a.spaceId].owner = draft.players[seat].id;
    note(draft, `${tag(draft, seat)} won ${BOARD[a.spaceId].name} at auction for $${a.highBid}`);
  } else {
    note(draft, `Nobody bid, so ${BOARD[a.spaceId].name} stays with the bank`);
  }
  draft.pendingAuction = null;
  draft.phase = 'action';
}

/** Advance to the next bidder who must still act, or resolve when only the high
 *  bidder (or nobody) remains. */
function afterAuctionMove(draft: MonopolyState): void {
  const a = draft.pendingAuction!;
  const pending = a.participants.filter((s) => !a.passed.includes(s) && s !== a.highBidder);
  if (pending.length === 0) {
    resolveAuction(draft);
    return;
  }
  const order = a.participants;
  const start = order.indexOf(a.turn);
  for (let i = 1; i <= order.length; i++) {
    const seat = order[(start + i) % order.length];
    if (pending.includes(seat)) {
      a.turn = seat;
      return;
    }
  }
}

function bid(draft: MonopolyState, amount: number): void {
  const a = draft.pendingAuction;
  if (!a) illegal('no auction');
  const seat = a.turn;
  if (amount <= a.highBid) illegal('bid must exceed the standing bid');
  if (amount > draft.players[seat].cash) illegal('bid exceeds cash');
  a.highBid = amount;
  a.highBidder = seat;
  afterAuctionMove(draft);
}

function passBid(draft: MonopolyState): void {
  const a = draft.pendingAuction;
  if (!a) illegal('no auction');
  a.passed.push(a.turn);
  afterAuctionMove(draft);
}

function buy(draft: MonopolyState): void {
  if (draft.phase !== 'action' || draft.pendingPurchase === null) illegal('nothing to buy');
  const seat = currentSeat(draft);
  const spaceId = draft.pendingPurchase;
  const price = BOARD[spaceId].price!;
  if (draft.players[seat].cash < price) illegal('cannot afford');
  draft.players[seat].cash -= price;
  draft.ownership[spaceId].owner = draft.players[seat].id;
  draft.pendingPurchase = null;
  note(draft, `${tag(draft, seat)} bought ${BOARD[spaceId].name} for $${price}`);
}

function decline(draft: MonopolyState): void {
  if (draft.pendingPurchase === null) illegal('nothing to decline');
  const spaceId = draft.pendingPurchase;
  if (draft.settings.auctions) {
    openAuction(draft, spaceId);
  } else {
    draft.pendingPurchase = null;
    draft.phase = 'action';
  }
}

/** Building, selling and mortgaging happen on the current player's own turn —
 *  never while an auction or trade has handed the floor to someone else. */
function requireOwnTurn(draft: MonopolyState): void {
  const ownTurn = draft.phase === 'roll' || draft.phase === 'jail' || draft.phase === 'action';
  if (!ownTurn || draft.pendingAuction || draft.pendingTrade) illegal('not now');
}

function build(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (!canBuild(draft, me.id, spaceId)) illegal('cannot build here');
  const own = draft.ownership[spaceId];
  me.cash -= BOARD[spaceId].houseCost!;
  if (own.houses === 4) {
    own.houses = 5; // hotel
    draft.hotelsLeft -= 1;
    draft.housesLeft += 4; // 4 houses return to the bank
  } else {
    own.houses += 1;
    draft.housesLeft -= 1;
  }
  note(draft, `{${me.id}} built a ${own.houses === 5 ? 'hotel' : 'house'} on ${BOARD[spaceId].name}`);
}

function clearDebtIfSettled(draft: MonopolyState): void {
  if (draft.pendingDebt && draft.players[draft.pendingDebt.debtor].cash >= 0) draft.pendingDebt = null;
}

function sellHouse(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (!canSellHouse(draft, me.id, spaceId)) illegal('cannot sell here');
  const own = draft.ownership[spaceId];
  me.cash += Math.floor(BOARD[spaceId].houseCost! / 2);
  if (own.houses === 5) {
    own.houses = 4; // hotel breaks back into 4 houses
    draft.hotelsLeft += 1;
    draft.housesLeft -= 4;
  } else {
    own.houses -= 1;
    draft.housesLeft += 1;
  }
  note(draft, `{${me.id}} sold a building on ${BOARD[spaceId].name}`);
  clearDebtIfSettled(draft);
}

function mortgage(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (draft.ownership[spaceId].owner !== me.id || !canMortgage(draft, spaceId)) illegal('cannot mortgage');
  draft.ownership[spaceId].mortgaged = true;
  me.cash += mortgageValue(spaceId);
  note(draft, `{${me.id}} mortgaged ${BOARD[spaceId].name} for $${mortgageValue(spaceId)}`);
  clearDebtIfSettled(draft);
}

function unmortgage(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (!canUnmortgage(draft, me.id, spaceId)) illegal('cannot unmortgage');
  draft.ownership[spaceId].mortgaged = false;
  me.cash -= unmortgageCost(spaceId);
  note(draft, `{${me.id}} paid off the mortgage on ${BOARD[spaceId].name}`);
}

const JAIL_FINE = 50;

function payJail(draft: MonopolyState): void {
  const seat = currentSeat(draft);
  const me = draft.players[seat];
  if (draft.phase !== 'jail' || !me.inJail) illegal('not in jail');
  note(draft, `${tag(draft, seat)} paid $${JAIL_FINE} to leave jail`);
  pay(draft, seat, null, JAIL_FINE);
  if (me.bankrupt) return;
  me.inJail = false;
  me.jailRolls = 0;
  draft.phase = 'roll'; // still owes a move this turn
}

function useJailCard(draft: MonopolyState): void {
  const me = currentPlayer(draft);
  if (draft.phase !== 'jail' || !me.inJail || me.getOutCards < 1) illegal('no jail card');
  me.getOutCards -= 1;
  me.inJail = false;
  me.jailRolls = 0;
  note(draft, `{${me.id}} used a Get Out of Jail Free card`);
  // Return the card to whichever deck it came from (the one currently out).
  if (draft.chanceJailOut) draft.chanceJailOut = false;
  else if (draft.chestJailOut) draft.chestJailOut = false;
  draft.phase = 'roll';
}

function rollJail(draft: MonopolyState): void {
  const seat = currentSeat(draft);
  const me = draft.players[seat];
  if (draft.phase !== 'jail' || !me.inJail) illegal('not in jail');
  const [d1, d2] = drawDice(draft);
  draft.dice = [d1, d2];
  draft.rollSeq += 1;
  if (d1 === d2) {
    note(draft, `${tag(draft, seat)} rolled double ${d1}s and left jail`);
    me.inJail = false;
    me.jailRolls = 0;
    draft.doubles = 0; // leaving jail on doubles does not grant another roll
    landOn(draft, seat, (me.position + d1 + d2) % 40, false);
    return;
  }
  me.jailRolls += 1;
  if (me.jailRolls >= 3) {
    note(draft, `${tag(draft, seat)} paid $${JAIL_FINE} after three tries and left jail`);
    pay(draft, seat, null, JAIL_FINE);
    if (me.bankrupt) return;
    me.inJail = false;
    me.jailRolls = 0;
    landOn(draft, seat, (me.position + d1 + d2) % 40, false);
  } else {
    draft.phase = 'action'; // stays in jail; turn will end
  }
}

/** Move to an absolute space, collecting Go if the index wraps past 0. */
export function advanceToSpace(
  state: MonopolyState,
  seat: number,
  newPos: number,
  collectGo: boolean,
): MonopolyState {
  const draft = clone(state);
  landOn(draft, seat, newPos, collectGo);
  settleTurn(draft);
  return draft;
}

function roll(draft: MonopolyState): void {
  if (draft.phase !== 'roll') illegal('cannot roll now');
  const seat = currentSeat(draft);
  const p: MonopolyPlayer = draft.players[seat];
  const [d1, d2] = drawDice(draft);
  draft.dice = [d1, d2];
  draft.rollSeq += 1;
  note(draft, `${tag(draft, seat)} rolled ${d1} + ${d2}${d1 === d2 ? ', doubles' : ''}`);

  if (d1 === d2) {
    draft.doubles += 1;
    if (draft.doubles === 3) {
      sendToJail(draft, seat);
      draft.phase = 'action';
      return;
    }
  } else {
    draft.doubles = 0;
  }

  const raw = p.position + d1 + d2;
  landOn(draft, seat, raw % 40, raw >= 40);
}

/** Whether `playerId` can presently deliver everything in a bundle. */
function canDeliver(draft: MonopolyState, playerId: string, bundle: TradeBundle): boolean {
  const p = draft.players.find((x) => x.id === playerId);
  if (!p || p.bankrupt) return false;
  if (p.cash < bundle.cash) return false;
  if (p.getOutCards < bundle.getOutCards) return false;
  return bundle.properties.every((id) => {
    const own = draft.ownership[id];
    return own && own.owner === playerId && own.houses === 0; // no built-up lots
  });
}

function proposeTrade(draft: MonopolyState, trade: PendingTrade): void {
  if (draft.phase !== 'action') illegal('cannot trade now');
  if (trade.from !== currentPlayer(draft).id) illegal('only the current player may propose');
  if (!canDeliver(draft, trade.from, trade.give)) illegal('you cannot deliver that offer');
  const to = draft.players.find((p) => p.id === trade.to);
  if (!to || to.bankrupt) illegal('no such trade partner');
  draft.pendingTrade = trade;
  draft.tradesThisTurn += 1;
  note(draft, `{${trade.from}} offered {${trade.to}} a trade`);
  draft.phase = 'trade';
}

/** Move a mortgaged lot: the receiver pays the bank a 10% interest fee. */
function moveProperty(draft: MonopolyState, spaceId: number, toSeat: number): void {
  const own = draft.ownership[spaceId];
  own.owner = draft.players[toSeat].id;
  if (own.mortgaged) draft.players[toSeat].cash -= Math.ceil(mortgageValue(spaceId) * 0.1);
}

function respondTrade(draft: MonopolyState, accept: boolean): void {
  const t = draft.pendingTrade;
  if (!t) illegal('no trade to answer');
  draft.pendingTrade = null;
  draft.phase = 'action';
  if (!accept) {
    note(draft, `{${t.to}} turned down the trade`);
    return;
  }
  // Re-validate both sides at accept time — no partial transfer.
  if (!canDeliver(draft, t.from, t.give) || !canDeliver(draft, t.to, t.receive)) {
    note(draft, `The trade between {${t.from}} and {${t.to}} fell through`);
    return;
  }
  note(draft, `{${t.to}} accepted {${t.from}}'s trade`);

  const fromSeat = seatOf(draft, t.from);
  const toSeat = seatOf(draft, t.to);
  draft.players[fromSeat].cash += t.receive.cash - t.give.cash;
  draft.players[toSeat].cash += t.give.cash - t.receive.cash;
  draft.players[fromSeat].getOutCards += t.receive.getOutCards - t.give.getOutCards;
  draft.players[toSeat].getOutCards += t.give.getOutCards - t.receive.getOutCards;
  for (const id of t.give.properties) moveProperty(draft, id, toSeat);
  for (const id of t.receive.properties) moveProperty(draft, id, fromSeat);
}

/** After any action: if the player whose turn it is has gone bankrupt (and no
 *  auction/trade still needs answering), play moves straight on to the next seat. */
function settleTurn(draft: MonopolyState): void {
  if (draft.phase === 'over' || draft.pendingAuction || draft.pendingTrade) return;
  if (!currentPlayer(draft).bankrupt) return;
  draft.pendingPurchase = null;
  draft.doubles = 0;
  nextActive(draft);
}

/** A game this long is pathological (usually all-bot with no development); end it
 *  by net worth rather than run forever. Far beyond any real human sitting. */
const MAX_TURNS = 2000;

/** Advance `current` to the next non-bankrupt seat and set its opening phase. */
function nextActive(draft: MonopolyState): void {
  const n = draft.turnOrder.length;
  for (let i = 1; i <= n; i++) {
    const idx = (draft.current + i) % n;
    if (!draft.players[draft.turnOrder[idx]].bankrupt) {
      draft.current = idx;
      break;
    }
  }
  draft.turns += 1;
  draft.tradesThisTurn = 0;
  if (draft.turns >= MAX_TURNS) {
    endGameInPlace(draft);
    return;
  }
  const next = currentPlayer(draft);
  draft.phase = next.inJail ? 'jail' : 'roll';
  draft.dice = null;
}

function endTurn(draft: MonopolyState): void {
  if (draft.phase !== 'action') illegal('cannot end turn now');
  if (draft.pendingPurchase !== null || draft.pendingAuction || draft.pendingTrade) {
    illegal('resolve the pending action first');
  }
  const me = currentPlayer(draft);
  if (me.cash < 0) illegal('settle your debt first');
  // A non-jail double earns the same player another roll.
  if (draft.dice && draft.dice[0] === draft.dice[1] && !me.inJail && draft.doubles > 0) {
    draft.phase = 'roll';
    return;
  }
  draft.doubles = 0;
  nextActive(draft);
}

function declareBankruptcy(draft: MonopolyState): void {
  const seat = currentSeat(draft);
  const creditor = draft.pendingDebt?.creditor ?? null;
  bankrupt(draft, seat, creditor);
  if (draft.phase !== 'over') {
    draft.doubles = 0;
    nextActive(draft);
  }
}

/** End the game outright, ranking the survivors by net worth. */
function endGameInPlace(draft: MonopolyState): void {
  const alive = draft.players.filter((p) => !p.bankrupt);
  if (alive.length > 0) {
    let best = alive[0];
    for (const p of alive) if (netWorth(draft, p.id) > netWorth(draft, best.id)) best = p;
    draft.winner = best.id;
  }
  draft.phase = 'over';
}

/** End the game when no human player remains in it (all left or went bankrupt). */
export function finishIfAbandoned(state: MonopolyState): MonopolyState {
  const draft = clone(state);
  if (draft.phase === 'over') return draft;
  if (!draft.players.some((p) => !p.isAI && !p.bankrupt)) endGameInPlace(draft);
  return draft;
}

/** Remove a seat entirely: its assets return to the bank and it is skipped. */
export function removePlayer(state: MonopolyState, seatIndex: number): MonopolyState {
  const draft = clone(state);
  const id = draft.players[seatIndex].id;
  // A trade with the departing player can no longer happen.
  if (draft.pendingTrade && (draft.pendingTrade.from === id || draft.pendingTrade.to === id)) {
    draft.pendingTrade = null;
    draft.phase = 'action';
  }
  // Drop them from a running auction; move the bid on if it was theirs to make.
  const a = draft.pendingAuction;
  if (a && a.participants.includes(seatIndex)) {
    if (!a.passed.includes(seatIndex)) a.passed.push(seatIndex);
    if (a.highBidder === seatIndex) {
      a.highBidder = null;
      a.highBid = 0;
    }
    const waiting = a.participants.filter((s) => !a.passed.includes(s) && s !== a.highBidder);
    if (a.turn === seatIndex || waiting.length === 0) afterAuctionMove(draft);
  }
  bankrupt(draft, seatIndex, null);
  settleTurn(draft);
  return draft;
}

export function endGame(state: MonopolyState): MonopolyState {
  const draft = clone(state);
  endGameInPlace(draft);
  return draft;
}

export function applyAction(state: MonopolyState, action: Action): MonopolyState {
  const draft = clone(state);
  switch (action.type) {
    case 'ROLL':
      roll(draft);
      break;
    case 'BUY':
      buy(draft);
      break;
    case 'DECLINE':
      decline(draft);
      break;
    case 'BID':
      bid(draft, action.amount);
      break;
    case 'PASS_BID':
      passBid(draft);
      break;
    case 'BUILD':
      build(draft, action.spaceId);
      break;
    case 'SELL_HOUSE':
      sellHouse(draft, action.spaceId);
      break;
    case 'MORTGAGE':
      mortgage(draft, action.spaceId);
      break;
    case 'UNMORTGAGE':
      unmortgage(draft, action.spaceId);
      break;
    case 'PAY_JAIL':
      payJail(draft);
      break;
    case 'USE_JAIL_CARD':
      useJailCard(draft);
      break;
    case 'ROLL_JAIL':
      rollJail(draft);
      break;
    case 'END_TURN':
      endTurn(draft);
      break;
    case 'DECLARE_BANKRUPTCY':
      declareBankruptcy(draft);
      break;
    case 'PROPOSE_TRADE':
      proposeTrade(draft, action.trade);
      break;
    case 'RESPOND_TRADE':
      respondTrade(draft, action.accept);
      break;
    default:
      illegal('unhandled action');
  }
  settleTurn(draft);
  return draft;
}

export { GO_TO_JAIL_ID };
