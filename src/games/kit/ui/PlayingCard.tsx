import type { CSSProperties, ReactNode } from 'react';

export const SUIT_SYMBOL: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME: Record<string, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const RANK_NAME: Record<string, string> = { A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: '10' };

/** "TS" → "10", "QH" → "Q". */
export const rankLabel = (card: string) => (card[0] === 'T' ? '10' : card[0]);
export const isRed = (card: string) => card[1] === 'H' || card[1] === 'D';
/** "QH" → "queen of hearts". */
export const cardName = (card: string) => `${RANK_NAME[card[0]] ?? card[0]} of ${SUIT_NAME[card[1]]}`;

/**
 * A playing card face: rank and suit in two corners and a large centre mark (a
 * framed letter for court cards). Sized by `--pc-w` (its width); `faceDown`
 * shows the back.
 */
export function PlayingCard({
  card,
  faceDown,
  className,
  style,
  badge,
}: {
  card: string;
  faceDown?: boolean;
  className?: string;
  style?: CSSProperties;
  /** A small label laid over the card (Sequence marks its wild Jacks). */
  badge?: ReactNode;
}) {
  if (faceDown) return <span className={`pc is-back${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />;
  const rank = rankLabel(card);
  const suit = SUIT_SYMBOL[card[1]];
  const court = 'JQK'.includes(card[0]);
  return (
    <span className={`pc ${isRed(card) ? 'is-red' : 'is-black'}${className ? ` ${className}` : ''}`} style={style}>
      <span className="pc-corner">
        <b>{rank}</b>
        <i>{suit}</i>
      </span>
      {court ? (
        <span className="pc-court">
          <b>{rank}</b>
          <i>{suit}</i>
        </span>
      ) : (
        <span className="pc-pip">{suit}</span>
      )}
      <span className="pc-corner is-flip">
        <b>{rank}</b>
        <i>{suit}</i>
      </span>
      {badge && <span className="pc-badge">{badge}</span>}
    </span>
  );
}
