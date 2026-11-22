import { useState } from 'react';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createCatan, catanKit, type CatanMode } from '../engine';
import { CATAN_RULES } from '../rules';
import { CatanGame, catanSeatColor } from './CatanGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const MODES: Record<CatanMode, { name: string; hint: string; seats: number[] }> = {
  base: { name: 'Catan', hint: 'The island game · 10 points wins · 5-6 players get a larger island', seats: [3, 4, 5, 6] },
  seafarers: { name: 'Seafarers', hint: 'Ships, a pirate, gold fields and outer islands to reach · 13 points wins', seats: [3, 4] },
  'cities-knights': { name: 'Cities & Knights', hint: 'Commodities, city improvements, knights and the barbarian ship · 13 points wins', seats: [3, 4] },
};

const LOBBY_RULES = rulesFromSpec([
  { key: 'mode', label: 'Expansion', choices: (Object.keys(MODES) as CatanMode[]).map((m) => ({ value: m, label: MODES[m].name })) },
]);

export function CatanApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [mode, setMode] = useState<CatanMode>('base');
  const config: KitAppConfig = {
    gameId: 'catan',
    title: 'Catan',
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
      rules={CATAN_RULES}
      rulesVariant={mode === 'base' ? 'standard' : mode}
      optionValue={{ mode }}
      localSummary={LOBBY_RULES({ mode }, null).summary}
      optionFields={
        <label className="g-field">
          <span className="g-field-label">Expansion</span>
          <select aria-label="Expansion" value={mode} onChange={(e) => setMode(e.target.value as CatanMode)}>
            {(Object.keys(MODES) as CatanMode[]).map((m) => (
              <option key={m} value={m}>
                {MODES[m].name}
              </option>
            ))}
          </select>
          <span className="g-hint">{MODES[mode].hint}</span>
        </label>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={catanKit} init={() => createCatan(localSeats(setup.seats, setup.difficulty), freshSeed(), { mode })} onExit={onExit} render={(p) => <CatanGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={catanKit}
          gameId="catan"
          title="Catan"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={catanSeatColor}
          rulesFor={LOBBY_RULES}
          render={(p) => <CatanGame {...p} />}
        />
      )}
    />
  );
}
