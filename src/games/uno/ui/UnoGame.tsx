import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { colorsOf, faceOf, fits, unoKit, points, rulesOf, type Card, type Color, type UnoAction, type UnoEvent, type UnoState, MERCY } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
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
import { COLOR_HEX, COLOR_NAME, UnoCard, faceName } from './UnoCard';
import { UNO_SOUNDS, unoCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2B6BE0', '#20A464', '#F2B705', '#9B6BFF', '#14C3A2', '#FF9F1C', '#FF4F8B', '#8d97ab', '#c4467f'];
export const unoSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

function describe(e: UnoEvent, who: (id: string) => string, side: 'light' | 'dark'): string {
  switch (e.kind) {
    case 'play': {
      const f = e.card ? faceOf(e.card, side) ?? faceOf(e.card, side === 'light' ? 'dark' : 'light') : null;
      const name = f ? faceName(f) : 'a card';
      if ((e.count ?? 1) > 1 && f) return `${who(e.player)} played ${['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][e.count!] ?? e.count} ${f.value}s together, ending on ${e.color ? COLOR_NAME[e.color].toLowerCase() : 'any colour'}`;
      return `${who(e.player)} played ${name}${f && f.color === null && e.color ? ` → ${COLOR_NAME[e.color]}` : ''}`;
    }
    case 'draw':
      return (e.count ?? 1) > 1 ? `${who(e.player)} drew ${e.count} cards to find one to play` : `${who(e.player)} drew a card`;
    case 'pass':
      return `${who(e.player)} kept it and passed`;
    case 'penalty':
      return `${who(e.target!)} drew ${e.count}`;
    case 'call':
      return `${who(e.player)} called "UNO!"`;
    case 'catch':
      return `${who(e.player)} caught ${who(e.target!)} - draw ${e.count}`;
    case 'swap':
      return `${who(e.player)} swapped hands with ${who(e.target!)}`;
    case 'rotate':
      return `Every hand moved on to the next player`;
    case 'bust':
      return `${who(e.player)} hit ${e.count} cards and ${who(e.player) === 'You' ? 'are' : 'is'} out of the hand`;
  }
}

/**
 * The plays the whole table should notice, said large: a colour chosen, a
 * "UNO!" call, a player caught without calling, a heavy draw, the flip.
 */
export function unoMoments(prev: UnoState, next: UnoState, who: (id: string) => string, colorOf: (id: string) => string): TableMoment[] {
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
      out.push({ kicker: who(e.player), title: '"UNO!"', detail: 'One card left.', color: '#ffd25a', art: <Megaphone size={44} />, feels: { [e.player]: 'good' } });
    } else if (e.kind === 'catch') {
      out.push({
        kicker: `${who(e.player)} caught ${who(e.target!)}`,
        title: "Didn't call UNO!",
        detail: `${who(e.target!)} ${e.target && who(e.target) === 'You' ? 'draw' : 'draws'} ${e.count}.`,
        color: '#e2483b',
        art: <Siren size={44} />,
        feels: { [e.target!]: 'bad', [e.player]: 'good' },
      });
    } else if (e.kind === 'swap') {
      out.push({ kicker: who(e.player), title: `swapped hands with ${who(e.target!)}`, detail: 'A 7 trades your whole hand for theirs.', color: colorOf(e.player), feels: { [e.target!]: 'bad' } });
    } else if (e.kind === 'rotate') {
      out.push({ kicker: `${who(e.player)} played a 0`, title: 'Every hand moves on', detail: 'You now hold the hand of the player before you.', color: colorOf(e.player) });
    } else if (e.kind === 'bust') {
      out.push({ kicker: who(e.player), title: `${who(e.player) === 'You' ? 'are' : 'is'} out of the hand`, detail: `${e.count} cards: 25 is the limit. Their points wait for the winner.`, color: '#e2483b', art: <span className="uno-moment-count">${e.count}</span>, feels: { [e.player]: 'bad' } });
    } else if (e.kind === 'penalty' && (e.count ?? 0) >= 2) {
      const you = who(e.target!) === 'You';
      out.push({ kicker: who(e.target!), title: `${you ? 'draw' : 'draws'} ${e.count}`, color: '#e2483b', art: <span className="uno-moment-count">+{e.count}</span>, feels: { [e.target!]: 'bad' } });
    }
  }
  return out;
}

