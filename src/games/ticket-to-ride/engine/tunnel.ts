import type { CardCombo, Hand, TrainCard } from './types';

/** The actual cards a combo spends, for the discard pile. */
export function spentCards(combo: CardCombo): TrainCard[] {
  const spent: TrainCard[] = [];
  if (combo.colorCount > 0 && combo.color) {
    for (let i = 0; i < combo.colorCount; i++) spent.push(combo.color);
  }
  for (let i = 0; i < combo.locomotives; i++) spent.push('locomotive');
  return spent;
}

/**
 * Whether a flipped card demands an extra card: a locomotive always does; a
 * coloured card does if it matches the colour the player paid with (an
 * all-locomotive payment has no colour, so only locomotives match it).
 */
export function isTunnelMatch(card: TrainCard, combo: CardCombo): boolean {
  return card === 'locomotive' || (combo.colorCount > 0 && card === combo.color);
}

/** How many of the (up to 3) flipped cards demand an extra card. */
export function tunnelExtra(flipped: TrainCard[], combo: CardCombo): number {
  return flipped.filter((c) => isTunnelMatch(c, combo)).length;
}

/**
 * The extra cards (beyond the base combo) a player would spend to pay `extra`:
 * matching color first, then locomotives. null if they can't afford it.
 */
export function payExtra(hand: Hand, combo: CardCombo, extra: number): TrainCard[] | null {
  const paid: TrainCard[] = [];
  let need = extra;
  if (combo.color) {
    const avail = Math.max(0, hand[combo.color] - combo.colorCount);
    const use = Math.min(need, avail);
    for (let i = 0; i < use; i++) paid.push(combo.color);
    need -= use;
  }
  const locoAvail = Math.max(0, hand.locomotive - combo.locomotives);
  const useLoco = Math.min(need, locoAvail);
  for (let i = 0; i < useLoco; i++) paid.push('locomotive');
  need -= useLoco;
  return need > 0 ? null : paid;
}

/** Whether the player can afford the tunnel's extra cost right now. */
export function canAffordTunnel(hand: Hand, combo: CardCombo, extra: number): boolean {
  return payExtra(hand, combo, extra) !== null;
}
