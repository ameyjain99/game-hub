import { useEffect, useRef, useState } from 'react';
import { TableMomentBanner } from './TableMoment';

/**
 * Counts game starts. It goes up when a game comes on screen while `armed`
 * (a fresh start, not a reload into a game under way) and at each rematch
 * (a game that was over is on again).
 */
export function useGameStart(live: boolean, over: boolean, armed: boolean): number {
  const [starts, setStarts] = useState(0);
  const prev = useRef({ live: false, over: false });
  useEffect(() => {
    const was = prev.current;
    prev.current = { live, over };
    if (live && !over && ((!was.live && armed) || (was.live && was.over))) setStarts((n) => n + 1);
  }, [live, over]); // eslint-disable-line react-hooks/exhaustive-deps
  return starts;
}

const HOLD_MS = 2400;

/** "Riya goes first", said once across the top of the screen as a game starts. */
export function OpeningCall({ start, name, isMe, color }: { start: number; name: string | null; isMe: boolean; color?: string }) {
  const [shown, setShown] = useState<{ key: number; name: string; isMe: boolean; color?: string } | null>(null);
  const latest = useRef({ name, isMe, color });
  latest.current = { name, isMe, color };
  useEffect(() => {
    const who = latest.current;
    if (start === 0 || !who.name) return;
    setShown({ key: start, name: who.name, isMe: who.isMe, color: who.color });
    const t = setTimeout(() => setShown(null), HOLD_MS);
    return () => clearTimeout(t);
  }, [start]);
  if (!shown) return null;
  return (
    <div className="g-opening">
      <TableMomentBanner place="top" moment={{ key: shown.key, ms: HOLD_MS, kicker: 'New game', title: shown.isMe ? 'You go first' : `${shown.name} goes first`, color: shown.color }} />
    </div>
  );
}
