import { useEffect, useState, type CSSProperties } from 'react';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { PlayingCard, SUIT_SYMBOL, rankLabel } from '../../kit/ui/PlayingCard';
import { useCues } from '../../kit/ui/useCues';
import { describeHand, type Card } from '../cards';
import {
  HANDS_PER_LEVEL,
  LEVELS,
  VARIANTS,
  handValue,
  optionsFor,
  stakes,
  type BetOptions,
  type PokerAction,
  type PokerEvent,
  type PokerPlayer,
  type PokerState,
} from '../engine';
import { PK_SOUNDS, pkCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2B6BE0', '#20A464', '#F2B705', '#9B6BFF', '#14C3A2', '#FF9F1C', '#FF4F8B', '#8d97ab'];
export const pkSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

const fmt = (n: number) => n.toLocaleString('en-US');
const cardText = (c: string) => `${rankLabel(c)}${SUIT_SYMBOL[c[1]]}`;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

const STREET_NAME: Record<string, string> = {
  flop: 'The flop',
  turn: 'The turn',
  river: 'The river',
  fourth: 'Fourth street',
  fifth: 'Fifth street',
  sixth: 'Sixth street',
  seventh: 'Seventh street',
};

/** Where a seat sits round the oval: you at the bottom, then clockwise in turn order. */
function seatSpot(k: number, n: number, mine: number) {
  const angle = Math.PI / 2 + (((k - mine + n) % n) * 2 * Math.PI) / n;
  return { x: 50 + 44 * Math.cos(angle), y: 46 + 40 * Math.sin(angle) };
}
const toward = (from: { x: number; y: number }, t: number) => ({ x: from.x + (50 - from.x) * t, y: from.y + (46 - from.y) * t });

function describe(e: PokerEvent, who: (id: string) => string): string | null {
  const w = e.player ? who(e.player) : '';
  // "You call", "Bot 2 calls".
  const v = (verb: string) => (w === 'You' ? verb : verb.endsWith('sh') ? `${verb}es` : `${verb}s`);
  const all = e.allIn ? ', all-in' : '';
  switch (e.kind) {
    case 'post':
      return `${w} ${v('post')} the ${e.text} (${fmt(e.amount ?? 0)})`;
    case 'bring-in':
      return `${w} ${v('bring')} it in for ${fmt(e.amount ?? 0)}${all}`;
    case 'fold':
      return `${w} ${v('fold')}`;
    case 'check':
      return `${w} ${v('check')}`;
    case 'call':
      return `${w} ${v('call')} ${fmt(e.amount ?? 0)}${all}`;
    case 'bet':
      return `${w} ${v('bet')} ${fmt(e.amount ?? 0)}${all}`;
    case 'raise':
      return `${w} ${v('raise')} to ${fmt(e.amount ?? 0)}${all}`;
    case 'complete':
      return `${w} ${v('complete')} to ${fmt(e.amount ?? 0)}${all}`;
    case 'return':
      return `${fmt(e.amount ?? 0)} uncalled goes back to ${w === 'You' ? 'you' : w}`;
    case 'street':
      return `${STREET_NAME[e.street ?? ''] ?? 'Next street'}${e.text ? `: ${e.text.split(' ').map(cardText).join(' ')}` : ''}`;
    case 'win':
      return `${w} ${v('win')} ${fmt(e.amount ?? 0)}${e.text ? ` with ${e.text.toLowerCase()}` : ''}`;
    case 'out':
      return `${w} ${w === 'You' ? 'are' : 'is'} out in ${ordinal(e.amount ?? 0)} place`;
    case 'level':
      return `Stakes rise: the big blind is now ${fmt(e.amount ?? 0)}`;
    case 'ante':
      return null;
  }
}

/** Each player's latest action on this street, for the tag on their seat. */
function lastActions(s: PokerState): Record<string, string> {
  const out: Record<string, string> = {};
  const label: Partial<Record<PokerEvent['kind'], string>> = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', complete: 'Complete', 'bring-in': 'Bring-in' };
  for (const e of s.log) {
    if (e.hand !== s.hand || e.kind === 'street') break;
    if (!e.player || out[e.player]) continue;
    if (e.kind === 'post') out[e.player] = e.text === 'small blind' ? 'Small blind' : 'Big blind';
    else if (label[e.kind]) out[e.player] = e.allIn ? 'All-in' : label[e.kind]!;
  }
  return out;
}

const RANKINGS: Record<'high' | 'short' | 'low', string[]> = {
  high: ['Straight flush', 'Four of a kind', 'Full house', 'Flush', 'Straight', 'Three of a kind', 'Two pair', 'One pair', 'High card'],
  short: ['Straight flush', 'Four of a kind', 'Flush', 'Full house', 'Three of a kind', 'Straight (A-6-7-8-9 is the lowest)', 'Two pair', 'One pair', 'High card'],
  low: ['5-4-3-2-A, the best hand', 'Any five different ranks: the lower the top card, the better', 'One pair', 'Two pair', 'Three of a kind', 'Full house', 'Four of a kind'],
};

function Controls({ s, o, onAction }: { s: PokerState; o: BetOptions; onAction: (a: PokerAction) => void }) {
  const fixed = VARIANTS[s.variant].structure === 'fixed-limit';
  const [amount, setAmount] = useState(o.minTo);
  useEffect(() => setAmount(o.minTo), [s.seq, o.minTo]);
  const potAfterCall = s.pot + s.players.reduce((t, p) => t + p.bet, 0) + o.toCall;
  // Presets land on round amounts (multiples of 5) inside the allowed range.
  const clamp = (n: number) => Math.min(o.maxTo, Math.max(o.minTo, Math.round(n / 5) * 5));
  const presets = fixed
    ? []
    : [
        { label: 'Min', to: o.minTo },
        { label: '½ pot', to: clamp(s.currentBet + potAfterCall / 2) },
        { label: '¾ pot', to: clamp(s.currentBet + (potAfterCall * 3) / 4) },
        { label: 'Pot', to: clamp(s.currentBet + potAfterCall) },
        { label: 'All-in', to: o.maxTo === o.allInTo ? o.allInTo : -1 },
      ].filter((p, i, all) => p.to > 0 && all.findIndex((q) => q.to === p.to) === i);
  const verb = o.completes ? 'Complete to' : o.isBet ? 'Bet' : 'Raise to';
  const label = amount === o.allInTo ? `All-in ${fmt(amount)}` : `${verb} ${fmt(amount)}`;

  if (o.bringIn !== null) {
    return (
      <div className="pk-controls">
        <button type="button" className="pk-act" onClick={() => onAction({ type: 'BRING_IN' })}>
          Bring in {fmt(o.bringIn)}
        </button>
        {o.canRaise && (
          <button type="button" className="pk-act is-raise" onClick={() => onAction({ type: 'RAISE', to: o.minTo })}>
            Complete to {fmt(o.minTo)}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="pk-controls">
      {!o.canCheck && (
        <button type="button" className="pk-act is-fold" onClick={() => onAction({ type: 'FOLD' })}>
          Fold
        </button>
      )}
      <button type="button" className="pk-act" onClick={() => onAction(o.canCheck ? { type: 'CHECK' } : { type: 'CALL' })}>
        {o.canCheck ? 'Check' : o.toCall >= s.players[s.toAct!].stack ? `Call all-in ${fmt(o.toCall)}` : `Call ${fmt(o.toCall)}`}
      </button>
      {o.canRaise && (
        <>
          {!fixed && o.maxTo > o.minTo && (
            <div className="pk-sizer">
              <div className="pk-presets">
                {presets.map((p) => (
                  <button key={p.label} type="button" className={`pk-preset${amount === p.to ? ' is-on' : ''}`} onClick={() => setAmount(p.to)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                className="pk-slider"
                aria-label="Bet size"
                min={o.minTo}
                max={o.maxTo}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          )}
          <button type="button" className="pk-act is-raise" onClick={() => onAction({ type: 'RAISE', to: amount })}>
            {label}
          </button>
        </>
      )}
    </div>
  );
}

function SeatCards({ p, mine, winning, dealt }: { p: PokerPlayer; mine: boolean; winning: Set<string> | null; dealt: boolean }) {
  return (
    <div className="pk-cards" aria-hidden={!mine}>
      {p.hole.map((c, i) => {
        const face = c !== null;
        const hit = winning && face && winning.has(c);
        return (
          <PlayingCard
            key={face ? c : `back-${i}`}
            card={c ?? 'AS'}
            faceDown={!face}
            className={`pk-card${mine && !p.up[i] && p.up.some(Boolean) ? ' is-down' : ''}${winning ? (hit ? ' is-win' : ' is-dim') : ''}${dealt ? ' is-dealt' : ''}`}
            style={{ '--i': i } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

/** The poker table: seats round an oval, the board and pot in the middle, your controls below. */
export function PokerGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<PokerState, PokerAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => pkCues(a, b, meId), PK_SOUNDS);

  const s = view;
  const spec = VARIANTS[s.variant];
  const n = s.players.length;
  const mine = Math.max(0, s.players.findIndex((p) => p.id === meId));
  const me = s.players[mine];
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const actorId = s.phase === 'betting' && s.toAct !== null ? s.players[s.toAct].id : null;
  const myTurn = actorId === meId;
  const o = myTurn ? optionsFor(s) : null;
  const st = stakes(s);
  const tags = s.phase === 'betting' || s.phase === 'dealing' ? lastActions(s) : {};
  const showdown = s.phase === 'result' && !!s.result?.showdown;
  const winners = s.result ? Object.keys(s.result.won) : [];
  const winning = showdown ? new Set(winners.flatMap((id) => s.result!.hands[id]?.cards ?? [])) : null;
  const mineValue = me && !me.folded && !me.out ? handValue(s.variant, me.hole as Card[], s.board) : null;
  const blinds = new Map<string, string>();
  for (const e of s.log) if (e.hand === s.hand && e.kind === 'post' && e.player) blinds.set(e.player, e.text === 'small blind' ? 'SB' : 'BB');

  // Keys: F folds, C checks or calls.
  useEffect(() => {
    if (!o) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (e.key === 'f' && !o.canCheck && o.bringIn === null) onAction({ type: 'FOLD' });
      if (e.key === 'c' && o.bringIn === null) onAction(o.canCheck ? { type: 'CHECK' } : { type: 'CALL' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [o, onAction]);

  const table = (
    <div className={`pk-board is-${s.variant}`}>
      <div className="pk-table">
        <div className="pk-felt">
          <span className="pk-felt-mark">{spec.name}</span>
        </div>

        <div className="pk-centre">
          {s.phase === 'result' && s.result ? (
            <div className="pk-pot">
              {s.result.pots.map((p, i) => (
                <span key={i}>
                  {s.result!.pots.length === 1 ? 'Pot' : i === 0 ? 'Main pot' : `Side pot ${i}`} <b>{fmt(p.amount)}</b>
                </span>
              ))}
            </div>
          ) : (
            s.pot > 0 && (
              <div className="pk-pot">
                <span>
                  Pot <b>{fmt(s.pot)}</b>
                </span>
              </div>
            )
          )}
          {(!spec.stud || s.board.length > 0) && (
            <div className="pk-community">
              {Array.from({ length: spec.stud ? 1 : 5 }, (_, i) => {
                const c = s.board[i];
                return c ? (
                  <PlayingCard key={c} card={c} className={`pk-card is-board is-dealt${winning ? (winning.has(c) ? ' is-win' : ' is-dim') : ''}`} />
                ) : (
                  <span key={`slot-${i}`} className="pk-slot" />
                );
              })}
            </div>
          )}
          {s.phase === 'result' && s.result && (
            <p className="pk-verdict" role="status">
              {winners.map((id) => (
                <span key={id}>
                  <b>{who(id)}</b> {id === meId ? 'win' : 'wins'} {fmt(s.result!.won[id])}
                  {s.result!.hands[id] && <em> · {s.result!.hands[id].name}</em>}
                </span>
              ))}
            </p>
          )}
        </div>

        {s.players.map((p, k) => {
          const spot = seatSpot(k, n, mine);
          const bet = toward(spot, 0.42);
          const dealer = toward(spot, 0.22);
          const isMe = k === mine;
          const won = s.phase === 'result' ? s.result?.won[p.id] : undefined;
          return (
            <div key={p.id} className="pk-seat-group">
              <div
                className={`pk-seat${isMe ? ' is-me' : ''}${actorId === p.id ? ' is-turn' : ''}${p.folded && !p.out ? ' is-folded' : ''}${p.out ? ' is-out' : ''}${won ? ' is-winner' : ''}${spotlight === p.id ? ' is-spot' : ''}${spot.y < 46 ? ' is-top' : ''}`}
                style={{ '--x': `${spot.x}%`, '--y': `${spot.y}%`, '--tc': pkSeatColor(k) } as CSSProperties}
              >
                {!p.out && p.hole.length > 0 && <SeatCards p={p} mine={isMe} winning={winning && !p.folded ? winning : null} dealt />}
                <div className="pk-plate">
                  <span className="pk-token">{tokenLabel(who(p.id))}</span>
                  <span className="pk-plate-text">
                    <span className="pk-name">{who(p.id)}</span>
                    <span className="pk-stack">{p.out ? `Out · ${ordinal(p.place ?? n)}` : fmt(p.stack)}</span>
                  </span>
                </div>
                {tags[p.id] && <span className={`pk-tag is-${tags[p.id].toLowerCase().replace(/[^a-z]/g, '')}`}>{tags[p.id]}</span>}
                {won && <span className="pk-won">+{fmt(won)}</span>}
                {showdown && s.result?.hands[p.id] && <span className="pk-handname">{s.result.hands[p.id].name}</span>}
              </div>
              {p.bet > 0 && (
                <span className="pk-bet" style={{ '--x': `${bet.x}%`, '--y': `${bet.y}%` } as CSSProperties}>
                  <i className="pk-chip" style={{ '--tc': pkSeatColor(k) } as CSSProperties} />
                  {fmt(p.bet)}
                </span>
              )}
              {k === s.button && (
                <span className="pk-dealer" style={{ '--x': `${dealer.x + 3.2}%`, '--y': `${dealer.y}%` } as CSSProperties} title="Dealer button">
                  D
                </span>
              )}
              {won && (
                <span key={`fly-${s.hand}`} className="pk-fly" style={{ '--x': `${spot.x}%`, '--y': `${spot.y}%` } as CSSProperties} aria-hidden="true">
                  <i className="pk-chip" />
                  <i className="pk-chip" />
                  <i className="pk-chip" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="pk-dock">
        {me && !me.out && s.phase !== 'result' && (
          <p className="pk-mine">
            {me.folded ? 'You folded this hand' : mineValue ? describeHand(mineValue) : spec.stud ? '' : 'Your cards'}
            {o && o.toCall > 0 && (
              <span className="pk-odds">
                {' '}
                · call {fmt(o.toCall)} to win {fmt(s.pot + s.players.reduce((t, p) => t + p.bet, 0))}
              </span>
            )}
          </p>
        )}
        {o && !s.over ? <Controls s={s} o={o} onAction={onAction} /> : <div className="pk-controls is-idle" />}
      </div>
    </div>
  );

  const placed = [...s.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  const overlay =
    s.over && s.winner ? (
      <ResultCard
        kicker={`${spec.name} · ${s.hand} hands`}
        title={s.winner === meId ? 'You won the tournament' : `${nameFor(s.winner)} wins the tournament`}
        won={s.winner === meId}
        onRematch={() => onAction({ type: 'REMATCH' })}
        rematchLabel="New tournament"
        onExit={onExit}
        exitLabel={exitLabel}
        delayMs={1200}
      >
        <ol className="pk-standings">
          {placed.map((p) => (
            <li key={p.id}>
              <span>{ordinal(p.place ?? n)}</span> {who(p.id)}
            </li>
          ))}
        </ol>
      </ResultCard>
    ) : null;

  const perLevel = HANDS_PER_LEVEL[s.speed];
  const handsLeft = perLevel - ((s.hand - 1) % perLevel);
  const atTop = s.level >= LEVELS.length - 1;
  const events = s.log.map((e) => ({ e, text: describe(e, who) })).filter((x) => x.text).slice(0, 14);

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={s.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: pkSeatColor(s.players.indexOf(p)), active: actorId === p.id, badge: <span className="kit-badge" style={{ '--tc': pkSeatColor(s.players.indexOf(p)) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      <PlayersPanel
        title={`Hand ${s.hand}`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={s.players.map((p, i) => ({
          id: p.id,
          name: who(p.id),
          you: p.id === meId,
          color: pkSeatColor(i),
          detail: p.out
            ? `Out · ${ordinal(p.place ?? n)}`
            : [i === s.button ? 'Button' : null, blinds.get(p.id) === 'SB' ? 'Small blind' : blinds.get(p.id) === 'BB' ? 'Big blind' : null, p.folded ? 'Folded' : p.allIn ? 'All-in' : null]
                .filter(Boolean)
                .join(' · ') || undefined,
          trailing: p.out ? '-' : fmt(p.stack),
          active: actorId === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="Stakes" meta={`Level ${s.level + 1}`}>
        <p className="pk-stakes">
          {spec.stud ? (
            <>
              Ante <b>{fmt(st.ante)}</b> · Bring-in <b>{fmt(st.bringIn)}</b> · Bets <b>{fmt(st.small)}</b>/<b>{fmt(st.big)}</b>
            </>
          ) : (
            <>
              Blinds <b>{fmt(st.sb)}</b>/<b>{fmt(st.bb)}</b> · {spec.structure === 'pot-limit' ? 'Pot limit' : 'No limit'}
            </>
          )}
        </p>
        <p className="kit-muted">{atTop ? 'The stakes are at their highest.' : `They rise in ${handsLeft} ${handsLeft === 1 ? 'hand' : 'hands'}.`}</p>
      </SideSection>
      <SideSection title="Hand history">
        {events.length === 0 ? (
          <p className="kit-muted">The deal is under way.</p>
        ) : (
          <ul className="kit-log">
            {events.map(({ e, text }) => (
              <li key={e.seq} className={e.kind === 'win' ? 'is-win' : e.kind === 'street' ? 'is-street' : undefined}>
                {text}
              </li>
            ))}
          </ul>
        )}
      </SideSection>
      <SideSection title="Hand rankings" className="pk-ranks">
        <ol>
          {RANKINGS[spec.low ? 'low' : s.variant === 'shortdeck' ? 'short' : 'high'].map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </SideSection>
    </>
  );

  let status;
  if (s.over && s.winner) status = <><strong>{who(s.winner)}</strong> {s.winner === meId ? 'win' : 'wins'} the tournament</>;
  else if (s.phase === 'result') status = <><strong>{winners.map(who).join(' and ')}</strong> {winners.length === 1 && winners[0] !== meId ? 'takes' : 'take'} the pot</>;
  else if (myTurn && o) status = <><strong>Your turn</strong> · {o.bringIn !== null ? 'bring it in or complete' : o.canCheck ? 'check or bet' : `${fmt(o.toCall)} to call`}</>;
  else if (actorId) status = <><strong>{nameFor(actorId)}</strong> to act</>;
  else status = <>Dealing...</>;

  return (
    <GameShell
      className="pk-game"
      rulesVariant={s.variant}
      title="Poker"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={table}
      overlay={overlay}
      side={side}
    />
  );
}
