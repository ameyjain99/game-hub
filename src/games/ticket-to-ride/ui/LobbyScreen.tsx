import { useState } from 'react';
import { CloseIcon, AddIcon, Circle, CopyIcon, CheckIcon } from '../../../shared/icons';
import { Loader } from '../../../shared/Loader';
import { playerColor } from './colors';
import { AVATARS } from './avatars';
import { cleanName } from './displayName';
import type { LobbyView } from '../../../net/protocol';
import type { Difficulty } from '../engine/types';

interface Props {
  lobby: LobbyView;
  isHost: boolean;
  /** The viewer's own seat, so they can change their avatar; -1 if none. */
  mySeatIndex?: number;
  onSetSeatAi: (index: number, isAI: boolean, difficulty?: Difficulty) => void;
  onSetAvatar?: (avatar: string) => void;
  onStart: () => void;
  /** Host cancels the lobby; anyone else just leaves. */
  onLeave?: () => void;
}

const seatFilled = (s: LobbyView['seats'][number]): boolean => s.isAI || s.name !== null;

export function LobbyScreen({ lobby, isHost, mySeatIndex = -1, onSetSeatAi, onSetAvatar, onStart, onLeave }: Props) {
  const [difficulties, setDifficulties] = useState<Record<number, Difficulty>>({});
  const diffOf = (index: number): Difficulty => difficulties[index] ?? 'normal';
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(lobby.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  const allFilled = lobby.seats.every(seatFilled);

  const mySeat = mySeatIndex >= 0 ? lobby.seats[mySeatIndex] : undefined;
  const takenByOthers = new Set(
    lobby.seats.filter((s) => s.index !== mySeatIndex && s.avatar).map((s) => s.avatar),
  );

  return (
    <div className="setup-screen lobby-screen">
      {onLeave && (
        <button type="button" className="corner-exit" onClick={onLeave}>
          {isHost ? 'Cancel lobby' : 'Leave'} <CloseIcon size={14} />
        </button>
      )}
      <h1>Game lobby</h1>
      <p className="tagline">Share this code so friends can join:</p>
      <div className="lobby-code-row">
        <div className="lobby-code" aria-label="Room code">
          {lobby.code}
        </div>
        <button
          type="button"
          className={`copy-code${copied ? ' copied' : ''}`}
          onClick={copyCode}
          aria-label={copied ? 'Copied' : 'Copy room code'}
          title={copied ? 'Copied' : 'Copy room code'}
        >
          {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
        </button>
      </div>

      <div className="setup-rows">
        {lobby.seats.map((seat) => (
          <div className="setup-row" key={seat.index} style={{ borderLeftColor: playerColor(seat.index) }}>
            {seat.avatar ? (
              <span className="player-avatar" style={{ borderColor: playerColor(seat.index) }} aria-hidden>
                {seat.avatar}
              </span>
            ) : (
              <span className="seat-token" style={{ background: playerColor(seat.index) }} />
            )}
            <span className="player-name">
              {seat.isAI ? `AI (${seat.difficulty ?? 'normal'})` : seat.name ? cleanName(seat.name) : 'Empty'}
            </span>
            {!seat.isAI && seat.name !== null && (
              <span className={`conn-dot${seat.connected ? ' on' : ''}`} title={seat.connected ? 'connected' : 'disconnected'}>
                <Circle size={9} fill={seat.connected ? 'currentColor' : 'none'} />
              </span>
            )}

            {isHost && !seatFilled(seat) && (
              <>
                <select
                  className="difficulty"
                  aria-label={`Seat ${seat.index + 1} AI difficulty`}
                  value={diffOf(seat.index)}
                  onChange={(e) =>
                    setDifficulties((d) => ({ ...d, [seat.index]: e.target.value as Difficulty }))
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
                <button
                  type="button"
                  className="add-ai-btn"
                  onClick={() => onSetSeatAi(seat.index, true, diffOf(seat.index))}
                >
                  <AddIcon size={14} />Add AI
                </button>
              </>
            )}
            {isHost && seat.isAI && (
              <button type="button" className="remove-row" onClick={() => onSetSeatAi(seat.index, false)} aria-label="Remove bot">
                <CloseIcon size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {mySeat && onSetAvatar && (
        <div className="avatar-picker">
          <div className="avatar-label">Your avatar</div>
          <div className="avatar-grid" role="radiogroup" aria-label="Your avatar">
            {AVATARS.map((a) => {
              const taken = takenByOthers.has(a);
              return (
                <button
                  key={a}
                  type="button"
                  aria-label={`avatar ${a}`}
                  aria-pressed={a === mySeat.avatar}
                  disabled={taken}
                  className={`avatar-choice${a === mySeat.avatar ? ' selected' : ''}${taken ? ' taken' : ''}`}
                  onClick={() => onSetAvatar(a)}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isHost ? (
        <div className="setup-actions">
          <button type="button" className="primary" disabled={!allFilled} onClick={onStart}>
            Start game
          </button>
        </div>
      ) : (
        <Loader label="Waiting for the host to start..." />
      )}
    </div>
  );
}
