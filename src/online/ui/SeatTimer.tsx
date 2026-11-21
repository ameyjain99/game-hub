import type { CSSProperties } from 'react';
import { useTable } from '../TableContext';

/**
 * The turn clock, at the seat of whoever is on it: a bar that drains to
 * nothing as their time runs out, so the whole table can see it without
 * looking up at the header. Renders nothing without a clock (a local game, a
 * paused game, a bot's turn).
 */
export function SeatTimer({ turnMs = 45_000, className }: { turnMs?: number; className?: string }) {
  const deadline = useTable()?.deadline ?? null;
  if (deadline === null) return null;
  const left = Math.max(0, deadline - Date.now());
  // A gift of extra time can make more than a full turn: the bar starts full.
  const total = Math.max(turnMs, left);
  return (
    <span key={deadline} className={`g-seat-timer${className ? ` ${className}` : ''}`} aria-hidden="true">
      <i style={{ animationDuration: `${total}ms`, animationDelay: `-${total - left}ms` } as CSSProperties} />
    </span>
  );
}
