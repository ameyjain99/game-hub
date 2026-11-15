/**
 * What one player can work out about who holds each card, from their own view
 * of the game. Bots reason at three depths:
 *   seen:  your hand, cards shown to you, cards laid face up by players who
 *          left, and who passed on your own suggestions;
 *   basic: also, a player who passed holds none of the named cards, and a
 *          category's one card nobody can hold is the envelope's;
 *   full:  also, a player who showed someone else a card holds one of the
 *          three, and every hand has a known size, repeated until nothing changes.
 * The notebook's automatic marks use the direct facts only (seen + passes).
 */
import { ROOMS, SUSPECTS, WEAPONS, type Card, type Room, type Suspect, type Weapon } from './engine/cards';
import type { ClState } from './engine';

export type Depth = 'seen' | 'basic' | 'full';
export const ENVELOPE = 'envelope';

export interface Knowledge {
  /** Who could hold each card (player ids and ENVELOPE). */
  possible: Map<Card, Set<string>>;
  /** The envelope's card in each category, once known. */
  envelope: { suspect?: Suspect; weapon?: Weapon; room?: Room };
  /** Cards that may still be in the envelope. */
  open: { suspects: Suspect[]; weapons: Weapon[]; rooms: Room[] };
}

const CATEGORIES: readonly (readonly Card[])[] = [SUSPECTS, WEAPONS, ROOMS];
const ALL: Card[] = [...SUSPECTS, ...WEAPONS, ...ROOMS];

export function know(view: ClState, me: string, depth: Depth): Knowledge {
  const ids = view.players.map((p) => p.id);
  const possible = new Map<Card, Set<string>>(ALL.map((c) => [c, new Set([...ids, ENVELOPE])]));
  const assign = (c: Card, h: string) => possible.set(c, new Set([h]));
  const known = (c: Card) => (possible.get(c)!.size === 1 ? [...possible.get(c)!][0] : null);
  const fullHand = (id: string, hand: Card[]) => {
    for (const c of ALL) {
      if (hand.includes(c)) assign(c, id);
      else possible.get(c)!.delete(id);
    }
  };

  fullHand(me, view.players.find((p) => p.id === me)?.hand ?? []);
  const clauses: { who: string; cards: Card[] }[] = [];
  for (const e of view.log) {
    if (e.kind === 'left') fullHand(e.player, e.cards);
    if (e.kind !== 'suggest') continue;
    const named: Card[] = [e.s.triple.suspect, e.s.triple.weapon, e.s.triple.room];
    if (e.s.card && e.s.disprover) assign(e.s.card, e.s.disprover);
    if (depth === 'seen' && e.s.player !== me) continue;
    for (const p of e.s.passed) for (const c of named) possible.get(c)!.delete(p);
    if (depth === 'seen') continue;
    if (depth === 'full' && e.s.disprover && !e.s.card) clauses.push({ who: e.s.disprover, cards: named });
  }

  for (let changed = true; changed; ) {
    changed = false;
    const drop = (c: Card, h: string) => {
      if (possible.get(c)!.has(h) && possible.get(c)!.size > 1) {
        possible.get(c)!.delete(h);
        changed = true;
      }
    };
    const set = (c: Card, h: string) => {
      if (known(c) !== h) {
        assign(c, h);
        changed = true;
      }
    };
    for (const cards of CATEGORIES) {
      // One card per category is in the envelope.
      const inEnvelope = cards.find((c) => known(c) === ENVELOPE);
      if (inEnvelope) for (const c of cards) if (c !== inEnvelope) drop(c, ENVELOPE);
      const could = cards.filter((c) => possible.get(c)!.has(ENVELOPE));
      if (depth !== 'seen' && could.length === 1) set(could[0], ENVELOPE);
    }
    if (depth !== 'full') continue;
    for (const p of view.players) {
      const mine = ALL.filter((c) => known(c) === p.id);
      const maybe = ALL.filter((c) => possible.get(c)!.has(p.id));
      if (mine.length === p.cards) {
        for (const c of maybe) if (known(c) !== p.id) drop(c, p.id);
      } else if (maybe.length === p.cards) {
        for (const c of maybe) set(c, p.id);
      }
    }
    for (const { who, cards } of clauses) {
      if (cards.some((c) => known(c) === who)) continue;
      const left = cards.filter((c) => possible.get(c)!.has(who));
      if (left.length === 1) set(left[0], who);
    }
  }

  const open = <T extends Card>(cards: readonly T[]) => cards.filter((c) => possible.get(c)!.has(ENVELOPE));
  const solo = <T extends Card>(cards: readonly T[]) => {
    const o = open(cards);
    return o.length === 1 ? o[0] : undefined;
  };
  return {
    possible,
    envelope: { suspect: solo(SUSPECTS), weapon: solo(WEAPONS), room: solo(ROOMS) },
    open: { suspects: open(SUSPECTS), weapons: open(WEAPONS), rooms: open(ROOMS) },
  };
}
