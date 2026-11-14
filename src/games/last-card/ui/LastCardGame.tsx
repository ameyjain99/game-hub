import { useEffect, useState, type CSSProperties } from 'react';
import { colorsOf, faceOf, fits, lastCardKit, type Card, type Color, type LcAction, type LcEvent, type LcState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { Megaphone } from '../../../shared/icons';
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
      return `${who(e.player)} caught ${who(e.target!)} – draw ${e.count}`;
  }
}

/** The Last Card table: opponents round the top, the piles in the middle, your hand along the bottom. */
export function LastCardGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<LcState, LcAction>) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const [callArmed, setCallArmed] = useState(false);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => lcCues(a, b, meId), LC_SOUNDS);

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

  const table = (
    <div className={`kit-board lc-table is-${side}${myTurn ? ' is-my-turn' : ''}`}>
      <div className="lc-felt" />
      <div className="lc-opponents">
        {others.map((p, k) => {
          const n = others.length;
          const angle = Math.PI * (0.92 - (0.84 * (k + 0.5)) / n);
          const x = 50 + Math.cos(angle) * 40;
          const y = 26 - Math.sin(angle) * 17;
          const shown = Math.min(p.handCount, 10);
          const exposed = view.exposed === p.id;
          return (
            <div
              key={p.id}
              className={`lc-opp${actor === p.id ? ' is-turn' : ''}${p.out ? ' is-out' : ''}${spotlight === p.id ? ' is-spot' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, '--tc': lcSeatColor(view.players.indexOf(p)) } as CSSProperties}
            >
              <div className="lc-opp-cards" aria-hidden="true">
                {Array.from({ length: shown }, (_, i) => {
                  const c = p.hand[i];
                  const backFace = view.variant === 'flip' && c ? faceOf(c, other) : null;
                  return <LcCard key={i} face={backFace} side={other} back={!backFace} className="is-mini" style={{ '--i': i - (shown - 1) / 2 } as CSSProperties} />;
                })}
              </div>
              <div className="lc-opp-name">
                <span className="lc-dot" />
                {nameFor(p.id)}
                <span className="lc-count">{p.handCount}</span>
              </div>
              {exposed && me && (
                <button type="button" className="lc-catch" onClick={() => onAction({ type: 'CATCH', target: p.id })}>
                  Catch!
                </button>
              )}
              {!exposed && p.handCount === 1 && !p.out && <span className="lc-one">Last card</span>}
            </div>
          );
        })}
      </div>

      <div className="lc-centre">
        <div className={`lc-direction${view.direction < 0 ? ' is-ccw' : ''}`} aria-label={view.direction > 0 ? 'Play goes clockwise' : 'Play goes anticlockwise'} />
        <button
          type="button"
          className={`lc-pile lc-deck${myTurn && view.drawn === null ? ' is-live' : ''}`}
          aria-label={`Draw a card (${view.deckCount} left)`}
          disabled={!myTurn || view.drawn !== null}
          onClick={() => onAction({ type: 'DRAW' })}
        >
          <span className="lc-deck-stack" />
          {view.variant === 'flip' && view.deckBack ? <LcCard face={view.deckBack} side={other} /> : <LcCard back />}
          <span className="lc-deck-count">{view.deckCount}</span>
        </button>
        <div className="lc-pile lc-discard" style={{ '--cc': view.color ? COLOR_HEX[view.color] : '#ffffff' } as CSSProperties}>
          {view.discard.slice(-3).map((c, i, arr) => (
            <LcCard
              key={`${c.id}-${side}`}
              face={faceOf(c, side)}
              side={side}
              className={i === arr.length - 1 ? 'is-top' : 'is-under'}
              style={{ '--r': `${((c.id * 37) % 23) - 11}deg` } as CSSProperties}
            />
          ))}
          <span className="lc-colour">{view.color ? COLOR_NAME[view.color] : 'Any colour'}</span>
        </div>
      </div>

      {me && !view.over && (
        <div className="lc-controls">
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
            <button type="button" className="lc-call is-urgent" onClick={() => onAction({ type: 'CALL' })}>
              <Megaphone size={15} /> Last card! – call it now
            </button>
          )}
        </div>
      )}

      {me && (
        <div className="lc-hand" style={{ '--n': hand.length } as CSSProperties}>
          {hand.map((c, i) => {
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
      <p>
        Scores: {[...view.players].sort((a, b) => (view.score[b.id] ?? 0) - (view.score[a.id] ?? 0)).map((p) => `${who(p.id)} ${view.score[p.id] ?? 0}`).join(' · ')}
      </p>
      <p>{winnerPoints >= 500 ? `${who(view.winner)} passed 500 points!` : "Points come from the cards left in everyone else's hands."}</p>
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
        title={`Hand ${view.game} · ${view.variant === 'flip' ? `Flip – ${side} side` : 'Classic'}`}
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
      <SideSection title="Recent plays">
        {view.history.length === 0 ? (
          <p className="kit-muted">
            Match the colour or the symbol. {view.variant === 'flip' ? 'A Flip card turns the whole table over to the dark side – and back.' : 'Wild Draw 4 only when you have nothing of the colour.'}
          </p>
        ) : (
          <ul className="kit-log">
            {view.history.slice(0, 10).map((e) => (
              <li key={e.seq}>{describe(e, who, side)}</li>
            ))}
          </ul>
        )}
      </SideSection>
    </>
  );

  let status;
  if (view.over && view.winner) status = <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'} the hand</>;
  else if (myTurn) status = view.drawn !== null ? <><strong>Play it or keep it</strong></> : <><strong>Your turn</strong> · {topFace ? `on ${faceName(topFace)}` : ''}</>;
  else status = <><strong>{nameFor(actor ?? '')}</strong> is playing...</>;

  return (
    <GameShell
      className={`lc-game${side === 'dark' ? ' is-dark-side' : ''}`}
      title="Last Card"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={table}
      overlay={overlay}
      side={side$}
    />
  );
}
