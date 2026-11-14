import type { ReactNode } from 'react';
import { BackIcon, Volume2, VolumeX } from '../../../shared/icons';
import { useMuted } from '../../../shared/sound';

interface Props {
  title: string;
  exitLabel: string;
  onExit: () => void;
  /** One line under the title saying whose move it is (announced to screen readers). */
  status?: ReactNode;
  /** Header extras before the mute switch (the online turn clock). */
  headerExtra?: ReactNode;
  /** Above the board (a disconnected-player banner). */
  banner?: ReactNode;
  /** The board, sized by the game inside `.kit-board-wrap`. */
  board: ReactNode;
  /** Laid over the board (the result card). */
  overlay?: ReactNode;
  /** The right column: video table, players, game panels. */
  side: ReactNode;
  /** A game-specific class on the screen root, for its palette and layout. */
  className?: string;
}

/**
 * The screen every kit game shares, laid out like Monopoly: a header (back,
 * title, status, clock, mute), the board filling the stage, and a sidebar.
 */
export function GameShell({ title, exitLabel, onExit, status, headerExtra, banner, board, overlay, side, className }: Props) {
  const [muted, setMuted] = useMuted();
  return (
    <div className={`kit-game${className ? ` ${className}` : ''}`}>
      <header className="kit-head">
        <button type="button" className="back-link" onClick={onExit}>
          <BackIcon size={16} />
          {exitLabel}
        </button>
        <h1 className="kit-title">{title}</h1>
        {status && (
          <p className="kit-status" aria-live="polite">
            {status}
          </p>
        )}
        <div className="kit-head-extra">
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
      <main className="kit-stage">
        {banner}
        <div className="kit-board-wrap">
          {board}
          {overlay}
        </div>
      </main>
      <aside className="kit-side">{side}</aside>
    </div>
  );
}

/** A titled sidebar section. */
export function SideSection({ title, meta, children, className }: { title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`kit-side-section${className ? ` ${className}` : ''}`}>
      <h2 className="kit-side-title">
        {title}
        {meta !== undefined && <span className="kit-side-meta">{meta}</span>}
      </h2>
      {children}
    </section>
  );
}
