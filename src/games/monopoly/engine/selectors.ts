import { groupIds, isMega, layoutOf, ownableIds, spacesOf, type ColorGroup, type Space } from './board';
import { MEGA } from './mega';
import type { MonopolyState } from './state';

const space = (state: MonopolyState, id: number): Space => spacesOf(state.settings.board)[id];
const player = (state: MonopolyState, id: string) => state.players.find((p) => p.id === id);

/** Houses on a lot: 1-4 houses, 5 a hotel, 6 a skyscraper (Mega Edition). */
export const HOTEL = 5;
export const SKYSCRAPER = 6;

/** Every property space in a group, on the board in play. */
function groupSpaceIds(state: MonopolyState, group: ColorGroup): number[] {
  return groupIds(group, state.settings.board);
}

/** All ownable space ids an owner holds. */
function ownedBy(state: MonopolyState, ownerId: string): number[] {
  return Object.keys(state.ownership)
    .map(Number)
    .filter((id) => state.ownership[id].owner === ownerId);
}

export function ownsFullSet(state: MonopolyState, ownerId: string, group: ColorGroup): boolean {
  return groupSpaceIds(state, group).every((id) => state.ownership[id].owner === ownerId);
}

/**
 * Whether `ownerId` holds enough of a colour set to build on it. On a standard
 * board that is the whole set. In the Mega Edition it is all but one street
 * (two of three, or three of four).
 */
export function ownsMajority(state: MonopolyState, ownerId: string, group: ColorGroup): boolean {
  const lots = groupSpaceIds(state, group);
  const mine = lots.filter((id) => state.ownership[id].owner === ownerId).length;
  return isMega(state.settings.board) ? mine >= lots.length - 1 : mine === lots.length;
}

/** The streets of a set that `ownerId` holds (the ones the even-building rule spreads houses over). */
function ownedLots(state: MonopolyState, ownerId: string, group: ColorGroup): number[] {
  return groupSpaceIds(state, group).filter((id) => state.ownership[id].owner === ownerId);
}

const countOwned = (state: MonopolyState, ownerId: string, kind: Space['kind']) => ownedBy(state, ownerId).filter((id) => space(state, id).kind === kind).length;

/** What a utility charges per pip of the dice: 4 with one, 10 with two, 20 with all three (Mega). */
export function utilityMultiplier(owned: number): number {
  return owned >= 3 ? 20 : owned === 2 ? 10 : 4;
}

/** Rent owed for landing on `spaceId` after rolling `diceTotal`. 0 if unowned,
 *  mortgaged, owned by nobody, or (with the house rule) the owner is jailed. */
export function rentFor(state: MonopolyState, spaceId: number, diceTotal: number): number {
  const sp = space(state, spaceId);
  const own = state.ownership[spaceId];
  if (!own || !own.owner || own.mortgaged) return 0;
  const owner = player(state, own.owner);
  if (!owner) return 0;
  if (state.settings.noRentInJail && owner.inJail) return 0;

  if (sp.kind === 'railroad') {
    const base = sp.rent![countOwned(state, own.owner, 'railroad') - 1] ?? 0;
    return own.depot ? base * 2 : base; // a train depot doubles its railroad's rent
  }
  if (sp.kind === 'utility') return diceTotal * utilityMultiplier(countOwned(state, own.owner, 'utility'));
  // Property.
  const rent = sp.rent!;
  if (own.houses === 0) {
    if (!state.settings.doubleRentFullSet) return rent[0];
    if (ownsFullSet(state, own.owner, sp.group!)) return rent[0] * (isMega(state.settings.board) ? 3 : 2);
    // Mega: all but one street of the set already doubles the rent of its bare sites.
    return isMega(state.settings.board) && ownsMajority(state, own.owner, sp.group!) ? rent[0] * 2 : rent[0];
  }
  if (own.houses >= SKYSCRAPER) return sp.skyscraper ?? rent[HOTEL];
  return rent[own.houses]; // houses 1-4 -> rent[1..4]; hotel (5) -> rent[5]
}

