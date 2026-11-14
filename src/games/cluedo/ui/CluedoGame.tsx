import type { ReactNode } from 'react';
import type { CluedoAction } from '../engine/reducer';
import type { RedactedCluedoState } from '../engine/redact';
import { BackIcon } from '../../../shared/icons';
import { CluedoBoard } from './CluedoBoard';
import { CluedoActions } from './CluedoActions';
import { CluedoHand } from './CluedoHand';
import { CluedoNotebook } from './CluedoNotebook';
import { CluedoPlayers } from './CluedoPlayers';

interface Props {
  view: RedactedCluedoState;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (a: CluedoAction) => void;
  onExit: () => void;
  exitLabel: string;
  /** Header extras (the online turn clock). */
  headerExtra?: ReactNode;
  /** Shown above the board (a disconnected-player banner). */
  banner?: ReactNode;
  /** Shown at the top of the sidebar (online video tiles). */
  sideTop?: ReactNode;
}

/** The full Cluedo screen – mansion + decision panel, with the table, your
 *  hand and the notebook alongside – shared by local and online games. */
export function CluedoGame({ view, meId, nameFor, onAction, onExit, exitLabel, headerExtra, banner, sideTop }: Props) {
  const actorId = view.phase === 'disprove' ? view.pendingDisprover : view.players[view.current]?.id;
  const me = view.players.find((p) => p.id === meId);
  const reachable = view.phase === 'move' && view.players[view.current]?.id === meId ? view.moveOptions : [];

  return (
    <div className="cl-game">
      <header className="cl-head">
        <button type="button" className="back-link" onClick={onExit}>
          <BackIcon size={16} />
          {exitLabel}
        </button>
        <h1 className="cl-title">Cluedo</h1>
        <div className="cl-head-extra">{headerExtra}</div>
      </header>
      <main className="cl-main">
        {banner}
        <CluedoBoard view={view} meId={meId} nameFor={nameFor} reachable={reachable} onMove={(room) => onAction({ type: 'move', room })} />
        <CluedoActions view={view} meId={meId} nameFor={nameFor} onAction={onAction} onExit={onExit} />
      </main>
      <aside className="cl-side">
        {sideTop}
        <section className="cl-side-section">
          <h2 className="cl-side-title">Players</h2>
          <CluedoPlayers view={view} meId={meId} nameFor={nameFor} actorId={actorId} />
        </section>
        {me?.hand && (
          <section className="cl-side-section">
            <h2 className="cl-side-title">Your cards</h2>
            <CluedoHand hand={me.hand} />
          </section>
        )}
        <CluedoNotebook view={view} nameFor={nameFor} />
      </aside>
    </div>
  );
}
