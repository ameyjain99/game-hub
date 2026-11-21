/**
 * Taking a move back, as friends do across a board: you ask, the other player
 * says yes or no (a bot always says yes). Shown in the game's action panel.
 */
export function Takeback({
  asker,
  meId,
  nameFor,
  canAsk,
  onAsk,
  onAnswer,
}: {
  /** Who is asking right now, if anyone. */
  asker: string | null | undefined;
  meId: string;
  nameFor: (id: string) => string;
  /** Whether you have a move to take back. */
  canAsk: boolean;
  onAsk: () => void;
  onAnswer: (accept: boolean) => void;
}) {
  if (asker && asker !== meId) {
    return (
      <div className="kit-takeback" role="group" aria-label="Take-back request">
        <p className="kit-muted">
          <strong>{nameFor(asker)}</strong> asks to take back their last move.
        </p>
        <div className="kit-actions">
          <button type="button" className="primary" onClick={() => onAnswer(true)}>
            Allow
          </button>
          <button type="button" className="g-btn g-btn-ghost" onClick={() => onAnswer(false)}>
            No
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="g-btn g-btn-ghost" disabled={!canAsk || asker === meId} onClick={onAsk}>
      {asker === meId ? 'Take-back asked...' : 'Take back a move'}
    </button>
  );
}