/** Whether `ownerId` could legally add a house, hotel or skyscraper to `spaceId` right now. */
export function canBuild(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const sp = space(state, spaceId);
  if (sp.kind !== 'property') return false;
  const own = state.ownership[spaceId];
  const mega = isMega(state.settings.board);
  if (own.owner !== ownerId || own.houses >= (mega ? SKYSCRAPER : HOTEL)) return false;
  if (!ownsMajority(state, ownerId, sp.group!)) return false;
  // A skyscraper needs the whole set (and, by the even rule below, a hotel on every street of it).
  if (own.houses === HOTEL && !ownsFullSet(state, ownerId, sp.group!)) return false;
  const lots = ownedLots(state, ownerId, sp.group!);
  if (lots.some((id) => state.ownership[id].mortgaged)) return false;
  const min = Math.min(...lots.map((id) => state.ownership[id].houses));
  if ((state.settings.evenBuild || own.houses === HOTEL) && own.houses > min) return false;
  const left = own.houses === HOTEL ? (state.skyscrapersLeft ?? 0) : own.houses === 4 ? state.hotelsLeft : state.housesLeft;
  if (left < 1) return false;
  const p = player(state, ownerId);
  return !!p && p.cash >= sp.houseCost!;
}

/** Whether a built-up lot can be sold back (even-build in reverse). */
export function canSellHouse(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const sp = space(state, spaceId);
  if (sp.kind !== 'property') return false;
  const own = state.ownership[spaceId];
  if (own.owner !== ownerId || own.houses < 1) return false;
  if (state.settings.evenBuild) {
    const max = Math.max(...ownedLots(state, ownerId, sp.group!).map((id) => state.ownership[id].houses));
    if (own.houses < max) return false;
  }
  return true;
}

/** Mega: a train depot can go on any railroad you own that is not mortgaged, while the bank has one. */
export function canBuildDepot(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  if (!isMega(state.settings.board) || space(state, spaceId).kind !== 'railroad') return false;
  const own = state.ownership[spaceId];
  const p = player(state, ownerId);
  return own.owner === ownerId && !own.mortgaged && !own.depot && (state.depotsLeft ?? 0) > 0 && !!p && p.cash >= MEGA.depotCost;
}

export function canSellDepot(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const own = state.ownership[spaceId];
  return !!own && own.owner === ownerId && !!own.depot;
}

export function canMortgage(state: MonopolyState, spaceId: number): boolean {
  if (!state.settings.mortgaging) return false;
  const own = state.ownership[spaceId];
  if (!own || !own.owner || own.mortgaged || own.depot) return false;
  const sp = space(state, spaceId);
  if (sp.kind === 'property') {
    // No lot in the group may carry buildings.
    if (groupSpaceIds(state, sp.group!).some((id) => state.ownership[id].houses > 0)) return false;
  }
  return true;
}

export function canUnmortgage(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const own = state.ownership[spaceId];
  if (!own || own.owner !== ownerId || !own.mortgaged) return false;
  const p = player(state, ownerId);
  return !!p && p.cash >= unmortgageCost(state, spaceId);
}

/** Half the printed price (mortgage proceeds / mortgage value). */
export function mortgageValue(state: MonopolyState, spaceId: number): number {
  return Math.floor(space(state, spaceId).price! / 2);
}

/** Mortgage value plus 10% interest to redeem. */
export function unmortgageCost(state: MonopolyState, spaceId: number): number {
  return Math.ceil(mortgageValue(state, spaceId) * 1.1);
}

/** A net-worth proxy: cash + property value + building cost paid. */
export function netWorth(state: MonopolyState, ownerId: string): number {
  const p = player(state, ownerId);
  let total = p?.cash ?? 0;
  for (const id of ownedBy(state, ownerId)) {
    const own = state.ownership[id];
    const sp = space(state, id);
    total += own.mortgaged ? mortgageValue(state, id) : sp.price!;
    if (sp.kind === 'property') total += own.houses * sp.houseCost!;
    if (own.depot) total += MEGA.depotCost;
  }
  return total;
}

