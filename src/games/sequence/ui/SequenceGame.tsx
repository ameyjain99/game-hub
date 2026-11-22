import { useEffect, useState, type CSSProperties } from 'react';
import { BOARD, CORNERS, isDead, isOneEyed, isTwoEyed, legalPlays, sequenceKit, targetsFor, type SeqAction, type SeqPlay, type SeqState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { PlayingCard, SUIT_SYMBOL, cardName, isRed, rankLabel } from '../../kit/ui/PlayingCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { SortButton, useSortMode } from '../../kit/ui/HandSort';
import { GameLog } from '../../kit/ui/GameLog';
import { SafeSquareIcon } from '../../../shared/icons';
import { TableMomentBanner, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { SEQ_SOUNDS, seqCues } from './sound';

export const TEAM_COLOR = ['#2F6FDB', '#25A35A', '#E0393E'];
export const TEAM_NAME = ['Blue', 'Green', 'Red'];

const short = (card: string) => `${rankLabel(card)}${SUIT_SYMBOL[card[1]]}`;

function describe(p: SeqPlay, name: string): string {
  if (p.kind === 'dead') return `${name} swapped a dead ${short(p.card)}`;
  if (p.kind === 'discard') return `${name} had no play and discarded ${short(p.card)}`;
  const at = p.cell !== undefined && p.card !== BOARD[p.cell] ? ` on ${short(BOARD[p.cell])}` : '';
  if (p.kind === 'remove') return `${name} used ${short(p.card)} to remove a ${TEAM_NAME[p.removedTeam!].toLowerCase()} chip${p.cell !== undefined ? ` from ${short(BOARD[p.cell])}` : ''}`;
  const text = `${name} played ${short(p.card)}${isTwoEyed(p.card) ? ` (wild)${at}` : ''}`;
  return p.made ? `${text} - made a line of five!` : text;
}

const SORTS = ['dealt', 'suit', 'rank'] as const;
const SORT_LABEL: Record<(typeof SORTS)[number], string> = { dealt: 'as dealt', suit: 'by suit', rank: 'by rank' };
const RANKS = 'A23456789TJQK';
const SUITS = 'SHDC';

/** The positions of your cards in the order you like to hold them (a play still names the card by its real position). */
export function handOrder(hand: string[], mode: (typeof SORTS)[number]): number[] {
  const idx = hand.map((_, i) => i);
  if (mode === 'dealt') return idx;
  const rank = (c: string) => RANKS.indexOf(c[0]);
  const suit = (c: string) => SUITS.indexOf(c[1]);
  return idx.sort((a, b) => (mode === 'suit' ? suit(hand[a]) - suit(hand[b]) || rank(hand[a]) - rank(hand[b]) : rank(hand[a]) - rank(hand[b]) || suit(hand[a]) - suit(hand[b])) || a - b);
}

/** How long the board shows who just placed or removed a chip, and where. */
const FX_MS = 2600;

/** A chip removed, or a line made: who did it and where, said large. */
export function seqMoments(prev: SeqState, next: SeqState, who: (id: string) => string): TableMoment[] {
  const p = next.last;
  if (!p || p.seq === prev.last?.seq || next.game !== prev.game) return [];
  const team = next.players.find((pl) => pl.id === p.player)?.team ?? 0;
  if (p.kind === 'remove' && p.cell !== undefined) {
    const theirs = TEAM_COLOR[p.removedTeam!];
    return [
      {
        kicker: `${who(p.player)} played ${short(p.card)}`,
        title: `removed a ${TEAM_NAME[p.removedTeam!].toLowerCase()} chip`,
        detail: `Taken off the ${cardName(BOARD[p.cell])}.`,
        color: theirs,
        art: <span className="seq-chip is-moment is-struck" style={{ '--tc': theirs } as CSSProperties} />,
        feels: { [p.player]: 'good' },
      },
    ];
  }
  if (p.kind === 'place' && p.made) {
    return [
      {
        kicker: `${who(p.player)} · ${TEAM_NAME[team]}`,
        title: p.made > 1 ? 'Two lines of five!' : 'A line of five!',
        color: TEAM_COLOR[team],
        art: <span className="seq-chip is-moment" style={{ '--tc': TEAM_COLOR[team] } as CSSProperties} />,
        feels: { [p.player]: 'good' },
      },
    ];
  }
  return [];
}

/** The Sequence screen, shared by local and online games. */
export function SequenceGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<SeqState, SeqAction>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hoverCard, setHoverCard] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [spotTeam, setSpotTeam] = useState<number | null>(null);
  useCues(view, (a, b) => seqCues(a, b, meId), SEQ_SOUNDS);
  const moment = useTableMoments(view, (a, b) => seqMoments(a, b, (id) => (id === meId ? 'You' : nameFor(id))));

  // The last chip placed or removed is acted out on its space for a moment:
  // the chip drops in (or lifts off) under the name of whoever did it.
  const [fx, setFx] = useState<number | null>(null);
  const lastSeq = view.last?.seq;
  useEffect(() => {
    if (lastSeq === undefined || view.last?.cell === undefined) return;
    setFx(lastSeq);
    const t = setTimeout(() => setFx(null), FX_MS);
    return () => clearTimeout(t);
  }, [lastSeq, view.game]); // eslint-disable-line react-hooks/exhaustive-deps
  const acted = fx !== null && view.last?.seq === fx ? view.last : null;

  const me = view.players.find((p) => p.id === meId);
  const actor = sequenceKit.actor(view);
  const myTurn = actor === meId;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const hand = me?.hand ?? [];
  const [sortBy, nextSort] = useSortMode('gamehub:sequence:sort', SORTS);
  const noPlays = myTurn && legalPlays(view).length === 0;

  useEffect(() => setSelected(null), [view.last?.seq, view.game]);

  const focusCard = selected ?? hoverCard;
  const focusTargets = new Set(me && focusCard !== null && hand[focusCard] ? targetsFor(view, hand[focusCard], me.team) : []);
  const removing = focusCard !== null && isOneEyed(hand[focusCard] ?? '');
  // Hovering a board space lifts the cards in your hand that could go there.
  const fitsHover = (card: string) =>
    hoverCell !== null && me && !CORNERS.has(hoverCell) && (card === BOARD[hoverCell] || (view.chips[hoverCell] === null && isTwoEyed(card)) || (isOneEyed(card) && targetsFor(view, card, me.team).includes(hoverCell)));
  const inSequence = new Set(view.sequences.flatMap((q) => q.cells));

  const playOn = (cell: number) => {
    if (!myTurn || !me) return;
    if (selected !== null) {
      if (focusTargets.has(cell)) onAction({ type: 'PLAY', card: selected, cell });
      else setSelected(null);
      return;
    }
    // No card picked: a plain card that matches this space plays itself.
    const match = hand.findIndex((c) => c === BOARD[cell] && view.chips[cell] === null);
    if (match >= 0) onAction({ type: 'PLAY', card: match, cell });
  };

  const board = (
    <div className={`kit-board seq-board${removing ? ' is-removing' : ''}`} style={{ '--mine': me ? TEAM_COLOR[me.team] : '#fff' } as CSSProperties} onMouseLeave={() => setHoverCell(null)}>
      {/* A finished line is drawn through its five chips, in its team's colour. */}
      <svg className="seq-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {view.sequences.map((q) => {
          const cells = [...q.cells].sort((a, b) => a - b);
          const at = (cell: number) => ({ x: (cell % 10) * 10 + 5, y: Math.floor(cell / 10) * 10 + 5 });
          const a = at(cells[0]);
          const b = at(cells[cells.length - 1]);
          return (
            <g key={`${view.game}-${cells.join('-')}`} style={{ '--tc': TEAM_COLOR[q.team] } as CSSProperties}>
              <line className="seq-line-glow" x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength={1} />
              <line className="seq-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength={1} />
            </g>
          );
        })}
      </svg>
      <div className="seq-grid" role="grid" aria-label="Sequence board">
        {BOARD.map((card, i) => {
          const chip = view.chips[i];
          const target = focusTargets.has(i);
          const cls = ['seq-cell', CORNERS.has(i) ? 'is-corner' : isRed(card) ? 'is-red' : 'is-black'];
          if (target) cls.push(removing ? 'is-victim' : 'is-target');
          else if (focusCard !== null && chip !== null && !CORNERS.has(i) && hand[focusCard] === card) cls.push('is-taken');
          if (view.last?.cell === i) cls.push('is-last');
          const here = acted?.cell === i ? acted : null;
          if (here) cls.push('is-acting');
          if (spotTeam !== null && chip !== null && chip !== spotTeam) cls.push('is-dim');
          const label = CORNERS.has(i) ? 'Free corner' : `${cardName(card)}${chip !== null ? `, ${TEAM_NAME[chip].toLowerCase()} chip` : ''}`;
          return (
            <button key={i} type="button" role="gridcell" className={cls.join(' ')} aria-label={label} onClick={() => playOn(i)} onMouseEnter={() => setHoverCell(i)}>
              {CORNERS.has(i) ? (
                <SafeSquareIcon className="seq-free" />
              ) : (
                <span className="seq-face">
                  <b>{rankLabel(card)}</b>
                  <i>{SUIT_SYMBOL[card[1]]}</i>
                </span>
              )}
              {chip !== null && (
                <span
                  key={`${view.game}-${i}-${chip}`}
                  className={`seq-chip${inSequence.has(i) ? ' is-locked' : ''}${here?.kind === 'place' ? ' is-fresh' : ''}`}
                  style={{ '--tc': TEAM_COLOR[chip] } as CSSProperties}
                >
                  {!CORNERS.has(i) && (
                    <span className="seq-chip-card" aria-hidden="true">
                      {short(card)}
                    </span>
                  )}
                </span>
              )}
              {here?.kind === 'remove' && (
                <span key={`gone-${here.seq}`} className="seq-chip is-leaving" style={{ '--tc': TEAM_COLOR[here.removedTeam!] } as CSSProperties} aria-hidden="true" />
              )}
              {here && (
                <>
                  <span key={`ring-${here.seq}`} className={`seq-ring${here.kind === 'remove' ? ' is-remove' : ''}`} style={{ '--tc': here.kind === 'remove' ? '#e2483b' : TEAM_COLOR[chip ?? 0] } as CSSProperties} aria-hidden="true" />
                  <span key={`tag-${here.seq}`} className={`seq-tag${here.kind === 'remove' ? ' is-remove' : ''}${i < 10 ? ' is-below' : ''}`} aria-hidden="true">
                    {who(here.player)}
                    {here.kind === 'remove' ? ' removed' : ''} · {short(here.card)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const myTeam = me?.team ?? 0;
  const teamSeqs = (t: number) => view.sequences.filter((q) => q.team === t).length;

  const overlay = view.over && view.winner !== null ? (
    <ResultCard
      title={view.winner === myTeam ? (view.players.filter((p) => p.team === myTeam).length > 1 ? 'Your team wins' : 'You win') : `${TEAM_NAME[view.winner]} wins`}
      won={view.winner === myTeam}
      onRematch={view.players.filter((p) => !p.out).length > 1 ? () => onAction({ type: 'REMATCH' }) : undefined}
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={900}
    >
      <p>
        {view.needed === 2 ? 'Two lines of five' : 'A line of five'} for {TEAM_NAME[view.winner].toLowerCase()}.
        {view.game > 1 ? ` Games won: ${view.score.map((n, t) => `${TEAM_NAME[t]} ${n}`).join(' · ')}.` : ''}
      </p>
    </ResultCard>
  ) : null;

  const handPanel = me && !view.over && (
    <SideSection title="Your hand" meta={`${view.deckCount} in the deck`}>
      <div className="kit-panel seq-hand-panel" style={{ '--tc': TEAM_COLOR[me.team] } as CSSProperties}>
        <SortButton label={SORT_LABEL[sortBy]} onClick={nextSort} />
        <div className="seq-hand" onMouseLeave={() => setHoverCard(null)}>
          {handOrder(hand, sortBy).map((i) => {
            const card = hand[i];
            const dead = isDead(view, card);
            const cls = ['seq-card'];
            if (selected === i) cls.push('is-selected');
            if (fitsHover(card)) cls.push('is-fit');
            if (dead) cls.push('is-dead');
            return (
              <button
                key={`${card}-${i}`}
                type="button"
                className={cls.join(' ')}
                aria-label={`${cardName(card)}${isTwoEyed(card) ? ', wild' : isOneEyed(card) ? ', removes a chip' : ''}${dead ? ', dead' : ''}`}
                aria-pressed={selected === i}
                disabled={!myTurn}
                onMouseEnter={() => setHoverCard(i)}
                onClick={() => {
                  if (noPlays) onAction({ type: 'DISCARD', card: i });
                  else setSelected(selected === i ? null : i);
                }}
              >
                <PlayingCard card={card} badge={isTwoEyed(card) ? 'Wild' : isOneEyed(card) ? 'Remove' : dead ? 'Dead' : undefined} />
              </button>
            );
          })}
        </div>
        {myTurn && hand.some((c) => isDead(view, c)) && !view.swapped && (
          <button
            type="button"
            className="g-btn g-btn-ghost"
            onClick={() => onAction({ type: 'DEAD', card: hand.findIndex((c) => isDead(view, c)) })}
          >
            Swap dead card {short(hand.find((c) => isDead(view, c))!)}
          </button>
        )}
        <p className="kit-muted">
          {!myTurn
            ? `${nameFor(actor ?? '')} is playing.`
            : noPlays
              ? 'No card can be played - pick one to discard.'
              : selected !== null
                ? isOneEyed(hand[selected])
                  ? "Pick an opponent's chip to remove."
                  : 'Pick a lit space to place your chip.'
                : 'Pick a card, or click a matching space on the board.'}
        </p>
      </div>
    </SideSection>
  );

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={(id) => setSpotTeam(id ? view.players.find((p) => p.id === id)?.team ?? null : null)}
        seats={view.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: TEAM_COLOR[p.team], active: actor === p.id, badge: <span className="seq-chip is-badge" style={{ '--tc': TEAM_COLOR[p.team] } as CSSProperties} /> }))}
      />
      {handPanel}
      <PlayersPanel
        title={`Teams · ${view.needed === 2 ? 'two lines' : 'one line'} to win`}
        spotlight={null}
        onSpotlight={(id) => setSpotTeam(id ? view.players.find((p) => p.id === id)?.team ?? null : null)}
        players={view.players.map((p) => ({
          id: p.id,
          name: nameFor(p.id),
          you: p.id === meId,
          color: TEAM_COLOR[p.team],
          badge: <span className="seq-chip is-token" style={{ '--tc': TEAM_COLOR[p.team] } as CSSProperties} />,
          detail: p.out ? 'Left the game' : `${TEAM_NAME[p.team]} · ${p.id === meId ? hand.length : p.handCount} cards`,
          trailing: `${teamSeqs(p.team)}/${view.needed}`,
          active: actor === p.id,
          out: p.out,
        }))}
      />
    </>
  );

  return (
    <GameShell
      className="seq-game"
      title="Sequence"
      exitLabel={exitLabel}
      onExit={onExit}
      status={
        view.over && view.winner !== null ? (
          <><strong>{TEAM_NAME[view.winner]}</strong> wins</>
        ) : myTurn ? (
          <><strong>Your turn</strong> · {TEAM_NAME[myTeam].toLowerCase()} chips</>
        ) : (
          <><strong>{nameFor(actor ?? '')}</strong> is playing...</>
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
        <GameLog
          entries={view.history.map((p) => ({
            key: p.seq,
            text: describe(p, who(p.player)),
            color: TEAM_COLOR[view.players.find((pl) => pl.id === p.player)?.team ?? 0],
            loud: p.kind === 'remove' || !!p.made,
          }))}
          empty="Two-eyed Jacks (♦ ♣) are wild; one-eyed Jacks (♥ ♠) remove an opponent's chip. Corners count for everyone."
        />
      }
    />
  );
}
