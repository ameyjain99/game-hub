import { makeRng } from '../../../shared/rng';
import { SPEED_FACES, createMonopolyGame, type SpeedFace } from './state';
import { cardSpace, groupIds, isMega, layoutOf, spaceName, spacesOf, type ColorGroup, type Space } from './board';
import { MEGA } from './mega';
import { CHANCE, CHEST, cardText, type CardEffect } from './cards';
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
  canBuildDepot,
  canSellDepot,
  ownsFullSet,
  nextAhead,
  rentSquares,
  ticketTargets,
  unownedIds,
  HOTEL,
  SKYSCRAPER,
} from './selectors';

const clone = (state: MonopolyState): MonopolyState => structuredClone(state);

/** A square of the board in play. */
const spaceAt = (draft: MonopolyState, id: number): Space => spacesOf(draft.settings.board)[id];
const sizeOf = (draft: MonopolyState): number => layoutOf(draft.settings.board).size;
const megaGame = (draft: MonopolyState): boolean => isMega(draft.settings.board);

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

/** Roll the Mega Edition's speed die. */
function drawSpeed(draft: MonopolyState): SpeedFace {
  const rng = makeRng(draft.rngState);
  const face = SPEED_FACES[Math.floor(rng.next() * SPEED_FACES.length)];
  draft.rngState = rng.state;
  return face;
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
  p.position = layoutOf(draft.settings.board).jail;
  p.inJail = true;
  p.jailRolls = 0;
  draft.doubles = 0;
  if (megaGame(draft)) draft.bonus = null; // no bonus move from Jail
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
  const salary = draft.settings.goSalary;
  if (collectGo) {
    p.cash += salary;
    p.passedGo = true;
    note(draft, `${tag(draft, seat)} passed Go and collected $${salary}`);
  }

  const sp = spaceAt(draft, newPos);
  switch (sp.kind) {
    case 'auction':
      landOnAuction(draft, seat);
      return;
    case 'bus-ticket':
      if ((draft.busLeft ?? 0) > 0) drawTicket(draft, seat);
      break;
    case 'birthday':
      // The money, or a Bus Ticket while any are left.
      if ((draft.busLeft ?? 0) > 0) draft.choice = { kind: 'birthday' };
      else giveBirthdayCash(draft, seat);
      break;
    case 'go-to-jail':
      sendToJail(draft, seat);
      break;
    case 'go':
      if (draft.settings.doubleGoSalary) {
        p.cash += salary; // doubles the exact-landing salary
        note(draft, `${tag(draft, seat)} landed right on Go: another $${salary}`);
      }
      break;
    case 'property':
    case 'railroad':
    case 'utility': {
      const own = draft.ownership[newPos];
      if (own.owner === null) {
        // Buying can wait for a first lap: until then the property simply stays with the bank.
        if (draft.settings.firstLapBuy && !p.passedGo) note(draft, `${tag(draft, seat)} cannot buy ${spaceName(newPos, draft.settings.board)} before passing Go`);
        else draft.pendingPurchase = newPos;
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

/** The white dice only: the speed die never counts toward a utility's rent. */
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

/** Take one building off a lot and pay its owner half its cost; the bank's stock is updated. */
function sellOneBuilding(draft: MonopolyState, seat: number, spaceId: number): void {
  const own = draft.ownership[spaceId];
  draft.players[seat].cash += Math.floor(spaceAt(draft, spaceId).houseCost! / 2);
  if (own.houses === SKYSCRAPER) {
    own.houses = HOTEL; // a skyscraper comes back down to a hotel
    draft.skyscrapersLeft = (draft.skyscrapersLeft ?? 0) + 1;
    draft.hotelsLeft -= 1;
  } else if (own.houses === HOTEL) {
    own.houses = 4; // a hotel breaks back into 4 houses
    draft.hotelsLeft += 1;
    draft.housesLeft -= 4;
  } else {
    own.houses -= 1;
    draft.housesLeft += 1;
  }
}

function sellOneDepot(draft: MonopolyState, seat: number, spaceId: number): void {
  draft.ownership[spaceId].depot = false;
  draft.depotsLeft = (draft.depotsLeft ?? 0) + 1;
  draft.players[seat].cash += MEGA.depotCost / 2;
}

/** Crudely raise a seat's cash to ≥0 by selling buildings then mortgaging. */
function liquidateToZero(draft: MonopolyState, seat: number): void {
  const id = draft.players[seat].id;
  let guard = 0;
  while (draft.players[seat].cash < 0 && guard++ < 400) {
    // The tallest building first, so the even-building rule is kept on the way down.
    const built = ownedIds(draft, id)
      .filter((s) => draft.ownership[s].houses > 0)
      .sort((x, y) => draft.ownership[y].houses - draft.ownership[x].houses)[0];
    if (built !== undefined) {
      sellOneBuilding(draft, seat, built);
      continue;
    }
    const depot = ownedIds(draft, id).find((s) => draft.ownership[s].depot);
    if (depot !== undefined) {
      sellOneDepot(draft, seat, depot);
      continue;
    }
    const lot = ownedIds(draft, id).find((s) => !draft.ownership[s].mortgaged);
    if (lot !== undefined) {
      draft.ownership[lot].mortgaged = true;
      draft.players[seat].cash += mortgageValue(draft, lot);
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
    cr.busTickets = (cr.busTickets ?? 0) + (debtor.busTickets ?? 0);
    for (const group of new Set(ids.map((id) => spaceAt(draft, id).group).filter(Boolean) as ColorGroup[])) completeSet(draft, creditorSeat, group);
  } else {
    for (const id of ids) {
      const own = draft.ownership[id];
      if (own.houses === SKYSCRAPER) draft.skyscrapersLeft = (draft.skyscrapersLeft ?? 0) + 1;
      else if (own.houses === HOTEL) draft.hotelsLeft += 1;
      else draft.housesLeft += own.houses;
      if (own.depot) draft.depotsLeft = (draft.depotsLeft ?? 0) + 1;
      own.owner = null;
      own.houses = 0;
      own.mortgaged = false;
      own.depot = false;
    }
    if (debtor.getOutCards > 0) {
      draft.chanceJailOut = false;
      draft.chestJailOut = false;
    }
  }
  debtor.cash = 0;
  debtor.getOutCards = 0;
  debtor.busTickets = 0;
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
  // A utility reached without a roll (a Bus Ticket) is paid on a fresh roll of the two white dice.
  if (spaceAt(draft, spaceId).kind === 'utility' && !draft.dice) {
    draft.dice = drawDice(draft);
    draft.rollSeq += 1;
    note(draft, `${tag(draft, seat)} rolled ${draft.dice[0]} + ${draft.dice[1]} for the utility`);
  }
  const rent = rentFor(draft, spaceId, diceTotal(draft));
  note(draft, `${tag(draft, seat)} paid $${rent} rent to ${tag(draft, ownerSeat)}`);
  pay(draft, seat, ownerSeat, rent);
}

function payTax(draft: MonopolyState, seat: number, spaceId: number): void {
  const printed = spaceAt(draft, spaceId).taxAmount ?? 0;
  const INCOME_TAX_ID = spacesOf(draft.settings.board).find((sp) => sp.kind === 'tax')!.id;
  // Income Tax at 10% of everything you own, when that is less than the printed amount.
  const tenth = Math.floor(netWorth(draft, draft.players[seat].id) / 10);
  const amount = draft.settings.incomeTaxTenPercent && spaceId === INCOME_TAX_ID ? Math.min(printed, tenth) : printed;
  note(draft, `${tag(draft, seat)} paid $${amount} ${spaceName(spaceId, draft.settings.board)}`);
  pay(draft, seat, null, amount, draft.settings.freeParkingJackpot);
}

function collectFreeParking(draft: MonopolyState, seat: number): void {
  const prize = draft.settings.freeParkingPrize;
  if (prize > 0) {
    draft.players[seat].cash += prize;
    note(draft, `${tag(draft, seat)} collected the $${prize} Free Parking prize`);
  }
  if (!draft.settings.freeParkingJackpot) return;
  if (draft.freeParkingPot > 0) note(draft, `${tag(draft, seat)} collected the $${draft.freeParkingPot} Free Parking jackpot`);
  draft.players[seat].cash += draft.freeParkingPot;
  draft.freeParkingPot = 0;
}

/** The next railroad/utility at or after `from` (wrapping), with Go collected if wrapped. */
function nearest(draft: MonopolyState, from: number, kind: 'railroad' | 'utility'): { pos: number; wrapped: boolean } {
  return nextAhead(draft, from, (id) => spaceAt(draft, id).kind === kind) ?? { pos: from, wrapped: false };
}

function applyCardEffect(draft: MonopolyState, seat: number, deck: 'chance' | 'chest', effect: CardEffect): void {
  const p = draft.players[seat];
  switch (effect.kind) {
    case 'move-to':
      landOn(draft, seat, cardSpace(effect.space, draft.settings.board), effect.collectGo ?? false);
      break;
    case 'move-rel': {
      const pos = (p.position + effect.delta + sizeOf(draft)) % sizeOf(draft);
      landOn(draft, seat, pos, false); // going back never collects Go
      break;
    }
    case 'nearest': {
      const { pos, wrapped } = nearest(draft, p.position, effect.target);
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
        if (own.houses >= HOTEL) hotels += 1; // a skyscraper is charged as a hotel
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

  note(draft, `${tag(draft, seat)} drew ${deck === 'chance' ? 'Chance' : 'Community Chest'}: ${cardText(card, draft.settings.board, draft.settings.goSalary)}`);
  draft.lastCard = { deck, text: cardText(card, draft.settings.board, draft.settings.goSalary), playerId: draft.players[seat].id, atRoll: draft.rollSeq };
  applyCardEffect(draft, seat, deck, card.effect);
}

/** Open a bank auction for a declined/unaffordable lot, open to all solvent
 *  players in turn order starting from the current player. */
function openAuction(draft: MonopolyState, spaceId: number): void {
  const current = currentSeat(draft);
  note(draft, `${spaceName(spaceId, draft.settings.board)} goes up for auction`);
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
    note(draft, `${tag(draft, seat)} won ${spaceName(a.spaceId, draft.settings.board)} at auction for $${a.highBid}`);
    afterAcquire(draft, seat, a.spaceId);
  } else {
    note(draft, `Nobody bid, so ${spaceName(a.spaceId, draft.settings.board)} stays with the bank`);
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
  const price = spaceAt(draft, spaceId).price!;
  if (draft.players[seat].cash < price) illegal('cannot afford');
  draft.players[seat].cash -= price;
  draft.ownership[spaceId].owner = draft.players[seat].id;
  draft.pendingPurchase = null;
  note(draft, `${tag(draft, seat)} bought ${spaceName(spaceId, draft.settings.board)} for $${price}`);
  afterAcquire(draft, seat, spaceId);
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

/** Building, selling and mortgaging happen on the current player's own turn -
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
  me.cash -= spaceAt(draft, spaceId).houseCost!;
  if (own.houses === HOTEL) {
    own.houses = SKYSCRAPER; // the hotel goes back to the bank
    draft.skyscrapersLeft = (draft.skyscrapersLeft ?? 0) - 1;
    draft.hotelsLeft += 1;
  } else if (own.houses === 4) {
    own.houses = HOTEL;
    draft.hotelsLeft -= 1;
    draft.housesLeft += 4; // 4 houses return to the bank
  } else {
    own.houses += 1;
    draft.housesLeft -= 1;
  }
  const what = own.houses === SKYSCRAPER ? 'skyscraper' : own.houses === HOTEL ? 'hotel' : 'house';
  note(draft, `{${me.id}} built a ${what} on ${spaceName(spaceId, draft.settings.board)}`);
}

function buildDepot(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (!canBuildDepot(draft, me.id, spaceId)) illegal('cannot build a depot here');
  me.cash -= MEGA.depotCost;
  draft.ownership[spaceId].depot = true;
  draft.depotsLeft = (draft.depotsLeft ?? 0) - 1;
  note(draft, `{${me.id}} built a train depot on ${spaceName(spaceId, draft.settings.board)}`);
}

function sellDepot(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const seat = currentSeat(draft);
  if (!canSellDepot(draft, draft.players[seat].id, spaceId)) illegal('no depot to sell here');
  sellOneDepot(draft, seat, spaceId);
  note(draft, `${tag(draft, seat)} sold the train depot on ${spaceName(spaceId, draft.settings.board)}`);
  clearDebtIfSettled(draft);
}

function clearDebtIfSettled(draft: MonopolyState): void {
  if (draft.pendingDebt && draft.players[draft.pendingDebt.debtor].cash >= 0) draft.pendingDebt = null;
}

function sellHouse(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (!canSellHouse(draft, me.id, spaceId)) illegal('cannot sell here');
  sellOneBuilding(draft, currentSeat(draft), spaceId);
  note(draft, `{${me.id}} sold a building on ${spaceName(spaceId, draft.settings.board)}`);
  clearDebtIfSettled(draft);
}

function mortgage(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (draft.ownership[spaceId].owner !== me.id || !canMortgage(draft, spaceId)) illegal('cannot mortgage');
  draft.ownership[spaceId].mortgaged = true;
  me.cash += mortgageValue(draft, spaceId);
  note(draft, `{${me.id}} mortgaged ${spaceName(spaceId, draft.settings.board)} for $${mortgageValue(draft, spaceId)}`);
  clearDebtIfSettled(draft);
}

function unmortgage(draft: MonopolyState, spaceId: number): void {
  requireOwnTurn(draft);
  const me = currentPlayer(draft);
  if (!canUnmortgage(draft, me.id, spaceId)) illegal('cannot unmortgage');
  draft.ownership[spaceId].mortgaged = false;
  me.cash -= unmortgageCost(draft, spaceId);
  note(draft, `{${me.id}} paid off the mortgage on ${spaceName(spaceId, draft.settings.board)}`);
}

function payJail(draft: MonopolyState): void {
  const seat = currentSeat(draft);
  const me = draft.players[seat];
  if (draft.phase !== 'jail' || !me.inJail) illegal('not in jail');
  const fine = draft.settings.jailFine;
  note(draft, `${tag(draft, seat)} paid $${fine} to leave jail`);
  pay(draft, seat, null, fine);
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
  if (megaGame(draft)) draft.speedDie = null; // only the two white dice are rolled in Jail
  draft.rollSeq += 1;
  if (d1 === d2) {
    note(draft, `${tag(draft, seat)} rolled double ${d1}s and left jail`);
    me.inJail = false;
    me.jailRolls = 0;
    draft.doubles = 0; // leaving jail on doubles does not grant another roll
    landOn(draft, seat, (me.position + d1 + d2) % sizeOf(draft), false);
    return;
  }
  me.jailRolls += 1;
  const tries = draft.settings.jailTurns;
  if (me.jailRolls >= tries) {
    const fine = draft.settings.jailFine;
    note(draft, `${tag(draft, seat)} paid $${fine} after ${tries === 1 ? 'one try' : `${tries} tries`} and left jail`);
    pay(draft, seat, null, fine);
    if (me.bankrupt) return;
    me.inJail = false;
    me.jailRolls = 0;
    landOn(draft, seat, (me.position + d1 + d2) % sizeOf(draft), false);
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
  // Mega: the speed die is rolled with the two white dice.
  const speed = megaGame(draft) ? drawSpeed(draft) : null;
  if (megaGame(draft)) draft.speedDie = speed;
  draft.rollSeq += 1;
  const speedText = speed === null ? '' : speed === 'mr' ? ' and Mr. Monopoly' : speed === 'bus' ? ' and the Bus' : ` + ${speed}`;
  note(draft, `${tag(draft, seat)} rolled ${d1} + ${d2}${speedText}${d1 === d2 ? ', doubles' : ''}`);

  // Triples (all three dice the same): move to any square, and no second roll. Not counted as doubles.
  if (typeof speed === 'number' && d1 === d2 && d1 === speed) {
    note(draft, `${tag(draft, seat)} rolled triple ${d1}s and may move to any square`);
    draft.doubles = 0;
    draft.choice = { kind: 'triples' };
    draft.phase = 'action';
    return;
  }

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

  const size = sizeOf(draft);
  const raw = p.position + d1 + d2 + (typeof speed === 'number' ? speed : 0);
  if (megaGame(draft)) draft.bonus = speed === 'mr' || speed === 'bus' ? speed : null;
  landOn(draft, seat, raw % size, raw >= size);
  if (megaGame(draft) && (p.inJail || p.bankrupt)) draft.bonus = null;
}

// ---------------------------------------------------------------------------
// The Mega Edition: bus tickets, the speed die's bonus moves, the Auction, Bus
// Ticket and Birthday Gift squares, and what happens when a colour set is completed.

/** Take the top Bus Ticket. An expiry ticket makes every other ticket held, the drawer's too, worthless. */
function drawTicket(draft: MonopolyState, seat: number): void {
  const deck = draft.busDeck ?? [];
  if (deck.length === 0) return;
  const expires = deck.shift()!;
  draft.busLeft = deck.length;
  const p = draft.players[seat];
  if (expires) {
    for (const other of draft.players) other.busTickets = 0;
    p.busTickets = 1;
    note(draft, `${tag(draft, seat)} drew a Bus Ticket: all other Bus Tickets expire`);
  } else {
    p.busTickets = (p.busTickets ?? 0) + 1;
    note(draft, `${tag(draft, seat)} took a Bus Ticket`);
  }
}

function giveBirthdayCash(draft: MonopolyState, seat: number): void {
  draft.players[seat].cash += MEGA.birthdayGift;
  note(draft, `${tag(draft, seat)} collected a $${MEGA.birthdayGift} birthday gift`);
}

/** Auction: name an unowned property for the bank to sell. With none left, go and pay the dearest rent on the board. */
function landOnAuction(draft: MonopolyState, seat: number): void {
  draft.phase = 'action';
  if (unownedIds(draft).length > 0) {
    draft.choice = { kind: 'auction' };
    return;
  }
  const me = draft.players[seat];
  const owed = rentSquares(draft, me.id, diceTotal(draft));
  if (owed.length === 0) return;
  const size = sizeOf(draft);
  const ahead = (id: number) => (id - me.position + size) % size;
  const rentAt = (id: number) => rentFor(draft, id, diceTotal(draft) || 7);
  // The highest rent; the nearer square when two are equal.
  const target = [...owed].sort((x, y) => rentAt(y) - rentAt(x) || ahead(x) - ahead(y))[0];
  note(draft, `Every property is owned: ${tag(draft, seat)} moves to ${spaceName(target, draft.settings.board)}`);
  landOn(draft, seat, target, target < me.position);
}

/** Instead of rolling: a Bus Ticket to a square further along this side of the board. */
function useTicket(draft: MonopolyState, space: number): void {
  if (draft.phase !== 'roll') illegal('a Bus Ticket is used in place of a roll');
  const seat = currentSeat(draft);
  const me = draft.players[seat];
  if (me.inJail) illegal('not from Jail');
  if ((me.busTickets ?? 0) < 1) illegal('no Bus Ticket');
  if (!ticketTargets(draft, me.position).includes(space)) illegal('a Bus Ticket only goes further along this side of the board');
  me.busTickets = (me.busTickets ?? 0) - 1;
  // The ticket takes the place of the roll: no dice, no doubles, no speed die bonus.
  draft.dice = null;
  draft.speedDie = null;
  draft.doubles = 0;
  draft.bonus = null;
  note(draft, `${tag(draft, seat)} rode a Bus Ticket to ${spaceName(space, draft.settings.board)}`);
  landOn(draft, seat, space, space < me.position);
}

/** Whether the current player still has something to settle before a bonus move or a new choice. */
function busy(draft: MonopolyState): boolean {
  return draft.pendingPurchase !== null || !!draft.pendingAuction || !!draft.pendingTrade || currentPlayer(draft).cash < 0;
}

/** The speed die's bonus, taken once the ordinary move has been dealt with. */
function takeBonus(draft: MonopolyState, take: 'ticket' | 'move' | undefined): void {
  if (draft.phase !== 'action' || !draft.bonus) illegal('no bonus move to take');
  if (busy(draft) || draft.choice) illegal('finish this square first');
  const seat = currentSeat(draft);
  const me = draft.players[seat];
  const bonus = draft.bonus;
  draft.bonus = null;
  if (bonus === 'bus') {
    // A ticket for later, or a ride to the next Chance or Community Chest square.
    if (take === 'ticket') {
      if ((draft.busLeft ?? 0) < 1) illegal('no Bus Tickets are left');
      drawTicket(draft, seat);
      return;
    }
    const card = nextAhead(draft, me.position, (id) => spaceAt(draft, id).kind === 'chance' || spaceAt(draft, id).kind === 'chest');
    if (card) landOn(draft, seat, card.pos, card.wrapped);
    return;
  }
  // Mr. Monopoly: on to the next unowned property, which may be bought. With none left, to the next rent owed.
  const unowned = nextAhead(draft, me.position, (id) => draft.ownership[id]?.owner === null);
  if (unowned) {
    note(draft, `Mr. Monopoly takes ${tag(draft, seat)} on to ${spaceName(unowned.pos, draft.settings.board)}`);
    landOn(draft, seat, unowned.pos, unowned.wrapped);
    return;
  }
  const owed = new Set(rentSquares(draft, me.id, diceTotal(draft)));
  const rent = nextAhead(draft, me.position, (id) => owed.has(id));
  if (!rent) {
    note(draft, `Mr. Monopoly finds nothing for ${tag(draft, seat)} to pay`);
    return;
  }
  note(draft, `Mr. Monopoly takes ${tag(draft, seat)} on to ${spaceName(rent.pos, draft.settings.board)}`);
  landOn(draft, seat, rent.pos, rent.wrapped);
}

/** Answer the choice owed: where triples take you, what to auction, or which birthday gift. */
function choose(draft: MonopolyState, space: number | undefined, take: 'cash' | 'ticket' | undefined): void {
  const choice = draft.choice;
  if (draft.phase !== 'action' || !choice) illegal('nothing to choose');
  const seat = currentSeat(draft);
  const me = draft.players[seat];
  if (choice.kind === 'birthday') {
    if (take !== 'cash' && take !== 'ticket') illegal('take the money or a Bus Ticket');
    if (take === 'ticket' && (draft.busLeft ?? 0) < 1) illegal('no Bus Tickets are left');
    draft.choice = null;
    if (take === 'ticket') drawTicket(draft, seat);
    else giveBirthdayCash(draft, seat);
    return;
  }
  if (space === undefined || space < 0 || space >= sizeOf(draft)) illegal('name a square');
  if (choice.kind === 'auction') {
    if (!unownedIds(draft).includes(space)) illegal('that property is not for sale');
    draft.choice = null;
    openAuction(draft, space);
    return;
  }
  // Triples: any square but the one you are on.
  if (space === me.position) illegal('move to another square');
  draft.choice = null;
  landOn(draft, seat, space, space < me.position);
}

/**
 * Mega: completing a colour set that already has buildings. The street that
 * completed it is un-mortgaged at once, and the buildings are spread evenly
 * over every street of the set (hotels are broken down where needed).
 */
function completeSet(draft: MonopolyState, seat: number, group: ColorGroup): void {
  if (!megaGame(draft)) return;
  const me = draft.players[seat];
  if (!ownsFullSet(draft, me.id, group)) return;
  const lots = groupIds(group, draft.settings.board);
  const total = lots.reduce((n, id) => n + draft.ownership[id].houses, 0);
  if (total === 0) return;
  for (const id of lots) {
    const own = draft.ownership[id];
    if (!own.mortgaged) continue;
    own.mortgaged = false;
    note(draft, `${tag(draft, seat)} had to pay off the mortgage on ${spaceName(id, draft.settings.board)}`);
    pay(draft, seat, null, unmortgageCost(draft, id));
    if (me.bankrupt) return;
  }
  // Hand the buildings back, then deal them out again evenly, the dearest streets first.
  for (const id of lots) {
    const own = draft.ownership[id];
    if (own.houses === HOTEL) draft.hotelsLeft += 1;
    else draft.housesLeft += own.houses;
    own.houses = 0;
  }
  const order = [...lots].sort((x, y) => spaceAt(draft, y).price! - spaceAt(draft, x).price!);
  for (let left = total, k = 0; left > 0; k++) {
    draft.ownership[order[k % order.length]].houses += 1;
    left -= 1;
  }
  for (const id of lots) {
    const own = draft.ownership[id];
    if (own.houses === HOTEL) draft.hotelsLeft -= 1;
    else draft.housesLeft -= own.houses;
  }
  note(draft, `${tag(draft, seat)} completed a set: its buildings were spread evenly`);
}

/** What follows a property changing hands. */
function afterAcquire(draft: MonopolyState, seat: number, spaceId: number): void {
  const group = spaceAt(draft, spaceId).group;
  if (group) completeSet(draft, seat, group);
}

/** Whether `playerId` can presently deliver everything in a bundle. */
function canDeliver(draft: MonopolyState, playerId: string, bundle: TradeBundle): boolean {
  const p = draft.players.find((x) => x.id === playerId);
  if (!p || p.bankrupt) return false;
  if (p.cash < bundle.cash) return false;
  if (p.getOutCards < bundle.getOutCards) return false;
  if ((p.busTickets ?? 0) < (bundle.busTickets ?? 0)) return false;
  return bundle.properties.every((id) => {
    const own = draft.ownership[id];
    return own && own.owner === playerId && own.houses === 0 && !own.depot; // no built-up lots
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
  if (own.mortgaged) draft.players[toSeat].cash -= Math.ceil(mortgageValue(draft, spaceId) * 0.1);
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
  // Re-validate both sides at accept time - no partial transfer.
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
  const tickets = (t.receive.busTickets ?? 0) - (t.give.busTickets ?? 0);
  if (tickets !== 0) {
    draft.players[fromSeat].busTickets = (draft.players[fromSeat].busTickets ?? 0) + tickets;
    draft.players[toSeat].busTickets = (draft.players[toSeat].busTickets ?? 0) - tickets;
  }
  for (const id of t.give.properties) moveProperty(draft, id, toSeat);
  for (const id of t.receive.properties) moveProperty(draft, id, fromSeat);
  for (const id of t.give.properties) afterAcquire(draft, toSeat, id);
  for (const id of t.receive.properties) afterAcquire(draft, fromSeat, id);
}

/** After any action: if the player whose turn it is has gone bankrupt (and no
 *  auction/trade still needs answering), play moves straight on to the next seat. */
function settleTurn(draft: MonopolyState): void {
  if (draft.phase === 'over' || draft.pendingAuction || draft.pendingTrade) return;
  if (!currentPlayer(draft).bankrupt) return;
  draft.pendingPurchase = null;
  draft.doubles = 0;
  if (megaGame(draft)) {
    draft.bonus = null;
    draft.choice = null;
  }
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
      if (idx <= draft.current) draft.round += 1; // back round to the top of the order
      draft.current = idx;
      break;
    }
  }
  draft.turns += 1;
  // A game with a round limit ends when its last round has been played.
  if (draft.settings.roundLimit > 0 && draft.round > draft.settings.roundLimit) {
    note(draft, `The last of ${draft.settings.roundLimit} rounds is over: the highest net worth wins`);
    endGameInPlace(draft);
    return;
  }
  draft.tradesThisTurn = 0;
  if (draft.turns >= MAX_TURNS) {
    endGameInPlace(draft);
    return;
  }
  const next = currentPlayer(draft);
  draft.phase = next.inJail ? 'jail' : 'roll';
  draft.dice = null;
  if (megaGame(draft)) {
    draft.speedDie = null;
    draft.bonus = null;
    draft.choice = null;
  }
}

function endTurn(draft: MonopolyState): void {
  if (draft.phase !== 'action') illegal('cannot end turn now');
  if (draft.pendingPurchase !== null || draft.pendingAuction || draft.pendingTrade) {
    illegal('resolve the pending action first');
  }
  if (draft.choice) illegal('make your choice first');
  if (draft.bonus) illegal('take your bonus move first');
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

/** A fresh game for the same players, pieces and rules. */
function rematch(state: MonopolyState): MonopolyState {
  return createMonopolyGame(
    state.players.map((p) => ({ name: p.name, avatar: p.avatar, isAI: p.isAI, difficulty: p.difficulty })),
    (state.rngState ^ 0x9e3779b9) >>> 0,
    state.settings,
  );
}

export function applyAction(state: MonopolyState, action: Action): MonopolyState {
  if (action.type === 'REMATCH') {
    if (state.phase !== 'over') illegal('the game is still on');
    return rematch(state);
  }
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
    case 'BUILD_DEPOT':
      buildDepot(draft, action.spaceId);
      break;
    case 'SELL_DEPOT':
      sellDepot(draft, action.spaceId);
      break;
    case 'USE_TICKET':
      useTicket(draft, action.space);
      break;
    case 'BONUS':
      takeBonus(draft, action.take);
      break;
    case 'CHOOSE':
      choose(draft, action.space, action.take);
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
