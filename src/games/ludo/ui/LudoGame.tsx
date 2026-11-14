import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  HOME,
  HOME_COLUMN,
  SAFE,
  START,
  TRACK,
  YARD,
  destination,
  eventMs,
  ludoKit,
  movableTokens,
  trackIndex,
  type LudoAction,
  type LudoColor,
  type LudoEvent,
  type LudoState,
} from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { Die } from '../../kit/ui/Die';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { SafeSquareIcon } from '../../../shared/icons';
import { LUDO_SOUNDS, ludoCues, playCapture, playFinish, playHome, playOut, playStep } from './sound';

export const LUDO_COLOR: Record<LudoColor, string> = { red: '#E0393E', green: '#25A35A', yellow: '#F2B90F', blue: '#2F6FDB' };
const NAME: Record<LudoColor, string> = { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue' };
/** Each yard's top-left cell, and which side of the centre its home triangle faces. */
const YARD_AT: Record<LudoColor, [number, number]> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };
const HOME_AT: Record<LudoColor, [number, number]> = { red: [7.5, 6.55], green: [6.55, 7.5], yellow: [7.5, 8.45], blue: [8.45, 7.5] };
const YARD_SPOTS: [number, number][] = [
  [1.85, 1.85],
  [1.85, 4.15],
  [4.15, 1.85],
  [4.15, 4.15],
];

const WALK_DELAY_MS = 420;
const STEP_MS = 140;

/** A token's centre in grid units (row, col), 0–15. */
function spot(color: LudoColor, progress: number, token: number): [number, number] {
  if (progress === YARD) {
    const [r, c] = YARD_AT[color];
    return [r + YARD_SPOTS[token][0], c + YARD_SPOTS[token][1]];
  }
  if (progress === HOME) {
    const [r, c] = HOME_AT[color];
    const off = (token - 1.5) * 0.42;
    return color === 'red' || color === 'yellow' ? [r + off, c] : [r, c + off];
  }
  const cell = progress <= 50 ? TRACK[trackIndex(color, progress)!] : HOME_COLUMN[color][progress - 51];
  return [cell[0] + 0.5, cell[1] + 0.5];
}

/** The squares a move walks through, as progress values. */
function walkPath(e: LudoEvent): number[] {
  if (e.from === YARD) return [0];
  const out: number[] = [];
  for (let p = e.from! + 1; p <= e.to!; p++) out.push(p);
  return out;
}

const key = (pid: string, i: number) => `${pid}:${i}`;

