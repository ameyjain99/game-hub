import { useState } from 'react';
import { BackIcon, ExternalLinkIcon, CloseIcon, AddIcon, BookOpen } from '../../../shared/icons';
import type { Difficulty, MapId } from '../engine/types';
import type { PlayerConfig } from '../engine/setup';
import { DEFAULT_MAP_ID, getMap, MAP_LIST } from '../engine/maps';
import { avatarForSeat } from './avatars';
import { playerColor } from './colors';

interface Row {
  name: string;
  isAI: boolean;
  difficulty: Difficulty;
}

const DEFAULT_ROWS: Row[] = [
  { name: 'You', isAI: false, difficulty: 'normal' },
  { name: 'Bot 1', isAI: true, difficulty: 'normal' },
];

interface Props {
  onStart: (configs: PlayerConfig[], mapId: MapId, modeId?: string) => void;
  /** Return to the game hub (shown as a left-aligned "← Back to games" link). */
  onBackToHub?: () => void;
  /** Switch to online play (shown as an "or play with anyone" link). */
  onPlayOnline?: () => void;
}

export function TicketToRideSetup({ onStart, onBackToHub, onPlayOnline }: Props) {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [mapId, setMapId] = useState<MapId>(DEFAULT_MAP_ID);
  const [modeId, setModeId] = useState('default');
  const modes = getMap(mapId).modes;
  const mode = modes.find((m) => m.id === modeId) ?? modes[0];

  const update = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const addRow = () =>
    setRows((r) => [
      ...r,
      { name: `Bot ${r.length}`, isAI: true, difficulty: 'normal' },
    ]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const canStart = rows.length >= 2 && rows.length <= 5 && rows.every((r) => r.name.trim());

  return (
    <div className="setup-screen">
      {onBackToHub && (
        <button type="button" className="back-link" onClick={onBackToHub}>
          <BackIcon size={16} />Back to games
        </button>
      )}
      <h1>Ticket to Ride</h1>
      <p className="tagline">2-5 players · On this device</p>

      <label className="setup-map">
        <span>Board</span>
        <select
          aria-label="Board"
          value={mapId}
          onChange={(e) => {
            setMapId(e.target.value);
            setModeId('default');
          }}
        >
          {MAP_LIST.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {modes.length > 1 && (
          <select aria-label="Mode" value={modeId} onChange={(e) => setModeId(e.target.value)}>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        {mode.rulebook && (
          <a className="rulebook-link" href={mode.rulebook} target="_blank" rel="noopener noreferrer">
            <BookOpen size={14} />Rules <ExternalLinkIcon size={12} />
          </a>
        )}
      </label>

      <div className="setup-rows">
        {rows.map((row, i) => (
          <div className="setup-row" key={i} style={{ borderLeftColor: playerColor(i) }}>
            <span className="seat-token" style={{ background: playerColor(i) }} />
            <input
              className="name-input"
              value={row.name}
              onChange={(e) => update(i, { name: e.target.value })}
              aria-label={`Player ${i + 1} name`}
            />
            <div className="type-toggle">
              <button
                type="button"
                className={row.isAI ? '' : 'active'}
                onClick={() => update(i, { isAI: false })}
              >
                Human
              </button>
              <button
                type="button"
                className={row.isAI ? 'active' : ''}
                onClick={() => update(i, { isAI: true })}
              >
                Computer
              </button>
            </div>
            {row.isAI && (
              <select
                className="difficulty"
                value={row.difficulty}
                onChange={(e) => update(i, { difficulty: e.target.value as Difficulty })}
                aria-label={`Player ${i + 1} difficulty`}
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            )}
            {rows.length > 2 && (
              <button type="button" className="remove-row" onClick={() => removeRow(i)} aria-label="Remove player">
                <CloseIcon size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="setup-actions">
        {rows.length < 5 && (
          <button type="button" onClick={addRow}>
            <AddIcon size={15} />Add player
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={!canStart}
          onClick={() =>
            onStart(
              rows.map((r, i) => ({
                name: r.name.trim(),
                isAI: r.isAI,
                difficulty: r.isAI ? r.difficulty : undefined,
                avatar: avatarForSeat(i),
              })),
              mapId,
              modeId,
            )
          }
        >
          Start game
        </button>
      </div>

      {onPlayOnline && (
        <button type="button" className="landing-local" onClick={onPlayOnline}>
          or play with anyone
        </button>
      )}
    </div>
  );
}
