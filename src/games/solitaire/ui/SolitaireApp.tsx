import { useState } from 'react';
import { useGameRoute } from '../../../online/useGameRoute';
import { GameLanding } from '../../../shared/ui/GameLanding';
import type { DrawMode } from '../engine';
import { SolitaireGame } from './SolitaireGame';

/** Solitaire: a one-player game – the landing (draw one or three), then the table at /solitaire/play. */
export function SolitaireApp({ onBackToHub }: { onBackToHub: () => void }) {
  const { step, navigate, exit } = useGameRoute('solitaire', onBackToHub);
  const [draw, setDraw] = useState<DrawMode>(1);
  if (step.kind === 'local') return <SolitaireGame draw={draw} onExit={exit} />;
  return (
    <GameLanding
      title="Solitaire"
      meta="Klondike · 1 player · 5–15 min"
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
}
