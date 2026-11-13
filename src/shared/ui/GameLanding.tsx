import { useState, type ReactNode } from 'react';
import { BackIcon } from '../icons';

interface Props {
  title: string;
  /** e.g. "2–6 players · 60–120 min" */
  meta: string;
  onBack: () => void;
  onJoin: (code: string) => void;
  onStart: () => void;
  onLocal: () => void;
  /** The local-game options (player count, bot difficulty) as `.g-field`s. */
  localOptions: ReactNode;
}

/**
 * A game's front door, shared by Monopoly and Cluedo: play online (join with a
 * code, or start a room) and play on this device against bots — the same
 * join-first structure as Ticket to Ride's landing.
 */
export function GameLanding({ title, meta, onBack, onJoin, onStart, onLocal, localOptions }: Props) {
  const [code, setCode] = useState('');
  const canJoin = code.length === 4;
  return (
    <div className="setup-screen g-screen">
      <button type="button" className="back-link" onClick={onBack}>
        <BackIcon size={16} />
        Back to games
      </button>
      <header className="g-head">
        <h1>{title}</h1>
        <p className="tagline">{meta}</p>
      </header>

      <section className="g-panel" aria-labelledby="g-online-title">
        <h2 className="g-panel-title" id="g-online-title">
          Play online
        </h2>
        <form
          className="g-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (canJoin) onJoin(code);
          }}
        >
          <label className="g-field g-grow">
            <span className="g-field-label">Room code</span>
            <input
              className="g-input g-code-input"
              aria-label="Room code"
              placeholder="ABCD"
              value={code}
              maxLength={4}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
          </label>
          <button type="submit" className="g-btn g-btn-light" disabled={!canJoin}>
            Join game
          </button>
        </form>
        <div className="landing-or">
          <span>or</span>
        </div>
        <button type="button" className="primary g-block" onClick={onStart}>
          Start a game
        </button>
        <p className="g-hint">Create a room, then share its code with friends.</p>
      </section>

      <section className="g-panel" aria-labelledby="g-local-title">
        <h2 className="g-panel-title" id="g-local-title">
          Play on this device
        </h2>
        <div className="g-field-row">{localOptions}</div>
        <button type="button" className="g-btn g-btn-ghost g-block" onClick={onLocal}>
          Start local game
        </button>
      </section>
    </div>
  );
}
