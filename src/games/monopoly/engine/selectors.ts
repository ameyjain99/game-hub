import { BOARD, groupIds, type ColorGroup } from './board';
import type { MonopolyState } from './state';

const space = (id: number) => BOARD[id];
const player = (state: MonopolyState, id: string) => state.players.find((p) => p.id === id);

/** Every ownable space in a group (property groups only here). */
export function groupSpaceIds(group: ColorGroup): number[] {
  return groupIds(group);
}

/** All ownable space ids an owner holds. */
function ownedBy(state: MonopolyState, ownerId: string): number[] {
  return Object.keys(state.ownership)
    .map(Number)
    .filter((id) => state.ownership[id].owner === ownerId);
}

export function ownsFullSet(state: MonopolyState, ownerId: string, group: ColorGroup): boolean {
  return groupIds(group).every((id) => state.ownership[id].owner === ownerId);
}

/** Rent owed for landing on `spaceId` after rolling `diceTotal`. 0 if unowned,
 *  mortgaged, owned by nobody, or (with the house rule) the owner is jailed. */
export function rentFor(state: MonopolyState, spaceId: number, diceTotal: number): number {
  const sp = space(spaceId);
  const own = state.ownership[spaceId];
  if (!own || !own.owner || own.mortgaged) return 0;
  const owner = player(state, own.owner);
  if (!owner) return 0;
  if (state.settings.noRentInJail && owner.inJail) return 0;

  if (sp.kind === 'railroad') {
    const count = ownedBy(state, own.owner).filter((id) => space(id).kind === 'railroad').length;
    return sp.rent![count - 1] ?? 0;
  }
  if (sp.kind === 'utility') {
    const count = ownedBy(state, own.owner).filter((id) => space(id).kind === 'utility').length;
    return diceTotal * (count >= 2 ? 10 : 4);
  }
  // Property.
  const rent = sp.rent!;
  if (own.houses === 0) {
    const base = rent[0];
    const full = ownsFullSet(state, own.owner, sp.group!);
    return full && state.settings.doubleRentFullSet ? base * 2 : base;
  }
  return rent[own.houses]; // houses 1–4 -> rent[1..4]; hotel (5) -> rent[5]
}

/** Whether `ownerId` could legally add a house/hotel to `spaceId` right now. */
export function canBuild(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const sp = space(spaceId);
  if (sp.kind !== 'property') return false;
  const own = state.ownership[spaceId];
  if (own.owner !== ownerId || own.houses >= 5) return false;
  if (!ownsFullSet(state, ownerId, sp.group!)) return false;
  const groupLots = groupIds(sp.group!);
  if (groupLots.some((id) => state.ownership[id].mortgaged)) return false;
  if (state.settings.evenBuild) {
    const min = Math.min(...groupLots.map((id) => state.ownership[id].houses));
    if (own.houses > min) return false;
  }
  const buildingHotel = own.houses === 4;
  if (buildingHotel ? state.hotelsLeft < 1 : state.housesLeft < 1) return false;
  const p = player(state, ownerId);
  return !!p && p.cash >= sp.houseCost!;
}

/** Whether a built-up lot can be sold back (even-build in reverse). */
export function canSellHouse(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const sp = space(spaceId);
  if (sp.kind !== 'property') return false;
  const own = state.ownership[spaceId];
  if (own.owner !== ownerId || own.houses < 1) return false;
  if (state.settings.evenBuild) {
    const groupLots = groupIds(sp.group!);
    const max = Math.max(...groupLots.map((id) => state.ownership[id].houses));
    if (own.houses < max) return false;
  }
  return true;
}

export function canMortgage(state: MonopolyState, spaceId: number): boolean {
  if (!state.settings.mortgaging) return false;
  const own = state.ownership[spaceId];
  if (!own || !own.owner || own.mortgaged) return false;
  const sp = space(spaceId);
  if (sp.kind === 'property') {
    // No lot in the group may carry buildings.
    if (groupIds(sp.group!).some((id) => state.ownership[id].houses > 0)) return false;
  }
  return true;
}

export function canUnmortgage(state: MonopolyState, ownerId: string, spaceId: number): boolean {
  const own = state.ownership[spaceId];
  if (!own || own.owner !== ownerId || !own.mortgaged) return false;
  const p = player(state, ownerId);
  return !!p && p.cash >= unmortgageCost(spaceId);
}

/** Half the printed price (mortgage proceeds / mortgage value). */
export function mortgageValue(spaceId: number): number {
  return Math.floor(space(spaceId).price! / 2);
}

/** Mortgage value plus 10% interest to redeem. */
export function unmortgageCost(spaceId: number): number {
  return Math.ceil(mortgageValue(spaceId) * 1.1);
}

/** A net-worth proxy: cash + property value + building cost paid. */
export function netWorth(state: MonopolyState, ownerId: string): number {
  const p = player(state, ownerId);
  let total = p?.cash ?? 0;
  for (const id of ownedBy(state, ownerId)) {
    const own = state.ownership[id];
    total += own.mortgaged ? mortgageValue(id) : space(id).price!;
    if (space(id).kind === 'property') total += own.houses * space(id).houseCost!;
  }
  return total;
}

/** The most cash a player could raise now: cash + building sell-backs + mortgaging. */
export function canRaise(state: MonopolyState, ownerId: string): number {
  const p = player(state, ownerId);
  let total = p?.cash ?? 0;
  for (const id of ownedBy(state, ownerId)) {
    const own = state.ownership[id];
    if (space(id).kind === 'property') total += Math.floor((own.houses * space(id).houseCost!) / 2);
    if (!own.mortgaged) total += mortgageValue(id);
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
    !(state.pendingDebt && me.cash < 0) &&
    state.players.some((p) => p.id !== playerId && !p.bankrupt)
  );
}

const COLOR_GROUPS: ColorGroup[] = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'];

/** Every colour set one player owns outright (a monopoly), with its owner. */
export function completedSets(state: MonopolyState): { group: ColorGroup; owner: string }[] {
  return COLOR_GROUPS.flatMap((group) => {
    const owner = state.ownership[groupIds(group)[0]].owner;
    return owner && ownsFullSet(state, owner, group) ? [{ group, owner }] : [];
  });
}
