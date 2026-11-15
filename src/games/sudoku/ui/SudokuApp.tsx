import { useState } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { GameLanding } from '../../../shared/ui/GameLanding';
import { RulesContext } from '../../../shared/rules';
import type { Difficulty } from '../engine';
import { SUDOKU_RULES } from '../rules';
import { SudokuGame } from './SudokuGame';

/** Sudoku: a one-player game - the landing (level, mistake limit), then the grid at /sudoku/play. */
export function SudokuApp({ onBackToHub }: { onBackToHub: () => void }) {
  const { step, navigate, exit } = useGameRoute('sudoku', onBackToHub);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [limit, setLimit] = useState(3);
  const screen =
    step.kind === 'local' ? (
      <SudokuGame difficulty={difficulty} mistakeLimit={limit} onExit={exit} />
    ) : (
      <GameLanding
        title="Sudoku"
        meta="1 player · 5-30 min"
        online={false}
        onBack={exit}
        onLocal={() => navigate({ kind: 'local' })}
        localOptions={
          <>
            <label className="g-field">
              <span className="g-field-label">Level</span>
              <select aria-label="Level" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </label>
            <label className="g-field">
              <span className="g-field-label">Mistakes</span>
              <select aria-label="Mistakes" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                <option value={3}>3 and you're out</option>
                <option value={0}>No limit</option>
              </select>
            </label>
          </>
        }
      />
    );
  return <RulesContext.Provider value={{ rules: SUDOKU_RULES }}>{screen}</RulesContext.Provider>;
}