/** The most cash a player could raise now: cash + building sell-backs + mortgaging. */
export function canRaise(state: MonopolyState, ownerId: string): number {
  const p = player(state, ownerId);
  let total = p?.cash ?? 0;
  for (const id of ownedBy(state, ownerId)) {
    const own = state.ownership[id];
    const sp = space(state, id);
    if (sp.kind === 'property') total += Math.floor((own.houses * sp.houseCost!) / 2);
    if (own.depot) total += MEGA.depotCost / 2;
    if (!own.mortgaged) total += mortgageValue(state, id);
  }
  return total;
}

/** Bid bounds in an auction: above the standing bid, capped at the bidder's cash. */
export function legalBid(
  state: MonopolyState,
  ownerId: string,
  highBid: number,
): { min: number; max: number } {
  const p = player(state, ownerId);
  return { min: highBid + 1, max: p?.cash ?? 0 };
}

/**
 * Whether `playerId` can open a trade right now: their own turn, after moving,
 * with nothing else (a purchase, an auction, a trade, a debt) awaiting them, and
 * someone left to trade with. Mirrors the reducer's PROPOSE_TRADE guard.
 */
export function canProposeTrade(state: MonopolyState, playerId: string): boolean {
  const me = player(state, playerId);
  const current = state.players[state.turnOrder[state.current]];
  return (
    !!me &&
    !me.bankrupt &&
    state.phase === 'action' &&
    current.id === playerId &&
    state.pendingPurchase === null &&
    !state.pendingAuction &&
    !state.pendingTrade &&
    !state.bonus &&
    !state.choice &&
    !(state.pendingDebt && me.cash < 0) &&
    state.players.some((p) => p.id !== playerId && !p.bankrupt)
  );
}

const COLOR_GROUPS: ColorGroup[] = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'];

/** Every colour set one player owns outright (a monopoly), with its owner. */
export function completedSets(state: MonopolyState): { group: ColorGroup; owner: string }[] {
  return COLOR_GROUPS.flatMap((group) => {
    const owner = state.ownership[groupSpaceIds(state, group)[0]].owner;
    return owner && ownsFullSet(state, owner, group) ? [{ group, owner }] : [];
  });
}

/** Every square that can be owned and is still the bank's. */
export function unownedIds(state: MonopolyState): number[] {
  return ownableIds(state.settings.board).filter((id) => state.ownership[id].owner === null);
}

/**
 * Where a Bus Ticket can take a token standing on `from`: any square further
 * along the same side of the board, up to and including the corner that ends
 * it. A token on a corner is at the start of the next side.
 */
export function ticketTargets(state: MonopolyState, from: number): number[] {
  const { size, side } = layoutOf(state.settings.board);
  const corner = (Math.floor(from / side) + 1) * side;
  const out: number[] = [];
  for (let at = from + 1; at <= corner; at++) out.push(at % size);
  return out;
}

/** The next square ahead of `from` that passes `test`, and whether reaching it passes Go. */
export function nextAhead(state: MonopolyState, from: number, test: (id: number) => boolean): { pos: number; wrapped: boolean } | null {
  const { size } = layoutOf(state.settings.board);
  for (let step = 1; step < size; step++) {
    const pos = (from + step) % size;
    if (test(pos)) return { pos, wrapped: from + step >= size };
  }
  return null;
}

/** The squares on which `playerId` would owe rent to someone else right now. */
export function rentSquares(state: MonopolyState, playerId: string, diceTotal: number): number[] {
  return ownableIds(state.settings.board).filter((id) => {
    const own = state.ownership[id];
    return !!own.owner && own.owner !== playerId && rentFor(state, id, diceTotal || 7) > 0;
  });
}
