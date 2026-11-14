import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FINISH, LADDERS, SNAKES, moveMs, snlKit, walk, type SnlAction, type SnlMove, type SnlState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { Die } from '../../kit/ui/Die';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { SQUARES_BY_CELL, centreOf, ladderShape, snakeShape } from './board';
import { SNL_SOUNDS, playFinish, playLadder, playSnake, playStep, snlCues } from './sound';

const TOKENS = ['#D93A3F', '#2651C9', '#2F9E62', '#E8821A', '#7C4DBA', '#00897B'];
export const snlColor = (seat: number) => TOKENS[seat % TOKENS.length];
const SNAKE_COLORS = ['#3f9d4c', '#d5483f', '#7b57d1', '#e2861b', '#1d8f95', '#c4467f', '#5d8a2a', '#b8572a', '#3a6fd0', '#8f4fb3'];

/** The die tumbles first; then the token walks. */
const WALK_DELAY_MS = 450;
const STEP_MS = 150;

/**
 * Tokens as they appear: they walk the last roll square by square, then climb or
 * slide; everyone else stands where the game says.
 */
function useTokenWalk(view: SnlState) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const at = () => Object.fromEntries(view.players.map((p) => [p.id, p.pos]));
  const [shown, setShown] = useState<Record<string, number>>(at);
  const [mover, setMover] = useState<{ id: string; gliding: boolean } | null>(null);
  const seen = useRef({ seq: view.last?.seq ?? 0, game: view.game });

  useEffect(() => {
    const m = view.last;
    const fresh = !!m && (m.seq !== seen.current.seq || view.game !== seen.current.game);
    seen.current = { seq: m?.seq ?? 0, game: view.game };
    if (!m || !fresh || reduced) {
      setShown(at());
      setMover(null);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    setShown({ ...at(), [m.player]: m.from });
    setMover({ id: m.player, gliding: false });
    m.path.forEach((sq, i) =>
      later(WALK_DELAY_MS + i * STEP_MS, () => {
        setShown((s) => ({ ...s, [m.player]: sq }));
        playStep();
      }),
    );
    const walked = WALK_DELAY_MS + m.path.length * STEP_MS;
    if (m.via) {
      later(walked + 120, () => {
        setMover({ id: m.player, gliding: true });
        setShown((s) => ({ ...s, [m.player]: m.to }));
        if (m.via!.kind === 'ladder') playLadder();
        else playSnake();
      });
    }
    later(walked + (m.via ? 950 : 120), () => {
      setMover(null);
      setShown(at());
    });
    return () => timers.forEach(clearTimeout);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  return { shown, mover };
}

function describe(m: SnlMove, name: string): string {
  let text = `${name} rolled ${m.roll}`;
  if (m.via?.kind === 'ladder') text += ` – climbed a ladder ${m.via.from} → ${m.via.to}`;
  else if (m.via?.kind === 'snake') text += ` – bitten on ${m.via.from}, slid to ${m.via.to}`;
  else text += ` → ${m.to}`;
  if (m.to === FINISH) text += ' and reached 100!';
  else if (m.again) text += ' · rolls again';
  return text;
}

/** The Snakes & Ladders screen, shared by local and online games. */
export function SnlGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<SnlState, SnlAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [hoverSq, setHoverSq] = useState<number | null>(null);
  useCues(view, (a, b) => snlCues(a, b, meId), SNL_SOUNDS);
  const { shown, mover } = useTokenWalk(view);

  const actor = snlKit.actor(view);
  const myTurn = actor === meId;
  const animating = mover !== null;
  const me = view.players.find((p) => p.id === meId);
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const seatOf = (id: string) => view.players.findIndex((p) => p.id === id);

  // The finish sounds once the winning token arrives.
  const finished = useRef(view.over);
  useEffect(() => {
    if (view.over && !finished.current && view.winner) {
      const t = setTimeout(() => playFinish(view.winner === meId), WALK_DELAY_MS + moveMs(view.last));
      finished.current = true;
      return () => clearTimeout(t);
    }
    finished.current = view.over;
  }, [view.over, view.winner, view.last, meId]);

  // Space rolls on your turn.
  useEffect(() => {
    if (!myTurn || animating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        onAction({ type: 'ROLL' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [myTurn, animating, onAction]);

  // On your turn, the six squares a roll could take you to.
  const reach = new Map<number, { roll: number; to: number }>();
  if (myTurn && me && !animating) {
    for (let r = 1; r <= 6; r++) {
      const land = walk(me.pos, r).at(-1)!;
      reach.set(land, { roll: r, to: LADDERS[land] ?? SNAKES[land] ?? land });
    }
  }
  const hoverLink = hoverSq !== null ? (LADDERS[hoverSq] ? { kind: 'ladder', from: hoverSq } : SNAKES[hoverSq] ? { kind: 'snake', from: hoverSq } : null) : null;
  const dest = hoverSq !== null ? LADDERS[hoverSq] ?? SNAKES[hoverSq] ?? null : null;

  const squareTitle = (n: number) => {
    const parts: string[] = [];
    const r = reach.get(n);
    if (r) parts.push(`Roll ${r.roll}`);
    if (LADDERS[n]) parts.push(`ladder up to ${LADDERS[n]}`);
    if (SNAKES[n]) parts.push(`snake down to ${SNAKES[n]}`);
    return parts.length ? `${n}: ${parts.join(' – ')}` : String(n);
  };

  // Tokens sharing a square fan out a little.
  const bySquare = new Map<number, string[]>();
  for (const p of view.players) {
    if (p.out) continue;
    const pos = shown[p.id] ?? p.pos;
    bySquare.set(pos, [...(bySquare.get(pos) ?? []), p.id]);
  }

  const board = (
    <div className={`kit-board snl-board${hoverLink ? ' is-linking' : ''}`} onMouseLeave={() => setHoverSq(null)}>
      <div className="snl-grid">
        {SQUARES_BY_CELL.map((n, k) => {
          const r = reach.get(n);
          const cls = ['snl-sq', (Math.floor(k / 10) + (k % 10)) % 2 ? 'is-b' : 'is-a'];
          if (n === FINISH) cls.push('is-finish');
          if (r) cls.push('is-reach', r.to > n ? 'is-up' : r.to < n ? 'is-down' : '');
          if (dest === n) cls.push('is-dest');
          return (
            <div key={n} className={cls.join(' ')} title={squareTitle(n)} onMouseEnter={() => setHoverSq(n)}>
              <span className="snl-num">{n}</span>
            </div>
          );
        })}
      </div>
      <svg className="snl-art" viewBox="0 0 1000 1000" aria-hidden="true">
        <defs>
          <filter id="snl-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.28" />
          </filter>
        </defs>
        {Object.entries(LADDERS).map(([foot, top]) => {
          const { rails, rungs } = ladderShape(Number(foot), top);
          const lit = hoverLink?.kind === 'ladder' && hoverLink.from === Number(foot);
          return (
            <g key={`l${foot}`} className={`snl-ladder${lit ? ' is-lit' : ''}`} filter="url(#snl-shadow)">
              {rungs.map((d, i) => (
                <path key={i} d={d} className="snl-rung" />
              ))}
              {rails.map((d, i) => (
                <path key={i} d={d} className="snl-rail" />
              ))}
            </g>
          );
        })}
        {Object.entries(SNAKES).map(([head, tail], i) => {
          const s = snakeShape(Number(head), tail);
          const lit = hoverLink?.kind === 'snake' && hoverLink.from === Number(head);
          return (
            <g key={`s${head}`} className={`snl-snake${lit ? ' is-lit' : ''}`} style={{ '--sc': SNAKE_COLORS[i % SNAKE_COLORS.length] } as CSSProperties} filter="url(#snl-shadow)">
              <path d={s.body} className="snl-body" />
              <path d={s.spine} className="snl-spots" />
              <g transform={`translate(${s.head.x} ${s.head.y}) rotate(${s.angle})`}>
                <path d="M20 0 L33 -4 M20 0 L33 4 M14 0 L22 0" className="snl-tongue" />
                <ellipse rx="22" ry="17" className="snl-head" />
                <circle cx="8" cy="-8" r="5" className="snl-eye" />
                <circle cx="8" cy="8" r="5" className="snl-eye" />
                <circle cx="10" cy="-8" r="2.4" className="snl-pupil" />
                <circle cx="10" cy="8" r="2.4" className="snl-pupil" />
              </g>
            </g>
          );
        })}
      </svg>
      <div className="snl-tokens">
        {view.players.map((p, seat) => {
          if (p.out) return null;
          const pos = shown[p.id] ?? p.pos;
          if (pos <= 0) return null; // still waiting at the start
          const c = centreOf(pos);
          const group = bySquare.get(pos) ?? [p.id];
          const k = group.indexOf(p.id);
          const spread = group.length > 1 ? 2.1 : 0;
          const angle = (k / group.length) * Math.PI * 2;
          const moving = mover?.id === p.id;
          return (
            <span
              key={p.id}
              className={`snl-token${moving ? ' is-moving' : ''}${moving && mover?.gliding ? ' is-gliding' : ''}${actor === p.id && !animating ? ' is-active' : ''}${
                spotlight && spotlight !== p.id ? ' is-dim' : ''
              }`}
              style={{ left: `${c.x / 10 + Math.cos(angle) * spread}%`, top: `${c.y / 10 + Math.sin(angle) * spread}%`, '--tc': snlColor(seat) } as CSSProperties}
              aria-label={`${who(p.id)} on ${pos}`}
            >
              {tokenLabel(nameFor(p.id))}
            </span>
          );
        })}
      </div>
    </div>
  );

  const roller = view.last ? view.players.find((p) => p.id === view.last!.player) : null;
  const tray = (
    <div className="kit-panel snl-tray" style={{ '--tc': actor ? snlColor(seatOf(actor)) : '#fff' } as CSSProperties}>
      <div className="snl-tray-row">
        <Die value={view.last?.roll ?? null} rollKey={view.last?.seq ?? 0} size={56} />
        <div className="snl-tray-text">
          <span className="snl-tray-kicker">{view.over ? 'Game over' : myTurn ? 'Your turn' : `${nameFor(actor!)}'s turn`}</span>
          <span className="snl-tray-line">
            {view.last && roller ? describe(view.last, who(roller.id)) : 'Everyone starts off the board. Roll to begin.'}
          </span>
        </div>
      </div>
      {!view.over && me && (
        <button type="button" className="primary snl-roll" disabled={!myTurn || animating} onClick={() => onAction({ type: 'ROLL' })}>
          {myTurn ? (animating ? 'Moving...' : 'Roll the die') : `Waiting for ${nameFor(actor!)}`}
        </button>
      )}
    </div>
  );

  const overlay = view.over && view.winner ? (
    <ResultCard
      title={view.winner === meId ? 'You win' : `${nameFor(view.winner)} wins`}
      won={view.winner === meId}
      onRematch={view.players.filter((p) => !p.out).length > 1 ? () => onAction({ type: 'REMATCH' }) : undefined}
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={WALK_DELAY_MS + moveMs(view.last) + 500}
    >
      <p>First to square 100{view.game > 1 ? ` · game ${view.game}` : ''}.</p>
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
          .map((p) => ({ id: p.id, accent: snlColor(seatOf(p.id)), active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': snlColor(seatOf(p.id)) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      {tray}
      <PlayersPanel
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p, seat) => ({
          id: p.id,
          name: who(p.id),
          you: p.id === meId,
          color: snlColor(seat),
          detail: p.out ? 'Left the game' : p.pos === 0 ? 'At the start' : `On square ${p.pos}`,
          trailing: view.game > 1 ? view.score[p.id] ?? 0 : undefined,
          active: actor === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="Recent rolls">
        {view.history.length === 0 ? (
          <p className="kit-muted">A 6 rolls again. Land on 100 exactly – too high and you bounce back.</p>
        ) : (
          <ul className="kit-log">
            {view.history.slice(0, 12).map((m) => (
              <li key={m.seq}>{describe(m, who(m.player))}</li>
            ))}
          </ul>
        )}
      </SideSection>
    </>
  );

  return (
    <GameShell
      className="snl-game"
      title="Snakes & Ladders"
      exitLabel={exitLabel}
      onExit={onExit}
      status={
        view.over && view.winner ? (
          <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'}</>
        ) : myTurn ? (
          <><strong>Your roll</strong> · press Space</>
        ) : (
          <><strong>{nameFor(actor!)}</strong> is rolling...</>
        )
      }
      headerExtra={online?.clock}
      banner={online?.banner}
      board={board}
      overlay={overlay}
      side={side}
    />
  );
}
