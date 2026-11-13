import { useState } from 'react';
import { GameForm } from '../../../shared/ui/GameForm';
import { DEFAULT_SETTINGS, type Settings } from '../engine/state';

/** House rules, in display order. Defaults follow the official rulebook. */
const RULES: { key: keyof Settings; label: string; desc: string }[] = [
  { key: 'auctions', label: 'Auctions', desc: 'A declined property goes to the highest bidder' },
  { key: 'doubleRentFullSet', label: 'Double rent on a full set', desc: 'Unbuilt lots in a complete colour set' },
  { key: 'mortgaging', label: 'Mortgaging', desc: 'Raise half a lot’s price from the bank' },
  { key: 'evenBuild', label: 'Even building', desc: 'Houses go up evenly across a set' },
  { key: 'freeParkingJackpot', label: 'Free Parking jackpot', desc: 'Taxes collect there for whoever lands' },
  { key: 'doubleGoSalary', label: 'Double salary on Go', desc: '$400 for landing exactly on Go' },
  { key: 'noRentInJail', label: 'No rent from jail', desc: 'Jailed owners can’t collect' },
];

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
          <label className="g-field">
            <span className="g-field-label">Starting cash</span>
            <select aria-label="Starting cash" value={startingCash} onChange={(e) => setStartingCash(Number(e.target.value))}>
              {[500, 1000, 1500, 2000, 2500, 3000].map((c) => (
                <option key={c} value={c}>
                  ${c.toLocaleString()}
                  {c === 1500 ? ' (standard)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="g-field">
            <span className="g-field-label">House rules</span>
            <div className="g-switches">
              {RULES.map((r) => (
                <label key={r.key} className="g-switch-row">
                  <span className="g-switch-text">
                    <span>{r.label}</span>
                    <span className="g-switch-desc">{r.desc}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="g-switch"
                    checked={rules[r.key] as boolean}
                    onChange={() => setRules((s) => ({ ...s, [r.key]: !s[r.key] }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </GameForm>
  );
}
