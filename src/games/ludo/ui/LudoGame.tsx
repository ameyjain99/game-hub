import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  COLORS,
  HOME_COLUMN,
  SAFE,
  START,
  TRACK,
  YARD,
  destination,
  eventMs,
  homeOf,
  isSafe,
  lastTrack,
  ludoKit,
  movableTokens,
  trackAt,
  type CrossColor,
  type LudoAction,
  type LudoColor,
  type LudoEvent,
  type LudoPlayer,
  type LudoState,
} from '../engine';
import { armAngle, cellCentre, starOf, starSpot, yardAngle, type Star } from './star';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { BoardDie } from '../../kit/ui/BoardDie';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { TableMomentBanner, freshEvents, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { SeatFace } from '../../../online/ui/SeatFace';
import { useCues } from '../../kit/ui/useCues';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { SafeSquareIcon } from '../../../shared/icons';
import { LUDO_SOUNDS, ludoCues, playCapture, playFinish, playHome, playOut, playStep } from './sound';

export const LUDO_COLOR: Record<LudoColor, string> = { red: '#E0393E', green: '#25A35A', yellow: '#F2B90F', blue: '#2F6FDB', purple: '#8E4EC6', orange: '#F0761A', teal: '#12A5A0', pink: '#E34C9C' };
const NAME: Record<LudoColor, string> = { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue', purple: 'Purple', orange: 'Orange', teal: 'Teal', pink: 'Pink' };
/** Each yard's top-left cell on the cross board, and which side of the centre its home triangle faces. */
const YARD_AT: Record<CrossColor, [number, number]> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };
const HOME_AT: Record<CrossColor, [number, number]> = { red: [7.5, 6.55], green: [6.55, 7.5], yellow: [7.5, 8.45], blue: [8.45, 7.5] };
const YARD_SPOTS: [number, number][] = [
  [1.85, 1.85],
  [1.85, 4.15],
  [4.15, 1.85],
  [4.15, 4.15],
];

const WALK_DELAY_MS = 420;
const STEP_MS = 140;

/**
 * A token's centre as (row, col) on a 15-unit square: the cross board's own
 * grid, or the star board scaled to the same square. `cell` names the square
 * it stands on, so tokens sharing one can fan out.
 */
function spot(star: Star | null, p: Pick<LudoPlayer, 'color' | 'arm'>, progress: number, token: number): { r: number; c: number; cell: string | null } {
  const arms = star?.arms ?? 4;
  const resting = progress === YARD || progress === homeOf(arms);
  if (star) {
    const [x, y] = starSpot(star, p.arm, progress, token);
    const scale = 7.5 / star.half;
    return { r: 7.5 + y * scale, c: 7.5 + x * scale, cell: resting ? null : progress > lastTrack(arms) ? `h${p.arm}-${progress}` : `t${trackAt(arms, p.arm, progress)}` };
  }
  const color = p.color as CrossColor;
  if (progress === YARD) {
    const [r, c] = YARD_AT[color];
    return { r: r + YARD_SPOTS[token][0], c: c + YARD_SPOTS[token][1], cell: null };
  }
  if (resting) {
    const [r, c] = HOME_AT[color];
    const off = (token - 1.5) * 0.42;
    return color === 'red' || color === 'yellow' ? { r: r + off, c, cell: null } : { r, c: c + off, cell: null };
  }
  const [r, c] = progress <= lastTrack(4) ? TRACK[trackAt(4, p.arm, progress)!] : HOME_COLUMN[color][progress - lastTrack(4) - 1];
  return { r: r + 0.5, c: c + 0.5, cell: `${r}-${c}` };
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
    if (e.to === homeOf(view.arms)) later(walked, playHome);
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

function describe(e: LudoEvent, name: string, color: LudoColor, home: number): string {
  if (e.kind === 'three-sixes') return `${name} rolled a third 6 - turn over`;
  if (e.kind === 'no-move') return `${name} rolled ${e.roll} - no move`;
  let text = `${name} rolled ${e.roll}`;
  if (e.from === YARD) text += ' - a token comes out';
  else if (e.to === home) text += ' - a token reaches home';
  else text += ` - moved ${NAME[color].toLowerCase()} ${e.token! + 1}`;
  if (e.captured?.length) text += `, capturing ${e.captured.length === 1 ? 'a token' : `${e.captured.length} tokens`}`;
  if (e.bonus) text += ' · rolls again';
  return text;
}

/** The Ludo screen, shared by local and online games. */
export function LudoGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<LudoState, LudoAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [hoverToken, setHoverToken] = useState<number | null>(null);
  useCues(view, (a, b) => ludoCues(a, b, meId), LUDO_SOUNDS);
  // A capture and a token reaching home are the turns a game swings on: said large, as the token lands.
  const moment = useTableMoments(view, (a, b): TableMoment[] =>
    freshEvents(a.history, b.history).flatMap((e): TableMoment[] => {
      const p = b.players.find((pl) => pl.id === e.player);
      if (!p || e.kind !== 'move') return [];
      const name = e.player === meId ? 'You' : nameFor(e.player);
      const afterMs = WALK_DELAY_MS + eventMs(e);
      const out: TableMoment[] = [];
      if (e.captured?.length) {
        const victims = [...new Set(e.captured.map((c) => (c.player === meId ? 'you' : nameFor(c.player))))].join(' and ');
        out.push({ kicker: name, title: `sent ${victims} home`, detail: `${e.captured.length === 1 ? 'That token goes' : 'Those tokens go'} back to the yard.`, color: LUDO_COLOR[p.color], afterMs, feels: { [e.player]: 'good', ...Object.fromEntries(e.captured.map((c) => [c.player, 'bad' as const])) } });
      }
      if (e.to === homeOf(b.arms)) out.push({ kicker: name, title: 'brought a token home', color: LUDO_COLOR[p.color], afterMs, feels: { [e.player]: 'good' } });
      return out;
    }),
  );
  const { shown, moving, flying, animating } = useTokenWalk(view);

  const actor = ludoKit.actor(view);
  const myTurn = actor === meId;
  const me = view.players.find((p) => p.id === meId);
  const current = view.players[view.turn];
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const choosing = myTurn && view.phase === 'move' && !animating;
  const movable = choosing && me ? new Set(movableTokens(me, view.dice!, view.arms)) : new Set<number>();
  const star = view.arms > 4 ? starOf(view.arms) : null;
  const HOME = homeOf(view.arms);

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
  const preview = hoverToken !== null && me && movable.has(hoverToken) ? destination(me.tokens[hoverToken], view.dice!, view.arms) : null;
  const previewSpot = preview !== null && me ? spot(star, me, preview, hoverToken!) : null;
  const previewIdx = preview !== null && me ? trackAt(view.arms, me.arm, preview) : null;
  const victims = new Set<string>();
  if (previewIdx !== null && !isSafe(previewIdx)) {
    for (const p of view.players) if (p.id !== meId) p.tokens.forEach((t, i) => trackAt(view.arms, p.arm, t) === previewIdx && victims.add(key(p.id, i)));
  }

  const cells = [];
  for (let r = 0; r < (star ? 0 : 15); r++) {
    for (let c = 0; c < 15; c++) {
      const inYard = (r < 6 || r > 8) && (c < 6 || c > 8);
      const inCentre = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      if (inYard || inCentre) continue;
      const idx = TRACK.findIndex(([tr, tc]) => tr === r && tc === c);
      const columnOf = COLORS.find((col) => HOME_COLUMN[col].some(([hr, hc]) => hr === r && hc === c));
      const startOf = COLORS.find((col) => START[col] === idx);
      const tint = columnOf ?? startOf;
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
          const { r, c, cell } = spot(star, p, progress, i);
          const cellKey = cell ?? k;
          groups.set(cellKey, [...(groups.get(cellKey) ?? []), k]);
          return { p, i, k, r, c, cellKey, progress };
        }),
  );

  /** The die of the player to roll, in their yard. */
  const die = (color: LudoColor) => (
    <BoardDie value={view.dice ?? view.last?.roll ?? null} rollKey={view.rollSeq} canRoll={myTurn && view.phase === 'roll' && !animating} onRoll={() => onAction({ type: 'ROLL' })} color={LUDO_COLOR[color]} className="ludo-die" />
  );

  // The star board is drawn in its own units, centred on the middle of the board.
  const starBoard = star && (
    <div className="ludo-star-board">
      <svg className="ludo-star-art" viewBox={`${-star.half} ${-star.half} ${star.half * 2} ${star.half * 2}`} aria-hidden="true">
        {view.players.map((p) => {
          const deg = (armAngle(star, p.arm) * 180) / Math.PI;
          const [yx, yy] = [Math.cos(yardAngle(star, p.arm)) * star.yardAt, Math.sin(yardAngle(star, p.arm)) * star.yardAt];
          const fill = LUDO_COLOR[p.color];
          const half = Math.PI / star.arms;
          const corner = (side: number) => `${Math.cos(armAngle(star, p.arm) + side * half) * star.corner},${Math.sin(armAngle(star, p.arm) + side * half) * star.corner}`;
          return (
            <g key={p.id} className={p.out ? 'is-empty' : undefined}>
              <polygon points={`0,0 ${corner(-1)} ${corner(1)}`} fill={fill} />
              <circle cx={yx} cy={yy} r={star.yardRadius} fill={fill} className={`ludo-star-yard${p.id === current.id && !view.over ? ' is-turn' : ''}`} />
              <circle cx={yx} cy={yy} r={star.yardRadius * 0.8} fill="#fffdf8" />
              {[0, 1, 2, 3].map((t) => {
                const [sx, sy] = starSpot(star, p.arm, YARD, t);
                return <circle key={t} cx={sx} cy={sy} r={0.42} fill={`color-mix(in srgb, ${fill} 22%, #fff)`} stroke={`color-mix(in srgb, ${fill} 55%, #fff)`} strokeWidth={0.08} />;
              })}
              <g transform={`rotate(${deg})`}>
                {[0, 1, 2, 3, 4, 5].flatMap((row) =>
                  [-1, 0, 1].map((col) => {
                    const tinted = (col === 0 && row < 5) || (col === 1 && row === 4);
                    return <rect key={`${row}:${col}`} x={star.apothem + row} y={col - 0.5} width={1} height={1} fill={tinted ? fill : '#fffdf8'} stroke={tinted ? `color-mix(in srgb, ${fill} 70%, #000)` : '#c9bfa9'} strokeWidth={0.04} />;
                  }),
                )}
              </g>
            </g>
          );
        })}
      </svg>
      {view.players.map((p) => {
        // Each arm's star square, the fourth out on its near side, and its start square.
        const at = (row: number, col: number) => {
          const [x, y] = cellCentre(star, { arm: p.arm, row, col });
          return { left: `${50 + (x / star.half) * 50}%`, top: `${50 + (y / star.half) * 50}%`, width: `${50 / star.half}%` } as CSSProperties;
        };
        const [yx, yy] = [Math.cos(yardAngle(star, p.arm)) * star.yardAt, Math.sin(yardAngle(star, p.arm)) * star.yardAt];
        return (
          <div key={p.id}>
            <SafeSquareIcon className="ludo-star-mark" style={at(3, -1)} />
            <SafeSquareIcon className="ludo-star-mark is-start" style={at(4, 1)} />
            <div className={`ludo-star-who${p.out ? ' is-out' : ''}`} style={{ left: `${50 + (yx / star.half) * 50}%`, top: `${50 + ((yy + (yy < 0 ? -1 : 1) * star.yardRadius * 0.93) / star.half) * 50}%`, '--lc': LUDO_COLOR[p.color] } as CSSProperties}>
              <SeatFace id={p.id} className="ludo-face" color="#fff" />
              <span className="ludo-yard-name">{nameFor(p.id)}</span>
            </div>
            {p.id === current.id && !view.over && !p.out && (
              <div className="ludo-star-die" style={{ left: `${50 + (yx / star.half) * 50}%`, top: `${50 + (yy / star.half) * 50}%` }}>
                {die(p.color)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const board = (
    <div className={`kit-board ludo-board${choosing ? ' is-choosing' : ''}${star ? ' is-star' : ''}`} style={star ? ({ '--k': 7.5 / star.half } as CSSProperties) : undefined}>
      {starBoard}
      {!star && <div className="ludo-grid">
        {cells}
        {(Object.keys(YARD_AT) as CrossColor[]).map((col) => {
          const [r, c] = YARD_AT[col];
          const owner = view.players.find((p) => p.color === col && !p.out);
          const seated = !!owner;
          return (
            <div key={col} className={`ludo-yard${seated ? '' : ' is-empty'}${owner && owner.id === current.id && !view.over ? ' is-turn' : ''}${r < 6 ? ' is-top' : ' is-bottom'}${c < 6 ? ' is-left' : ' is-right'}`} style={{ gridRow: `${r + 1} / span 6`, gridColumn: `${c + 1} / span 6`, '--lc': LUDO_COLOR[col] } as CSSProperties}>
              <div className="ludo-yard-inner" />
              {YARD_SPOTS.map(([sr, sc], i) => (
                <span key={i} className="ludo-yard-spot" style={{ top: `${(sr / 6) * 100}%`, left: `${(sc / 6) * 100}%` }} />
              ))}
              {owner && owner.id === current.id && !view.over && die(col)}
              {owner && (
                <span className="ludo-yard-who">
                  <SeatFace id={owner.id} className="ludo-face" color="#fff" />
                  <span className="ludo-yard-name">{nameFor(owner.id)}</span>
                </span>
              )}
            </div>
          );
        })}
        <svg className="ludo-centre" viewBox="0 0 3 3" style={{ gridRow: '7 / span 3', gridColumn: '7 / span 3' }} aria-hidden="true">
          <polygon points="0,0 1.5,1.5 0,3" fill={LUDO_COLOR.red} />
          <polygon points="0,0 3,0 1.5,1.5" fill={LUDO_COLOR.green} />
          <polygon points="3,0 3,3 1.5,1.5" fill={LUDO_COLOR.yellow} />
          <polygon points="0,3 1.5,1.5 3,3" fill={LUDO_COLOR.blue} />
        </svg>
      </div>}
      <div className="ludo-tokens">
        {previewSpot && <span className="ludo-ghost" style={{ left: `${(previewSpot.c / 15) * 100}%`, top: `${(previewSpot.r / 15) * 100}%`, '--lc': LUDO_COLOR[me!.color] } as CSSProperties} />}
        {placed.map(({ p, i, k, r, c, cellKey }) => {
          const group = groups.get(cellKey) ?? [k];
          const n = group.indexOf(k);
          const spread = group.length > 1 ? 0.22 * (star ? 7.5 / star.half : 1) : 0;
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
        <div className="snl-tray-text">
          <span className="snl-tray-kicker">{view.over ? 'Game over' : myTurn ? 'Your turn' : `${nameFor(current.id)}'s turn`}</span>
          <span className="snl-tray-line">
            {choosing
              ? `You rolled ${view.dice} - pick a token to move.`
              : view.last && roller
                ? describe(view.last, who(roller.id), roller.color, HOME)
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
          name: nameFor(p.id),
          you: p.id === meId,
          color: LUDO_COLOR[p.color],
          detail: p.out ? 'Left the game' : `${NAME[p.color]} · ${tally(p.tokens)}`,
          trailing: `${p.tokens.filter((t) => t === HOME).length}/4`,
          active: actor === p.id,
          out: p.out,
        }))}
      />
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
      overlay={
        <>
          <TableMomentBanner moment={moment} place="top" />
          {overlay}
        </>
      }
      side={side}
      log={
        <SideSection title="Recent rolls">
          {view.history.length === 0 ? (
            <p className="kit-muted">A 6 brings a token out and rolls again. Stars and start squares are safe. Land exactly on home.</p>
          ) : (
            <ul className="kit-log">
              {view.history.map((e) => {
                const p = view.players.find((pl) => pl.id === e.player)!;
                return <li key={e.seq}>{describe(e, who(p.id), p.color, HOME)}</li>;
              })}
            </ul>
          )}
        </SideSection>
      }
    />
  );
}
