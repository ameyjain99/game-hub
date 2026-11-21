import type { ReactNode } from 'react';
import { BackIcon, Volume2, VolumeX } from '../../../shared/icons';
import { useMuted } from '../../../shared/sound';
import { RulesButton } from '../../../shared/ui/Rules';
import { FacesStrip } from '../../../online/ui/SeatFace';
import { PausedOverlay } from '../../../online/ui/Pause';

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
  /** The game log: its own column left of the board on a wide screen, under the sidebar otherwise. */
  log?: ReactNode;
  /** A game-specific class on the screen root, for its palette and layout. */
  className?: string;
  /** Which version's rules the Rules sheet opens on (Poker's variant, Last Card's mode). */
  rulesVariant?: string;
}

/**
 * The screen every kit game shares, laid out like Monopoly: a header (back,
 * title, status, clock, mute), the board filling the stage, and a sidebar;
 * a game may add its log as a column on the board's left.
 */
export function GameShell({ title, exitLabel, onExit, status, headerExtra, banner, board, overlay, side, log, className, rulesVariant }: Props) {
  const [muted, setMuted] = useMuted();
  return (
    <div className={`kit-game${log ? ' has-left' : ''}${className ? ` ${className}` : ''}`}>
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
          <RulesButton variant={rulesVariant} />
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
        <FacesStrip />
        {banner}
        <div className="kit-board-wrap">
          {board}
          {overlay}
          <PausedOverlay />
        </div>
      </main>
      <aside className="kit-side">{side}</aside>
      {log && <aside className="kit-left">{log}</aside>}
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
