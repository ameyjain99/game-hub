import type { CSSProperties } from 'react';
import type { Card, Suspect } from '../engine/cards';
import { SUSPECT_COLOR, kindOf } from './palette';

const ORDER = { suspect: 0, weapon: 1, room: 2 } as const;

/** A single card face: its category, and a colour band for characters. */
export function CardFace({ card, onClick }: { card: Card; onClick?: () => void }) {
  const kind = kindOf(card);
  const band = kind === 'suspect' ? SUSPECT_COLOR[card as Suspect] : undefined;
  const inner = (
    <>
      <span className="cl-card-kind">{kind}</span>
      <span className="cl-card-name">{card}</span>
    </>
  );
  const style = { '--band': band ?? 'transparent' } as CSSProperties;
  return onClick ? (
    <button type="button" className={`cl-card kind-${kind} is-action`} style={style} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <span className={`cl-card kind-${kind}`} style={style}>
      {inner}
    </span>
  );
}

/** The viewer's own cards, characters first, then weapons, then rooms. */
export function CluedoHand({ hand }: { hand: Card[] }) {
  const cards = [...hand].sort((a, b) => ORDER[kindOf(a)] - ORDER[kindOf(b)]);
  return (
    <div className="cl-hand" aria-label="Your cards">
      {cards.map((c) => (
        <CardFace key={c} card={c} />
      ))}
    </div>
  );
}
