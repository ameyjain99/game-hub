import { useEffect, useState, type ReactNode } from 'react';
import { Crown } from '../../../shared/icons';

interface Props {
  /** "You win", "Bot 2 wins", "Draw". */
  title: string;
  /** Whether the viewer won (a crown and a warmer card). */
  won?: boolean;
  children?: ReactNode;
  onRematch?: () => void;
  rematchLabel?: string;
  onExit: () => void;
  exitLabel: string;
  /** The line above the title (a round's number in a series). */
  kicker?: string;
  /** A pause before the card appears, so the last move (a winning line) is seen first. */
  delayMs?: number;
}

/**
 * The game-over card, laid over the board. It can be tucked away to look at the
 * final position, leaving a chip to bring it back.
 */
export function ResultCard({ title, kicker = 'Game over', won, children, onRematch, rematchLabel = 'Play again', onExit, exitLabel, delayMs = 700 }: Props) {
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState(delayMs <= 0);
  // A new result (a rematch that ended) shows the card again.
  useEffect(() => setHidden(false), [title]);
  useEffect(() => {
    if (delayMs <= 0) return;
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!shown) return null;
  if (hidden) {
    return (
      <button type="button" className="kit-result-chip" onClick={() => setHidden(false)}>
        {kicker} · Show result
      </button>
    );
  }
  return (
    <div className="kit-result-backdrop">
      <section className={`kit-result${won ? ' is-won' : ''}`} role="dialog" aria-label={title}>
        <p className="kit-result-kicker">{kicker}</p>
        <h2 className="kit-result-title">
          {won && <Crown size={22} aria-hidden="true" />}
          {title}
        </h2>
        {children && <div className="kit-result-body">{children}</div>}
        <div className="kit-result-actions">
          {onRematch && (
            <button type="button" className="primary" onClick={onRematch}>
              {rematchLabel}
            </button>
          )}
          <button type="button" className="g-btn g-btn-ghost" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
        <button type="button" className="kit-result-hide" onClick={() => setHidden(true)}>
          View the board
        </button>
      </section>
    </div>
  );
}
