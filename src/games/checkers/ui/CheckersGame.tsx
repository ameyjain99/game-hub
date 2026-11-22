import { useEffect, useMemo, useState } from 'react';
import { checkersKit, isDark, legalHops, sideOf, sideOfPlayer, squareNumber, type CheckersAction, type CheckersState, type Piece, type Side } from '../engine';
import { Crown } from '../../../shared/icons';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { SquareBoard } from '../../kit/ui/SquareBoard';
import { MoveList } from '../../kit/ui/MoveList';
import { Takeback } from '../../kit/ui/Takeback';
import { replayCheckers } from '../engine';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { TableMomentBanner, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { useCues } from '../../kit/ui/useCues';
import { CHECKERS_SOUNDS, checkersCues } from './sound';

/** Each side's accent in the sidebar and video ring (Black's lifted so it shows on the dark UI). */
const SIDE_COLOR: Record<Side, string> = { black: '#8d97ab', white: '#efe8da' };
const SIDE_NAME: Record<Side, string> = { black: 'Black', white: 'White' };

export function Disc({ piece }: { piece: Piece }) {
  const side = sideOf(piece)!;
  return (
    <span className={`ck-piece is-${side}${Math.abs(piece) === 2 ? ' is-king' : ''}`}>
      {Math.abs(piece) === 2 && <Crown className="ck-crown" strokeWidth={2.4} />}
    </span>
  );
}

const count = (board: Piece[], side: Side, king?: boolean) =>
  board.filter((p) => sideOf(p) === side && (king === undefined || (Math.abs(p) === 2) === king)).length;

const REASON: Record<string, string> = {
  'no-moves': 'No legal moves left.',
  resigned: 'By resignation.',
  'forty-moves': 'Forty moves each without a capture or a man moving.',
  abandoned: 'The table emptied.',
};

/** The Checkers screen, shared by local and online games. */
export function CheckersGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<CheckersState, CheckersAction>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => checkersCues(a, b, meId), CHECKERS_SOUNDS);
  // A man crowned, or a run of jumps in one move.
  const moment = useTableMoments(view, (a, b): TableMoment[] => {
    const hop = b.lastHop;
    if (!hop || b.game !== a.game || (hop === a.lastHop)) return [];
    const mover = hop.side === 'black' ? b.blackId : b.players.find((p) => p.id !== b.blackId)!.id;
    const name = mover === meId ? 'You' : nameFor(mover);
    const out: TableMoment[] = [];
    if (Math.abs(b.board[hop.to]) === 2 && Math.abs(a.board[hop.from]) === 1) out.push({ kicker: name, title: 'crowned a king', color: '#f2c548', art: <Crown size={44} />, feels: { [mover]: 'good' } });
    const jumps = b.moves.length > a.moves.length ? (b.moves[b.moves.length - 1].match(/x/g) ?? []).length : 0;
    if (jumps >= 2) out.push({ kicker: name, title: jumps === 2 ? 'Double jump!' : jumps === 3 ? 'Triple jump!' : `${jumps} jumps in one move!`, color: '#e2483b', feels: { [mover]: 'good' } });
    return out;
  });

  const mySide = view.players.some((p) => p.id === meId) ? sideOfPlayer(view, meId) : 'white';
  const actor = checkersKit.actor(view);
  // Looking back: the board after a chosen number of moves (null = the live game).
  const [review, setReview] = useState<number | null>(null);
  useEffect(() => setReview(null), [view.game]);
  const shownBoard = useMemo(() => (review === null ? view.board : replayCheckers(view.moves.slice(0, review)).board), [view.board, view.moves, review]);
  const myTurn = actor === meId && review === null;
  const hops = useMemo(() => (myTurn ? legalHops(view) : []), [view, myTurn]);
  const mustCapture = hops.some((h) => h.capture);
  const movable = new Set(hops.map((h) => h.from));

  // A multi-jump keeps its piece selected; a new position clears a stale pick.
  useEffect(() => setSelected(view.chain), [view]);

  const focus = selected ?? (hover !== null && movable.has(hover) ? hover : null);
  const targets = hops.filter((h) => h.from === focus);
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const idFor = (side: Side) => (side === 'black' ? view.blackId : view.players.find((p) => p.id !== view.blackId)!.id);
  const spotSide = spotlight ? sideOfPlayer(view, spotlight) : null;

  const tryMove = (from: number, to: number) => {
    if (hops.some((h) => h.from === from && h.to === to)) {
      onAction({ type: 'MOVE', from, to });
      setSelected(null);
      return true;
    }
    return false;
  };

  const onSquare = (sq: number) => {
    if (!myTurn) return;
    if (selected !== null && tryMove(selected, sq)) return;
    if (view.chain !== null) return; // mid-jump: only the jumping piece may move
    setSelected(movable.has(sq) && selected !== sq ? sq : null);
  };

  const last = view.lastHop;
  const squareClass = (sq: number) => {
    const c = [isDark(sq) ? 'is-dark' : 'is-light'];
    if (last && (sq === last.from || sq === last.to)) c.push('is-last');
    if (sq === selected) c.push('is-selected');
    const t = targets.find((h) => h.to === sq);
    if (t) c.push(t.capture ? 'is-capture' : 'is-target', selected === null ? 'is-preview' : '');
    if (myTurn && selected === null && movable.has(sq)) c.push(mustCapture ? 'is-must' : 'is-movable');
    if (spotSide && sideOf(shownBoard[sq]) && sideOf(shownBoard[sq]) !== spotSide) c.push('is-dim');
    return c.join(' ');
  };

  const label = (sq: number) => {
    if (!isDark(sq)) return 'light square';
    const p = shownBoard[sq];
    const what = p === 0 ? 'empty' : `${SIDE_NAME[sideOf(p)!]} ${Math.abs(p) === 2 ? 'king' : 'man'}`;
    return `Square ${squareNumber(sq)}, ${what}`;
  };

  let status;
  if (view.over) status = view.draw ? <>Drawn game</> : <><strong>{who(view.winner!)}</strong> {view.winner === meId ? 'win' : 'wins'}</>;
  else if (review !== null) status = <><strong>Looking back</strong> · after move {review} of {view.moves.length}{actor === meId ? ' · it is your move' : ''}</>;
  else if (myTurn) status = view.chain !== null ? <><strong>Keep jumping</strong> · the same piece goes again</> : mustCapture ? <><strong>You must capture</strong></> : <><strong>Your move</strong> · you're {SIDE_NAME[mySide]}</>;
  else status = <><strong>{nameFor(actor!)}</strong> is thinking...</>;

  const board = (
    <div className={`kit-board ck-board${myTurn ? ' is-my-turn' : ''}`}>
      <SquareBoard
        ariaLabel="Checkers board"
        flipped={mySide === 'black'}
        squareClass={squareClass}
        piece={(sq) => (shownBoard[sq] ? <Disc piece={shownBoard[sq]} /> : null)}
        label={label}
        number={(sq) => (isDark(sq) ? squareNumber(sq) : null)}
        onSquare={onSquare}
        onHover={setHover}
        canDrag={(sq) => myTurn && movable.has(sq) && (view.chain === null || view.chain === sq)}
        onPick={setSelected}
        onDrop={(from, to) => {
          if (!tryMove(from, to)) setSelected(view.chain);
        }}
        arrival={last ? { from: last.from, to: last.to, key: `${view.game}-${view.moves.length}-${last.from}-${last.to}` } : null}
        ghosts={last && last.captured !== null ? [{ sq: last.captured, node: <Disc piece={last.capturedPiece} />, key: `${view.moves.length}-${last.captured}` }] : []}
      />
    </div>
  );

  const overlay = view.over ? (
    <ResultCard
      title={view.draw ? 'Drawn game' : view.winner === meId ? 'You win' : `${nameFor(view.winner!)} wins`}
      won={view.winner === meId}
      onRematch={view.reason === 'abandoned' ? undefined : () => onAction({ type: 'REMATCH' })}
      rematchLabel="Rematch · swap colours"
      onExit={onExit}
      exitLabel={exitLabel}
    >
      <p>{REASON[view.reason ?? ''] ?? ''}</p>
      <p>
        Score: {who(meId)} {view.score[meId] ?? 0} - {view.score[view.players.find((p) => p.id !== meId)?.id ?? ''] ?? 0}{' '}
        {nameFor(view.players.find((p) => p.id !== meId)?.id ?? '')}
      </p>
    </ResultCard>
  ) : null;

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={view.players
          .filter((p) => !p.isAI)
          .map((p) => {
            const s = sideOfPlayer(view, p.id);
            return { id: p.id, accent: SIDE_COLOR[s], active: actor === p.id, badge: <Disc piece={s === 'black' ? 1 : -1} /> };
          })}
      />
      <PlayersPanel
        title={view.game > 1 ? `Game ${view.game}` : 'Players'}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={(['black', 'white'] as Side[]).map((s) => {
          const id = idFor(s);
          const kings = count(shownBoard, s, true);
          return {
            id,
            name: nameFor(id),
            you: id === meId,
            color: SIDE_COLOR[s],
            badge: <span className={`ck-token-dot is-${s}`} />,
            detail: `${SIDE_NAME[s]} · ${count(shownBoard, s)} pieces${kings ? ` · ${kings} ${kings === 1 ? 'king' : 'kings'}` : ''}`,
            trailing: view.game > 1 || (view.score[id] ?? 0) > 0 ? view.score[id] ?? 0 : undefined,
            active: actor === id,
          };
        })}
      />
      {!view.over && view.players.some((p) => p.id === meId) && (
        <div className="kit-panel">
          <p className="kit-muted">
            Captures are compulsory - pieces that must jump glow. A man reaching the far row is crowned and can then move backwards.
          </p>
          <div className="kit-actions">
            <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'RESIGN' })}>
              Resign
            </button>
            <Takeback
              asker={view.takeback}
              meId={meId}
              nameFor={nameFor}
              canAsk={view.chain === null && view.moves.length >= (actor === meId ? 2 : 1)}
              onAsk={() => onAction({ type: 'TAKEBACK' })}
              onAnswer={(accept) => onAction({ type: 'ANSWER_TAKEBACK', accept })}
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <GameShell
      className="ck-game"
      title="Checkers"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
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
        <SideSection title="Moves" meta={view.quiet >= 40 ? `${80 - view.quiet} plies to a draw` : undefined}>
          <MoveList moves={view.moves} empty="Black moves first." picked={review} onPick={setReview} />
        </SideSection>
      }
    />
  );
}
