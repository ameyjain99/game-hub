import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTable } from '../../online/TableContext';

/** Something the whole table should notice: who did what, said large. */
export interface TableMoment {
  /** The headline ("Last card!", "chose Blue"). */
  title: ReactNode;
  /** Who it's about, above the headline. */
  kicker?: ReactNode;
  /** One more line under it. */
  detail?: ReactNode;
  /** The colour it wears (a player's colour, the colour chosen). */
  color?: string;
  /** A picture beside the words (a colour disc, a chip, an icon). */
  art?: ReactNode;
  /** Hold it back this long, so it lands when the piece does (a token still walking). */
  afterMs?: number;
  /** Who it is good or bad news for, by player id: a bot at the table may say a word about it. */
  feels?: Record<string, 'good' | 'bad'>;
}

/** The events in `next` that `prev` didn't have yet, oldest first. */
export function freshEvents<E extends { seq: number }>(prev: readonly E[], next: readonly E[]): E[] {
  const before = prev.reduce((m, e) => Math.max(m, e.seq), 0);
  const latest = next.reduce((m, e) => Math.max(m, e.seq), 0);
  if (latest < before) return []; // a new game restarted the count
  return next.filter((e) => e.seq > before).sort((a, b) => a.seq - b.seq);
}

/** How long one moment holds the table; a backlog plays faster. */
const MOMENT_MS = 2000;
const HURRIED_MS = 1200;

/**
 * The moments each state change makes, shown one at a time. `derive(prev, next)`
 * names them; several from one change (a card played, then a call) queue up.
 */
export function useTableMoments<S>(view: S, derive: (prev: S, next: S) => TableMoment[]): (TableMoment & { key: number; ms: number }) | null {
  const prev = useRef(view);
  const queue = useRef<TableMoment[]>([]);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiting = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [current, setCurrent] = useState<(TableMoment & { key: number; ms: number }) | null>(null);
  const table = useRef(useTable());
  table.current = useTable();

  const advance = () => {
    const next = queue.current.shift();
    if (!next) {
      timer.current = null;
      setCurrent(null);
      return;
    }
    const ms = queue.current.length > 0 ? HURRIED_MS : MOMENT_MS;
    setCurrent({ ...next, key: ++seq.current, ms });
    for (const [id, feel] of Object.entries(next.feels ?? {})) table.current?.react(id, feel);
    timer.current = setTimeout(advance, ms);
  };

  useEffect(() => {
    if (prev.current === view) return;
    const fresh = derive(prev.current, view);
    prev.current = view;
    if (fresh.length === 0) return;
    const enqueue = () => {
      queue.current.push(...fresh);
      if (!timer.current) advance();
    };
    const wait = Math.max(0, ...fresh.map((m) => m.afterMs ?? 0));
    if (wait === 0) enqueue();
    else {
      const t = setTimeout(() => {
        waiting.current.delete(t);
        enqueue();
      }, wait);
      waiting.current.add(t);
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const held = waiting.current;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      held.forEach(clearTimeout);
    };
  }, []);

  return current;
}

/** The moment itself, laid over the board (centred, or along its top edge). */
export function TableMomentBanner({ moment, place = 'centre' }: { moment: (TableMoment & { key: number; ms: number }) | null; place?: 'centre' | 'top' }) {
  if (!moment) return null;
  return (
    <div
      key={moment.key}
      className={`g-moment is-${place}`}
      role="status"
      style={{ '--mc': moment.color ?? '#ffffff', '--ms': `${moment.ms}ms` } as CSSProperties}
    >
      {moment.art && <span className="g-moment-art">{moment.art}</span>}
      <span className="g-moment-text">
        {moment.kicker && <span className="g-moment-kicker">{moment.kicker}</span>}
        <span className="g-moment-title">{moment.title}</span>
        {moment.detail && <span className="g-moment-detail">{moment.detail}</span>}
      </span>
    </div>
  );
}
