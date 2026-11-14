import { useState } from 'react';
import { GameForm } from '../../../shared/ui/GameForm';
import { DEFAULT_SETTINGS, type Settings } from '../engine/state';
import { HouseRuleSwitches, StartingCashField } from './MonopolyRules';

interface Props {
  action: 'start' | 'join';
  /** The room being joined (join only). */
  code?: string;
  onBack: () => void;
  onSubmit: (name: string, seatCount?: number, settings?: Partial<Settings>) => void;
}

/** Name, plus — when hosting — players, board, starting cash and house rules. */
export function MonopolyProfile({ action, code, onBack, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [seatCount, setSeatCount] = useState(4);
  const [startingCash, setStartingCash] = useState(1500);
  const [rules, setRules] = useState<Settings>(DEFAULT_SETTINGS);
  const hosting = action === 'start';

  return (
    <GameForm
      eyebrow={hosting ? 'Monopoly · New room' : `Monopoly · Room ${code}`}
      title={hosting ? 'Set up your game' : 'Join the game'}
      subtitle={hosting ? 'You’ll get a room code to share next.' : 'Pick the name the table will see.'}
      onBack={onBack}
      submitLabel={hosting ? 'Create game' : 'Join game'}
      canSubmit={name.trim().length > 0}
      blockedHint="Enter your name to continue."
      onSubmit={() => (hosting ? onSubmit(name.trim(), seatCount, { ...rules, startingCash }) : onSubmit(name.trim()))}
    >
      <label className="g-field">
        <span className="g-field-label">Your name</span>
        <input className="g-input" aria-label="Your name" placeholder="e.g. Amey" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {hosting && (
        <>
          <div className="g-field-row">
            <label className="g-field">
              <span className="g-field-label">Board</span>
              <select aria-label="Board" defaultValue="us">
                <option value="us">Classic (US)</option>
              </select>
            </label>
            <label className="g-field">
              <span className="g-field-label">Players</span>
              <select aria-label="Number of players" value={seatCount} onChange={(e) => setSeatCount(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </select>
            </label>
          </div>
          <StartingCashField value={startingCash} onChange={setStartingCash} />
          <div className="g-field">
            <span className="g-field-label">House rules</span>
            <HouseRuleSwitches value={rules} onChange={setRules} />
          </div>
        </>
      )}
    </GameForm>
  );
}
