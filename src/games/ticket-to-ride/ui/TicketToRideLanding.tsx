import { useState } from 'react';
import { BackIcon } from '../../../shared/icons';

interface Props {
  onStart: () => void;
  onJoin: (code: string) => void;
  onLocal: () => void;
  /** Return to the game hub, when launched from it. */
  onBackToHub?: () => void;
}

export function TicketToRideLanding({ onStart, onJoin, onLocal, onBackToHub }: Props) {
  const [code, setCode] = useState('');

  const canJoin = code.length === 4;

  return (
    <div className="setup-screen landing-screen">
      {onBackToHub && (
        <button type="button" className="back-link" onClick={onBackToHub}>
          <BackIcon size={16} />Back to games
        </button>
      )}
      <h1>Ticket to Ride</h1>
      <p className="tagline">2-5 players · Play online</p>

      <div className="landing-stack">
        <section className="landing-panel">
          <h2>Join a game</h2>
          <p className="landing-sub">Got a code from a friend? Hop in.</p>
          <label className="landing-field">
            <span>Room code</span>
            <input
              className="name-input code-input"
              aria-label="Room code"
              placeholder="ABCD"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
          </label>
          <button type="button" className="primary" disabled={!canJoin} onClick={() => onJoin(code)}>
            Join game
          </button>
          {!canJoin && <p className="landing-hint">Enter the 4-letter room code your friend shared.</p>}
        </section>

        <div className="landing-or"><span>or</span></div>

        <section className="landing-start">
          <button type="button" className="primary" onClick={() => onStart()}>
            Start game
          </button>
          <p className="landing-hint">Create a room and invite friends — you'll pick the board, players and mode next.</p>
        </section>
      </div>

      <button type="button" className="landing-local" onClick={onLocal}>
        or play on this device
      </button>
    </div>
  );
}