const SORTS = ['colour', 'number', 'dealt'] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { colour: 'by colour', number: 'by number', dealt: 'as dealt' };
const KIND_RANK: Record<string, number> = { number: 0, skip: 10, 'skip-all': 10, reverse: 11, draw: 12, flip: 13, 'discard-all': 14, wild: 20, 'wild-draw': 21, 'wild-draw-color': 21, 'wild-reverse-draw': 22 };

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

/** The Uno table: opponents round the top, the piles in the middle, your hand along the bottom. */
export function UnoGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<UnoState, UnoAction>) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const [fanned, setFanned] = useState<string | null>(null);
  // No Mercy: the 7 waiting for a player to swap hands with.
  const [swapping, setSwapping] = useState<{ card: number; also: number[] } | null>(null);
  /** Same numbers together: the card picked, and the others of its number added so far, in order. */
  const [grouping, setGrouping] = useState<{ card: number; also: number[] } | null>(null);
  const noMercy = view.variant === 'no-mercy';
  const rules = rulesOf(view);
  const [callArmed, setCallArmed] = useState(false);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => unoCues(a, b, meId), UNO_SOUNDS);
  const seatColorOf = (id: string) => unoSeatColor(view.players.findIndex((p) => p.id === id));
  const moment = useTableMoments(view, (a, b) => unoMoments(a, b, (id) => (id === meId ? 'You' : nameFor(id)), seatColorOf));

  const seat = view.players.findIndex((p) => p.id === meId);
  const me = view.players[seat];
  const actor = unoKit.actor(view);
  const myTurn = actor === meId;
  const side = view.side;
  const other = side === 'light' ? 'dark' : 'light';
  const top = view.discard[view.discard.length - 1];
  const topFace = top ? faceOf(top, side) : null;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const hand = me?.hand ?? [];
  const [sortBy, nextSort] = useSortMode('gamehub:uno:sort', SORTS);
  const shown = sortHand(hand, view.side, sortBy);
  const canPlay = (c: Card) => myTurn && (view.drawn === null || c.id === view.drawn) && !!faceOf(c, side) && fits(view, faceOf(c, side)!, hand);

  useEffect(() => {
    setChoosing(null);
    setSwapping(null);
    setGrouping(null);
    if (hand.length !== 2) setCallArmed(false);
  }, [view.last?.seq, hand.length]);

  const play = (c: Card) => {
    if (!canPlay(c)) return;
    const f = faceOf(c, side)!;
    if (f.color === null) {
      setChoosing(c.id);
      return;
    }
    // Same numbers together: holding more of this number, ask which go with it.
    if (rules.together && view.drawn === null && f.kind === 'number' && twinsOf(c).length > 0) {
      setGrouping({ card: c.id, also: [] });
      return;
    }
    send(c, []);
  };
  /** The other cards in hand with this card's number. */
  const twinsOf = (c: Card) => {
    const f = faceOf(c, side);
    return f?.kind === 'number' ? hand.filter((h) => h.id !== c.id && faceOf(h, side)?.kind === 'number' && faceOf(h, side)!.value === f.value) : [];
  };
  /** Play a card (with any others of its number). Down to one card after it, the call goes with it. */
  const send = (c: Card, also: number[]) => {
    const f = faceOf(c, side)!;
    const left = hand.length - 1 - also.length;
    // A 7 swaps hands, so it needs a player (unless it empties your hand).
    if (rules.sevenZero && f.kind === 'number' && f.value === 7 && left > 0) {
      setGrouping(null);
      setSwapping({ card: c.id, also });
      return;
    }
    onAction({ type: 'PLAY', card: c.id, callLast: callArmed, ...(also.length ? { also } : {}) });
    setGrouping(null);
    setCallArmed(false);
  };

  // Opponents sit round the top of the table, in turn order after you.
  const others = view.players.map((_, k) => view.players[(seat + 1 + k) % view.players.length]).filter((p) => p.id !== meId);
  /** Where opponent `k` of `n` sits, as a point on the table (percent). */
  const seatAt = (k: number, n: number) => {
    if (n > 5) {
      // A full table: the seats go round the sides and the top, clear of your hand.
      const round = Math.PI * (1.13 - (1.26 * (k + 0.5)) / n);
      return { x: 50 + Math.cos(round) * 42, y: 45 - Math.sin(round) * 33 };
    }
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
      const to = who === meId ? el.querySelector('.uno-hand') : el.querySelector(`[data-seat="${who}"] .uno-opp-cards`);
      for (let i = 0; i < Math.min(e.count ?? 1, 6); i++) fly({ from: el.querySelector('.uno-deck'), to, make: flyer('uno-flyer'), delay: 90 * n++, ms: 420 });
    }
  }, [view.history, meId]);

  const table = (
    <div ref={tableRef} className={`kit-board uno-table is-${side}${myTurn ? ' is-my-turn' : ''}`}>
      <div className="uno-felt" />
      <div className={`uno-opponents${others.length > 5 ? ' is-many' : ''}`}>
        {others.map((p, k) => {
          const { x, y } = seatAt(k, others.length);
          // Hovered, a hand lays out flat with every card clear, kept inside the table.
          const open = fanned === p.id;
          const shown = open ? p.handCount : Math.min(p.handCount, others.length > 5 ? 6 : 10);
          const gap = Math.min(4.2, 84 / Math.max(shown, 1));
          const half = (gap * (shown - 1) + 4.6) / 2 + 2;
          const shift = Math.min(Math.max(x, half), 100 - half) - x;
          const exposed = view.exposed === p.id;
          return (
            <div
              key={p.id}
              data-seat={p.id}
              className={`uno-opp${actor === p.id ? ' is-turn' : ''}${p.out || p.bust ? ' is-out' : ''}${spotlight === p.id ? ' is-spot' : ''}${exposed ? ' is-exposed' : ''}${open ? ' is-fanned' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, '--tc': unoSeatColor(view.players.indexOf(p)), '--gap': `${gap}cqw`, '--shift': `${shift}cqw` } as CSSProperties}
              onMouseEnter={() => setFanned(p.id)}
              onMouseLeave={() => setFanned(null)}
            >
              <div className="uno-opp-cards" aria-hidden="true">
                {Array.from({ length: shown }, (_, i) => {
                  const c = p.hand[i];
                  const backFace = view.variant === 'flip' && c ? faceOf(c, other) : null;
                  return <UnoCard key={i} face={backFace} side={other} back={!backFace} className="is-mini" style={{ '--i': i - (shown - 1) / 2 } as CSSProperties} />;
                })}
              </div>
              <div className="uno-opp-name">
                <SeatFace id={p.id} className="uno-seat-face" color={unoSeatColor(view.players.indexOf(p))} fallback={<span className="uno-dot" />} />
                {nameFor(p.id)}
                <span className={`uno-count${noMercy && p.handCount >= MERCY - 7 ? ' is-near' : ''}`} title={noMercy ? `${p.handCount} of ${MERCY}: at ${MERCY} they are out of the hand` : undefined}>
                  {p.handCount}
                  {noMercy && p.handCount >= MERCY - 7 && !p.bust ? `/${MERCY}` : ''}
                </span>
              </div>
              {exposed && me && (
                <button type="button" className="uno-catch" onClick={() => onAction({ type: 'CATCH', target: p.id })}>
                  <Siren size={14} /> Didn't call - catch!
                </button>
              )}
              {!exposed && p.handCount === 1 && !p.out && !p.bust && <span className="uno-one">UNO</span>}
              {p.bust && <span className="uno-one is-bust">Out: {MERCY} cards</span>}
              {fx?.skipped === p.id && (
                <span key={fx.seq} className="uno-skipped" role="status">
                  Skipped
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="uno-centre">
        <div key={fx?.reversed ? `rev-${fx.seq}` : 'dir'} className={`uno-direction${view.direction < 0 ? ' is-ccw' : ''}${fx?.reversed ? ' is-reversing' : ''}`} aria-label={view.direction > 0 ? 'Play goes clockwise' : 'Play goes anticlockwise'} />
        <button
          type="button"
          className={`uno-pile uno-deck${myTurn && view.drawn === null ? ' is-live' : ''}`}
          aria-label={view.owed > 0 ? `Draw ${view.owed} cards` : `Draw a card (${view.deckCount} left)`}
          disabled={!myTurn || view.drawn !== null}
          onClick={() => onAction({ type: 'DRAW' })}
        >
          <span className="uno-deck-stack" />
          {view.variant === 'flip' && view.deckBack ? <UnoCard face={view.deckBack} side={other} /> : <UnoCard back />}
          <span className="uno-deck-count">{view.deckCount}</span>
          {view.owed > 0 && <span className="uno-owed">{myTurn ? `Draw ${view.owed}` : `+${view.owed}`}</span>}
        </button>
        <div className="uno-pile uno-discard" style={{ '--cc': view.color ? COLOR_HEX[view.color] : '#ffffff' } as CSSProperties}>
          {view.discard.slice(-3).map((c, i, arr) => (
            <UnoCard
              key={`${c.id}-${side}`}
              face={faceOf(c, side)}
              side={side}
              className={i === arr.length - 1 ? 'is-top' : 'is-under'}
              style={{ '--r': `${((c.id * 37) % 23) - 11}deg`, ...(i === arr.length - 1 ? { '--fx': playedFrom.fx, '--fy': playedFrom.fy } : {}) } as CSSProperties}
            />
          ))}
          {/* Re-made on each change of colour, so the new colour bursts across the felt. */}
          {view.color && <span key={`burst-${view.color}`} className="uno-colour-burst" aria-hidden="true" />}
          <span key={`name-${view.color ?? 'any'}`} className="uno-colour">
            {view.color ? COLOR_NAME[view.color] : 'Any colour'}
          </span>
        </div>
      </div>

      {fx?.skipped === meId && (
        <span key={fx.seq} className="uno-skipped is-me" role="status">
          You were skipped
        </span>
      )}
      {fx?.reversed && (
        <span key={`r-${fx.seq}`} className="uno-reversed" role="status">
          Reverse
        </span>
      )}
      {me && !view.over && (
        <div className="uno-controls">
          {view.exposed && view.exposed !== meId && (
            <button type="button" className="uno-call is-urgent is-big" onClick={() => onAction({ type: 'CATCH', target: view.exposed! })}>
              <Siren size={18} /> {nameFor(view.exposed)} didn't call "UNO" - catch them!
            </button>
          )}
          {noMercy && me && !me.bust && hand.length >= MERCY - 10 && (
            <span className={`uno-mercy${hand.length >= MERCY - 4 ? ' is-near' : ''}`} role="status">
              {hand.length} of {MERCY} cards · at {MERCY} you are out of the hand
            </span>
          )}
          {me?.bust && <span className="uno-mercy is-near" role="status">You are out of this hand: you reached {MERCY} cards</span>}
          {myTurn && view.drawn !== null && !rules.drawToMatch && (
            <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => onAction({ type: 'PASS' })}>
              Keep it &amp; pass
            </button>
          )}
          {myTurn && (hand.length === 2 || (rules.together && hand.length > 2)) && (
            <button type="button" className={`uno-call${callArmed ? ' is-armed' : ''}`} aria-pressed={callArmed} onClick={() => setCallArmed((v) => !v)}>
              <Megaphone size={15} /> {callArmed ? 'Calling "UNO!"' : 'Call "UNO!"'}
            </button>
          )}
          {view.exposed === meId && (
            <button type="button" className="uno-call is-urgent is-big" onClick={() => onAction({ type: 'CALL' })}>
              <Megaphone size={18} /> You didn't call "UNO!" - call it now
            </button>
          )}
        </div>
      )}

      {me && hand.length > 1 && <SortButton label={SORT_LABEL[sortBy]} onClick={nextSort} className="uno-sort" />}
      {me && (
        <div className="uno-hand" style={{ '--n': hand.length } as CSSProperties}>
          {shown.map((c, i) => {
            const ok = canPlay(c);
            const f = faceOf(c, side);
            return (
              <button
                key={`${c.id}-${side}`}
                type="button"
                className={`uno-hand-card${ok ? ' is-ok' : ''}${view.drawn === c.id ? ' is-drawn' : ''}`}
                style={{ '--i': i - (hand.length - 1) / 2 } as CSSProperties}
                aria-label={`${f ? faceName(f) : 'card'}${ok ? '' : " (can't play)"}`}
                disabled={!ok}
                onClick={() => play(c)}
              >
                <UnoCard face={f} side={side} />
              </button>
            );
          })}
        </div>
      )}

      {swapping !== null && (
        <div className="uno-picker" role="dialog" aria-label="Swap hands with">
          <p>Swap hands with</p>
          <div className="uno-swap-list">
            {others
              .filter((p) => !p.out && !p.bust)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="uno-swap"
                  style={{ '--tc': unoSeatColor(view.players.indexOf(p)) } as CSSProperties}
                  onClick={() => {
                    onAction({ type: 'PLAY', card: swapping.card, swapWith: p.id, callLast: callArmed, ...(swapping.also.length ? { also: swapping.also } : {}) });
                    setSwapping(null);
                    setCallArmed(false);
                  }}
                >
                  <span className="uno-dot" />
                  <span className="uno-swap-name">{nameFor(p.id)}</span>
                  <b>
                    {p.handCount} {p.handCount === 1 ? 'card' : 'cards'}
                  </b>
                </button>
              ))}
          </div>
          <p className="uno-swap-note">You give them your {hand.length - 1 - swapping.also.length} and take theirs.</p>
          <button type="button" className="uno-picker-cancel" onClick={() => setSwapping(null)}>
            Cancel
          </button>
        </div>
      )}

      {grouping !== null &&
        (() => {
          const first = hand.find((h) => h.id === grouping.card);
          if (!first) return null;
          const n = 1 + grouping.also.length;
          return (
            <div className="uno-picker" role="dialog" aria-label="Play the same numbers together">
              <p>Play your other {faceOf(first, side)!.value}s with it?</p>
              <div className="uno-group">
                <span className="uno-group-card is-in">
                  <UnoCard face={faceOf(first, side)} side={side} />
                  <b>1</b>
                </span>
                {twinsOf(first).map((h) => {
                  const at = grouping.also.indexOf(h.id);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      className={`uno-group-card${at >= 0 ? ' is-in' : ''}`}
                      aria-pressed={at >= 0}
                      aria-label={`${faceName(faceOf(h, side)!)}${at >= 0 ? `, number ${at + 2} on the pile` : ''}`}
                      onClick={() => setGrouping({ card: grouping.card, also: at >= 0 ? grouping.also.filter((id) => id !== h.id) : [...grouping.also, h.id] })}
                    >
                      <UnoCard face={faceOf(h, side)} side={side} />
                      {at >= 0 && <b>{at + 2}</b>}
                    </button>
                  );
                })}
              </div>
              <p className="uno-swap-note">Tap the cards to add, in order. The last one sets the colour.</p>
              <button type="button" className="g-btn primary" onClick={() => send(first, grouping.also)}>
                Play {n} {n === 1 ? 'card' : 'cards'}
              </button>
              <button type="button" className="uno-picker-cancel" onClick={() => setGrouping(null)}>
                Cancel
              </button>
            </div>
          );
        })()}

      {choosing !== null && (
        <div className="uno-picker" role="dialog" aria-label="Choose a colour">
          <p>Choose a colour</p>
          <div className="uno-swatches">
            {colorsOf(side).map((col: Color) => (
              <button
                key={col}
                type="button"
                className="uno-swatch"
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
          <button type="button" className="uno-picker-cancel" onClick={() => setChoosing(null)}>
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
      <ul className="uno-tally" aria-label="Cards left in each hand">
        {view.players
          .filter((p) => p.id !== view.winner && !p.out && !p.bust)
          .map((p) => {
            const faces = p.hand.map((c) => ({ c, f: faceOf(c, side) })).filter((x) => x.f);
            const total = faces.reduce((n, x) => n + points(x.f!), 0);
            return (
              <li key={p.id}>
                <span className="uno-tally-name">{nameFor(p.id)}</span>
                <span className="uno-tally-cards">
                  {faces.map(({ c, f }) => (
                    <UnoCard key={c.id} face={f} side={side} className="is-tally" />
                  ))}
                  {faces.length === 0 && <i>no cards</i>}
                </span>
                <b className="uno-tally-points">{total}</b>
              </li>
            );
          })}
        {view.pot > 0 && (
          <li>
            <span className="uno-tally-name">Knocked out</span>
            <span className="uno-tally-cards">
              <i>{view.players.filter((p) => p.bust).map((p) => who(p.id)).join(', ')}: the hands that reached {MERCY} cards</i>
            </span>
            <b className="uno-tally-points">{view.pot}</b>
          </li>
        )}
        <li className="uno-tally-total">
          <span className="uno-tally-name">{who(view.winner)} {view.winner === meId ? 'score' : 'scores'}</span>
          <span className="uno-tally-cards">every card left in the other hands, added up</span>
          <b className="uno-tally-points">
            +
            {view.players
              .filter((p) => p.id !== view.winner && !p.out)
              .reduce((n, p) => n + p.hand.reduce((m, c) => m + (faceOf(c, side) ? points(faceOf(c, side)!) : 0), 0), 0) + view.pot}
          </b>
        </li>
      </ul>
      <p>
        Scores: {[...view.players].sort((a, b) => (view.score[b.id] ?? 0) - (view.score[a.id] ?? 0)).map((p) => `${nameFor(p.id)} ${view.score[p.id] ?? 0}`).join(' · ')}
      </p>
      {winnerPoints >= 500 && <p>{who(view.winner)} passed 500 points!</p>}
    </ResultCard>
  ) : null;

  // What this table switched on, beyond the mode's own rules (No Mercy has most built in).
  const houseRules = [
    !noMercy && rules.stack && 'Stack draw cards: answer with one as big or bigger',
    rules.together && 'Same numbers together',
    !noMercy && rules.freeWild && 'Wild Draw any time',
    !noMercy && rules.drawToMatch && 'Draw until you can play',
    !noMercy && rules.sevenZero && (view.variant === 'flip' ? '7 swaps hands' : '7 swaps hands, 0 passes hands on'),
  ].filter(Boolean) as string[];

  const side$ = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: unoSeatColor(view.players.indexOf(p)), active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': unoSeatColor(view.players.indexOf(p)) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      <PlayersPanel
        title={`Hand ${view.game} · ${view.variant === 'flip' ? `Flip - ${side} side` : noMercy ? 'No Mercy' : 'Classic'}`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p, i) => ({
          id: p.id,
          name: nameFor(p.id),
          you: p.id === meId,
          color: unoSeatColor(i),
          detail: p.out ? 'Left the game' : p.bust ? `Out of the hand: ${MERCY} cards` : `${p.handCount} ${p.handCount === 1 ? 'card' : 'cards'}${view.exposed === p.id ? " · didn't call!" : ''}`,
          trailing: view.score[p.id] ?? 0,
          active: actor === p.id,
          out: p.out,
        }))}
      />
      {houseRules.length > 0 && (
        <SideSection title="House rules" meta={`${houseRules.length} on`}>
          <ul className="uno-house">
            {houseRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </SideSection>
      )}
    </>
  );

  let status;
  if (view.over && view.winner) status = <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'} the hand</>;
  else if (myTurn) {
    const onWhat = !topFace || view.color === null ? 'play any card' : topFace.color === null ? `on ${faceName(topFace)} · ${COLOR_NAME[view.color]}` : `on ${faceName(topFace)}`;
    status = view.owed > 0 ? <><strong>Draw {view.owed}</strong> · or answer with a draw card as big or bigger</> : view.drawn !== null ? (rules.drawToMatch ? <><strong>Play the card you drew</strong></> : <><strong>Play it or keep it</strong></>) : <><strong>Your turn</strong> · {onWhat}</>;
  }
  else status = <><strong>{nameFor(actor ?? '')}</strong> is playing...</>;

  return (
    <GameShell
      className={`uno-game${side === 'dark' ? ' is-dark-side' : ''}`}
      rulesVariant={view.variant}
      title="Uno"
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
              {view.variant === 'flip' ? 'A Flip card turns the whole table over to the dark side - and back.' : noMercy ? `Draw cards stack, you draw until you can play, and ${MERCY} cards puts you out of the hand.` : rules.freeWild ? 'Wild Draw 4 can be played any time.' : 'Wild Draw 4 only when you have nothing of the colour.'}
            </>
          }
        />
      }
    />
  );
}
