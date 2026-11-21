import { Pause, Play } from '../../shared/icons';
import { useTable } from '../TableContext';

/**
 * Pause the game for the whole table ("back in two minutes"). Anyone seated
 * can pause and anyone can carry on. Renders nothing in a local game.
 */
export function PauseButton() {
  const table = useTable();
  if (!table?.pause) return null;
  const paused = table.pause.by !== null;
  return (
    <button
      type="button"
      className="g-icon-btn"
      aria-label={paused ? 'Carry on with the game' : 'Pause the game for everyone'}
      title={paused ? 'Carry on' : 'Pause for everyone'}
      onClick={table.pause.toggle}
    >
      {paused ? <Play size={16} /> : <Pause size={16} />}
    </button>
  );
}

/** Laid over the board while the game is paused: who paused it, and the way back. */
export function PausedOverlay() {
  const table = useTable();
  const by = table?.pause?.by ?? null;
  if (!table?.pause || by === null) return null;
  const mine = by === table.meId;
  return (
    <div className="g-paused" role="status">
      <div className="g-paused-card">
        <Pause size={26} aria-hidden="true" />
        <p className="g-paused-title">{mine ? 'You paused the game' : `${table.nameFor(by)} paused the game`}</p>
        <p className="g-paused-note">The clock is stopped and nobody can move. Anyone at the table can carry on.</p>
        <button type="button" className="primary" onClick={table.pause.toggle}>
          <Play size={16} /> Carry on
        </button>
      </div>
    </div>
  );
}
