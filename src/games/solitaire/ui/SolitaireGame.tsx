import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  applySol,
  autoFinishStep,
  autoTarget,
  canAutoFinish,
  canMove,
  cardsAt,
  hint,
  newDeal,
  rankOf,
  type DrawMode,
  type Place,
  type SolAction,
  type SolState,
} from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { ResultCard } from '../../kit/ui/ResultCard';
import { PlayingCard, SUIT_SYMBOL, cardName } from '../../kit/ui/PlayingCard';
import { freshSeed } from '../../kit/ui/KitLocal';
import { playFlip, playHome, playNope, playPlace, playShuffle, playWin } from './sound';

type Target = { pile: 'foundation' | 'tableau'; index: number };

const UNDO_LIMIT = 300;
const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (secs: number) => `${Math.floor(secs / 60)}:${pad2(secs % 60)}`;

/** The table's size, kept up to date. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

interface Spot {
  x: number;
  y: number;
  z: number;
  up: boolean;
  place: Place | null;
}

/** Where every card sits on a table `W`×`H` (and each pile's slot). */
function layout(s: SolState, W: number, H: number) {
  const gap = 0.14;
  const w = Math.max(30, Math.min(W / (7 + 6 * gap), H / 4.3, 120));
  const h = w * 1.4;
  const g = w * gap;
  const left = (W - (7 * w + 6 * g)) / 2;
  const x = (col: number) => left + col * (w + g);
  const tabY = h + w * 0.32;
  const spots = new Map<string, Spot>();
  let z = 1;

  s.stock.forEach((c) => spots.set(c, { x: x(0), y: 0, z: z++, up: false, place: null }));
  const fanned = s.draw === 3 ? 3 : 1;
  s.waste.forEach((c, i) => {
    const fromTop = s.waste.length - 1 - i;
    const off = fromTop < fanned ? (Math.min(fanned, s.waste.length) - 1 - fromTop) * w * 0.26 : 0;
    spots.set(c, { x: x(1) + off, y: 0, z: z++, up: true, place: i === s.waste.length - 1 ? { pile: 'waste' } : null });
  });
  s.foundations.forEach((pile, f) => pile.forEach((c, i) => spots.set(c, { x: x(3 + f), y: 0, z: z++, up: true, place: i === pile.length - 1 ? { pile: 'foundation', index: f } : null })));
  s.tableau.forEach((pile, col) => {
    const down = pile.cards.length - pile.up;
    const room = H - tabY - h - 6;
    const fd = Math.min(w * 0.14, down > 0 ? room / (down + Math.max(0, pile.up - 1) * 2.2) : w);
    const fu = pile.up > 1 ? Math.min(w * 0.34, Math.max(w * 0.14, (room - down * fd) / (pile.up - 1))) : 0;
    let y = tabY;
    pile.cards.forEach((c, i) => {
      const up = i >= down;
      spots.set(c, { x: x(col), y, z: z++, up, place: up ? { pile: 'tableau', index: col, from: i } : null });
      y += up ? fu : fd;
    });
  });
  return { w, h, x, tabY, spots };
}

