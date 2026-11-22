import { useState } from 'react';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { MAX_SEATS, MIN_SEATS, MODES, createImposter, imposterKit, type CluesSetting, type Mode, type RoundsSetting } from '../engine';
import { IMPOSTER_RULES } from '../rules';
import { ImposterGame, imSeatColor } from './ImposterGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const LOBBY_RULES = rulesFromSpec([
  { key: 'mode', label: 'Mode', choices: (Object.keys(MODES) as Mode[]).map((m) => ({ value: m, label: MODES[m].name })) },
  {
    key: 'rounds',
    label: 'Rounds',
    choices: [
      { value: 5, label: '5 rounds' },
      { value: 3, label: '3 rounds' },
      { value: 'each', label: 'One per player' },
    ],
  },
  {
    key: 'clues',
    label: 'Clues each round',
    choices: [
      { value: 2, label: '2 per player' },
      { value: 1, label: '1 per player (quick)' },
      { value: 3, label: '3 per player (long)' },
    ],
  },
]);

export function ImposterApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [mode, setMode] = useState<Mode>('classic');
  const [rounds, setRounds] = useState<RoundsSetting>(5);
  const [clues, setClues] = useState<CluesSetting>(2);
  const options = { mode, rounds, clues };
  const config: KitAppConfig = {
    gameId: 'imposter',
    title: 'Imposter',
    meta: `${MIN_SEATS}-${MAX_SEATS} players · 10-20 min`,
    localSeats: range(MIN_SEATS, MAX_SEATS),
    onlineSeats: range(MIN_SEATS, MAX_SEATS),
    defaultSeats: 5,
    difficulties: DIFFICULTIES,
  };
  return (
    <KitApp
      config={config}
      onBackToHub={onBackToHub}
      rules={IMPOSTER_RULES}
      rulesVariant={mode}
      optionValue={options}
      localSummary={LOBBY_RULES(options, null).summary}
      optionFields={
        <>
          <label className="g-field">
            <span className="g-field-label">Mode</span>
            <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              {(Object.keys(MODES) as Mode[]).map((m) => (
                <option key={m} value={m}>
                  {MODES[m].name}
                </option>
              ))}
            </select>
            <span className="g-hint">{MODES[mode].hint}</span>
          </label>
          <label className="g-field">
            <span className="g-field-label">Rounds</span>
            <select aria-label="Rounds" value={String(rounds)} onChange={(e) => setRounds(e.target.value === 'each' ? 'each' : (Number(e.target.value) as 3 | 5))}>
              <option value="3">3 rounds</option>
              <option value="5">5 rounds</option>
              <option value="each">One per player (everyone is the imposter once)</option>
            </select>
          </label>
          <label className="g-field">
            <span className="g-field-label">Clues each round</span>
            <select aria-label="Clues each round" value={clues} onChange={(e) => setClues(Number(e.target.value) as CluesSetting)}>
              <option value={1}>1 per player (quick)</option>
              <option value={2}>2 per player</option>
              <option value={3}>3 per player (long)</option>
            </select>
          </label>
        </>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={imposterKit} init={() => createImposter(localSeats(setup.seats, setup.difficulty), freshSeed(), options)} onExit={onExit} render={(p) => <ImposterGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={imposterKit}
          gameId="imposter"
          title="Imposter"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={imSeatColor}
          rulesFor={LOBBY_RULES}
          render={(p) => <ImposterGame {...p} />}
        />
      )}
    />
  );
}
