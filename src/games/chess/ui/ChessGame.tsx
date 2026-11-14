import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chess, type Square } from 'chess.js';
import { chessKit, colorOf, idOfColor, type ChessAction, type ChessState, type Color, type Promotion } from '../engine';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { SquareBoard } from '../../kit/ui/SquareBoard';
import { MoveList } from '../../kit/ui/MoveList';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { useCues } from '../../kit/ui/useCues';
import { PIECE_SVG } from './pieces';
import { CHESS_SOUNDS, chessCues } from './sound';
import { engineLevel, stockfish } from './stockfish';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
/** Board index (0 = a8, row-major) ↔ algebraic square. */
const alg = (sq: number) => `${FILES[sq % 8]}${8 - Math.floor(sq / 8)}` as Square;
const indexOf = (square: string) => (8 - Number(square[1])) * 8 + FILES.indexOf(square[0]);

const NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
export const COLOR_ACCENT: Record<Color, string> = { w: '#f2f0ea', b: '#8d97ab' };

export function PieceImg({ code }: { code: string }) {
  return <svg className="ch-piece" viewBox="0 0 45 45" dangerouslySetInnerHTML={{ __html: PIECE_SVG[code] }} />;
}

const RESULT_TEXT: Record<string, string> = {
  checkmate: 'Checkmate.',
  stalemate: 'Stalemate – no legal move, and no check.',
  threefold: 'The same position came up three times.',
  insufficient: 'Neither side has enough material to mate.',
  'fifty-moves': 'Fifty moves each with no capture or pawn move.',
  resigned: 'By resignation.',
  agreed: 'Drawn by agreement.',
  abandoned: 'The table emptied.',
};

/** Whether Stockfish has loaded, for the engine card. */
function useEngineReady(active: boolean): 'loading' | 'ready' | 'failed' {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    if (!active) return;
    let live = true;
    stockfish().ready.then(
      () => live && setState('ready'),
      () => live && setState('failed'),
    );
    return () => {
      live = false;
    };
  }, [active]);
  return state;
}

