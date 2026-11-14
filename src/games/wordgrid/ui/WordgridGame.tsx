import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CENTRE, LETTERS, N, PREMIUMS, RACK, evaluate, valueOf, wordgridKit, type Placement, type Tile, type WgAction, type WgMove, type WgState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { Shuffle, Undo2 } from '../../../shared/icons';
import { WG_SOUNDS, playNope, playTap, wgCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2B6BE0', '#20A464', '#F2B705'];
export const wgSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];
const PREMIUM_LABEL: Record<string, string> = { TW: '3W', DW: '2W', TL: '3L', DL: '2L' };

interface Pending {
  id: number;
  letter: string;
  blank: boolean;
}

function TileFace({ letter, blank, className, style }: { letter: string; blank?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span className={`wg-tile${blank ? ' is-blank' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <b>{letter === '?' ? '' : letter}</b>
      {!blank && letter !== '?' && <i>{valueOf(letter)}</i>}
    </span>
  );
}

function describe(m: WgMove, who: (id: string) => string): string {
  if (m.kind === 'pass') return `${who(m.player)} passed`;
  if (m.kind === 'exchange') return `${who(m.player)} swapped ${m.count} ${m.count === 1 ? 'tile' : 'tiles'}`;
  const words = m.words?.map((w) => w.word).join(', ') ?? '';
  return `${who(m.player)} played ${words} for ${m.score}${m.bingo ? ' – all seven!' : ''}`;
}

/** The Wordgrid screen: drag, click or type tiles onto the board; the score of what you've laid shows as you go. */
export function WordgridGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<WgState, WgAction>) {
  const me = view.players.find((p) => p.id === meId);
  const actor = wordgridKit.actor(view);
  const myTurn = actor === meId;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  useCues(view, (a, b) => wgCues(a, b, meId), WG_SOUNDS);

  const [pending, setPending] = useState<Map<number, Pending>>(new Map());
  const [order, setOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState<{ cell: number; across: boolean } | null>(null);
  const [blankFor, setBlankFor] = useState<{ id: number; cell: number } | null>(null);
  const [swapping, setSwapping] = useState<Set<number> | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const typed = useRef<number[]>([]);

  const rack = me?.rack ?? [];
  // Keep the rack in your own order; new tiles join at the end.
  useEffect(() => {
    setOrder((o) => {
      const ids = rack.map((t) => t.id);
      const kept = o.filter((id) => ids.includes(id));
      return [...kept, ...ids.filter((id) => !kept.includes(id))];
    });
  }, [rack.map((t) => t.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new turn or a board change clears what you'd laid out.
  useEffect(() => {
    setPending(new Map());
    setSelected(null);
    setCursor(null);
    typed.current = [];
  }, [view.last?.seq, view.game]);

  const tileById = (id: number) => rack.find((t) => t.id === id);
  const onBoard = new Set([...pending.values()].map((p) => p.id));
  const rackTiles = order.map(tileById).filter((t): t is Tile => !!t && !onBoard.has(t.id));
  const tentative = [...pending.entries()].map(([cell, p]) => ({ cell, letter: p.letter, blank: p.blank }));
  const preview = useMemo(() => (tentative.length ? evaluate(view.board, tentative) : null), [view.board, pending]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = !!preview && !('error' in preview);

  const place = (id: number, cell: number, letter?: string) => {
    if (!myTurn || view.board[cell] || pending.has(cell)) return false;
    const tile = tileById(id);
    if (!tile) return false;
    if (tile.letter === '?' && !letter) {
      setBlankFor({ id, cell });
      return true;
    }
    setPending((m) => new Map(m).set(cell, { id, letter: tile.letter === '?' ? letter!.toUpperCase() : tile.letter, blank: tile.letter === '?' }));
    setSelected(null);
    playTap();
    return true;
  };

  const takeBack = (cell: number) => {
    setPending((m) => {
      const next = new Map(m);
      next.delete(cell);
      return next;
    });
    playTap();
  };

  const recall = () => {
    setPending(new Map());
    typed.current = [];
  };

  const submit = () => {
    if (!myTurn || tentative.length === 0) return;
    if (!valid) {
      playNope();
      return;
    }
    const tiles: Placement[] = [...pending.entries()].map(([cell, p]) => ({ id: p.id, cell, ...(p.blank ? { letter: p.letter } : {}) }));
    onAction({ type: 'PLAY', tiles });
  };

  const onCell = (cell: number) => {
    if (!myTurn) return;
    if (pending.has(cell)) {
      takeBack(cell);
      return;
    }
    if (view.board[cell]) return;
    if (selected !== null) {
      place(selected, cell);
      return;
    }
    // No tile picked: put the typing cursor here (again to turn it).
    setCursor((c) => (c && c.cell === cell ? { cell, across: !c.across } : { cell, across: true }));
  };

  // Typing: letters go down at the cursor, which moves on; Backspace takes back; Enter plays.
  useEffect(() => {
    if (!myTurn) return;
    const onKey = (e: KeyboardEvent) => {
      if (blankFor || swapping || (e.target instanceof Element && e.target.closest('input, textarea, select'))) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') recall();
      else if (e.key === 'Backspace') {
        const last = typed.current.pop();
        if (last !== undefined) {
          takeBack(last);
          setCursor((c) => (c ? { ...c, cell: last } : c));
        }
      } else if (/^[a-zA-Z]$/.test(e.key) && cursor) {
        const letter = e.key.toUpperCase();
        let cell = cursor.cell;
        while (cell < N * N && (view.board[cell] || pending.has(cell))) cell += cursor.across ? 1 : N;
        if (cell >= N * N || (cursor.across && Math.floor(cell / N) !== Math.floor(cursor.cell / N))) return;
        const tile = rackTiles.find((t) => t.letter === letter) ?? rackTiles.find((t) => t.letter === '?');
        if (!tile) {
          playNope();
          return;
        }
        if (place(tile.id, cell, letter)) {
          typed.current.push(cell);
          let next = cell + (cursor.across ? 1 : N);
          while (next < N * N && view.board[next]) next += cursor.across ? 1 : N;
          setCursor({ cell: Math.min(next, N * N - 1), across: cursor.across });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Dragging a rack tile onto the board.
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const placeRef = useRef(place);
  placeRef.current = place;
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 } : d));
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d?.moved) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cell]');
      if (el) placeRef.current(d.id, Number(el.getAttribute('data-cell')));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]);

  const lastCells = new Set(view.last?.kind === 'play' ? view.last.cells : []);
  const previewCells = valid ? new Set(preview.words.flatMap((w) => w.cells)) : new Set<number>();

  const board = (
    <div className={`kit-board wg-board${myTurn ? ' is-my-turn' : ''}`}>
      <div className="wg-grid" role="grid" aria-label="Wordgrid board">
        {view.board.map((p, i) => {
          const prem = PREMIUMS[i];
          const pend = pending.get(i);
          const cls = ['wg-cell'];
          if (prem) cls.push(`is-${prem.toLowerCase()}`);
          if (i === CENTRE) cls.push('is-centre');
          if (cursor?.cell === i && !p && !pend) cls.push(cursor.across ? 'is-cursor-across' : 'is-cursor-down');
          if (previewCells.has(i)) cls.push('is-word');
          const label = p ? `${p.letter}${p.blank ? ' (blank)' : ''}` : pend ? `${pend.letter} (yours, not played yet)` : prem ? (i === CENTRE ? 'centre star, double word' : PREMIUM_LABEL[prem]) : 'empty';
          return (
            <button key={i} type="button" role="gridcell" data-cell={i} className={cls.join(' ')} aria-label={`Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${label}`} onClick={() => onCell(i)}>
              {!p && !pend && prem && <span className="wg-prem">{i === CENTRE ? '★' : PREMIUM_LABEL[prem]}</span>}
              {p && (
                <TileFace
                  letter={p.letter}
                  blank={p.blank}
                  className={`${lastCells.has(i) ? 'is-last' : ''}${spotlight && p.by !== spotlight ? ' is-dim' : ''}${spotlight && p.by === spotlight ? ' is-spot' : ''}`}
                />
              )}
              {pend && <TileFace letter={pend.letter} blank={pend.blank} className="is-pending" />}
            </button>
          );
        })}
      </div>
      {preview && (
        <div className={`wg-preview${valid ? ' is-ok' : ' is-bad'}`} aria-live="polite">
          {valid ? (
            <>
              {preview.words.map((w) => w.word).join(' · ')} <b>{preview.score}</b>
              {preview.bingo && <span className="wg-bingo">+50 all seven</span>}
            </>
          ) : (
            preview.error
          )}
        </div>
      )}
      {blankFor && (
        <div className="wg-modal" role="dialog" aria-label="Choose the blank's letter">
          <p>The blank stands for...</p>
          <div className="wg-letters">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  place(blankFor.id, blankFor.cell, l);
                  setBlankFor(null);
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <button type="button" className="wg-modal-cancel" onClick={() => setBlankFor(null)}>
            Cancel
          </button>
        </div>
      )}
      {swapping && (
        <div className="wg-modal" role="dialog" aria-label="Swap tiles">
          <p>Pick the tiles to swap</p>
          <div className="wg-rack is-swap">
            {rack.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wg-rack-tile${swapping.has(t.id) ? ' is-picked' : ''}`}
                aria-pressed={swapping.has(t.id)}
                onClick={() => setSwapping((sw) => {
                  const next = new Set(sw);
                  if (next.has(t.id)) next.delete(t.id);
                  else next.add(t.id);
                  return next;
                })}
              >
                <TileFace letter={t.letter} />
              </button>
            ))}
          </div>
          <div className="kit-actions">
            <button
              type="button"
              className="primary"
              disabled={swapping.size === 0}
              onClick={() => {
                onAction({ type: 'EXCHANGE', ids: [...swapping] });
                setSwapping(null);
              }}
            >
              Swap {swapping.size || ''}
            </button>
            <button type="button" className="g-btn g-btn-ghost" onClick={() => setSwapping(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Letters not yet seen: not on the board and not on your rack.
  const unseen = useMemo(() => {
    const counts = new Map<string, number>(Object.entries(LETTERS).map(([l, [n]]) => [l, n]));
    for (const p of view.board) if (p) counts.set(p.blank ? '?' : p.letter, (counts.get(p.blank ? '?' : p.letter) ?? 0) - 1);
    for (const t of rack) counts.set(t.letter, (counts.get(t.letter) ?? 0) - 1);
    return [...counts.entries()].filter(([, n]) => n > 0);
  }, [view.board, rack]);

  const overlay = view.over ? (
    <ResultCard
      title={view.winner === null ? 'A tie!' : view.winner === meId ? 'You win' : `${nameFor(view.winner)} wins`}
      won={view.winner === meId}
      onRematch={view.players.filter((p) => !p.out).length > 1 ? () => onAction({ type: 'REMATCH' }) : undefined}
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={900}
    >
      <p>
        {[...view.players]
          .filter((p) => !p.out)
          .sort((a, b) => b.score - a.score)
          .map((p) => `${who(p.id)} ${p.score}${view.final?.[p.id] ? ` (${view.final[p.id] > 0 ? '+' : ''}${view.final[p.id]})` : ''}`)
          .join(' · ')}
      </p>
    </ResultCard>
  ) : null;

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: wgSeatColor(view.players.indexOf(p)), active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': wgSeatColor(view.players.indexOf(p)) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      {me && !view.over && (
        <SideSection title="Your rack" meta={`${view.bagCount} in the bag`}>
          <div className="kit-panel wg-rack-panel">
            <div className="wg-rack" onDragStart={(e) => e.preventDefault()}>
              {rackTiles.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`wg-rack-tile${selected === t.id ? ' is-picked' : ''}${drag?.id === t.id && drag.moved ? ' is-lifted' : ''}`}
                  aria-label={`${t.letter === '?' ? 'blank' : t.letter}${selected === t.id ? ', picked' : ''}`}
                  aria-pressed={selected === t.id}
                  disabled={!myTurn}
                  onPointerDown={(e) => {
                    if (!myTurn || e.button !== 0) return;
                    setDrag({ id: t.id, x: e.clientX, y: e.clientY, moved: false });
                  }}
                  onClick={() => setSelected((s) => (s === t.id ? null : t.id))}
                >
                  <TileFace letter={t.letter} />
                </button>
              ))}
              {Array.from({ length: RACK - rackTiles.length - onBoard.size }, (_, i) => (
                <span key={`gap${i}`} className="wg-rack-gap" />
              ))}
            </div>
            <div className="wg-controls">
              <button type="button" className="primary" disabled={!myTurn || !valid} onClick={submit}>
                {valid ? `Play · ${preview.score}` : 'Play'}
              </button>
              <button type="button" className="g-btn g-btn-ghost" aria-label="Take tiles back" disabled={pending.size === 0} onClick={recall}>
                <Undo2 size={16} />
              </button>
              <button
                type="button"
                className="g-btn g-btn-ghost"
                aria-label="Shuffle rack"
                onClick={() =>
                  setOrder((o) => {
                    const a = [...o];
                    for (let i = a.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [a[i], a[j]] = [a[j], a[i]];
                    }
                    return a;
                  })
                }
              >
                <Shuffle size={16} />
              </button>
            </div>
            <div className="kit-actions">
              <button type="button" className="g-btn g-btn-ghost" disabled={!myTurn || view.bagCount < RACK} onClick={() => { recall(); setSwapping(new Set()); }}>
                Swap tiles
              </button>
              <button type="button" className="g-btn g-btn-ghost" disabled={!myTurn} onClick={() => { recall(); onAction({ type: 'PASS' }); }}>
                Pass
              </button>
            </div>
            <p className="kit-muted">Drag tiles onto the board, or click a square and type. Click a square twice to type downwards. Enter plays.</p>
          </div>
        </SideSection>
      )}
      <PlayersPanel
        title={view.game > 1 ? `Game ${view.game}` : 'Scores'}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p, i) => ({
          id: p.id,
          name: who(p.id),
          you: p.id === meId,
          color: wgSeatColor(i),
          detail: p.out ? 'Left the game' : `${p.rackCount} tiles${view.game > 1 ? ` · ${view.wins[p.id] ?? 0} won` : ''}`,
          trailing: p.score,
          active: actor === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="Moves">
        {view.history.length === 0 ? (
          <p className="kit-muted">The first word must cover the ★. Premiums count only under new tiles; all seven at once earns 50.</p>
        ) : (
          <ul className="kit-log">
            {view.history.slice(0, 10).map((m) => (
              <li key={m.seq}>{describe(m, who)}</li>
            ))}
          </ul>
        )}
      </SideSection>
      <SideSection title="Tiles still out" meta={`${unseen.reduce((n, [, c]) => n + c, 0)}`}>
        <div className="wg-unseen">
          {unseen.map(([l, n]) => (
            <span key={l}>
              {l === '?' ? '·' : l}
              <i>{n}</i>
            </span>
          ))}
        </div>
      </SideSection>
    </>
  );

  return (
    <>
      <GameShell
        className="wg-game"
        title="Wordgrid"
        exitLabel={exitLabel}
        onExit={onExit}
        status={
          view.over ? (
            <>Game over</>
          ) : myTurn ? (
            <><strong>Your turn</strong> · {pending.size ? `${pending.size} laid` : 'make a word'}</>
          ) : (
            <><strong>{nameFor(actor ?? '')}</strong> is thinking...</>
          )
        }
        headerExtra={online?.clock}
        banner={online?.banner}
        board={board}
        overlay={overlay}
        side={side}
      />
      {drag?.moved &&
        createPortal(
          <span className="wg-drag" style={{ left: drag.x, top: drag.y }}>
            <TileFace letter={tileById(drag.id)?.letter ?? ''} />
          </span>,
          document.body,
        )}
    </>
  );
}
