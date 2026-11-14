import { useEffect, useRef, useState } from 'react';

/** Seconds left at which the clock turns urgent and others may gift more time. */
const URGENT_SECS = 10;
/** Seconds left at which `onUrgent` fires (e.g. a sound on your own clock). */
const WARN_SECS = 5;

/**
 * A compact countdown for the player on the clock. Turns urgent in the last ten
 * seconds; then, if `onGift` is given (the viewer isn't the one on the clock),
 * offers to give that player 20 more seconds. `onUrgent` fires once per turn
 * in the last five seconds. Renders nothing with no clock.
 */
export function TurnClock({
  deadline,
  label,
  onGift,
  onUrgent,
}: {
  deadline: number | null | undefined;
  label: string;
  onGift?: () => void;
  onUrgent?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const warnedFor = useRef<number | null>(null);
  useEffect(() => {
    if (deadline == null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);

  const secs = deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (secs === null || secs > WARN_SECS || !onUrgent || warnedFor.current === deadline) return;
    warnedFor.current = deadline ?? null;
    onUrgent();
  }, [secs, deadline, onUrgent]);

  if (deadline == null || secs === null) return null;
  const urgent = secs <= URGENT_SECS;
  return (
    <span className="g-clock-wrap">
      <span className={`g-clock${urgent ? ' is-urgent' : ''}`} role="timer" aria-label={`${label}: ${secs} seconds left`}>
        <span className="g-clock-label">{label}</span>
        <span className="g-clock-time">{secs}s</span>
      </span>
      {urgent && onGift && (
        <button type="button" className="g-clock-gift" aria-label={`Give ${label} 20 more seconds`} onClick={onGift}>
          +20s
        </button>
      )}
    </span>
  );
}