/** The Klondike table: drag a card or run onto a pile, or click it to send it to its best place. */
export function SolitaireGame({ draw, onExit }: { draw: DrawMode; onExit: () => void }) {
  const [state, setState] = useState<SolState>(() => newDeal(freshSeed(), draw));
  const [undo, setUndo] = useState<SolState[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: Place; cards: string[]; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [hinted, setHinted] = useState<{ cards: string[]; to: Target | 'stock' } | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const table = useSize<HTMLDivElement>();
  const L = layout(state, table.w, table.h);

  const elapsed = started === null ? 0 : Math.floor(((finishedAt ?? now) - started) / 1000);
  useEffect(() => {
    if (started === null || finishedAt !== null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [started, finishedAt]);

  // The latest state and drag, for handlers that outlive a render.
  const live = useRef(state);
  live.current = state;
  const undoRef = useRef(undo);
  undoRef.current = undo;

  /** Apply a move, remembering the position for undo, with its sound. */
  const act = useCallback((a: SolAction) => {
    const s = live.current;
    const next = applySol(s, a);
    if (next === s) return;
    live.current = next;
    setUndo((u) => [...u.slice(-UNDO_LIMIT), s]);
    setState(next);
    setStarted((t) => t ?? Date.now());
    if (a.type === 'DRAW') playFlip();
    else if (a.to.pile === 'foundation') playHome(rankOf(cardsAt(s, a.from)[0]));
    else playPlace();
    if (next.won) {
      setFinishedAt(Date.now());
      setTimeout(playWin, 300);
    }
    setHinted(null);
  }, []);

  const newGame = () => {
    const fresh = newDeal(freshSeed(), draw);
    live.current = fresh;
    setState(fresh);
    setUndo([]);
    setStarted(null);
    setFinishedAt(null);
    setFinishing(false);
    setHinted(null);
    playShuffle();
  };

  const undoOnce = useCallback(() => {
    const u = undoRef.current;
    if (u.length === 0) return;
    const prev = u[u.length - 1];
    live.current = prev;
    setState(prev);
    setUndo(u.slice(0, -1));
    setFinishing(false);
    playFlip();
  }, []);

  // Cmd/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoOnce();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undoOnce]);

  // Auto-finish: one card home every beat.
  useEffect(() => {
    if (!finishing || state.won) return;
    const step = autoFinishStep(state);
    if (!step) {
      setFinishing(false);
      return;
    }
    const t = setTimeout(() => act(step), 110);
    return () => clearTimeout(t);
  }, [finishing, state, act]);

  const showHint = () => {
    const h = hint(state);
    if (h === null) {
      playNope();
      return;
    }
    if (h === 'draw') setHinted({ cards: state.stock.length ? [state.stock[state.stock.length - 1]] : [], to: 'stock' });
    else setHinted({ cards: cardsAt(state, h.from), to: h.to });
    setTimeout(() => setHinted(null), 1800);
  };

  // Dragging.
  const pileAt = (px: number, py: number): Target | null => {
    for (let f = 0; f < 4; f++) {
      const fx = L.x(3 + f);
      if (px >= fx - L.w * 0.2 && px <= fx + L.w * 1.2 && py <= L.h * 1.2) return { pile: 'foundation', index: f };
    }
    for (let col = 0; col < 7; col++) {
      const cx = L.x(col);
      if (px >= cx - L.w * 0.07 && px <= cx + L.w * 1.07 && py >= L.tabY - L.h * 0.3) return { pile: 'tableau', index: col };
    }
    return null;
  };

  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) =>
      setDrag((d) => (d ? { ...d, dx: e.clientX - d.x, dy: e.clientY - d.y, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 } : d));
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      const s = live.current;
      if (!d.moved) {
        // A click: send the card to its best place.
        const to = autoTarget(s, d.from);
        if (to) act({ type: 'MOVE', from: d.from, to });
        else {
          setShake(d.cards[0]);
          setTimeout(() => setShake(null), 400);
          playNope();
        }
        return;
      }
      const rect = table.ref.current!.getBoundingClientRect();
      const lay = layout(s, rect.width, rect.height);
      const spot = lay.spots.get(d.cards[0])!;
      const cx = spot.x + d.dx + lay.w / 2;
      const cy = spot.y + d.dy + lay.h * 0.3;
      const to = pileAt(cx, cy) ?? pileAt(e.clientX - rect.left, e.clientY - rect.top);
      if (to && canMove(s, d.from, to)) act({ type: 'MOVE', from: d.from, to });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCardDown = (card: string, e: React.PointerEvent) => {
    if (e.button !== 0 || finishing || state.won) return;
    const spot = L.spots.get(card);
    if (!spot) return;
    if (!spot.place) {
      // The stock turns over; nothing else face down can be picked up.
      if (state.stock.includes(card)) act({ type: 'DRAW' });
      return;
    }
    e.preventDefault();
    setDrag({ from: spot.place, cards: cardsAt(state, spot.place), x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false });
  };

  const dragged = new Set(drag?.moved ? drag.cards : []);
  const hintCards = new Set(hinted?.cards ?? []);
  const hintTarget = hinted?.to;
  const all = [...state.stock, ...state.waste, ...state.foundations.flat(), ...state.tableau.flatMap((p) => p.cards)];

  const slot = (x: number, y: number, label: string, cls: string, onClick?: () => void) => (
    <button
      type="button"
      className={`sol-slot ${cls}`}
      style={{ left: x, top: y, width: L.w, height: L.h }}
      aria-label={label}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
    />
  );

  const board = (
    <div className={`sol-table${state.won ? ' is-won' : ''}`} ref={table.ref} style={{ '--pc-w': `${L.w}px` } as CSSProperties}>
      {table.w > 0 && (
        <>
          {slot(L.x(0), 0, state.stock.length ? 'Stock' : 'Turn the waste back over', `is-stock${hintTarget === 'stock' ? ' is-hint' : ''}`, () => act({ type: 'DRAW' }))}
          {slot(L.x(1), 0, 'Waste', 'is-waste')}
          {[0, 1, 2, 3].map((f) => (
            <span key={f}>{slot(L.x(3 + f), 0, `Foundation ${f + 1}`, `is-foundation${hintTarget && hintTarget !== 'stock' && hintTarget.pile === 'foundation' && hintTarget.index === f ? ' is-hint' : ''}`)}</span>
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((col) => (
            <span key={col}>{slot(L.x(col), L.tabY, `Pile ${col + 1}`, `is-pile${hintTarget && hintTarget !== 'stock' && hintTarget.pile === 'tableau' && hintTarget.index === col ? ' is-hint' : ''}`)}</span>
          ))}
          {all.map((card) => {
            const sp = L.spots.get(card)!;
            const lifted = dragged.has(card);
            const order = lifted ? drag!.cards.indexOf(card) : 0;
            const style: CSSProperties = {
              left: sp.x,
              top: sp.y,
              zIndex: lifted ? 1000 + order : sp.z,
              transform: lifted ? `translate(${drag!.dx}px, ${drag!.dy}px) rotate(${Math.max(-4, Math.min(4, drag!.dx / 60))}deg)` : undefined,
            };
            const celebrate = state.won ? { animationDelay: `${(rankOf(card) * 4 + 'SHDC'.indexOf(card[1])) * 35}ms` } : undefined;
            return (
              <div
                key={card}
                className={`sol-card${sp.up ? '' : ' is-down'}${sp.place ? ' is-live' : ''}${lifted ? ' is-dragging' : ''}${hintCards.has(card) ? ' is-hint' : ''}${shake === card ? ' is-shake' : ''}`}
                style={{ ...style, ...celebrate }}
                role={sp.place || !sp.up ? 'button' : undefined}
                aria-label={sp.up ? cardName(card) : state.stock.includes(card) ? 'Stock' : 'Face-down card'}
                onPointerDown={(e) => onCardDown(card, e)}
              >
                <PlayingCard card={card} faceDown={!sp.up} />
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  const overlay = state.won ? (
    <ResultCard title="Solved!" won onRematch={newGame} rematchLabel="Deal again" onExit={onExit} exitLabel="Back to games" delayMs={1600}>
      <p>
        {clock(elapsed)} · {state.moves} moves · {state.score} points
      </p>
    </ResultCard>
  ) : null;

  const home = state.foundations.reduce((n, p) => n + p.length, 0);
  const side = (
    <>
      <div className="kit-panel sol-stats">
        <div>
          <span>Time</span>
          <b>{clock(elapsed)}</b>
        </div>
        <div>
          <span>Moves</span>
          <b>{state.moves}</b>
        </div>
        <div>
          <span>Score</span>
          <b>{state.score}</b>
        </div>
      </div>
      <div className="kit-panel">
        {canAutoFinish(state) && !finishing && (
          <button type="button" className="primary" onClick={() => setFinishing(true)}>
            Finish the game
          </button>
        )}
        <div className="kit-actions">
          <button type="button" className="g-btn g-btn-ghost" disabled={undo.length === 0} onClick={undoOnce}>
            Undo
          </button>
          <button type="button" className="g-btn g-btn-ghost" disabled={state.won} onClick={showHint}>
            Hint
          </button>
        </div>
        <button type="button" className="g-btn g-btn-ghost" onClick={newGame}>
          New deal
        </button>
      </div>
      <SideSection title="Foundations" meta={`${home} / 52`}>
        <div className="sol-progress" aria-hidden="true">
          {state.foundations.map((p, f) => (
            <span key={f} className={p.length && 'HD'.includes(p[0][1]) ? 'is-red' : ''}>
              {p.length ? SUIT_SYMBOL[p[0][1]] : '·'} {p.length}
            </span>
          ))}
        </div>
        <p className="kit-muted">
          Click a card to send it to its best spot, or drag it. Build down in alternating colours; only a King fills an empty pile. Turning {draw === 1 ? 'one card' : 'three cards'} at
          a time.
        </p>
      </SideSection>
    </>
  );

  return (
    <GameShell
      className="sol-game"
      title="Solitaire"
      exitLabel="Back to games"
      onExit={onExit}
      status={
        state.won ? (
          <><strong>Solved</strong> in {clock(elapsed)}</>
        ) : (
          <><strong>Draw {draw}</strong> · {home} of 52 home</>
        )
      }
      board={board}
      overlay={overlay}
      side={side}
    />
  );
}