/** Tokens as they appear: the last move walks square by square, then any captured token flies home. */
function useTokenWalk(view: LudoState) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const at = () => Object.fromEntries(view.players.flatMap((p) => p.tokens.map((t, i) => [key(p.id, i), t])));
  const [shown, setShown] = useState<Record<string, number>>(at);
  const [moving, setMoving] = useState<string | null>(null);
  const [flying, setFlying] = useState<string[]>([]);
  const seen = useRef({ seq: view.last?.seq ?? 0, game: view.game });

  useEffect(() => {
    const e = view.last;
    const fresh = !!e && (e.seq !== seen.current.seq || view.game !== seen.current.game);
    seen.current = { seq: e?.seq ?? 0, game: view.game };
    if (!e || !fresh || e.kind !== 'move' || reduced) {
      setShown(at());
      setMoving(null);
      setFlying([]);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const k = key(e.player, e.token!);
    const before = { ...at(), [k]: e.from! };
    for (const c of e.captured ?? []) before[key(c.player, c.token)] = c.from;
    setShown(before);
    setMoving(k);
    const path = walkPath(e);
    path.forEach((p, i) =>
      later(WALK_DELAY_MS + i * STEP_MS, () => {
        setShown((s) => ({ ...s, [k]: p }));
        if (e.from === YARD) playOut();
        else playStep();
      }),
    );
    const walked = WALK_DELAY_MS + path.length * STEP_MS;
    if (e.to === HOME) later(walked, playHome);
    if (e.captured?.length) {
      later(walked + 80, () => {
        playCapture();
        setFlying(e.captured!.map((c) => key(c.player, c.token)));
        setShown(at());
      });
    }
    later(walked + (e.captured?.length ? 700 : 80), () => {
      setMoving(null);
      setFlying([]);
      setShown(at());
    });
    return () => timers.forEach(clearTimeout);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  return { shown, moving, flying, animating: moving !== null };
}

function describe(e: LudoEvent, name: string, color: LudoColor): string {
  if (e.kind === 'three-sixes') return `${name} rolled a third 6 – turn over`;
  if (e.kind === 'no-move') return `${name} rolled ${e.roll} – no move`;
  let text = `${name} rolled ${e.roll}`;
  if (e.from === YARD) text += ' – a token comes out';
  else if (e.to === HOME) text += ' – a token reaches home';
  else text += ` – moved ${NAME[color].toLowerCase()} ${e.token! + 1}`;
  if (e.captured?.length) text += `, capturing ${e.captured.length === 1 ? 'a token' : `${e.captured.length} tokens`}`;
  if (e.bonus) text += ' · rolls again';
  return text;
}

/** The Ludo screen, shared by local and online games. */
export function LudoGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<LudoState, LudoAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [hoverToken, setHoverToken] = useState<number | null>(null);
  useCues(view, (a, b) => ludoCues(a, b, meId), LUDO_SOUNDS);
  const { shown, moving, flying, animating } = useTokenWalk(view);

  const actor = ludoKit.actor(view);
  const myTurn = actor === meId;
  const me = view.players.find((p) => p.id === meId);
  const current = view.players[view.turn];
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const choosing = myTurn && view.phase === 'move' && !animating;
  const movable = choosing && me ? new Set(movableTokens(me, view.dice!)) : new Set<number>();

  // The finish sounds once the last token is home.
  const finished = useRef(view.over);
  useEffect(() => {
    if (view.over && !finished.current && view.winner) {
      const t = setTimeout(() => playFinish(view.winner === meId), WALK_DELAY_MS + eventMs(view.last));
      finished.current = true;
      return () => clearTimeout(t);
    }
    finished.current = view.over;
  }, [view.over, view.winner, view.last, meId]);

  // Space rolls on your turn.
  useEffect(() => {
    if (!myTurn || view.phase !== 'roll' || animating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onAction({ type: 'ROLL' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [myTurn, view.phase, animating, onAction]);

  // Where a hovered token would land, and whom it would knock out.
  const preview = hoverToken !== null && me && movable.has(hoverToken) ? destination(me.tokens[hoverToken], view.dice!) : null;
  const previewSpot = preview !== null && me ? spot(me.color, preview, hoverToken!) : null;
  const previewIdx = preview !== null && me ? trackIndex(me.color, preview) : null;
  const victims = new Set<string>();
  if (previewIdx !== null && !SAFE.has(previewIdx)) {
    for (const p of view.players) if (p.id !== meId) p.tokens.forEach((t, i) => trackIndex(p.color, t) === previewIdx && victims.add(key(p.id, i)));
  }

  const cells = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const inYard = (r < 6 || r > 8) && (c < 6 || c > 8);
      const inCentre = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      if (inYard || inCentre) continue;
      const idx = TRACK.findIndex(([tr, tc]) => tr === r && tc === c);
      const homeOf = (Object.keys(HOME_COLUMN) as LudoColor[]).find((col) => HOME_COLUMN[col].some(([hr, hc]) => hr === r && hc === c));
      const startOf = (Object.keys(START) as LudoColor[]).find((col) => START[col] === idx);
      const tint = homeOf ?? startOf;
      cells.push(
        <div
          key={`${r}-${c}`}
          className={`ludo-cell${tint ? ' is-tinted' : ''}`}
          style={{ gridRow: r + 1, gridColumn: c + 1, ...(tint ? ({ '--lc': LUDO_COLOR[tint] } as CSSProperties) : {}) }}
        >
          {idx >= 0 && SAFE.has(idx) && <SafeSquareIcon className="ludo-star" />}
        </div>,
      );
    }
  }

  // Tokens on one cell fan out.
  const groups = new Map<string, string[]>();
  const placed = view.players.flatMap((p) =>
    p.out
      ? []
      : p.tokens.map((_, i) => {
          const k = key(p.id, i);
          const progress = shown[k] ?? p.tokens[i];
          const [r, c] = spot(p.color, progress, i);
          const cellKey = progress === YARD || progress === HOME ? k : `${Math.floor(r)}-${Math.floor(c)}`;
          groups.set(cellKey, [...(groups.get(cellKey) ?? []), k]);
          return { p, i, k, r, c, cellKey, progress };
        }),
  );

  const board = (
    <div className={`kit-board ludo-board${choosing ? ' is-choosing' : ''}`}>
      <div className="ludo-grid">
        {cells}
        {(Object.keys(YARD_AT) as LudoColor[]).map((col) => {
          const [r, c] = YARD_AT[col];
          const seated = view.players.some((p) => p.color === col && !p.out);
          return (
            <div key={col} className={`ludo-yard${seated ? '' : ' is-empty'}`} style={{ gridRow: `${r + 1} / span 6`, gridColumn: `${c + 1} / span 6`, '--lc': LUDO_COLOR[col] } as CSSProperties}>
              <div className="ludo-yard-inner" />
              {YARD_SPOTS.map(([sr, sc], i) => (
                <span key={i} className="ludo-yard-spot" style={{ top: `${(sr / 6) * 100}%`, left: `${(sc / 6) * 100}%` }} />
              ))}
            </div>
          );
        })}
        <svg className="ludo-centre" viewBox="0 0 3 3" style={{ gridRow: '7 / span 3', gridColumn: '7 / span 3' }} aria-hidden="true">
          <polygon points="0,0 1.5,1.5 0,3" fill={LUDO_COLOR.red} />
          <polygon points="0,0 3,0 1.5,1.5" fill={LUDO_COLOR.green} />
          <polygon points="3,0 3,3 1.5,1.5" fill={LUDO_COLOR.yellow} />
          <polygon points="0,3 1.5,1.5 3,3" fill={LUDO_COLOR.blue} />
        </svg>
      </div>
      <div className="ludo-tokens">
  {previewSpot && <span className="ludo-ghost" style={{ left: `${(previewSpot[1] / 15) * 100}%`, top: `${(previewSpot[0] / 15) * 100}%`, '--lc': LUDO_COLOR[me!.color] } as CSSProperties} />}
        {placed.map(({ p, i, k, r, c, cellKey }) => {
          const group = groups.get(cellKey) ?? [k];
          const n = group.indexOf(k);
          const spread = group.length > 1 ? 0.22 : 0;
          const angle = (n / group.length) * Math.PI * 2 + 0.6;
          const canMove = p.id === meId && movable.has(i);
          const cls = ['ludo-token'];
          if (canMove) cls.push('is-movable');
          if (moving === k) cls.push('is-moving');
          if (flying.includes(k)) cls.push('is-flying');
          if (victims.has(k)) cls.push('is-threatened');
          if (spotlight && spotlight !== p.id) cls.push('is-dim');
          const style = {
            left: `${((c + Math.cos(angle) * spread) / 15) * 100}%`,
            top: `${((r + Math.sin(angle) * spread) / 15) * 100}%`,
            '--lc': LUDO_COLOR[p.color],
            zIndex: moving === k ? 5 : Math.round(r * 2),
          } as CSSProperties;
          return canMove ? (
            <button
              key={k}
              type="button"
              className={cls.join(' ')}
              style={style}
              aria-label={`Move ${NAME[p.color].toLowerCase()} token ${i + 1}`}
              onMouseEnter={() => setHoverToken(i)}
              onMouseLeave={() => setHoverToken(null)}
              onFocus={() => setHoverToken(i)}
              onBlur={() => setHoverToken(null)}
              onClick={() => {
                setHoverToken(null);
                onAction({ type: 'MOVE', token: i });
              }}
            />
          ) : (
            <span key={k} className={cls.join(' ')} style={style} aria-hidden="true" />
          );
        })}
      </div>
    </div>
  );

  const roller = view.last ? view.players.find((p) => p.id === view.last!.player) : null;
  const tray = (
    <div className="kit-panel snl-tray" style={{ '--tc': LUDO_COLOR[current.color] } as CSSProperties}>
      <div className="snl-tray-row">
        <Die value={view.dice ?? view.last?.roll ?? null} rollKey={view.rollSeq} size={56} />
        <div className="snl-tray-text">
          <span className="snl-tray-kicker">{view.over ? 'Game over' : myTurn ? 'Your turn' : `${nameFor(current.id)}'s turn`}</span>
          <span className="snl-tray-line">
            {choosing
              ? `You rolled ${view.dice} – pick a token to move.`
              : view.last && roller
                ? describe(view.last, who(roller.id), roller.color)
                : 'Roll a 6 to bring a token out.'}
          </span>
        </div>
      </div>
      {!view.over && me && (
        <button type="button" className="primary snl-roll" disabled={!myTurn || view.phase !== 'roll' || animating} onClick={() => onAction({ type: 'ROLL' })}>
          {!myTurn ? `Waiting for ${nameFor(current.id)}` : view.phase === 'move' ? 'Choose a token' : animating ? 'Moving...' : 'Roll the die'}
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
      delayMs={WALK_DELAY_MS + eventMs(view.last) + 500}
    >
      <p>All four tokens home{view.game > 1 ? ` · game ${view.game}` : ''}.</p>
    </ResultCard>
  ) : null;

  const tally = (tokens: number[]) => {
    const home = tokens.filter((t) => t === HOME).length;
    const yard = tokens.filter((t) => t === YARD).length;
    const parts = [];
    if (home) parts.push(`${home} home`);
    if (4 - home - yard) parts.push(`${4 - home - yard} out`);
    if (yard) parts.push(`${yard} in the yard`);
    return parts.join(' · ');
  };

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: LUDO_COLOR[p.color], active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': LUDO_COLOR[p.color] } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      {tray}
      <PlayersPanel
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p) => ({
          id: p.id,
          name: who(p.id),
          you: p.id === meId,
          color: LUDO_COLOR[p.color],
          detail: p.out ? 'Left the game' : `${NAME[p.color]} · ${tally(p.tokens)}`,
          trailing: `${p.tokens.filter((t) => t === HOME).length}/4`,
          active: actor === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="Recent rolls">
        {view.history.length === 0 ? (
          <p className="kit-muted">A 6 brings a token out and rolls again. Stars and start squares are safe. Land exactly on home.</p>
        ) : (
          <ul className="kit-log">
            {view.history.slice(0, 12).map((e) => {
              const p = view.players.find((pl) => pl.id === e.player)!;
              return <li key={e.seq}>{describe(e, who(p.id), p.color)}</li>;
            })}
          </ul>
        )}
      </SideSection>
    </>
  );

  return (
    <GameShell
      className="ludo-game"
      title="Ludo"
      exitLabel={exitLabel}
      onExit={onExit}
      status={
        view.over && view.winner ? (
          <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'}</>
        ) : choosing ? (
          <><strong>Pick a token</strong> · you rolled {view.dice}</>
        ) : myTurn ? (
          <><strong>Your roll</strong> · press Space</>
        ) : (
          <><strong>{nameFor(current.id)}</strong> is playing...</>
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
