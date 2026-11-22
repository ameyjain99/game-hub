import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CARD_NAME, COUNTS, NOPE_MS, ekKit, isCat, kittensInDeck, playOf, topOf, type Card, type EkAction, type EkEvent, type EkState, type Kind, type Play } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { SortButton, useSortMode } from '../../kit/ui/HandSort';
import { GameLog } from '../../kit/ui/GameLog';
import { SeatFace } from '../../../online/ui/SeatFace';
import { TableMomentBanner, freshEvents, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { fly, flyer } from '../../../shared/fly';
import { EkCard } from './EkCard';
import { EK_SOUNDS, ekCues } from './sound';

const SEAT_COLORS = ['#e5484d', '#2f7de1', '#f2b705', '#3fa34d', '#d44a9c'];
export const ekSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

/** The order a hand sorts into by type: what saves you first, the cats last. */
const TYPE_ORDER: Kind[] = ['defuse', 'nope', 'attack', 'skip', 'future', 'shuffle', 'favor', 'tacocat', 'cattermelon', 'potato', 'beard', 'rainbow', 'exploding'];
const SORTS = ['type', 'dealt'] as const;
const SORT_LABEL = { type: 'By type', dealt: 'As drawn' };

const a = (name: string) => (/^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`);

/** What a set of cards is called when played. */
function playName(play: Play, cards: Kind[]): string {
  if (play === 'pair') return `a pair of ${CARD_NAME[cards[0]]}s`;
  if (play === 'triple') return `three ${CARD_NAME[cards[0]]}s`;
  if (play === 'five') return 'five different cards';
  return CARD_NAME[cards[0]];
}

/** What a selection in hand will do, for the button that plays it. */
const PLAY_LABEL: Record<Play, string> = {
  attack: 'Play Attack',
  skip: 'Play Skip',
  favor: 'Play Favor',
  shuffle: 'Play Shuffle',
  future: 'See the Future',
  pair: 'Play the pair: steal a card',
  triple: 'Play three: ask for a card',
  five: 'Play five: take a discard',
};

function describe(e: EkEvent, who: (id: string) => string): string {
  const w = who(e.player);
  const t = e.target ? who(e.target) : '';
  const you = w === 'You';
  switch (e.kind) {
    case 'play':
      return `${w} played ${playName(e.play!, e.cards!)}${e.target ? ` on ${t === 'You' ? 'you' : t}` : ''}${e.named ? `, asking for ${a(CARD_NAME[e.named])}` : ''}`;
    case 'nope':
      return (e.count ?? 1) > 1 ? `${w} Noped the Nope` : `${w} said Nope`;
    case 'cancel':
      return `${you ? 'Your' : `${w}'s`} ${e.play === 'pair' || e.play === 'triple' || e.play === 'five' ? 'combo' : CARD_NAME[e.play as Kind]} was Noped: nothing happens`;
    case 'attack':
      return `${t} must take ${e.count} turns`;
    case 'skip':
      return `${w} ended the turn without drawing`;
    case 'shuffle':
      return `${w} shuffled the draw pile`;
    case 'future':
      return `${w} looked at the top 3 cards`;
    case 'ask':
      return `${t} must give ${you ? 'you' : w} a card`;
    case 'give':
      return `${w} gave ${t === 'You' ? 'you' : t} ${e.card ? a(CARD_NAME[e.card]) : 'a card'}`;
    case 'steal':
      return `${w} took ${e.card ? a(CARD_NAME[e.card]) : 'a card'} from ${t === 'You' ? 'you' : t}`;
    case 'named':
      return e.got ? `${t} handed over ${a(CARD_NAME[e.named!])}` : `${t} had no ${CARD_NAME[e.named!]}`;
    case 'take':
      return `${w} took ${a(CARD_NAME[e.card!])} from the discard pile`;
    case 'draw':
      return `${w} drew ${e.card ? a(CARD_NAME[e.card]) : 'a card'}`;
    case 'defuse':
      return `${w} drew an Exploding Kitten and Defused it`;
    case 'insert':
      return `${w} put the Kitten back in the draw pile`;
    case 'explode':
      return `${w} drew an Exploding Kitten and exploded`;
    case 'leave':
      return `${w} left the game`;
  }
}

/** The plays the whole table should notice: a Kitten going off, a Defuse, a Nope, an Attack. */
export function ekMoments(prev: EkState, next: EkState, who: (id: string) => string, colorOf: (id: string) => string): TableMoment[] {
  if (next.game !== prev.game) return [];
  const out: TableMoment[] = [];
  for (const e of freshEvents(prev.history, next.history)) {
    const w = who(e.player);
    if (e.kind === 'explode') out.push({ kicker: w, title: 'exploded!', detail: `${kittensInDeck(next)} ${kittensInDeck(next) === 1 ? 'Kitten is' : 'Kittens are'} still in the pile.`, color: '#e5484d', art: <EkCard kind="exploding" className="is-moment" />, feels: { [e.player]: 'bad' } });
    else if (e.kind === 'defuse') out.push({ kicker: w, title: 'Defused a Kitten', detail: 'It goes back in the pile, somewhere.', color: '#3fa34d', art: <EkCard kind="defuse" className="is-moment" />, feels: { [e.player]: 'good' } });
    else if (e.kind === 'nope') out.push({ kicker: w, title: (e.count ?? 1) > 1 ? 'Nope to the Nope!' : 'Nope!', color: '#d6343c', art: <EkCard kind="nope" className="is-moment" />, feels: e.target ? { [e.target]: 'bad' } : undefined });
    else if (e.kind === 'attack') out.push({ kicker: w, title: 'Attack!', detail: `${who(e.target!)} ${who(e.target!) === 'You' ? 'take' : 'takes'} ${e.count} turns.`, color: colorOf(e.player), art: <EkCard kind="attack" className="is-moment" />, feels: { [e.target!]: 'bad' } });
    else if (e.kind === 'named' && e.got && e.named === 'defuse') out.push({ kicker: w, title: 'took a Defuse', detail: `From ${who(e.target!) === 'You' ? 'you' : who(e.target!)}.`, color: colorOf(e.player), feels: { [e.player]: 'good', [e.target!]: 'bad' } });
  }
  return out;
}

type Prompt = { step: 'target'; cards: number[]; play: Play } | { step: 'named'; cards: number[]; target: string } | { step: 'take'; cards: number[] };

export function EkGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<EkState, EkAction>) {
  const [selected, setSelected] = useState<number[]>([]);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [slot, setSlot] = useState(0);
  /** The event after which the See the Future panel was put away. */
  const [futureClosed, setFutureClosed] = useState(-1);
  useCues(view, (x, y) => ekCues(x, y, meId), EK_SOUNDS);
  const colorOf = (id: string) => ekSeatColor(view.players.findIndex((p) => p.id === id));
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const moment = useTableMoments(view, (x, y) => ekMoments(x, y, who, colorOf));

  const seat = view.players.findIndex((p) => p.id === meId);
  const me = view.players[seat];
  const hand = me?.hand ?? [];
  const pending = view.pending;
  const turnId = view.players[view.turn].id;
  const actor = pending ? null : ekKit.actor(view);
  const myTurn = !view.over && !pending && !view.favor && !view.defusing && turnId === meId;
  const giving = view.favor?.from === meId;
  const placing = view.defusing === meId;
  const canNope = !!pending && !!me && !me.out && topOf(pending) !== meId && hand.some((c) => c.kind === 'nope');
  const letGo = !!pending && pending.passed.includes(meId);

  const [sortBy, nextSort] = useSortMode('gamehub:exploding-kittens:sort', SORTS);
  const shown = sortBy === 'type' ? [...hand].sort((x, y) => TYPE_ORDER.indexOf(x.kind) - TYPE_ORDER.indexOf(y.kind) || x.id - y.id) : hand;
  const picked = hand.filter((c) => selected.includes(c.id));
  const play = picked.length > 0 ? playOf(picked.map((c) => c.kind), view.anyCombos) : null;
  const victims = view.players.filter((p) => p.id !== meId && !p.out && p.handCount > 0);

  // A new event ends whatever was being chosen.
  useEffect(() => {
    setSelected([]);
    setPrompt(null);
  }, [view.last?.seq, view.game]);
  useEffect(() => setSlot(0), [view.defusing]);

  const toggle = (c: Card) => {
    if (giving) return onAction({ type: 'GIVE', card: c.id });
    if (!myTurn) return;
    setSelected((ids) => (ids.includes(c.id) ? ids.filter((id) => id !== c.id) : [...ids, c.id]));
  };
  const send = () => {
    if (!play) return;
    const cards = picked.map((c) => c.id);
    if (play === 'favor' || play === 'pair' || play === 'triple') setPrompt({ step: 'target', cards, play });
    else if (play === 'five') setPrompt({ step: 'take', cards });
    else onAction({ type: 'PLAY', cards });
  };

  // Opponents sit round the top of the table, in turn order after you.
  const others = view.players.map((_, k) => view.players[(Math.max(seat, 0) + 1 + k) % view.players.length]).filter((p) => p.id !== meId);
  const seatAt = (k: number, n: number) => {
    const angle = Math.PI * (0.9 - (0.8 * (k + 0.5)) / n);
    return { x: 50 + Math.cos(angle) * 39, y: 25 - Math.sin(angle) * 15 };
  };

  // Cards travel: a draw from the pile to whoever drew, a card given or taken from seat to seat.
  const tableRef = useRef<HTMLDivElement>(null);
  const seen = useRef(view.history);
  const [boom, setBoom] = useState<{ seq: number; id: string } | null>(null);
  useEffect(() => {
    const fresh = freshEvents(seen.current, view.history);
    seen.current = view.history;
    const el = tableRef.current;
    if (!el) return;
    const place = (id: string) => (id === meId ? el.querySelector('.ek-hand') : el.querySelector(`[data-seat="${id}"] .ek-opp-cards`));
    for (const e of fresh) {
      if (e.kind === 'draw' || e.kind === 'defuse' || e.kind === 'explode') fly({ from: el.querySelector('.ek-deck'), to: place(e.player), make: flyer('ek-flyer'), ms: 440 });
      else if (e.kind === 'give') fly({ from: place(e.player), to: place(e.target!), make: flyer('ek-flyer'), ms: 520 });
      else if (e.kind === 'steal' || (e.kind === 'named' && e.got)) fly({ from: place(e.target!), to: place(e.player), make: flyer('ek-flyer'), ms: 520 });
      else if (e.kind === 'take') fly({ from: el.querySelector('.ek-discard'), to: place(e.player), make: flyer('ek-flyer'), ms: 480 });
      else if (e.kind === 'insert') fly({ from: place(e.player), to: el.querySelector('.ek-deck'), make: flyer('ek-flyer is-kitten'), ms: 520 });
      if (e.kind === 'explode') setBoom({ seq: e.seq, id: e.player });
    }
  }, [view.history, meId]);
  useEffect(() => {
    if (!boom) return;
    const t = setTimeout(() => setBoom(null), 1700);
    return () => clearTimeout(t);
  }, [boom]);

  const kittens = kittensInDeck(view);
  const known = (me?.known ?? []).slice(0, 5);
  const knownCount = known.length - [...known].reverse().findIndex((k) => k !== null);
  const knownTop = known.some((k) => k !== null) ? known.slice(0, knownCount) : [];
  const lastPlayer = view.last?.kind === 'play' || view.last?.kind === 'nope' ? view.last.player : null;
  const playedFrom = (() => {
    const k = others.findIndex((p) => p.id === lastPlayer);
    if (k < 0) return { fx: '0cqw', fy: '34cqw' };
    const at = seatAt(k, others.length);
    return { fx: `${at.x - 58}cqw`, fy: `${at.y - 44}cqw` };
  })();

  const table = (
    <div ref={tableRef} className={`kit-board ek-table${myTurn ? ' is-my-turn' : ''}${boom ? ' is-booming' : ''}${view.history.length === 0 && !view.over ? ' is-dealing' : ''}`} style={{ '--seats': view.players.length } as CSSProperties}>
      <div className="ek-bench" />
      <div className="ek-opponents">
        {others.map((p, k) => {
          const { x, y } = seatAt(k, others.length);
          const cards = Math.min(p.handCount, 8);
          const up = turnId === p.id && !view.over;
          return (
            <div
              key={p.id}
              data-seat={p.id}
              className={`ek-opp${up ? ' is-turn' : ''}${p.out ? ' is-out' : ''}${spotlight === p.id ? ' is-spot' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, '--tc': colorOf(p.id), '--seat': k } as CSSProperties}
            >
              <div className="ek-opp-cards" aria-hidden="true">
                {Array.from({ length: cards }, (_, i) => (
                  <EkCard key={i} kind={null} className="is-mini" style={{ '--i': i - (cards - 1) / 2, '--k': i } as CSSProperties} />
                ))}
              </div>
              <div className="ek-opp-name">
                <SeatFace id={p.id} className="ek-seat-face" color={colorOf(p.id)} fallback={<span className="ek-dot" />} />
                {nameFor(p.id)}
                {!p.out && <span className="ek-count">{p.handCount}</span>}
              </div>
              {p.out && <span className="ek-tag is-out">{p.left ? 'Left' : 'Exploded'}</span>}
              {up && view.turnsLeft > 1 && <span className="ek-tag is-turns">{view.turnsLeft} turns</span>}
              {boom?.id === p.id && (
                <span key={boom.seq} className="ek-boom" role="status">
                  Boom!
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="ek-centre">
        <button
          type="button"
          className={`ek-pile ek-deck${myTurn ? ' is-live' : ''}`}
          aria-label={`Draw a card and end your turn (${view.deckCount} left, ${kittens} ${kittens === 1 ? 'Kitten' : 'Kittens'} among them)`}
          disabled={!myTurn}
          onClick={() => onAction({ type: 'DRAW' })}
        >
          <span className="ek-deck-stack" />
          <EkCard kind={null} />
          <span className="ek-deck-count">{view.deckCount}</span>
        </button>
        <div className="ek-pile ek-discard" aria-label={`Discard pile, ${view.discard.length} cards`}>
          {view.discard.length === 0 && <span className="ek-discard-empty">Discard</span>}
          {view.discard.slice(-4).map((c, i, arr) => (
            <EkCard key={c.id} kind={c.kind} className={i === arr.length - 1 ? 'is-top' : 'is-under'} style={{ '--r': `${((c.id * 37) % 25) - 12}deg`, ...(i === arr.length - 1 ? { '--fx': playedFrom.fx, '--fy': playedFrom.fy } : {}) } as CSSProperties} />
          ))}
        </div>
        <p className="ek-odds" role="status">
          <b>
            {kittens} {kittens === 1 ? 'Kitten' : 'Kittens'}
          </b>{' '}
          in {view.deckCount} {view.deckCount === 1 ? 'card' : 'cards'}
          {knownTop.length > 0 && (
            <span className="ek-known" title="What you know of the top of the draw pile">
              You know the top:
              {knownTop.map((k, i) => (
                <span key={i} className={`ek-known-card${k === 'exploding' ? ' is-kitten' : ''}`}>
                  {k ? CARD_NAME[k] : '?'}
                </span>
              ))}
            </span>
          )}
        </p>
      </div>

      {boom?.id === meId && (
        <span key={boom.seq} className="ek-boom is-me" role="status">
          Boom!
        </span>
      )}

      {pending && (
        <div key={`${pending.by}-${pending.nopes.length}`} className={`ek-stage${pending.nopes.length % 2 === 1 ? ' is-noped' : ''}`} role="status" style={{ '--tc': colorOf(topOf(pending)) } as CSSProperties}>
          <p className="ek-stage-text">
            <b>{who(pending.by)}</b> played <b>{playName(pending.play, pending.cards)}</b>
            {pending.target ? ` on ${pending.target === meId ? 'you' : nameFor(pending.target)}` : ''}
            {pending.named ? `, asking for ${a(CARD_NAME[pending.named])}` : ''}
          </p>
          {pending.nopes.length > 0 && (
            <p className="ek-stage-nopes">
              {pending.nopes.map((id, i) => (
                <span key={i} className="ek-nope-stamp" style={{ '--tc': colorOf(id) } as CSSProperties}>
                  {who(id)}: Nope
                </span>
              ))}
              <span className="ek-stage-verdict">{pending.nopes.length % 2 === 1 ? 'As it stands, nothing happens' : 'As it stands, it happens'}</span>
            </p>
          )}
          {canNope && !letGo && (
            <div className="ek-stage-actions">
              <button type="button" className="ek-nope-btn" onClick={() => onAction({ type: 'NOPE' })}>
                Nope!
              </button>
              <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => onAction({ type: 'PASS' })}>
                Let it happen
              </button>
              <span className="ek-fuse" style={{ '--ms': `${NOPE_MS}ms` } as CSSProperties} aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {view.seen?.player === meId && !pending && futureClosed !== (view.last?.seq ?? 0) && (
        <div className="ek-picker ek-future" role="dialog" aria-label="The top three cards">
          <p>The top of the draw pile, in the order it will be drawn</p>
          <div className="ek-future-cards">
            {view.seen.cards.map((k, i) => (
              <span key={i} className="ek-future-card">
                <EkCard kind={k} />
                <b>{['Next', '2nd', '3rd'][i]}</b>
              </span>
            ))}
          </div>
          <button type="button" className="g-btn primary" onClick={() => setFutureClosed(view.last?.seq ?? 0)}>
            Got it
          </button>
          <p className="ek-note">Only you can see this. The pile keeps reminding you until it changes.</p>
        </div>
      )}

      {placing && (
        <div className="ek-picker" role="dialog" aria-label="Put the Kitten back">
          <p>Defused! Put the Kitten back in the draw pile</p>
          <div className="ek-slots">
            {[
              { label: 'On top', at: 0 },
              { label: '2nd', at: 1 },
              { label: '3rd', at: 2 },
              { label: 'Middle', at: Math.floor(view.deckCount / 2) },
              { label: 'Bottom', at: view.deckCount },
            ]
              .filter((o, i, all) => o.at <= view.deckCount && all.findIndex((x) => x.at === o.at) === i)
              .map((o) => (
                <button key={o.label} type="button" className={`ek-slot${slot === o.at ? ' is-on' : ''}`} aria-pressed={slot === o.at} onClick={() => setSlot(o.at)}>
                  {o.label}
                </button>
              ))}
          </div>
          <label className="ek-range">
            <span>
              {slot === 0 ? 'The very next card drawn' : slot === view.deckCount ? 'The last card of the pile' : `Under ${slot} ${slot === 1 ? 'card' : 'cards'}`}
            </span>
            <input type="range" min={0} max={view.deckCount} value={slot} aria-label="Cards above the Kitten" onChange={(e) => setSlot(Number(e.target.value))} />
          </label>
          <button type="button" className="g-btn primary" onClick={() => onAction({ type: 'INSERT', index: slot })}>
            Put it back
          </button>
          <p className="ek-note">Nobody else sees where it goes.</p>
        </div>
      )}

      {prompt?.step === 'target' && (
        <div className="ek-picker" role="dialog" aria-label="Choose a player">
          <p>{prompt.play === 'favor' ? 'Who gives you a card?' : prompt.play === 'pair' ? 'Whose hand do you take a card from?' : 'Who do you ask?'}</p>
          <div className="ek-choices">
            {victims.map((p) => (
              <button
                key={p.id}
                type="button"
                className="ek-choice"
                style={{ '--tc': colorOf(p.id) } as CSSProperties}
                onClick={() => (prompt.play === 'triple' ? setPrompt({ step: 'named', cards: prompt.cards, target: p.id }) : onAction({ type: 'PLAY', cards: prompt.cards, target: p.id }))}
              >
                <span className="ek-dot" />
                <span>{nameFor(p.id)}</span>
                <b>
                  {p.handCount} {p.handCount === 1 ? 'card' : 'cards'}
                </b>
              </button>
            ))}
          </div>
          <button type="button" className="ek-cancel" onClick={() => setPrompt(null)}>
            Cancel
          </button>
        </div>
      )}

      {prompt?.step === 'named' && (
        <div className="ek-picker" role="dialog" aria-label="Name a card">
          <p>Name the card {nameFor(prompt.target)} must hand over, if they hold one</p>
          <div className="ek-kinds">
            {TYPE_ORDER.filter((k) => k !== 'exploding').map((k) => (
              <button key={k} type="button" className="ek-kind" aria-label={CARD_NAME[k]} onClick={() => onAction({ type: 'PLAY', cards: prompt.cards, target: prompt.target, named: k })}>
                <EkCard kind={k} className="is-small" />
              </button>
            ))}
          </div>
          <button type="button" className="ek-cancel" onClick={() => setPrompt(null)}>
            Cancel
          </button>
        </div>
      )}

      {prompt?.step === 'take' && (
        <div className="ek-picker" role="dialog" aria-label="Take a card from the discard pile">
          <p>Take any card from the discard pile</p>
          <div className="ek-kinds">
            {TYPE_ORDER.map((k) => view.discard.find((c) => c.kind === k)).filter((c): c is Card => !!c).map((c) => (
              <button key={c.id} type="button" className="ek-kind" aria-label={CARD_NAME[c.kind]} onClick={() => onAction({ type: 'PLAY', cards: prompt.cards, take: c.id })}>
                <EkCard kind={c.kind} className="is-small" />
                <b>×{view.discard.filter((d) => d.kind === c.kind).length}</b>
              </button>
            ))}
            {view.discard.length === 0 && <i>The discard pile is empty.</i>}
          </div>
          <button type="button" className="ek-cancel" onClick={() => setPrompt(null)}>
            Cancel
          </button>
        </div>
      )}

      {me && !me.out && !view.over && !prompt && (
        <div className="ek-controls">
          {giving && (
            <span className="ek-hint is-urgent" role="status">
              {nameFor(view.favor!.to)} asks a Favor: choose a card to give
            </span>
          )}
          {myTurn && picked.length > 0 && (
            <button type="button" className="g-btn primary" disabled={!play} onClick={send}>
              {play ? PLAY_LABEL[play] : 'These cards do nothing together'}
            </button>
          )}
          {myTurn && picked.length === 0 && (
            <button type="button" className="g-btn primary" onClick={() => onAction({ type: 'DRAW' })}>
              Draw a card{view.turnsLeft > 1 ? ` (${view.turnsLeft} turns to take)` : ' to end your turn'}
            </button>
          )}
          {myTurn && picked.length > 0 && (
            <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => setSelected([])}>
              Clear
            </button>
          )}
        </div>
      )}

      {me && hand.length > 1 && !me.out && <SortButton label={SORT_LABEL[sortBy]} onClick={nextSort} className="ek-sort" />}
      {me && !me.out && (
        <div className="ek-hand" style={{ '--n': hand.length } as CSSProperties}>
          {shown.map((c, i) => {
            const on = selected.includes(c.id);
            const live = giving || myTurn;
            return (
              <button
                key={c.id}
                type="button"
                className={`ek-hand-card${on ? ' is-on' : ''}${live ? ' is-ok' : ''}${isCat(c.kind) ? ' is-cat' : ''}`}
                style={{ '--i': i - (hand.length - 1) / 2, '--k': i } as CSSProperties}
                aria-label={`${CARD_NAME[c.kind]}${on ? ', selected' : ''}`}
                aria-pressed={giving ? undefined : on}
                disabled={!live}
                onClick={() => toggle(c)}
              >
                <EkCard kind={c.kind} />
              </button>
            );
          })}
        </div>
      )}
      {me?.out && !view.over && (
        <p className="ek-dead" role="status">
          {me.left ? 'You left the game.' : 'You exploded. Watch the rest of the game from here.'}
        </p>
      )}
    </div>
  );

  const overlay = view.over && view.winner ? (
    <ResultCard
      kicker={`Game ${view.game}`}
      title={view.winner === meId ? 'You survived' : `${nameFor(view.winner)} survived`}
      won={view.winner === meId}
      onRematch={view.players.filter((p) => !p.left).length > 1 ? () => onAction({ type: 'REMATCH' }) : undefined}
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={1200}
    >
      <ul className="ek-standings">
        {view.players.map((p) => (
          <li key={p.id} className={p.id === view.winner ? 'is-winner' : ''}>
            <span className="ek-dot" style={{ '--tc': colorOf(p.id) } as CSSProperties} />
            <span>{nameFor(p.id)}</span>
            <b>{p.id === view.winner ? 'Last one standing' : p.left ? 'Left' : 'Exploded'}</b>
          </li>
        ))}
      </ul>
    </ResultCard>
  ) : null;

  const houseRules = [
    view.handSize !== 7 && `${view.handSize} cards dealt`,
    !view.anyCombos && 'Only Cat Cards pair; no threes or fives',
    !view.stackAttacks && 'Attacks do not stack: always 2 turns',
    view.shortGame && 'Short game: a third of the pile set aside',
  ].filter(Boolean) as string[];

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI && !p.left)
          .map((p) => ({ id: p.id, accent: colorOf(p.id), active: turnId === p.id, badge: <span className="kit-badge" style={{ '--tc': colorOf(p.id) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      <PlayersPanel
        title={`Game ${view.game}`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p, i) => ({
          id: p.id,
          name: nameFor(p.id),
          you: p.id === meId,
          color: ekSeatColor(i),
          detail: p.left ? 'Left the game' : p.out ? 'Exploded' : `${p.handCount} ${p.handCount === 1 ? 'card' : 'cards'}${turnId === p.id && view.turnsLeft > 1 ? ` · ${view.turnsLeft} turns to take` : ''}`,
          active: !view.over && turnId === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="The deck" meta={`${view.deckCount} left`}>
        <ul className="ek-facts">
          <li>
            <b>{kittens}</b> {kittens === 1 ? 'Exploding Kitten' : 'Exploding Kittens'} in the draw pile
          </li>
          <li>
            <b>{view.discard.filter((c) => c.kind === 'defuse').length}</b> of {COUNTS.defuse} Defuses used
          </li>
          <li>
            <b>{view.discard.filter((c) => c.kind === 'nope').length}</b> of {COUNTS.nope} Nopes played
          </li>
        </ul>
      </SideSection>
      {houseRules.length > 0 && (
        <SideSection title="House rules" meta={`${houseRules.length} on`}>
          <ul className="ek-facts">
            {houseRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </SideSection>
      )}
    </>
  );

  let status;
  if (view.over && view.winner) status = <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'are' : 'is'} the last one standing</>;
  else if (pending) status = canNope && !letGo ? <><strong>Nope it?</strong> {who(pending.by)} played {playName(pending.play, pending.cards)}</> : <>{who(pending.by)} played <strong>{playName(pending.play, pending.cards)}</strong></>;
  else if (giving) status = <><strong>Choose a card</strong> to give {nameFor(view.favor!.to)}</>;
  else if (view.favor) status = <><strong>{who(view.favor.from)}</strong> {view.favor.from === meId ? 'are' : 'is'} choosing a card for {view.favor.to === meId ? 'you' : nameFor(view.favor.to)}</>;
  else if (placing) status = <><strong>Put the Kitten back</strong> in the draw pile</>;
  else if (view.defusing) status = <><strong>{nameFor(view.defusing)}</strong> is hiding the Kitten in the draw pile</>;
  else if (myTurn) status = <><strong>Your turn</strong> · play any cards, then draw to end it{view.turnsLeft > 1 ? ` · ${view.turnsLeft} turns to take` : ''}</>;
  else status = <><strong>{nameFor(actor ?? turnId)}</strong> is playing...</>;

  return (
    <GameShell
      className="ek-game"
      title="Exploding Kittens"
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
          entries={[...view.history].reverse().map((e) => ({ key: e.seq, text: describe(e, who), color: colorOf(e.kind === 'attack' ? e.target! : e.player), loud: e.kind === 'explode' || e.kind === 'defuse' || e.kind === 'nope' }))}
          empty={<>Play cards, then draw to end your turn. Draw an Exploding Kitten without a Defuse and you are out.</>}
        />
      }
    />
  );
}
