import { useEffect, useState, type ReactNode } from 'react';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { BackIcon } from '../../../shared/icons';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { MonopolyBoard } from './MonopolyBoard';
import { MonopolyCenter } from './MonopolyCenter';
import { MonopolySidebar } from './MonopolySidebar';
import { TradeDialog } from './MonopolyTrade';

interface Props {
  view: MonopolyState;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (a: Action) => void;
  onExit: () => void;
  exitLabel: string;
  /** Header extras (the online turn clock). */
  headerExtra?: ReactNode;
  /** Shown above the board (e.g. a disconnected-player banner). */
  banner?: ReactNode;
}

/** The full Monopoly screen — header, board with its play area, and sidebar —
 *  shared by local and online games. */
export function MonopolyGame({ view, meId, nameFor, onAction, onExit, exitLabel, headerExtra, banner }: Props) {
  const [inspected, setInspected] = useState<number | null>(null);
  const [trading, setTrading] = useState(false);
  const compact = useMediaQuery('(max-width: 720px)');
  const actor = monopolyActor(view);

  // A new decision for the viewer (or a game event) closes an open deed.
  useEffect(() => setInspected(null), [view.phase, view.pendingPurchase, actor]);

  const center = (part: 'all' | 'head' | 'body') => (
    <MonopolyCenter
      view={view}
      meId={meId}
      onAction={onAction}
      nameFor={nameFor}
      inspected={inspected}
      onCloseInspect={() => setInspected(null)}
      onOpenTrade={() => setTrading(true)}
      onExit={onExit}
      part={part}
    />
  );

  return (
    <div className="mono-game">
      <header className="mono-head">
        <button type="button" className="back-link" onClick={onExit}>
          <BackIcon size={16} />
          {exitLabel}
        </button>
        <h1 className="mono-title">Monopoly</h1>
        <div className="mono-head-extra">{headerExtra}</div>
      </header>
      <main className="mono-stage">
        {banner}
        <div className="mono-board-wrap">
          <MonopolyBoard view={view} nameFor={nameFor} actorId={actor} onInspect={setInspected}>
            {center(compact ? 'head' : 'all')}
          </MonopolyBoard>
        </div>
        {compact && center('body')}
      </main>
      <MonopolySidebar view={view} meId={meId} nameFor={nameFor} onAction={onAction} onInspect={setInspected} />
      {trading && (
        <TradeDialog view={view} meId={meId} onAction={onAction} onClose={() => setTrading(false)} nameFor={nameFor} />
      )}
    </div>
  );
}
