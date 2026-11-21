import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { areConnected } from '../../engine/graph';
import { routeScore } from '../../engine/scoring';
import { cityById } from '../../engine/maps';
import { playerColor } from '../colors';
import { cleanName } from '../displayName';
import type { RankedPlayer } from './FinalResults';

interface Line {
  text: string;
  delta: number;
  /** A ticket made, a ticket missed, or neither (routes, bonuses). */
  kind: 'base' | 'made' | 'missed' | 'bonus';
}

const LINE_MS = 850;
const HOLD_MS = 1500;

/**
 * The count at the end, as at a real table: one player at a time, their
 * tickets turned over one by one with the total climbing or falling, then the
 * bonuses. The last place goes first and the winner last. It can be skipped;
 * the full results stay on screen afterwards.
 */
export function FinalCeremony({ ranked, onDone }: { ranked: RankedPlayer[]; onDone: () => void }) {
  const turns = useMemo(() => {
    const city = (id: string) => cityById.get(id)?.name ?? id;
    return [...ranked].reverse().map((r) => {
      const lines: Line[] = [{ text: 'Routes claimed', delta: routeScore(r.player), kind: 'base' }];
      let tickets = 0;
      for (const t of r.player.tickets) {
        const made = areConnected(r.player.claimedRouteIds, t.a, t.b);
        tickets += made ? t.points : -t.points;
        lines.push({ text: `${city(t.a)} - ${city(t.b)}`, delta: made ? t.points : -t.points, kind: made ? 'made' : 'missed' });
      }
      // A station can borrow a route and save tickets: that shows as one line.
      if (r.score.tickets !== tickets) lines.push({ text: 'Tickets saved by stations', delta: r.score.tickets - tickets, kind: 'bonus' });
      if (r.score.stations) lines.push({ text: 'Stations not used', delta: r.score.stations, kind: 'bonus' });
      if (r.score.bonuses) lines.push({ text: r.longestPath ? 'Longest route' : 'Bonus cards', delta: r.score.bonuses, kind: 'bonus' });
      return { r, lines };
    });
  }, [ranked]);

  const [turn, setTurn] = useState(0);
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const now = turns[turn];
    if (!now) return;
    const last = shown >= now.lines.length;
    const t = setTimeout(
      () => {
        if (!last) setShown(shown + 1);
        else if (turn + 1 < turns.length) {
          setTurn(turn + 1);
          setShown(1);
        } else onDone();
      },
      last ? HOLD_MS : LINE_MS,
    );
    return () => clearTimeout(t);
  }, [turn, shown, turns, onDone]);

  const now = turns[turn];
  if (!now) return null;
  const lines = now.lines.slice(0, shown);
  const total = lines.reduce((n, l) => n + l.delta, 0);
  const place = turns.length - turn;
  return (
    <div className="ttr-ceremony" role="status" style={{ '--pc': playerColor(now.r.seat) } as CSSProperties}>
      <div className="ttr-ceremony-card" key={now.r.player.id}>
        <p className="ttr-ceremony-kicker">
          {turns.length - turn === 1 && shown >= now.lines.length ? 'The winner' : `Counting up · ${turn + 1} of ${turns.length}`}
        </p>
        <h2 className="ttr-ceremony-name">{cleanName(now.r.player.name)}</h2>
        <ol className="ttr-ceremony-lines">
          {lines.map((l, i) => (
            <li key={i} className={`is-${l.kind}`}>
              <span>{l.text}</span>
              <b>{l.delta > 0 ? `+${l.delta}` : l.delta}</b>
            </li>
          ))}
        </ol>
        <p className="ttr-ceremony-total">
          <span>{shown >= now.lines.length ? (place === 1 ? 'Final score' : `Final score · place ${place}`) : 'So far'}</span>
          <b key={total}>{total}</b>
        </p>
        <button type="button" className="ttr-ceremony-skip" onClick={onDone}>
          Skip to the results
        </button>
      </div>
    </div>
  );
}
