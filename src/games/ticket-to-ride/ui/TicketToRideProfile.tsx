import { useState } from 'react';
import { BackIcon, ExternalLinkIcon, BookOpen } from '../../../shared/icons';
import type { MapId } from '../engine/types';
import { getMap, DEFAULT_MAP_ID, MAP_LIST } from '../engine/maps';
import { AVATARS, DEFAULT_AVATAR } from './avatars';

interface Props {
  action: 'start' | 'join';
  onBack: () => void;
  onSubmit: (name: string, avatar: string, seatCount?: number, modeId?: string, mapId?: MapId) => void;
}

/** Name + avatar step. When creating a room it also collects the board, mode and
 *  player count. */
export function TicketToRideProfile({ action, onBack, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [mapId, setMapId] = useState<MapId>(DEFAULT_MAP_ID);
  const [seatCount, setSeatCount] = useState(3);
  const [modeId, setModeId] = useState('default');
  const trimmed = name.trim();

  const creating = action === 'start';
  const modes = creating ? getMap(mapId).modes : [];
  const mode = modes.find((m) => m.id === modeId) ?? modes[0];

  // Switching boards resets the mode, since mode ids differ between maps.
  const changeBoard = (id: MapId) => {
    setMapId(id);
    setModeId(getMap(id).modes[0]?.id ?? 'default');
  };

  return (
    <div className="setup-screen profile-screen">
      <button type="button" className="setup-back" onClick={onBack}>
        <BackIcon size={16} />Back
      </button>
      <h1>Who are you?</h1>
      <p className="tagline">Pick a name and an avatar for this game.</p>

      <label className="landing-name">
        <span>Your name</span>
        <input
          className="name-input"
          aria-label="Your name"
          placeholder="e.g. Amey"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="avatar-label">Avatar</div>
      <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            aria-label={`avatar ${a}`}
            aria-pressed={a === avatar}
            className={`avatar-choice${a === avatar ? ' selected' : ''}`}
            onClick={() => setAvatar(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {creating && (
        <>
          <label className="landing-field">
            <span>Board</span>
            <select aria-label="Board" value={mapId} onChange={(e) => changeBoard(e.target.value)}>
              {MAP_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {modes.length > 1 && (
            <label className="landing-field">
              <span>Mode</span>
              <select aria-label="Mode" value={modeId} onChange={(e) => setModeId(e.target.value)}>
                {modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode?.rulebook && (
            <a className="rulebook-link" href={mode.rulebook} target="_blank" rel="noopener noreferrer">
              <BookOpen size={14} />New here? Skim the rules <ExternalLinkIcon size={12} />
            </a>
          )}
          <label className="landing-field">
            <span>Players</span>
            <select
              aria-label="Number of players"
              value={seatCount}
              onChange={(e) => setSeatCount(Number(e.target.value))}
            >
              <option value={2}>2 players</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
              <option value={5}>5 players</option>
            </select>
          </label>
        </>
      )}

      <button
        type="button"
        className="primary profile-submit"
        disabled={!trimmed}
        onClick={() =>
          creating ? onSubmit(trimmed, avatar, seatCount, modeId, mapId) : onSubmit(trimmed, avatar)
        }
      >
        {creating ? 'Create game' : 'Join game'}
      </button>
      {!trimmed && <p className="landing-hint">Enter your name to continue.</p>}
    </div>
  );
}
