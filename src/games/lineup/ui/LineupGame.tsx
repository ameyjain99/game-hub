import { useEffect, useState, type CSSProperties } from 'react';
import { BOARD, CORNERS, isDead, isOneEyed, isTwoEyed, legalPlays, lineupKit, targetsFor, type SeqAction, type SeqPlay, type SeqState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { PlayingCard, SUIT_SYMBOL, cardName, isRed, rankLabel } from '../../kit/ui/PlayingCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { SafeSquareIcon } from '../../../shared/icons';
import { SEQ_SOUNDS, seqCues } from './sound';

export const TEAM_COLOR = ['#2F6FDB', '#25A35A', '#E0393E'];
export const TEAM_NAME = ['Blue', 'Green', 'Red'];

const short = (card: string) => `${rankLabel(card)}${SUIT_SYMBOL[card[1]]}`;

function describe(p: SeqPlay, name: string): string {
  if (p.kind === 'dead') return `${name} swapped a dead ${short(p.card)}`;
  if (p.kind === 'discard') return `${name} had no play and discarded ${short(p.card)}`;
  if (p.kind === 'remove') return `${name} used ${short(p.card)} to remove a ${TEAM_NAME[p.removedTeam!].toLowerCase()} chip`;
  const text = `${name} played ${short(p.card)}${isTwoEyed(p.card) ? ' (wild)' : ''}`;
  return p.made ? `${text} – made a line of five!` : text;
}

/** The Lineup screen, shared by local and online games. */
export function LineupGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<SeqState, SeqAction>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hoverCard, setHoverCard] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [spotTeam, setSpotTeam] = useState<number | null>(null);
  useCues(view, (a, b) => seqCues(a, b, meId), SEQ_SOUNDS);

  const me = view.players.find((p) => p.id === meId);
  const actor = lineupKit.actor(view);
  const myTurn = actor === meId;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const hand = me?.hand ?? [];
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
      <div className="seq-grid" role="grid" aria-label="Lineup board">
        {BOARD.map((card, i) => {
          const chip = view.chips[i];
          const target = focusTargets.has(i);
          const cls = ['seq-cell', CORNERS.has(i) ? 'is-corner' : isRed(card) ? 'is-red' : 'is-black'];
          if (target) cls.push(removing ? 'is-victim' : 'is-target');
          if (view.last?.cell === i) cls.push('is-last');
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
                <span key={`${view.game}-${i}-${chip}`} className={`seq-chip${inSequence.has(i) ? ' is-locked' : ''}`} style={{ '--tc': TEAM_COLOR[chip] } as CSSProperties} />
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
        <div className="seq-hand" onMouseLeave={() => setHoverCard(null)}>
          {hand.map((card, i) => {
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
              ? 'No card can be played – pick one to discard.'
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
          name: who(p.id),
          you: p.id === meId,
          color: TEAM_COLOR[p.team],
          badge: <span className="seq-chip is-token" style={{ '--tc': TEAM_COLOR[p.team] } as CSSProperties} />,
          detail: p.out ? 'Left the game' : `${TEAM_NAME[p.team]} · ${p.id === meId ? hand.length : p.handCount} cards`,
          trailing: `${teamSeqs(p.team)}/${view.needed}`,
          active: actor === p.id,
          out: p.out,
        }))}
      />
      <SideSection title="Recent plays">
        {view.history.length === 0 ? (
          <p className="kit-muted">Two-eyed Jacks (♦ ♣) are wild; one-eyed Jacks (♥ ♠) remove an opponent's chip. Corners count for everyone.</p>
        ) : (
          <ul className="kit-log">
            {view.history.slice(0, 10).map((p) => (
              <li key={p.seq}>{describe(p, who(p.player))}</li>
            ))}
          </ul>
        )}
      </SideSection>
    </>
  );

  return (
    <GameShell
      className="seq-game"
      title="Lineup"
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
      overlay={overlay}
      side={side}
    />
  );
}
