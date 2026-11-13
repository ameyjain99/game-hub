import { useEffect, useRef } from 'react';
import { cleanName } from '../displayName';

interface Props {
  /** Human-readable event feed from the game state. */
  log: string[];
  /** The current prompt (whose turn / what they can do). */
  status: string;
}

/** Running commentary shown in the right pane: event history + the live prompt. */
export function Commentary({ log, status }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div className="commentary">
      <div className="commentary-feed" ref={feedRef}>
        {log.length === 0 && <div className="commentary-empty">The game is starting…</div>}
        {log.map((line, i) => (
          <div key={i} className="commentary-line">
            {cleanName(line)}
          </div>
        ))}
      </div>
      <div className="commentary-now">{cleanName(status)}</div>
    </div>
  );
}
