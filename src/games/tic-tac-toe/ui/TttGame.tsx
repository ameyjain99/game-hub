import { useState, type CSSProperties } from 'react';
import { markOf, type Mark, type TttAction, type TttState } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { TTT_SOUNDS, tttCues } from './sound';

export const MARK_COLOR: Record<Mark, string> = { X: '#F0524F', O: '#3D8BFF' };

/** The centre of a cell on the 300-unit board. */
const centre = (cell: number) => ({ x: 50 + (cell % 3) * 100, y: 50 + Math.floor(cell / 3) * 100 });

function MarkGlyph({ mark, ghost }: { mark: Mark; ghost?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`ttt-mark is-${mark.toLowerCase()}${ghost ? ' is-ghost' : ''}`} aria-hidden="true">
      {mark === 'X' ? (
        <>
          <path d="M28 28L72 72" pathLength={1} />
          <path d="M72 28L28 72" pathLength={1} />
        </>
      ) : (
        <circle cx="50" cy="50" r="24" pathLength={1} />
      )}
    </svg>
  );
}

const cellName = (i: number) => `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;

/** The Tic-Tac-Toe screen, shared by local and online games. */
export function TttGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<TttState, TttAction>) {
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => tttCues(a, b, meId), TTT_SOUNDS);

  const me = view.players.find((p) => p.id === meId);
  const myMark = me ? markOf(view, meId) : null;
  const myTurn = !view.roundOver && view.turn === meId;
  const opponent = view.players.find((p) => p.id !== meId) ?? view.players[1];
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const lastMove = view.moves[view.moves.length - 1];
  const spotMark = spotlight ? markOf(view, spotlight) : null;

  let status;
  if (view.closed) status = <>The series is over</>;
  else if (view.roundOver) status = view.winner ? <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'} round {view.round}</> : <>Round {view.round} is a draw</>;
  else if (myTurn) status = <><strong>Your move</strong> · you're {myMark}</>;
  else status = <><strong>{nameFor(view.turn)}</strong> is thinking...</>;

  const board = (
    <div
      className={`kit-board ttt-board${view.roundOver ? ' is-over' : ''}${myTurn ? ' is-my-turn' : ''}`}
      style={{ '--mine': myMark ? MARK_COLOR[myMark] : '#fff' } as CSSProperties}
      role="grid"
      aria-label="Tic-Tac-Toe board"
    >
      <svg className="ttt-grid" viewBox="0 0 300 300" aria-hidden="true">
        <path d="M100 18V282M200 18V282M18 100H282M18 200H282" />
      </svg>
      <div className="ttt-cells" role="rowgroup">
        {view.board.map((mark, i) => {
          const won = view.winLine?.includes(i);
          const dim = (view.winLine && !won) || (spotMark && mark && mark !== spotMark);
          return (
            <button
              key={`${view.round}-${i}`}
              type="button"
              role="gridcell"
              className={`ttt-cell${mark ? ' is-filled' : ''}${won ? ' is-won' : ''}${dim ? ' is-dim' : ''}${i === lastMove ? ' is-last' : ''}`}
              aria-label={`${cellName(i)}, ${mark ?? 'empty'}`}
              disabled={!myTurn || mark !== null}
              onClick={() => onAction({ type: 'PLACE', cell: i })}
            >
              {mark ? <MarkGlyph mark={mark} /> : myTurn && myMark ? <MarkGlyph mark={myMark} ghost /> : null}
            </button>
          );
        })}
      </div>
      {view.winLine && view.winner && (
        <svg className="ttt-strike" viewBox="0 0 300 300" aria-hidden="true">
          <line
            x1={centre(view.winLine[0]).x}
            y1={centre(view.winLine[0]).y}
            x2={centre(view.winLine[2]).x}
            y2={centre(view.winLine[2]).y}
            pathLength={1}
            style={{ stroke: MARK_COLOR[markOf(view, view.winner)] }}
          />
        </svg>
      )}
    </div>
  );

  const score = (id: string) => view.score[id] ?? 0;
  const scoreLine = `${who(meId)} ${score(meId)} – ${score(opponent.id)} ${nameFor(opponent.id)}${view.draws ? ` · ${view.draws} ${view.draws === 1 ? 'draw' : 'draws'}` : ''}`;

  const overlay = view.roundOver ? (
    <ResultCard
      title={view.winner === null ? (view.closed ? 'Series over' : "It's a draw") : view.winner === meId ? 'You win' : `${nameFor(view.winner)} wins`}
      won={view.winner === meId}
      onRematch={view.closed ? undefined : () => onAction({ type: 'REMATCH' })}
      kicker={view.closed ? 'Game over' : `Round ${view.round}`}
      rematchLabel="Next round"
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={view.winLine ? 1000 : 600}
    >
      <p>{scoreLine}</p>
      {!view.closed && <p>{who(view.players[view.round % 2].id)} {view.players[view.round % 2].id === meId ? 'start' : 'starts'} the next round.</p>}
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
          .map((p) => ({ id: p.id, accent: MARK_COLOR[markOf(view, p.id)], active: view.turn === p.id && !view.roundOver, badge: <span className="ttt-badge">{markOf(view, p.id)}</span> }))}
      />
      <PlayersPanel
        title={`Round ${view.round}`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={view.players.map((p) => {
          const mark = markOf(view, p.id);
          return {
            id: p.id,
            name: who(p.id),
            you: p.id === meId,
            color: MARK_COLOR[mark],
            badge: mark,
            detail: mark === 'X' ? 'Plays X · moves first' : 'Plays O',
            trailing: score(p.id),
            active: !view.roundOver && view.turn === p.id,
          };
        })}
      />
      <SideSection title="Series">
        <p className="kit-muted">
          {view.draws === 0 ? 'No draws yet.' : `${view.draws} ${view.draws === 1 ? 'draw' : 'draws'} so far.`} Starts alternate each round, and
          the starter plays X. Three in a row – across, down or diagonal – wins.
        </p>
      </SideSection>
    </>
  );

  return (
    <GameShell
      className="ttt-game"
      title="Tic-Tac-Toe"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={board}
      overlay={overlay}
      side={side}
    />
  );
}
