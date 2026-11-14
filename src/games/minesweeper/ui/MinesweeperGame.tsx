import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { LEVELS, chord, chordTargets, minesLeft, newGame, openCell, toggleFlag, type Level, type MsState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { ResultCard } from '../../kit/ui/ResultCard';
import { freshSeed } from '../../kit/ui/KitLocal';
import { playBoom, playFlag, playOpen, playSpread, playWin } from './sound';

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
const BEST_KEY = 'gamehub-minesweeper-best';
const LONG_PRESS_MS = 420;

function loadBest(): Partial<Record<Level, number>> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveBest(best: Partial<Record<Level, number>>) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* storage unavailable: best times just aren't kept */
  }
}

/** The flag: the same swallowtail as the game's icon. */
function FlagGlyph({ wrong }: { wrong?: boolean }) {
  return (
    <svg className={`ms-flag${wrong ? ' is-wrong' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
      <path className="ms-flag-pole" d="M20 56V10" />
      <path className="ms-flag-cloth" d="M20 10H50L41 21L50 32H20Z" />
      {wrong && <path className="ms-flag-x" d="M10 10L54 54M54 10L10 54" />}
    </svg>
  );
}

function MineGlyph() {
  return (
    <svg className="ms-mine" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 8V56M8 32H56M15 15L49 49M49 15L15 49" />
      <circle cx="32" cy="32" r="15" />
      <circle className="ms-mine-shine" cx="26" cy="26" r="4.5" />
    </svg>
  );
}

/** Minesweeper: open the board, flag the mines, clear every safe square. */
export function MinesweeperGame({ level: startLevel, onExit }: { level: Level; onExit: () => void }) {
  const [state, setState] = useState<MsState>(() => newGame(startLevel, freshSeed()));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flagMode, setFlagMode] = useState(false);
  const [pressed, setPressed] = useState<number[]>([]);
  const [cursor, setCursor] = useState<number>(() => Math.floor((LEVELS[startLevel].cols * LEVELS[startLevel].rows) / 2));
  const [best, setBest] = useState(loadBest);
  const [newBest, setNewBest] = useState(false);
  const live = useRef(state);
  live.current = state;
  const bestRef = useRef(best);
  bestRef.current = best;
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);

  const playing = state.status === 'playing';
  const done = state.status === 'won' || state.status === 'lost';
  const elapsed = startedAt === null ? 0 : Math.floor(((endedAt ?? now) - startedAt) / 1000);

  useEffect(() => {
    if (!playing || startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [playing, startedAt]);

  /** Apply a move and play what it sounds like. */
  const apply = useCallback((next: MsState, kind: 'open' | 'flag') => {
    const prev = live.current;
    if (next === prev) return;
    live.current = next;
    setState(next);
    if (prev.status === 'ready' && next.status !== 'ready') setStartedAt(Date.now());
    if (kind === 'flag') playFlag(next.flag.filter(Boolean).length > prev.flag.filter(Boolean).length);
    else if (next.status === 'lost') playBoom();
    else if (next.opened.length > 6) playSpread();
    else if (next.opened.length) playOpen(next.count[next.opened[0].cell]);
    if (next.status === 'won' || next.status === 'lost') {
      const end = Date.now();
      setEndedAt(end);
      if (next.status === 'won') {
        setTimeout(playWin, 250);
        const secs = Math.floor((end - (startedAt ?? end)) / 1000);
        const old = bestRef.current[next.level];
        if (old === undefined || secs < old) {
          const updated = { ...bestRef.current, [next.level]: secs };
          saveBest(updated);
          setBest(updated);
          setNewBest(true);
        }
      }
    }
  }, [startedAt]);

  const restart = (level: Level = state.level) => {
    const fresh = newGame(level, freshSeed());
    live.current = fresh;
    setState(fresh);
    setStartedAt(null);
    setEndedAt(null);
    setNewBest(false);
    setPressed([]);
    setCursor(Math.floor((fresh.cols * fresh.rows) / 2));
  };

  /** The main action on a square: open it, chord a number, or (in flag mode) flag it. */
  const primary = (cell: number) => {
    const s = live.current;
    if (done) return;
    if (s.open[cell]) apply(chord(s, cell), 'open');
    else if (flagMode) apply(toggleFlag(s, cell), 'flag');
    else apply(openCell(s, cell), 'open');
  };
  const secondary = (cell: number) => {
    if (done) return;
    apply(toggleFlag(live.current, cell), 'flag');
  };

  // Keyboard: arrows move, Space/Enter open, F flags, N starts over.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      const { cols, rows } = live.current;
      const r = Math.floor(cursor / cols);
      const c = cursor % cols;
      const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (move[e.key]) {
        e.preventDefault();
        const [dr, dc] = move[e.key];
        const next = Math.min(rows - 1, Math.max(0, r + dr)) * cols + Math.min(cols - 1, Math.max(0, c + dc));
        setCursor(next);
        (document.querySelector(`[data-ms="${next}"]`) as HTMLElement | null)?.focus();
      } else if (e.key.toLowerCase() === 'f') secondary(cursor);
      else if (e.key.toLowerCase() === 'n') restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = (i: number) => {
    const rc = `Row ${Math.floor(i / state.cols) + 1}, column ${(i % state.cols) + 1}`;
    if (state.open[i]) return `${rc}: ${state.mine[i] ? 'mine' : state.count[i] ? state.count[i] : 'empty'}`;
    return `${rc}: ${state.flag[i] ? 'flagged' : 'hidden'}`;
  };

  const ripple = new Map(state.opened.map((o) => [o.cell, Math.min(o.ring, 24)]));
  // When a mine goes off, the others follow outward from it.
  const blast = (i: number) => {
    if (state.exploded === null) return 0;
    const dr = Math.abs(Math.floor(i / state.cols) - Math.floor(state.exploded / state.cols));
    const dc = Math.abs((i % state.cols) - (state.exploded % state.cols));
    return Math.min(20, Math.max(dr, dc));
  };
  const pressedSet = new Set(pressed);

  const board = (
    <div className={`ms-frame is-${state.status}${flagMode ? ' is-flag-mode' : ''}`} style={{ '--cols': state.cols, '--rows': state.rows } as CSSProperties}>
      <div className="ms-grid" role="grid" aria-label="Minefield" onContextMenu={(e) => e.preventDefault()} onMouseLeave={() => setPressed([])}>
        {state.open.map((open, i) => {
          const isMine = state.mine[i];
          const flagged = state.flag[i];
          const cls = ['ms-cell'];
          if (open) cls.push('is-open', `n${state.count[i]}`);
          if (open && isMine) cls.push('is-mine');
          if (state.exploded === i) cls.push('is-exploded');
          if (pressedSet.has(i)) cls.push('is-pressed');
          if (ripple.has(i)) cls.push('is-new');
          const wrongFlag = state.status === 'lost' && flagged && !isMine;
          return (
            <button
              key={`${state.seed}-${i}`}
              type="button"
              role="gridcell"
              data-ms={i}
              className={cls.join(' ')}
              style={
                ripple.has(i)
                  ? ({ '--ring': ripple.get(i) } as CSSProperties)
                  : open && isMine
                    ? ({ '--ring': blast(i) } as CSSProperties)
                    : undefined
              }
              aria-label={label(i)}
              tabIndex={i === cursor ? 0 : -1}
              onFocus={() => setCursor(i)}
              onClick={() => {
                if (longPress.current?.fired) return;
                primary(i);
              }}
              onMouseDown={(e) => {
                if (e.button !== 0 || done) return;
                setPressed(open ? chordTargets(state, i) : flagged ? [] : [i]);
              }}
              onMouseUp={() => setPressed([])}
              onContextMenu={(e) => {
                e.preventDefault();
                secondary(i);
              }}
              onTouchStart={() => {
                if (done) return;
                const timer = setTimeout(() => {
                  if (longPress.current) longPress.current.fired = true;
                  secondary(i);
                }, LONG_PRESS_MS);
                longPress.current = { timer, fired: false };
              }}
              onTouchEnd={() => {
                if (longPress.current) clearTimeout(longPress.current.timer);
                setTimeout(() => (longPress.current = null), 0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  primary(i);
                }
              }}
            >
              {open && isMine ? <MineGlyph /> : open && state.count[i] ? <b>{state.count[i]}</b> : null}
              {!open && flagged && <FlagGlyph wrong={wrongFlag} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const overlay = done ? (
    <ResultCard
      kicker={LEVELS[state.level].label}
      title={state.status === 'won' ? 'Cleared!' : 'Boom.'}
      won={state.status === 'won'}
      onRematch={() => restart()}
      rematchLabel={state.status === 'won' ? 'Play again' : 'Try again'}
      onExit={onExit}
      exitLabel="Back to games"
      delayMs={state.status === 'won' ? 900 : 1300}
    >
      <p>
        {state.status === 'won'
          ? `${state.mines} mines found in ${clock(elapsed)}.${newBest ? ' A new best!' : best[state.level] !== undefined ? ` Best: ${clock(best[state.level]!)}.` : ''}`
          : `${state.open.filter((o, i) => o && !state.mine[i]).length} safe squares opened before the mine.`}
      </p>
    </ResultCard>
  ) : null;

  const side = (
    <>
      <div className="kit-panel sol-stats">
        <div>
          <span>Mines</span>
          <b className="ms-count">{minesLeft(state)}</b>
        </div>
        <div>
          <span>Time</span>
          <b>{clock(elapsed)}</b>
        </div>
        <div>
          <span>Best</span>
          <b>{best[state.level] !== undefined ? clock(best[state.level]!) : '–'}</b>
        </div>
      </div>
      <SideSection title="Level">
        <div className="ms-levels" role="group" aria-label="Level">
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button key={l} type="button" className={`ms-level${l === state.level ? ' is-on' : ''}`} aria-pressed={l === state.level} onClick={() => restart(l)}>
              <b>{LEVELS[l].label}</b>
              <span>
                {LEVELS[l].cols}×{LEVELS[l].rows} · {LEVELS[l].mines}
              </span>
            </button>
          ))}
        </div>
      </SideSection>
      <div className="kit-panel">
        <div className="kit-actions">
          <button type="button" className="primary" onClick={() => restart()}>
            New game
          </button>
          <button type="button" className={`g-btn ${flagMode ? 'g-btn-light' : 'g-btn-ghost'}`} aria-pressed={flagMode} onClick={() => setFlagMode((m) => !m)}>
            <FlagGlyph /> Flag mode {flagMode ? 'on' : 'off'}
          </button>
        </div>
        <p className="kit-muted">
          Click to open, right-click (or long-press, or flag mode) to flag. Click a number whose mines are all flagged to open the rest around it. Your first click is
          always safe. Arrows and Space work too; N starts over.
        </p>
      </div>
    </>
  );

  return (
    <GameShell
      className="ms-game"
      title="Minesweeper"
      exitLabel="Back to games"
      onExit={onExit}
      status={
        state.status === 'won' ? (
          <><strong>Cleared</strong> in {clock(elapsed)}</>
        ) : state.status === 'lost' ? (
          <><strong>Boom</strong> · try again</>
        ) : state.status === 'ready' ? (
          <><strong>{LEVELS[state.level].label}</strong> · click anywhere to start</>
        ) : (
          <><strong>{LEVELS[state.level].label}</strong> · {minesLeft(state)} mines left</>
        )
      }
      board={board}
      overlay={overlay}
      side={side}
    />
  );
}
