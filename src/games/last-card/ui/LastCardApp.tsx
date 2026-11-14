import { useState } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createLastCard, lastCardKit, type Variant } from '../engine';
import { LastCardGame, lcSeatColor } from './LastCardGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'last-card',
  title: 'Last Card',
  meta: '2–10 players · 15–30 min',
  localSeats: [2, 3, 4, 5, 6],
  onlineSeats: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

export function LastCardApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [variant, setVariant] = useState<Variant>('classic');
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      optionValue={{ variant }}
      optionFields={
        <label className="g-field">
          <span className="g-field-label">Mode</span>
          <select aria-label="Mode" value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
            <option value="classic">Classic</option>
            <option value="flip">Flip – two-sided deck, a light and a dark side</option>
          </select>
        </label>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={lastCardKit} init={() => createLastCard(localSeats(setup.seats, setup.difficulty), freshSeed(), { variant })} onExit={onExit} render={(p) => <LastCardGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={lastCardKit}
          gameId="last-card"
          title="Last Card"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={lcSeatColor}
          render={(p) => <LastCardGame {...p} />}
        />
      )}
    />
  );
}
