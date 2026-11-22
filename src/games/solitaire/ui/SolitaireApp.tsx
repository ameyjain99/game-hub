import { useState } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { GameLanding } from '../../../shared/ui/GameLanding';
import { RulesContext } from '../../../shared/rules';
import { SetupContext } from '../../../shared/ui/GameSetup';
import type { DrawMode } from '../engine';
import { SOLITAIRE_RULES } from '../rules';
import { SolitaireGame } from './SolitaireGame';

/** Solitaire: a one-player game - the landing (draw one or three), then the table at /solitaire/play. */
export function SolitaireApp({ onBackToHub }: { onBackToHub: () => void }) {
  const { step, navigate, exit } = useGameRoute('solitaire', onBackToHub);
  const [draw, setDraw] = useState<DrawMode>(1);
  const screen =
    step.kind === 'local' ? (
      <SetupContext.Provider value={[`Turn the stock: ${draw === 1 ? 'One card at a time' : 'Three at a time'}`]}>
        <SolitaireGame draw={draw} onExit={exit} />
      </SetupContext.Provider>
    ) : (
      <GameLanding
        title="Solitaire"
        meta="Klondike · 1 player · 5-15 min"
        online={false}
        onBack={exit}
        onLocal={() => navigate({ kind: 'local' })}
        localOptions={
          <label className="g-field">
            <span className="g-field-label">Turn the stock</span>
            <select aria-label="Turn the stock" value={draw} onChange={(e) => setDraw(Number(e.target.value) as DrawMode)}>
              <option value={1}>One card at a time (easier)</option>
              <option value={3}>Three at a time (classic)</option>
            </select>
          </label>
        }
      />
    );
  return <RulesContext.Provider value={{ rules: SOLITAIRE_RULES, variant: String(draw) }}>{screen}</RulesContext.Provider>;
}
