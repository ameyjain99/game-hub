import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ACTION_NAME, COLORS, COLOR_NAME, SET_SIZE, completeColors, isComplete, mdKit, payable, pileOf, rentOf, stealable, type Claim, type Color, type MdAction, type MdEvent, type MdPlayer, type MdState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { SortButton, useSortMode } from '../../kit/ui/HandSort';
import { GameLog } from '../../kit/ui/GameLog';
import { SeatFace } from '../../../online/ui/SeatFace';
import { House, Hotel } from '../../../shared/icons';
import { TableMomentBanner, freshEvents, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { fly, flyer } from '../../../shared/fly';
import { COLOR_HEX, MdCard, inkOn, money } from './MdCard';
import { MD_SOUNDS, mdCues } from './sound';

const SEAT_COLORS = ['#e5484d', '#2f7de1', '#f2b705', '#3fa34d', '#d44a9c'];
export const mdSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

const HAND_LIMIT = 7;
const PLAYS = 3;
const KIND_ORDER = ['property', 'wild', 'money', 'rent', 'action'];
const SORTS = ['type', 'dealt'] as const;
const SORT_LABEL = { type: 'By type', dealt: 'As drawn' };
const bankOf = (p: MdPlayer) => p.bank.reduce((n, c) => n + c.value, 0);
/** How wide an opponent's property set is drawn, by the number of opponents sharing the top of the table. */
const PILE_WIDTH: Record<number, number> = { 1: 16, 2: 13.2, 3: 8.9, 4: 9.5 };

function describe(e: MdEvent, who: (id: string) => string): string {
  const w = who(e.player);
  const t = e.target ? who(e.target) : '';
  const them = t === 'You' ? 'you' : t;
  switch (e.kind) {
    case 'draw':
      return `${w} drew ${e.count} cards`;
    case 'bank':
      return `${w} put ${e.card} in the bank`;
    case 'property':
      return `${w} laid down ${e.card}${e.card?.includes('Wild') ? ` as ${COLOR_NAME[e.color!]}` : ''}`;
    case 'action':
      return `${w} played ${e.card}${e.target ? ` on ${them}` : ''}`;
    case 'rent':
      return `${w} charged ${e.target ? them : 'everyone'} ${money(e.amount!)} ${COLOR_NAME[e.color!]} rent${e.count ? ', doubled' : ''}`;
    case 'no':
      return `${w} said Just Say No to ${them}${(e.count ?? 1) > 1 ? ' in return' : ''}`;
    case 'pay': {
      // Money needs no naming; anything else that was handed over does.
      const things = e.cards!.filter((name) => !/^\d+M$/.test(name));
      return `${w} paid ${them} ${money(e.amount!)}${things.length ? `, with ${things.join(', ')}` : ''}`;
    }
    case 'broke':
      return `${w} had nothing to pay ${them} with`;
    case 'steal':
      return `${w} took ${e.cards![0]} from ${them}`;
    case 'swap':
      return `${w} swapped ${e.cards![1]} for ${t === 'You' ? 'your' : `${t}'s`} ${e.cards![0]}`;
    case 'set':
      return `${w} took ${t === 'You' ? 'your' : `${t}'s`} ${COLOR_NAME[e.color!]} set`;
    case 'build':
      return `${w} built a ${e.card} on ${COLOR_NAME[e.color!]}`;
    case 'move':
      return `${w} turned ${e.card} to ${COLOR_NAME[e.color!]}`;
    case 'discard':
      return `${w} discarded ${e.count} ${e.count === 1 ? 'card' : 'cards'}`;
    case 'end':
      return `${w} ended the turn`;
    case 'leave':
      return `${w} left the game`;
  }
}

/** The plays the table should notice: a set taken or completed, a Just Say No, a heavy rent. */
export function mdMoments(prev: MdState, next: MdState, who: (id: string) => string, colorOf: (id: string) => string): TableMoment[] {
  if (next.game !== prev.game) return [];
  const out: TableMoment[] = [];
  for (const e of freshEvents(prev.history, next.history)) {
    const w = who(e.player);
    const t = e.target ? who(e.target) : '';
    if (e.kind === 'set') out.push({ kicker: w, title: 'Deal Breaker!', detail: `The ${COLOR_NAME[e.color!]} set, taken from ${t === 'You' ? 'you' : t}.`, color: COLOR_HEX[e.color!], feels: { [e.player]: 'good', [e.target!]: 'bad' } });
    else if (e.kind === 'no') out.push({ kicker: w, title: 'Just Say No!', detail: `${e.card} is refused.`, color: '#2f7de1', feels: { [e.target!]: 'bad' } });
    else if (e.kind === 'rent' && e.amount! >= 6) out.push({ kicker: w, title: `Rent: ${money(e.amount!)}`, detail: `${COLOR_NAME[e.color!]}${e.count ? ', doubled' : ''}. ${e.target ? `${t} ${t === 'You' ? 'pay' : 'pays'}` : 'Everyone pays'}.`, color: COLOR_HEX[e.color!] });
  }
  for (const p of next.players) {
    const before = prev.players.find((x) => x.id === p.id);
    const fresh = before ? completeColors(p).filter((c) => !isComplete(before, c)) : [];
    const n = completeColors(p).length;
    for (const c of fresh) if (n < next.setsToWin) out.push({ kicker: who(p.id), title: `${COLOR_NAME[c]} set complete`, detail: `${n} of ${next.setsToWin} sets.`, color: colorOf(p.id), feels: { [p.id]: 'good' } });
  }
  return out;
}

/** What the hand card being played is waiting on. */
type Flow =
  | { step: 'card'; card: number }
  | { step: 'rent'; card: number; color: Color; doubles: number[] }
  | { step: 'victim'; card: number }
  | { step: 'take'; card: number; swap: boolean; take?: number; from?: string }
  | { step: 'set'; card: number }
  | { step: 'build'; card: number }
  | { step: 'recolor'; card: number }
  | { step: 'discard'; ids: number[] };

export function MdGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<MdState, MdAction>) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [paying, setPaying] = useState<number[]>([]);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => mdCues(a, b, meId), MD_SOUNDS);
  const colorOf = (id: string) => mdSeatColor(view.players.findIndex((p) => p.id === id));
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const moment = useTableMoments(view, (a, b) => mdMoments(a, b, who, colorOf));

  const seat = view.players.findIndex((p) => p.id === meId);
  const me = view.players[seat] as MdPlayer | undefined;
  const hand = me?.hand ?? [];
  const actor = mdKit.actor(view);
  const turnId = view.players[view.turn].id;
  const claim: Claim | undefined = view.claims[0];
  const answering = !!claim && actor === meId && view.nos % 2 === 0;
  const insisting = !!claim && actor === meId && view.nos % 2 === 1;
  const myTurn = !view.over && !claim && turnId === meId;
  const canPlay = myTurn && view.phase === 'play' && view.plays < PLAYS;
  const holdsNo = hand.some((c) => c.action === 'just-say-no');
  const foes = view.players.filter((p) => p.id !== meId && !p.out);
  const send = (a: MdAction) => {
    onAction(a);
    setFlow(null);
  };

  useEffect(() => {
    setFlow(null);
    setPaying([]);
  }, [view.last?.seq, view.game]);

  const [sortBy, nextSort] = useSortMode('gamehub:monopoly-deal:sort', SORTS);
  const shown = sortBy === 'type' ? [...hand].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.colors[0] ? COLORS.indexOf(a.colors[0]) : 0) - (b.colors[0] ? COLORS.indexOf(b.colors[0]) : 0) || b.value - a.value || a.id - b.id) : hand;
  const discarding = flow?.step === 'discard' ? flow : null;
  const over = hand.length - HAND_LIMIT;

  // Cards travel: drawn from the pile, paid or taken from one table to another.
  const tableRef = useRef<HTMLDivElement>(null);
  const seen = useRef(view.history);
  useEffect(() => {
    const fresh = freshEvents(seen.current, view.history);
    seen.current = view.history;
    const el = tableRef.current;
    if (!el) return;
    const place = (id: string) => el.querySelector(`[data-seat="${id}"]`);
    let n = 0;
    for (const e of fresh) {
      if (e.kind === 'draw') for (let i = 0; i < (e.count ?? 2); i++) fly({ from: el.querySelector('.md-deck'), to: place(e.player), make: flyer('md-flyer'), delay: 90 * n++, ms: 420 });
      else if (e.kind === 'pay') for (let i = 0; i < Math.min(e.cards?.length ?? 1, 5); i++) fly({ from: place(e.player), to: place(e.target!), make: flyer('md-flyer is-cash'), delay: 80 * i, ms: 520 });
      else if (e.kind === 'steal' || e.kind === 'set') fly({ from: place(e.target!), to: place(e.player), make: flyer('md-flyer is-deed', undefined, { background: e.color ? COLOR_HEX[e.color] : '' }), ms: 560 });
      else if (e.kind === 'swap') {
        fly({ from: place(e.target!), to: place(e.player), make: flyer('md-flyer is-deed'), ms: 560 });
        fly({ from: place(e.player), to: place(e.target!), make: flyer('md-flyer is-deed'), ms: 560 });
      }
    }
  }, [view.history]);

  /** A player's side of the table: their bank and their property sets. */
  const tableau = (p: MdPlayer, mine: boolean) => {
    const colors = COLORS.filter((c) => pileOf(p, c).length > 0 || p.buildings.some((b) => b.color === c));
    return (
      <div className="md-tableau">
        <span className="md-bank" title={p.bank.map((c) => c.name).join(', ') || 'Nothing in the bank'}>
          <b>{money(bankOf(p))}</b>
          <i>
            bank · {p.bank.length} {p.bank.length === 1 ? 'card' : 'cards'}
          </i>
        </span>
        {colors.map((color) => {
          const pile = pileOf(p, color);
          const full = isComplete(p, color);
          return (
            <span key={color} className={`md-pile${full ? ' is-full' : ''}`} style={{ '--pc': COLOR_HEX[color], '--ink': inkOn(color) } as CSSProperties} aria-label={`${COLOR_NAME[color]}: ${pile.length} of ${SET_SIZE[color]}${full ? ', a full set' : ''}`}>
              {pile.map((x) =>
                mine && x.card.kind === 'wild' && myTurn && view.phase === 'play' ? (
                  <button key={x.card.id} type="button" className="md-bar is-wild" title="Turn this wild to another colour" aria-label={`${x.card.name}, lying as ${COLOR_NAME[color]}: change colour`} onClick={() => setFlow({ step: 'recolor', card: x.card.id })}>
                    Wild
                  </button>
                ) : (
                  <span key={x.card.id} className={`md-bar${x.card.kind === 'wild' ? ' is-wild' : ''}`} title={x.card.name}>
                    {x.card.kind === 'wild' ? 'Wild' : x.card.name}
                  </span>
                ),
              )}
              <span className="md-pile-foot">
                <b>
                  {pile.length}/{SET_SIZE[color]}
                </b>
                {p.buildings.filter((b) => b.color === color).map((b) => (b.card.action === 'house' ? <House key={b.card.id} size={12} aria-label="House" /> : <Hotel key={b.card.id} size={12} aria-label="Hotel" />))}
                <i>{money(rentOf(p, color))}</i>
              </span>
            </span>
          );
        })}
        {colors.length === 0 && <span className="md-empty">No properties yet</span>}
      </div>
    );
  };

  // ---- Prompts ----
  const flowCard = flow && 'card' in flow && flow.step !== 'recolor' ? hand.find((c) => c.id === flow.card) : undefined;
  const choice = (key: string | number, label: ReactNode, onClick: () => void, style?: CSSProperties, disabled = false) => (
    <button key={key} type="button" className="md-choice" style={style} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
  const swatch = (color: Color) => ({ '--tc': COLOR_HEX[color] }) as CSSProperties;
  const cancel = (
    <button type="button" className="md-cancel" onClick={() => setFlow(null)}>
      Cancel
    </button>
  );

  let prompt: ReactNode = null;
  if (answering && claim!.kind === 'pay') {
    const all = payable(me!);
    const total = all.filter((c) => paying.includes(c.id)).reduce((n, c) => n + c.value, 0);
    const enough = total >= claim!.amount! || paying.length === all.length;
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Pay what you owe">
        <p>
          Pay {nameFor(claim!.to)} <b>{money(claim!.amount!)}</b> · {claim!.why}
        </p>
        <div className="md-pay">
          {all.map((c) => {
            const placed = me!.props.find((x) => x.card.id === c.id);
            const on = paying.includes(c.id);
            return (
              <button key={c.id} type="button" className={`md-pay-card${on ? ' is-on' : ''}`} aria-pressed={on} aria-label={`${c.name}, ${money(c.value)}`} onClick={() => setPaying((ids) => (on ? ids.filter((id) => id !== c.id) : [...ids, c.id]))}>
                <MdCard card={c} as={placed?.color} className="is-small" />
              </button>
            );
          })}
        </div>
        <p className="md-note">No change is given. If you cannot cover it, you pay everything you have on the table.</p>
        <div className="md-row">
          <button type="button" className="g-btn primary" disabled={!enough || paying.length === 0} onClick={() => onAction({ type: 'PAY', cards: paying })}>
            Pay {money(total)}
          </button>
          {holdsNo && (
            <button type="button" className="md-no-btn" onClick={() => onAction({ type: 'NO' })}>
              Just Say No
            </button>
          )}
        </div>
      </div>
    );
  } else if (answering) {
    const them = view.players.find((p) => p.id === claim!.from)!;
    const wanted = claim!.kind === 'set' ? `your ${COLOR_NAME[claim!.color!]} set` : (them.props.find((x) => x.card.id === claim!.card)?.card.name ?? 'a property');
    const offered = claim!.kind === 'swap' ? view.players.find((p) => p.id === claim!.to)!.props.find((x) => x.card.id === claim!.give)?.card.name : null;
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Answer the action">
        <p>
          {nameFor(claim!.to)} plays <b>{claim!.why}</b>: {offered ? `${wanted} for their ${offered}` : `they take ${wanted}`}
        </p>
        <div className="md-row">
          <button type="button" className="md-no-btn" onClick={() => onAction({ type: 'NO' })}>
            Just Say No
          </button>
          <button type="button" className="g-btn g-btn-light" onClick={() => onAction({ type: 'ACCEPT' })}>
            Let it happen
          </button>
        </div>
      </div>
    );
  } else if (insisting) {
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Answer the Just Say No">
        <p>
          {nameFor(claim!.from)} said <b>Just Say No</b> to your {claim!.why}
        </p>
        <div className="md-row">
          <button type="button" className="md-no-btn" onClick={() => onAction({ type: 'NO' })}>
            Just Say No back
          </button>
          <button type="button" className="g-btn g-btn-light" onClick={() => onAction({ type: 'ACCEPT' })}>
            Let it stand
          </button>
        </div>
      </div>
    );
  } else if (flow?.step === 'recolor') {
    const placed = me?.props.find((x) => x.card.id === flow.card);
    prompt = placed ? (
      <div className="md-picker" role="dialog" aria-label="Turn the wild card">
        <p>Turn {placed.card.name} to</p>
        <div className="md-choices">{placed.card.colors.filter((c) => c !== placed.color).map((c) => choice(c, `${COLOR_NAME[c]} (${pileOf(me!, c).length + 1}/${SET_SIZE[c]})`, () => send({ type: 'MOVE', card: placed.card.id, color: c }), swatch(c)))}</div>
        {cancel}
      </div>
    ) : null;
  } else if (flow?.step === 'card' && flowCard) {
    const c = flowCard;
    const full = !canPlay;
    const bank = c.kind !== 'property' && c.kind !== 'wild' ? choice('bank', c.kind === 'money' ? 'Put it in the bank' : `Bank it as ${money(c.value)}`, () => send({ type: 'BANK', card: c.id }), undefined, full) : null;
    const rentable = c.kind === 'rent' ? c.colors.filter((col) => rentOf(me!, col) > 0) : [];
    const sets = c.action === 'house' || c.action === 'hotel' ? completeColors(me!).filter((col) => (view.buildAnywhere || (col !== 'railroad' && col !== 'utility')) && !me!.buildings.some((b) => b.color === col && b.card.action === c.action) && (c.action === 'house' || me!.buildings.some((b) => b.color === col && b.card.action === 'house'))) : [];
    const play: Record<string, ReactNode> = {
      'pass-go': choice('play', 'Play it: draw 2 cards', () => send({ type: 'PLAY', card: c.id }), undefined, full),
      birthday: choice('play', `Play it: everyone pays you ${money(2)}`, () => send({ type: 'PLAY', card: c.id }), undefined, full),
      'debt-collector': choice('play', `Play it: one player pays you ${money(5)}`, () => setFlow({ step: 'victim', card: c.id }), undefined, full),
      'sly-deal': choice('play', 'Play it: take a property', () => setFlow({ step: 'take', card: c.id, swap: false }), undefined, full || !foes.some((p) => p.props.some((x) => stealable(p, x.card.id)))),
      'forced-deal': choice('play', 'Play it: swap a property', () => setFlow({ step: 'take', card: c.id, swap: true }), undefined, full || me!.props.length === 0 || !foes.some((p) => p.props.some((x) => stealable(p, x.card.id)))),
      'deal-breaker': choice('play', 'Play it: take a full set', () => setFlow({ step: 'set', card: c.id }), undefined, full || !foes.some((p) => completeColors(p).length > 0)),
      house: choice('play', 'Build it on a full set', () => setFlow({ step: 'build', card: c.id }), undefined, full || sets.length === 0),
      hotel: choice('play', 'Build it on a set with a House', () => setFlow({ step: 'build', card: c.id }), undefined, full || sets.length === 0),
    };
    prompt = (
      <div className="md-picker" role="dialog" aria-label={c.name}>
        <MdCard card={c} className="is-shown" />
        <div className="md-choices is-stack">
          {c.kind === 'property' && choice('lay', 'Lay it down', () => send({ type: 'PROPERTY', card: c.id }), swatch(c.colors[0]), full)}
          {c.kind === 'wild' && c.colors.map((col) => choice(col, `Lay it as ${COLOR_NAME[col]} (${pileOf(me!, col).length + 1}/${SET_SIZE[col]})`, () => send({ type: 'PROPERTY', card: c.id, color: col }), swatch(col), full))}
          {rentable.map((col) => choice(col, `Charge ${COLOR_NAME[col]} rent: ${money(rentOf(me!, col))}`, () => setFlow({ step: 'rent', card: c.id, color: col, doubles: [] }), swatch(col), full))}
          {c.kind === 'rent' && rentable.length === 0 && <span className="md-note">You own nothing in these colours yet.</span>}
          {c.action && play[c.action]}
          {c.action === 'just-say-no' && <span className="md-note">Kept in hand, it answers an action played against you.</span>}
          {c.action === 'double-rent' && <span className="md-note">Add it when you play a Rent card.</span>}
          {bank}
        </div>
        {full && myTurn && view.phase === 'play' && <p className="md-note">You have played 3 cards this turn.</p>}
        {cancel}
      </div>
    );
  } else if (flow?.step === 'rent' && flowCard) {
    const one = flowCard.colors.length === COLORS.length;
    const spare = hand.filter((c) => c.action === 'double-rent');
    const room = Math.min(PLAYS - view.plays - 1, view.oneDouble ? 1 : spare.length, spare.length);
    const amount = rentOf(me!, flow.color) * 2 ** flow.doubles.length;
    const charge = (target?: string) => send({ type: 'PLAY', card: flow.card, color: flow.color, target, doubles: flow.doubles });
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Charge rent">
        <p>
          {COLOR_NAME[flow.color]} rent: <b>{money(amount)}</b>
        </p>
        {room > 0 && (
          <div className="md-choices">
            {Array.from({ length: room + 1 }, (_, n) =>
              choice(n, n === 0 ? 'No Double the Rent' : n === 1 ? 'Double the Rent' : 'Double it twice', () => setFlow({ ...flow, doubles: spare.slice(0, n).map((c) => c.id) }), undefined, false),
            ).map((b, n) => (
              <span key={n} className={flow.doubles.length === n ? 'md-on' : ''}>
                {b}
              </span>
            ))}
          </div>
        )}
        {one ? (
          <div className="md-choices">{foes.map((p) => choice(p.id, `${nameFor(p.id)} pays`, () => charge(p.id), { '--tc': colorOf(p.id) } as CSSProperties))}</div>
        ) : (
          <button type="button" className="g-btn primary" onClick={() => charge()}>
            Charge everyone {money(amount)}
          </button>
        )}
        {cancel}
      </div>
    );
  } else if (flow?.step === 'victim') {
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Choose a player">
        <p>Who pays you {money(5)}?</p>
        <div className="md-choices">{foes.map((p) => choice(p.id, `${nameFor(p.id)} · ${money(payable(p).reduce((n, c) => n + c.value, 0))} on the table`, () => send({ type: 'PLAY', card: flow.card, target: p.id }), { '--tc': colorOf(p.id) } as CSSProperties))}</div>
        {cancel}
      </div>
    );
  } else if (flow?.step === 'take') {
    const picking = flow.take === undefined;
    prompt = (
      <div className="md-picker" role="dialog" aria-label={picking ? 'Choose a property to take' : 'Choose a property to give'}>
        <p>{picking ? (flow.swap ? 'Which property do you want?' : 'Which property do you take?') : 'Which of yours do you give for it?'}</p>
        <div className="md-pay">
          {picking
            ? foes.flatMap((p) =>
                p.props
                  .filter((x) => stealable(p, x.card.id))
                  .map((x) => (
                    <button key={x.card.id} type="button" className="md-pay-card" aria-label={`${x.card.name}, from ${nameFor(p.id)}`} onClick={() => (flow.swap ? setFlow({ ...flow, take: x.card.id, from: p.id }) : send({ type: 'PLAY', card: flow.card, target: p.id, take: x.card.id }))}>
                      <MdCard card={x.card} as={x.color} className="is-small" />
                      <i style={{ '--tc': colorOf(p.id) } as CSSProperties}>{nameFor(p.id)}</i>
                    </button>
                  )),
              )
            : me!.props.map((x) => (
                <button key={x.card.id} type="button" className="md-pay-card" aria-label={`Give ${x.card.name}`} onClick={() => send({ type: 'PLAY', card: flow.card, target: flow.from, take: flow.take, give: x.card.id })}>
                  <MdCard card={x.card} as={x.color} className="is-small" />
                </button>
              ))}
        </div>
        <p className="md-note">A property in a full set cannot be taken.</p>
        {cancel}
      </div>
    );
  } else if (flow?.step === 'set') {
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Choose a full set">
        <p>Which full set do you take?</p>
        <div className="md-choices">{foes.flatMap((p) => completeColors(p).map((c) => choice(`${p.id}-${c}`, `${nameFor(p.id)}'s ${COLOR_NAME[c]} set · rent ${money(rentOf(p, c))}`, () => send({ type: 'PLAY', card: flow.card, target: p.id, color: c }), swatch(c))))}</div>
        {cancel}
      </div>
    );
  } else if (flow?.step === 'build' && flowCard) {
    const kind = flowCard.action as 'house' | 'hotel';
    const sets = completeColors(me!).filter((col) => (view.buildAnywhere || (col !== 'railroad' && col !== 'utility')) && !me!.buildings.some((b) => b.color === col && b.card.action === kind) && (kind === 'house' || me!.buildings.some((b) => b.color === col && b.card.action === 'house')));
    prompt = (
      <div className="md-picker" role="dialog" aria-label="Choose a set to build on">
        <p>Build the {ACTION_NAME[kind]} on</p>
        <div className="md-choices">{sets.map((c) => choice(c, `${COLOR_NAME[c]} · rent ${money(rentOf(me!, c))}`, () => send({ type: 'PLAY', card: flow.card, color: c }), swatch(c)))}</div>
        {cancel}
      </div>
    );
  }

  const table = (
    <div ref={tableRef} className={`kit-board md-table${myTurn ? ' is-my-turn' : ''}`} style={{ '--seats': view.players.length - 1, '--pw': `${PILE_WIDTH[view.players.length - 1] ?? 9}cqw` } as CSSProperties}>
      <div className="md-felt" />
      <div className="md-seats">
        {view.players
          .map((_, k) => view.players[(Math.max(seat, 0) + 1 + k) % view.players.length])
          .filter((p) => p.id !== meId)
          .map((p) => (
            <section key={p.id} data-seat={p.id} className={`md-seat${actor === p.id ? ' is-turn' : ''}${p.out ? ' is-out' : ''}${spotlight === p.id ? ' is-spot' : ''}`} style={{ '--tc': colorOf(p.id) } as CSSProperties}>
              <header className="md-seat-head">
                <SeatFace id={p.id} className="md-seat-face" color={colorOf(p.id)} fallback={<span className="md-dot" />} />
                <b>{nameFor(p.id)}</b>
                {!p.out && (
                  <span className="md-seat-hand" title={`${p.handCount} cards in hand`}>
                    {p.handCount}
                  </span>
                )}
                {!p.out && (
                  <span className="md-seat-sets">
                    {completeColors(p).length}/{view.setsToWin}
                  </span>
                )}
              </header>
              {p.out ? <span className="md-empty">Left the game</span> : tableau(p, false)}
            </section>
          ))}
      </div>

      <div className="md-centre">
        <button type="button" className={`md-deck${myTurn && view.phase === 'draw' ? ' is-live' : ''}`} disabled={!myTurn || view.phase !== 'draw'} aria-label={`Draw ${hand.length === 0 ? 5 : 2} cards (${view.deckCount} in the pile)`} onClick={() => onAction({ type: 'DRAW' })}>
          <MdCard card={null} />
          <span className="md-deck-count">{view.deckCount}</span>
        </button>
        <div className="md-discard" aria-label="Discard pile">
          {view.discard.slice(-2).map((c) => (
            <MdCard key={c.id} card={c} style={{ '--r': `${((c.id * 37) % 17) - 8}deg` } as CSSProperties} />
          ))}
          {view.discard.length === 0 && <span className="md-empty">Discard</span>}
        </div>
        <div className="md-turn" role="status">
          {claim ? (
            <>
              <b>{claim.why}</b>
              <span>
                {who(claim.to)} → {claim.from === meId ? 'you' : nameFor(claim.from)}
                {claim.amount ? ` · ${money(claim.amount)}` : ''}
                {view.nos > 0 ? ` · ${view.nos === 1 ? 'Just Say No' : `${view.nos} × Just Say No`}` : ''}
              </span>
            </>
          ) : (
            <>
              <b>{turnId === meId ? 'Your turn' : nameFor(turnId)}</b>
              <span className="md-pips" aria-label={`${PLAYS - view.plays} of ${PLAYS} plays left`}>
                {Array.from({ length: PLAYS }, (_, i) => (
                  <i key={i} className={i < view.plays ? 'is-used' : ''} />
                ))}
                {view.phase === 'draw' ? 'to draw' : `${PLAYS - view.plays} left`}
              </span>
            </>
          )}
        </div>
      </div>

      {me && !me.out && (
        <section data-seat={meId} className={`md-me${actor === meId ? ' is-turn' : ''}`} style={{ '--tc': colorOf(meId) } as CSSProperties}>
          <header className="md-seat-head">
            <b>Your table</b>
            <span className="md-seat-sets">
              {completeColors(me).length}/{view.setsToWin} sets
            </span>
          </header>
          {tableau(me, true)}
        </section>
      )}

      {prompt}

      {me && !me.out && !view.over && !prompt && (
        <div className="md-controls">
          {myTurn && view.phase === 'draw' && (
            <button type="button" className="g-btn primary" onClick={() => onAction({ type: 'DRAW' })}>
              Draw {hand.length === 0 ? 5 : 2} cards
            </button>
          )}
          {myTurn && view.phase === 'play' && !discarding && (
            <button type="button" className={`g-btn ${view.plays >= PLAYS ? 'primary' : 'g-btn-light'}`} onClick={() => (over > 0 ? setFlow({ step: 'discard', ids: [] }) : onAction({ type: 'END' }))}>
              End turn{over > 0 ? ` (discard ${over})` : ''}
            </button>
          )}
          {discarding && (
            <>
              <span className="md-hint">
                Choose {over} to discard ({discarding.ids.length}/{over})
              </span>
              <button type="button" className="g-btn primary" disabled={discarding.ids.length !== over} onClick={() => send({ type: 'END', discard: discarding.ids })}>
                Discard and end turn
              </button>
              <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => setFlow(null)}>
                Back
              </button>
            </>
          )}
          {myTurn && view.phase === 'play' && !discarding && <span className="md-hint is-quiet">{view.plays >= PLAYS ? 'You have played 3 cards' : 'Tap a card to play it'}</span>}
        </div>
      )}

      {me && hand.length > 1 && !me.out && <SortButton label={SORT_LABEL[sortBy]} onClick={nextSort} className="md-sort" />}
      {me && !me.out && (
        <div className="md-hand" style={{ '--n': hand.length } as CSSProperties}>
          {shown.map((c, i) => {
            const on = discarding?.ids.includes(c.id) ?? false;
            const live = !!discarding || (myTurn && view.phase === 'play');
            return (
              <button
                key={c.id}
                type="button"
                className={`md-hand-card${on ? ' is-on' : ''}${live ? ' is-ok' : ''}`}
                style={{ '--i': i - (hand.length - 1) / 2 } as CSSProperties}
                aria-label={`${c.name}${c.value ? `, ${money(c.value)}` : ''}${on ? ', to discard' : ''}`}
                aria-pressed={discarding ? on : undefined}
                disabled={!live}
                onClick={() => (discarding ? setFlow({ step: 'discard', ids: on ? discarding.ids.filter((id) => id !== c.id) : discarding.ids.length < over ? [...discarding.ids, c.id] : discarding.ids }) : setFlow({ step: 'card', card: c.id }))}
              >
                <MdCard card={c} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const winner = view.winner ? view.players.find((p) => p.id === view.winner) : undefined;
  const overlay = view.over && winner ? (
    <ResultCard
      kicker={`Game ${view.game}`}
      title={winner.id === meId ? 'You win' : `${nameFor(winner.id)} wins`}
      won={winner.id === meId}
      onRematch={view.players.filter((p) => !p.out).length > 1 ? () => onAction({ type: 'REMATCH' }) : undefined}
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={900}
    >
      <ul className="md-standings">
        {[...view.players]
          .sort((a, b) => completeColors(b).length - completeColors(a).length || payable(b).length - payable(a).length)
          .map((p) => (
            <li key={p.id} className={p.id === winner.id ? 'is-winner' : ''}>
              <span className="md-dot" style={{ '--tc': colorOf(p.id) } as CSSProperties} />
              <span>{nameFor(p.id)}</span>
              <span className="md-standing-sets">
                {completeColors(p).map((c) => (
                  <i key={c} style={{ background: COLOR_HEX[c] }} title={COLOR_NAME[c]} />
                ))}
              </span>
              <b>{p.out ? 'Left' : `${completeColors(p).length} ${completeColors(p).length === 1 ? 'set' : 'sets'} · ${money(bankOf(p))}`}</b>
            </li>
          ))}
      </ul>
    </ResultCard>
  ) : null;

  const houseRules = [view.setsToWin !== 3 && `${view.setsToWin} sets to win`, view.buildAnywhere && 'Houses and Hotels on Railroads and Utilities', view.oneDouble && 'One Double the Rent per Rent card'].filter(Boolean) as string[];

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: colorOf(p.id), active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': colorOf(p.id) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      <PlayersPanel
        title={`Game ${view.game} · first to ${view.setsToWin} sets`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p, i) => ({
          id: p.id,
          name: nameFor(p.id),
          you: p.id === meId,
          color: mdSeatColor(i),
          detail: p.out ? 'Left the game' : `${p.handCount} in hand · bank ${money(bankOf(p))}`,
          trailing: p.out ? undefined : `${completeColors(p).length}/${view.setsToWin}`,
          active: !view.over && actor === p.id,
          out: p.out,
        }))}
      />
      {houseRules.length > 0 && (
        <SideSection title="House rules" meta={`${houseRules.length} on`}>
          <ul className="md-facts">
            {houseRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </SideSection>
      )}
    </>
  );

  let status;
  if (view.over && winner) status = <><strong>{who(winner.id)}</strong> {winner.id === meId ? 'win' : 'wins'} with {view.setsToWin} full sets</>;
  else if (answering) status = <><strong>{claim!.kind === 'pay' ? `Pay ${money(claim!.amount!)}` : 'Answer'}</strong> · {nameFor(claim!.to)} played {claim!.why}</>;
  else if (insisting) status = <><strong>{nameFor(claim!.from)} said Just Say No</strong> · answer it or let it stand</>;
  else if (claim) status = <><strong>{nameFor(actor ?? claim.from)}</strong> is answering {who(claim.to) === 'You' ? 'your' : `${nameFor(claim.to)}'s`} {claim.why}</>;
  else if (myTurn && view.phase === 'draw') status = <><strong>Your turn</strong> · draw {hand.length === 0 ? 5 : 2} cards</>;
  else if (myTurn) status = <><strong>Your turn</strong> · play up to {PLAYS - view.plays} more {PLAYS - view.plays === 1 ? 'card' : 'cards'}, then end it</>;
  else status = <><strong>{nameFor(turnId)}</strong> is playing...</>;

  return (
    <GameShell
      className="md-game"
      title="Monopoly Deal"
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
      side={side}
      log={
        <GameLog
          entries={[...view.history]
            .reverse()
            .filter((e) => e.kind !== 'end')
            .map((e) => ({ key: e.seq, text: describe(e, who), color: colorOf(e.player), loud: e.kind === 'set' || e.kind === 'no' || e.kind === 'steal' }))}
          empty={<>Draw 2 cards, play up to 3. The first player with {view.setsToWin} full property sets of different colours wins.</>}
        />
      }
    />
  );
}
