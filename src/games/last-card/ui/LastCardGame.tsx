import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { colorsOf, faceOf, fits, lastCardKit, points, type Card, type Color, type LcAction, type LcEvent, type LcState } from '../engine';
import { GameShell } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { SortButton, useSortMode } from '../../kit/ui/HandSort';
import { GameLog } from '../../kit/ui/GameLog';
import { SeatFace } from '../../../online/ui/SeatFace';
import { Megaphone, Siren } from '../../../shared/icons';
import { TableMomentBanner, freshEvents, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { fly, flyer } from '../../../shared/fly';
import { COLOR_HEX, COLOR_NAME, LcCard, faceName } from './LcCard';
import { LC_SOUNDS, lcCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2B6BE0', '#20A464', '#F2B705', '#9B6BFF', '#14C3A2', '#FF9F1C', '#FF4F8B', '#8d97ab', '#c4467f'];
export const lcSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

function describe(e: LcEvent, who: (id: string) => string, side: 'light' | 'dark'): string {
  switch (e.kind) {
    case 'play': {
      const f = e.card ? faceOf(e.card, side) ?? faceOf(e.card, side === 'light' ? 'dark' : 'light') : null;
      const name = f ? faceName(f) : 'a card';
      return `${who(e.player)} played ${name}${f && f.color === null && e.color ? ` → ${COLOR_NAME[e.color]}` : ''}`;
    }
    case 'draw':
      return `${who(e.player)} drew a card`;
    case 'pass':
      return `${who(e.player)} kept it and passed`;
    case 'penalty':
      return `${who(e.target!)} drew ${e.count}`;
    case 'call':
      return `${who(e.player)} called "Last card!"`;
    case 'catch':
      return `${who(e.player)} caught ${who(e.target!)} - draw ${e.count}`;
  }
}

/**
 * The plays the whole table should notice, said large: a colour chosen, a
 * "Last card!" call, a player caught without calling, a heavy draw, the flip.
 */
export function lcMoments(prev: LcState, next: LcState, who: (id: string) => string, colorOf: (id: string) => string): TableMoment[] {
  if (next.game !== prev.game) return [];
  const fresh = next.history.filter((e) => e.seq > (prev.last?.seq ?? 0)).reverse();
  const out: TableMoment[] = [];
  for (const e of fresh) {
    if (e.kind === 'play' && e.card) {
      const f = faceOf(e.card, prev.side);
      if (f?.color === null && e.color) {
        out.push({ kicker: who(e.player), title: `chose ${COLOR_NAME[e.color]}`, color: COLOR_HEX[e.color], art: <span className="g-moment-disc" /> });
      } else if (f?.kind === 'flip') {
        out.push({ kicker: who(e.player), title: 'flipped the table', detail: `Everyone plays the ${next.side} side now.`, color: colorOf(e.player) });
      }
    } else if (e.kind === 'call') {
      out.push({ kicker: who(e.player), title: '"Last card!"', detail: 'One card left.', color: '#ffd25a', art: <Megaphone size={44} />, feels: { [e.player]: 'good' } });
    } else if (e.kind === 'catch') {
      out.push({
        kicker: `${who(e.player)} caught ${who(e.target!)}`,
        title: "Didn't call last card!",
        detail: `${who(e.target!)} ${e.target && who(e.target) === 'You' ? 'draw' : 'draws'} ${e.count}.`,
        color: '#e2483b',
        art: <Siren size={44} />,
        feels: { [e.target!]: 'bad', [e.player]: 'good' },
      });
    } else if (e.kind === 'penalty' && (e.count ?? 0) >= 2) {
      const you = who(e.target!) === 'You';
      out.push({ kicker: who(e.target!), title: `${you ? 'draw' : 'draws'} ${e.count}`, color: '#e2483b', art: <span className="lc-moment-count">+{e.count}</span>, feels: { [e.target!]: 'bad' } });
    }
  }
  return out;
}

const SORTS = ['colour', 'number', 'dealt'] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { colour: 'by colour', number: 'by number', dealt: 'as dealt' };
const KIND_RANK: Record<string, number> = { number: 0, skip: 10, 'skip-all': 10, reverse: 11, draw: 12, flip: 13, wild: 20, 'wild-draw': 21, 'wild-hunt': 21 };

/** Your hand in the order you like it: grouped by colour, by number, or as the cards came. */
export function sortHand(hand: Card[], side: 'light' | 'dark', mode: (typeof SORTS)[number]): Card[] {
  if (mode === 'dealt') return hand;
  const colours = colorsOf(side) as readonly string[];
  const key = (c: Card): [number, number] => {
    const f = faceOf(c, side);
    if (!f) return [99, 99];
    const colour = f.color === null ? 9 : colours.indexOf(f.color);
    const rank = f.kind === 'number' ? (f.value ?? 0) : KIND_RANK[f.kind] ?? 30;
    return mode === 'colour' ? [colour, rank] : [f.color === null ? 99 : rank, colour];
  };
  return [...hand].sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1] || a.id - b.id);
}

