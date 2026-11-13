import { useEffect, useState } from 'react';

/** A compact countdown for the player on the clock. Turns urgent in the last
 *  ten seconds; renders nothing when no clock is running. */
export function TurnClock({ deadline, label }: { deadline: number | null | undefined; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline == null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [deadline]);
  if (deadline == null) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`g-clock${secs <= 10 ? ' is-urgent' : ''}`} role="timer" aria-label={`${label}: ${secs} seconds left`}>
      <span className="g-clock-label">{label}</span>
      <span className="g-clock-time">{secs}s</span>
    </span>
  );
}
