import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { BackIcon, Volume2, VolumeX } from '../../../shared/icons';
import { useMediaQuery } from '../../../shared/useMediaQuery';
import { useMuted } from '../../../shared/sound';
import { PLAY, soundCues } from './sound';
import { MonopolyBoard } from './MonopolyBoard';
import { MonopolyCenter } from './MonopolyCenter';
import { MonopolySidebar } from './MonopolySidebar';
import { TradeDialog } from './MonopolyTrade';
import { momentLots, useSetMoments } from './SetMoment';

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
  /** Shown at the top of the sidebar (the online video table); it may spotlight
   *  a player's holdings, as their row does. */
  sideTop?: (onSpotlight: (playerId: string | null) => void) => ReactNode;
}

/** Play the cues each state change makes on this player's screen. */
function useMonopolySounds(view: MonopolyState, meId: string): void {
  const prev = useRef(view);
  useEffect(() => {
    const cues = soundCues(prev.current, view, meId);
    prev.current = view;
    for (const cue of cues) PLAY[cue]();
  }, [view, meId]);
}

/** The full Monopoly screen — header, board with its play area, and sidebar —
 *  shared by local and online games. */
export function MonopolyGame({ view, meId, nameFor, onAction, onExit, exitLabel, headerExtra, banner, sideTop }: Props) {
  const [inspected, setInspected] = useState<number | null>(null);
  // The open trade dialog, and the partner it opened with (from a sidebar row).
  const [trading, setTrading] = useState<{ with?: string } | null>(null);
  // A player whose holdings are lit on the board (from their row, video tile or a lot).
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const { moments, dismiss } = useSetMoments(view);
  const [muted, setMuted] = useMuted();
  useMonopolySounds(view, meId);
  const compact = useMediaQuery('(max-width: 720px)');
  const actor = monopolyActor(view);

  // A new decision for the viewer (or a game event) closes an open deed.
  useEffect(() => setInspected(null), [view.phase, view.pendingPurchase, actor]);

  // Escape closes an open deed.
  useEffect(() => {
    if (inspected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspected]);

  // Clicking a lot opens its deed; clicking the same lot again closes it.
  const toggleDeed = (id: number) => setInspected((open) => (open === id ? null : id));

  const center = (part: 'all' | 'head' | 'body') => (
    <MonopolyCenter
      view={view}
      meId={meId}
      onAction={onAction}
      nameFor={nameFor}
      inspected={inspected}
      onCloseInspect={() => setInspected(null)}
      onOpenTrade={() => setTrading({})}
      onExit={onExit}
      moments={moments}
      onDismissMoments={dismiss}
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
        <div className="mono-head-extra">
          {headerExtra}
          <button
            type="button"
            className="g-icon-btn"
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>
      <main className="mono-stage">
        {banner}
        <div className="mono-board-wrap">
          <MonopolyBoard
            view={view}
            nameFor={nameFor}
            actorId={actor}
            onInspect={toggleDeed}
            inspected={inspected}
            spotlight={spotlight}
            onSpotlight={setSpotlight}
            flashIds={momentLots(moments)}
          >
            {center(compact ? 'head' : 'all')}
          </MonopolyBoard>
        </div>
        {compact && center('body')}
      </main>
      <MonopolySidebar
        view={view}
        meId={meId}
        nameFor={nameFor}
        onAction={onAction}
        onInspect={toggleDeed}
        onTradeWith={(id) => setTrading({ with: id })}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        top={sideTop?.(setSpotlight)}
      />
      {trading && (
        <TradeDialog
          view={view}
          meId={meId}
          onAction={onAction}
          onClose={() => setTrading(null)}
          nameFor={nameFor}
          initialPartner={trading.with}
        />
      )}
    </div>
  );
}