/** The Last Card table: opponents round the top, the piles in the middle, your hand along the bottom. */
export function LastCardGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<LcState, LcAction>) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const [callArmed, setCallArmed] = useState(false);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => lcCues(a, b, meId), LC_SOUNDS);
  const seatColorOf = (id: string) => lcSeatColor(view.players.findIndex((p) => p.id === id));
  const moment = useTableMoments(view, (a, b) => lcMoments(a, b, (id) => (id === meId ? 'You' : nameFor(id)), seatColorOf));

  const seat = view.players.findIndex((p) => p.id === meId);
  const me = view.players[seat];
  const actor = lastCardKit.actor(view);
  const myTurn = actor === meId;
  const side = view.side;
  const other = side === 'light' ? 'dark' : 'light';
  const top = view.discard[view.discard.length - 1];
  const topFace = top ? faceOf(top, side) : null;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const hand = me?.hand ?? [];
  const [sortBy, nextSort] = useSortMode('gamehub:last-card:sort', SORTS);
  const shown = sortHand(hand, view.side, sortBy);
  const canPlay = (c: Card) => myTurn && (view.drawn === null || c.id === view.drawn) && !!faceOf(c, side) && fits(view, faceOf(c, side)!, hand);

  useEffect(() => {
    setChoosing(null);
    if (hand.length !== 2) setCallArmed(false);
  }, [view.last?.seq, hand.length]);

  const play = (c: Card) => {
    if (!canPlay(c)) return;
    if (faceOf(c, side)!.color === null) {
      setChoosing(c.id);
      return;
    }
    onAction({ type: 'PLAY', card: c.id, callLast: callArmed });
    setCallArmed(false);
  };

  // Opponents sit round the top of the table, in turn order after you.
  const others = view.players.map((_, k) => view.players[(seat + 1 + k) % view.players.length]).filter((p) => p.id !== meId);
  /** Where opponent `k` of `n` sits, as a point on the table (percent). */
  const seatAt = (k: number, n: number) => {
    const angle = Math.PI * (0.92 - (0.84 * (k + 0.5)) / n);
    return { x: 50 + Math.cos(angle) * 40, y: 26 - Math.sin(angle) * 17 };
  };
  // A played card flies in from the seat of whoever played it (from your hand, for you).
  const lastPlayer = view.last?.kind === 'play' ? view.last.player : null;
  const playedFrom = (() => {
    const k = others.findIndex((p) => p.id === lastPlayer);
    if (k < 0) return { fx: '0cqw', fy: '30cqw' };
    const at = seatAt(k, others.length);
    return { fx: `${at.x - 56}cqw`, fy: `${at.y - 50}cqw` };
  })();

  // A Skip stamps the seat it skipped; a Reverse sends the direction ring spinning.
  const [fx, setFx] = useState<{ seq: number; skipped: string | null; reversed: boolean } | null>(null);
  const seenPlay = useRef(view.last?.seq ?? 0);
  useEffect(() => {
    const e = view.last;
    if (!e || e.seq === seenPlay.current) return;
    seenPlay.current = e.seq;
    const f = e.kind === 'play' && e.card ? faceOf(e.card, view.side) : null;
    if (!f || (f.kind !== 'skip' && f.kind !== 'reverse')) return;
    const live = view.players.filter((p) => !p.out);
    // Whoever sat next after the player, the way play was going, lost their turn.
    const from = live.findIndex((p) => p.id === e.player);
    const skipped = f.kind === 'skip' || live.length === 2 ? live[(from + view.direction * (f.kind === 'reverse' ? -1 : 1) + live.length * 2) % live.length]?.id ?? null : null;
    setFx({ seq: e.seq, skipped: skipped === e.player ? null : skipped, reversed: f.kind === 'reverse' });
    const t = setTimeout(() => setFx(null), 1500);
    return () => clearTimeout(t);
  }, [view.last?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cards drawn fly from the deck to whoever drew them, one by one.
  const tableRef = useRef<HTMLDivElement>(null);
  const seenDraws = useRef(view.history);
  useEffect(() => {
    const fresh = freshEvents(seenDraws.current, view.history);
    seenDraws.current = view.history;
    const el = tableRef.current;
    if (!el) return;
    let n = 0;
    for (const e of fresh) {
      if (e.kind !== 'draw' && e.kind !== 'penalty') continue;
      const who = e.kind === 'penalty' ? e.target! : e.player;
      const to = who === meId ? el.querySelector('.lc-hand') : el.querySelector(`[data-seat="${who}"] .lc-opp-cards`);
      for (let i = 0; i < Math.min(e.count ?? 1, 6); i++) fly({ from: el.querySelector('.lc-deck'), to, make: flyer('lc-flyer'), delay: 90 * n++, ms: 420 });
    }
  }, [view.history, meId]);

  const table = (
    <div ref={tableRef} className={`kit-board lc-table is-${side}${myTurn ? ' is-my-turn' : ''}`}>
      <div className="lc-felt" />
      <div className="lc-opponents">
        {others.map((p, k) => {
          const { x, y } = seatAt(k, others.length);
          const shown = Math.min(p.handCount, 10);
          const exposed = view.exposed === p.id;
          return (
            <div
              key={p.id}
              data-seat={p.id}
              className={`lc-opp${actor === p.id ? ' is-turn' : ''}${p.out ? ' is-out' : ''}${spotlight === p.id ? ' is-spot' : ''}${exposed ? ' is-exposed' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, '--tc': lcSeatColor(view.players.indexOf(p)) } as CSSProperties}
            >
              <div className="lc-opp-cards" aria-hidden="true">
                {Array.from({ length: shown }, (_, i) => {
                  const c = p.hand[i];
                  const backFace = view.variant === 'flip' && c ? faceOf(c, other) : null;
                  return <LcCard key={i} face={backFace} side={other} back={!backFace} className="is-mini" style={{ '--i': i - (shown - 1) / 2 } as CSSProperties} />;
                })}
              </div>
              <SeatFace id={p.id} className="lc-face" color={lcSeatColor(view.players.indexOf(p))} />
              <div className="lc-opp-name">
                <span className="lc-dot" />
                {nameFor(p.id)}
                <span className="lc-count">{p.handCount}</span>
              </div>
              {exposed && me && (
                <button type="button" className="lc-catch" onClick={() => onAction({ type: 'CATCH', target: p.id })}>
                  <Siren size={14} /> Didn't call - catch!
                </button>
              )}
              {!exposed && p.handCount === 1 && !p.out && <span className="lc-one">Last card</span>}
              {fx?.skipped === p.id && (
                <span key={fx.seq} className="lc-skipped" role="status">
                  Skipped
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="lc-centre">
        <div key={fx?.reversed ? `rev-${fx.seq}` : 'dir'} className={`lc-direction${view.direction < 0 ? ' is-ccw' : ''}${fx?.reversed ? ' is-reversing' : ''}`} aria-label={view.direction > 0 ? 'Play goes clockwise' : 'Play goes anticlockwise'} />
        <button
          type="button"
          className={`lc-pile lc-deck${myTurn && view.drawn === null ? ' is-live' : ''}`}
          aria-label={view.owed > 0 ? `Draw ${view.owed} cards` : `Draw a card (${view.deckCount} left)`}
          disabled={!myTurn || view.drawn !== null}
          onClick={() => onAction({ type: 'DRAW' })}
        >
          <span className="lc-deck-stack" />
          {view.variant === 'flip' && view.deckBack ? <LcCard face={view.deckBack} side={other} /> : <LcCard back />}
          <span className="lc-deck-count">{view.deckCount}</span>
          {view.owed > 0 && <span className="lc-owed">{myTurn ? `Draw ${view.owed}` : `+${view.owed}`}</span>}
        </button>
        <div className="lc-pile lc-discard" style={{ '--cc': view.color ? COLOR_HEX[view.color] : '#ffffff' } as CSSProperties}>
          {view.discard.slice(-3).map((c, i, arr) => (
            <LcCard
              key={`${c.id}-${side}`}
              face={faceOf(c, side)}
              side={side}
              className={i === arr.length - 1 ? 'is-top' : 'is-under'}
              style={{ '--r': `${((c.id * 37) % 23) - 11}deg`, ...(i === arr.length - 1 ? { '--fx': playedFrom.fx, '--fy': playedFrom.fy } : {}) } as CSSProperties}
            />
          ))}
          {/* Re-made on each change of colour, so the new colour bursts across the felt. */}
          {view.color && <span key={`burst-${view.color}`} className="lc-colour-burst" aria-hidden="true" />}
          <span key={`name-${view.color ?? 'any'}`} className="lc-colour">
            {view.color ? COLOR_NAME[view.color] : 'Any colour'}
          </span>
        </div>
      </div>

      {fx?.skipped === meId && (
        <span key={fx.seq} className="lc-skipped is-me" role="status">
          You were skipped
        </span>
      )}
      {fx?.reversed && (
        <span key={`r-${fx.seq}`} className="lc-reversed" role="status">
          Reverse
        </span>
      )}
      {me && !view.over && (
        <div className="lc-controls">
          {view.exposed && view.exposed !== meId && (
            <button type="button" className="lc-call is-urgent is-big" onClick={() => onAction({ type: 'CATCH', target: view.exposed! })}>
              <Siren size={18} /> {nameFor(view.exposed)} didn't call "Last card" - catch them!
            </button>
          )}
          {myTurn && view.drawn !== null && (
            <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => onAction({ type: 'PASS' })}>
              Keep it &amp; pass
            </button>
          )}
          {myTurn && hand.length === 2 && (
            <button type="button" className={`lc-call${callArmed ? ' is-armed' : ''}`} aria-pressed={callArmed} onClick={() => setCallArmed((v) => !v)}>
              <Megaphone size={15} /> {callArmed ? 'Calling "Last card!"' : 'Call "Last card!"'}
            </button>
          )}
          {view.exposed === meId && (
            <button type="button" className="lc-call is-urgent is-big" onClick={() => onAction({ type: 'CALL' })}>
              <Megaphone size={18} /> You didn't call "Last card!" - call it now
            </button>
          )}
        </div>
      )}

      {me && hand.length > 1 && <SortButton label={SORT_LABEL[sortBy]} onClick={nextSort} className="lc-sort" />}
      {me && (
        <div className="lc-hand" style={{ '--n': hand.length } as CSSProperties}>
          {shown.map((c, i) => {
            const ok = canPlay(c);
            const f = faceOf(c, side);
            return (
              <button
                key={`${c.id}-${side}`}
                type="button"
                className={`lc-hand-card${ok ? ' is-ok' : ''}${view.drawn === c.id ? ' is-drawn' : ''}`}
                style={{ '--i': i - (hand.length - 1) / 2 } as CSSProperties}
                aria-label={`${f ? faceName(f) : 'card'}${ok ? '' : " (can't play)"}`}
                disabled={!ok}
                onClick={() => play(c)}
              >
                <LcCard face={f} side={side} />
              </button>
            );
          })}
        </div>
      )}

      {choosing !== null && (
        <div className="lc-picker" role="dialog" aria-label="Choose a colour">
          <p>Choose a colour</p>
          <div className="lc-swatches">
            {colorsOf(side).map((col: Color) => (
              <button
                key={col}
                type="button"
                className="lc-swatch"
                style={{ '--cc': COLOR_HEX[col] } as CSSProperties}
                onClick={() => {
                  onAction({ type: 'PLAY', card: choosing, color: col, callLast: callArmed });
                  setChoosing(null);
                  setCallArmed(false);
                }}
              >
                {COLOR_NAME[col]}
              </button>
            ))}
          </div>
          <button type="button" className="lc-picker-cancel" onClick={() => setChoosing(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  const winnerPoints = view.winner ? view.score[view.winner] : 0;
  const overlay = view.over && view.winner ? (
    <ResultCard
      kicker={`Hand ${view.game}`}
      title={view.winner === meId ? 'You went out' : `${nameFor(view.winner)} went out`}
      won={view.winner === meId}
      onRematch={view.players.filter((p) => !p.out).length > 1 ? () => onAction({ type: 'REMATCH' }) : undefined}
      rematchLabel="Deal the next hand"
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={900}
    >
      <ul className="lc-tally" aria-label="Cards left in each hand">
        {view.players
          .filter((p) => p.id !== view.winner && !p.out)
          .map((p) => {
            const faces = p.hand.map((c) => ({ c, f: faceOf(c, side) })).filter((x) => x.f);
            const total = faces.reduce((n, x) => n + points(x.f!), 0);
            return (
              <li key={p.id}>
                <span className="lc-tally-name">{who(p.id)}</span>
                <span className="lc-tally-cards">
                  {faces.map(({ c, f }) => (
                    <LcCard key={c.id} face={f} side={side} className="is-tally" />
                  ))}
                  {faces.length === 0 && <i>no cards</i>}
                </span>
                <b className="lc-tally-points">{total}</b>
              </li>
            );
          })}
        <li className="lc-tally-total">
          <span className="lc-tally-name">{who(view.winner)} {view.winner === meId ? 'score' : 'scores'}</span>
          <span className="lc-tally-cards">every card left in the other hands, added up</span>
          <b className="lc-tally-points">
            +
            {view.players
              .filter((p) => p.id !== view.winner && !p.out)
              .reduce((n, p) => n + p.hand.reduce((m, c) => m + (faceOf(c, side) ? points(faceOf(c, side)!) : 0), 0), 0)}
          </b>
        </li>
      </ul>
      <p>
        Scores: {[...view.players].sort((a, b) => (view.score[b.id] ?? 0) - (view.score[a.id] ?? 0)).map((p) => `${who(p.id)} ${view.score[p.id] ?? 0}`).join(' · ')}
      </p>
      {winnerPoints >= 500 && <p>{who(view.winner)} passed 500 points!</p>}
    </ResultCard>
  ) : null;

  const side$ = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: lcSeatColor(view.players.indexOf(p)), active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': lcSeatColor(view.players.indexOf(p)) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      <PlayersPanel
        title={`Hand ${view.game} · ${view.variant === 'flip' ? `Flip - ${side} side` : 'Classic'}`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p, i) => ({
          id: p.id,
          name: who(p.id),
          you: p.id === meId,
          color: lcSeatColor(i),
          detail: p.out ? 'Left the game' : `${p.handCount} ${p.handCount === 1 ? 'card' : 'cards'}${view.exposed === p.id ? " · didn't call!" : ''}`,
          trailing: view.score[p.id] ?? 0,
          active: actor === p.id,
          out: p.out,
        }))}
      />
    </>
  );

  let status;
  if (view.over && view.winner) status = <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'} the hand</>;
  else if (myTurn) {
    const onWhat = !topFace || view.color === null ? 'play any card' : topFace.color === null ? `on ${faceName(topFace)} · ${COLOR_NAME[view.color]}` : `on ${faceName(topFace)}`;
    status = view.owed > 0 ? <><strong>Draw {view.owed}</strong> · or stack a draw card of the same kind</> : view.drawn !== null ? <><strong>Play it or keep it</strong></> : <><strong>Your turn</strong> · {onWhat}</>;
  }
  else status = <><strong>{nameFor(actor ?? '')}</strong> is playing...</>;

  return (
    <GameShell
      className={`lc-game${side === 'dark' ? ' is-dark-side' : ''}`}
      rulesVariant={view.variant}
      title="Last Card"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={table}
      overlay={
        <>
          <TableMomentBanner moment={moment} />
          {overlay}
        </>
      }
      side={side$}
      log={
        <GameLog
          entries={view.history.map((e) => ({
            key: e.seq,
            text: describe(e, who, side),
            color: seatColorOf(e.kind === 'penalty' ? e.target! : e.player),
            loud: e.kind === 'call' || e.kind === 'catch' || (e.kind === 'penalty' && (e.count ?? 0) >= 2),
          }))}
          empty={
            <>
              Match the colour or the symbol.{' '}
              {view.variant === 'flip' ? 'A Flip card turns the whole table over to the dark side - and back.' : 'Wild Draw 4 only when you have nothing of the colour.'}
            </>
          }
        />
      }
    />
  );
}