/** The Chess screen, shared by local (against Stockfish) and online games. */
export function ChessGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<ChessState, ChessAction>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<{ from: number; to: number } | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  useCues(view, (a, b) => chessCues(a, b, meId), CHESS_SOUNDS);

  const chess = useMemo(() => new Chess(view.fen), [view.fen]);
  const seated = view.players.some((p) => p.id === meId);
  const myColor: Color = seated ? colorOf(view, meId) : 'w';
  const actor = chessKit.actor(view);
  const myTurn = actor === meId;
  const opponentId = view.players.find((p) => p.id !== meId)?.id ?? view.players[1].id;
  const engineOpponent = view.players.find((p) => p.id === opponentId)?.isAI ?? false;
  const engineState = useEngineReady(engineOpponent);

  useEffect(() => {
    setSelected(null);
    setPromoting(null);
  }, [view.fen]);

  const legal = useMemo(() => (myTurn ? chess.moves({ verbose: true }) : []), [chess, myTurn]);
  const movable = new Set(legal.map((m) => indexOf(m.from)));
  const focus = selected ?? (hover !== null && movable.has(hover) ? hover : null);
  const targets = focus === null ? [] : legal.filter((m) => m.from === alg(focus));
  const last = view.moves[view.moves.length - 1];
  const inCheck = chess.inCheck();
  const kingSq = inCheck ? chess.board().flat().find((p) => p && p.type === 'k' && p.color === chess.turn())?.square : undefined;
  const spotColor = spotlight ? colorOf(view, spotlight) : null;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));

  const tryMove = (from: number, to: number) => {
    const options = legal.filter((m) => m.from === alg(from) && m.to === alg(to));
    if (options.length === 0) return false;
    if (options.some((m) => m.promotion)) setPromoting({ from, to });
    else onAction({ type: 'MOVE', from: alg(from), to: alg(to) });
    setSelected(null);
    return true;
  };

  const onSquare = (sq: number) => {
    if (!myTurn || promoting) return;
    if (selected !== null && tryMove(selected, sq)) return;
    setSelected(movable.has(sq) && selected !== sq ? sq : null);
  };

  const pieceAt = (sq: number) => chess.get(alg(sq));
  const squareClass = (sq: number) => {
    const c = [(Math.floor(sq / 8) + (sq % 8)) % 2 === 1 ? 'is-dark' : 'is-light'];
    if (last && (alg(sq) === last.from || alg(sq) === last.to)) c.push('is-last');
    if (sq === selected) c.push('is-selected');
    const t = targets.find((m) => m.to === alg(sq));
    if (t) c.push(t.captured ? 'is-capture' : 'is-target', selected === null ? 'is-preview' : '');
    if (myTurn && movable.has(sq)) c.push('is-movable');
    if (kingSq === alg(sq)) c.push('is-check');
    const p = pieceAt(sq);
    if (spotColor && p && p.color !== spotColor) c.push('is-dim');
    return c.join(' ');
  };

  const label = (sq: number) => {
    const p = pieceAt(sq);
    return `${alg(sq)}, ${p ? `${p.color === 'w' ? 'white' : 'black'} ${NAMES[p.type]}` : 'empty'}`;
  };

  // Material taken by each side, and the balance.
  const taken: Record<Color, string[]> = { w: [], b: [] };
  for (const m of view.moves) if (m.captured) taken[m.color].push(m.captured);
  const material = (c: Color) => taken[c].reduce((n, p) => n + (VALUE[p] ?? 0), 0);
  const lead = material('w') - material('b');

  let status;
  if (view.over) status = view.winner ? <><strong>{who(view.winner)}</strong> {view.winner === meId ? 'win' : 'wins'}</> : <>Drawn game</>;
  else if (myTurn) status = inCheck ? <><strong>Check</strong> · your move</> : <><strong>Your move</strong> · you're {myColor === 'w' ? 'White' : 'Black'}</>;
  else status = engineOpponent ? <><strong>Stockfish</strong> is thinking...</> : <><strong>{nameFor(actor!)}</strong> to move</>;

  const board = (
    <div className={`kit-board ch-board${myTurn ? ' is-my-turn' : ''}`}>
      <SquareBoard
        ariaLabel="Chess board"
        flipped={myColor === 'b'}
        squareClass={squareClass}
        piece={(sq) => {
          const p = pieceAt(sq);
          return p ? <PieceImg code={`${p.color}${p.type.toUpperCase()}`} /> : null;
        }}
        label={label}
        onSquare={onSquare}
        onHover={setHover}
        canDrag={(sq) => myTurn && !promoting && movable.has(sq)}
        onPick={setSelected}
        onDrop={(from, to) => {
          if (!tryMove(from, to)) setSelected(null);
        }}
        arrival={last ? { from: indexOf(last.from), to: indexOf(last.to), key: `${view.game}-${view.moves.length}` } : null}
        ghosts={
          last?.captured
            ? [{ sq: indexOf(last.to), node: <PieceImg code={`${last.color === 'w' ? 'b' : 'w'}${last.captured.toUpperCase()}`} />, key: `g${view.moves.length}` }]
            : []
        }
        files={FILES}
        ranks={RANKS}
      />
      {promoting && (
        <div className="ch-promote" role="dialog" aria-label="Promote to">
          <p>Promote to</p>
          <div className="ch-promote-row">
            {(['q', 'r', 'b', 'n'] as Promotion[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-label={NAMES[p]}
                onClick={() => {
                  onAction({ type: 'MOVE', from: alg(promoting.from), to: alg(promoting.to), promotion: p });
                  setPromoting(null);
                }}
              >
                <PieceImg code={`${myColor}${p.toUpperCase()}`} />
              </button>
            ))}
          </div>
          <button type="button" className="ch-promote-cancel" onClick={() => setPromoting(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  const overlay = view.over ? (
    <ResultCard
      title={view.winner === null ? 'Drawn game' : view.winner === meId ? 'You win' : `${engineOpponent ? 'Stockfish' : nameFor(view.winner)} wins`}
      won={view.winner === meId}
      onRematch={view.result === 'abandoned' ? undefined : () => onAction({ type: 'REMATCH' })}
      rematchLabel="Rematch · swap colours"
      onExit={onExit}
      exitLabel={exitLabel}
    >
      <p>{RESULT_TEXT[view.result ?? ''] ?? ''}</p>
      {view.game > 1 && (
        <p>
          Score: {who(meId)} {view.score[meId] ?? 0} – {view.score[opponentId] ?? 0} {nameFor(opponentId)}
        </p>
      )}
    </ResultCard>
  ) : null;

  const takenRow = (c: Color) => {
    const pieces = [...taken[c]].sort((a, b) => (VALUE[b] ?? 0) - (VALUE[a] ?? 0));
    const diff = c === 'w' ? lead : -lead;
    if (pieces.length === 0) return c === 'w' ? 'White' : 'Black';
    return (
      <span className="ch-taken">
        {pieces.map((p, i) => (
          <span key={i} className="ch-taken-piece">
            <PieceImg code={`${c === 'w' ? 'b' : 'w'}${p.toUpperCase()}`} />
          </span>
        ))}
        {diff > 0 && <span className="ch-lead">+{diff}</span>}
      </span>
    );
  };

  const level = engineLevel(view.players.find((p) => p.id === opponentId)?.difficulty);
  const offerFromThem = view.drawOffer && view.drawOffer !== meId;

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
            const c = colorOf(view, p.id);
            return { id: p.id, accent: COLOR_ACCENT[c], active: actor === p.id, badge: <PieceImg code={`${c}K`} /> };
          })}
      />
      <PlayersPanel
        title={view.game > 1 ? `Game ${view.game}` : 'Players'}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={(['w', 'b'] as Color[]).map((c) => {
          const id = idOfColor(view, c);
          const bot = view.players.find((p) => p.id === id)?.isAI;
          return {
            id,
            name: bot ? 'Stockfish' : who(id),
            you: id === meId,
            color: COLOR_ACCENT[c],
            badge: <PieceImg code={`${c}K`} />,
            detail: takenRow(c),
            trailing: view.game > 1 ? view.score[id] ?? 0 : undefined,
            active: actor === id,
          };
        })}
      />
      {engineOpponent && (
        <div className="kit-panel ch-engine" style={{ '--tc': COLOR_ACCENT[myColor === 'w' ? 'b' : 'w'] } as CSSProperties}>
          <div className="ch-engine-row">
            <span className={`ch-engine-dot is-${engineState}${!myTurn && !view.over ? ' is-thinking' : ''}`} />
            <span>
              <strong>Stockfish 18</strong> · {level.label.replace('Stockfish · ', '')}
            </span>
          </div>
          <p className="kit-muted">
            {engineState === 'failed'
              ? "The engine couldn't load here, so a simple stand-in is playing."
              : engineState === 'loading'
                ? 'Loading the engine...'
                : "The world's strongest open-source engine, running in your browser."}{' '}
            <a href="/engine/COPYING.txt" target="_blank" rel="noreferrer" title="Stockfish is free software under the GNU GPL v3: github.com/official-stockfish/Stockfish">
              GPLv3
            </a>
          </p>
        </div>
      )}
      {!view.over && seated && (
        <div className="kit-panel">
          {offerFromThem ? (
            <>
              <p className="kit-muted">
                <strong className="ch-strong">{nameFor(view.drawOffer!)}</strong> offers a draw.
              </p>
              <div className="kit-actions">
                <button type="button" className="primary" onClick={() => onAction({ type: 'ANSWER_DRAW', accept: true })}>
                  Accept draw
                </button>
                <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'ANSWER_DRAW', accept: false })}>
                  Decline
                </button>
              </div>
            </>
          ) : (
            <div className="kit-actions">
              {!engineOpponent && (
                <button type="button" className="g-btn g-btn-ghost" disabled={view.drawOffer === meId} onClick={() => onAction({ type: 'OFFER_DRAW' })}>
                  {view.drawOffer === meId ? 'Draw offered' : 'Offer a draw'}
                </button>
              )}
              <button type="button" className="g-btn g-btn-ghost" style={engineOpponent ? { gridColumn: '1 / -1' } : undefined} onClick={() => onAction({ type: 'RESIGN' })}>
                Resign
              </button>
            </div>
          )}
        </div>
      )}
      <SideSection title="Moves">
        <MoveList moves={view.moves.map((m) => m.san)} empty="White moves first." />
      </SideSection>
    </>
  );

  return (
    <GameShell
      className="ch-game"
      title="Chess"
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
