import { useState } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { GameLanding } from '../../../shared/ui/GameLanding';
import { LEVELS, type Level } from '../engine';
import { MinesweeperGame } from './MinesweeperGame';

/** Minesweeper: a one-player game. Pick a level, then play at /minesweeper/play (levels switch from the game too). */
export function MinesweeperApp({ onBackToHub }: { onBackToHub: () => void }) {
  const { step, navigate, exit } = useGameRoute('minesweeper', onBackToHub);
  const [level, setLevel] = useState<Level>('easy');
  if (step.kind === 'local') return <MinesweeperGame level={level} onExit={exit} />;
  return (
    <GameLanding
      title="Minesweeper"
      meta="1 player · 1–10 min"
      online={false}
      onBack={exit}
      onLocal={() => navigate({ kind: 'local' })}
      localOptions={
        <label className="g-field">
          <span className="g-field-label">Level</span>
          <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {(Object.keys(LEVELS) as Level[]).map((l) => (
              <option key={l} value={l}>
                {LEVELS[l].label} – {LEVELS[l].cols}×{LEVELS[l].rows}, {LEVELS[l].mines} mines
              </option>
            ))}
          </select>
        </label>
      }
    />
  );
}
