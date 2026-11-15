import { useState } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createHexstead, hexKit, type HxMode } from '../engine';
import { HEXSTEAD_RULES } from '../rules';
import { HexsteadGame, hxSeatColor } from './HexsteadGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const MODES: Record<HxMode, { name: string; hint: string; seats: number[] }> = {
  base: { name: 'Hexstead', hint: 'The island game · 10 points wins · 5-6 players get a larger island', seats: [3, 4, 5, 6] },
  sea: { name: 'Open Sea', hint: 'Ships, a corsair, goldfields and outer islands to reach · 13 points wins', seats: [3, 4] },
  wardens: { name: 'Wardens', hint: 'Commodities, guild improvements, wardens and the marauder fleet · 13 points wins', seats: [3, 4] },
};

export function HexsteadApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [mode, setMode] = useState<HxMode>('base');
  const config: KitAppConfig = {
    gameId: 'hexstead',
    title: 'Hexstead',
    meta: '3-6 players · 45-120 min',
    localSeats: MODES[mode].seats,
    onlineSeats: MODES[mode].seats,
    defaultSeats: 4,
    difficulties: DIFFICULTIES,
  };
  return (
    <KitApp
      config={config}
      onBackToHub={onBackToHub}
      rules={HEXSTEAD_RULES}
      rulesVariant={mode === 'base' ? 'standard' : mode}
      optionValue={{ mode }}
      optionFields={
        <label className="g-field">
          <span className="g-field-label">Expansion</span>
          <select aria-label="Expansion" value={mode} onChange={(e) => setMode(e.target.value as HxMode)}>
            {(Object.keys(MODES) as HxMode[]).map((m) => (
              <option key={m} value={m}>
                {MODES[m].name}
              </option>
            ))}
          </select>
          <span className="g-hint">{MODES[mode].hint}</span>
        </label>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={hexKit} init={() => createHexstead(localSeats(setup.seats, setup.difficulty), freshSeed(), { mode })} onExit={onExit} render={(p) => <HexsteadGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={hexKit}
          gameId="hexstead"
          title="Hexstead"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={hxSeatColor}
          render={(p) => <HexsteadGame {...p} />}
        />
      )}
    />
  );
}
