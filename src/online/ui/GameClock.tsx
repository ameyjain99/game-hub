import { useEffect, useRef, useState } from 'react';
import { playTimeWarning } from '../../shared/sound';
import { useTable } from '../TableContext';

/** Under this much time a clock turns red (and yours sounds a warning). */
const LOW_MS = 30_000;

/**
 * A player's chess clock: the time they have left for the whole game. It runs
 * only while they are to move, stops with a pause, and renders nothing in a
 * game without clocks.
 */
export function GameClock({ id, running }: { id: string; running: boolean }) {
  const table = useTable();
  const seat = table?.seatOf(id)?.index;
  const bank = seat === undefined ? null : (table?.clocks?.[seat] ?? null);
  const deadline = table?.deadline ?? null;
  const live = running && deadline !== null && bank !== null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [live]);

  const ms = bank === null ? null : live ? Math.max(0, deadline - Date.now()) : bank;
  const low = ms !== null && ms < LOW_MS;
  const mine = id === table?.meId;
  const warned = useRef(false);
  useEffect(() => {
    if (low && live && mine && !warned.current) playTimeWarning();
    warned.current = low;
  }, [low, live, mine]);

  if (ms === null) return null;
  const secs = Math.ceil(ms / 1000);
  const text = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <span className={`g-game-clock${live ? ' is-running' : ''}${low ? ' is-low' : ''}`} role="timer" aria-label={`${table?.nameFor(id) ?? 'Player'}: ${text} left`}>
      {text}
    </span>
  );
}
