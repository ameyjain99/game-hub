import { useState } from 'react';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { SETS_TO_WIN, createMd, mdKit, type MdOptions } from '../engine';
import { MD_RULES } from '../rules';
import { MdGame, mdSeatColor } from './MdGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'monopoly-deal',
  title: 'Monopoly Deal',
  meta: '2-5 players · 15 min',
  localSeats: [2, 3, 4, 5],
  onlineSeats: [2, 3, 4, 5],
  defaultSeats: 3,
  difficulties: DIFFICULTIES,
};

type Switch = 'buildAnywhere' | 'oneDouble';
const SWITCHES: { key: Switch; label: string; desc: string }[] = [
  { key: 'buildAnywhere', label: 'Build on Railroads and Utilities', desc: 'Houses and Hotels may also be laid on full Railroad and Utility sets' },
  { key: 'oneDouble', label: 'One Double the Rent per Rent card', desc: 'Off: both Double the Rent cards may go on one Rent card, for four times the rent' },
];

const setsLabel = (n: number) => (n === 3 ? '3 sets (official)' : `${n} sets`);

const LOBBY_RULES = rulesFromSpec([
  { key: 'setsToWin', label: 'Sets to win', choices: SETS_TO_WIN.map((n) => ({ value: n, label: setsLabel(n) })) },
  ...SWITCHES.map((s) => ({
    key: s.key,
    label: s.label,
    choices: [
      { value: false, label: 'Off (official)' },
      { value: true, label: 'On' },
    ],
  })),
]);

export function MdApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [setsToWin, setSetsToWin] = useState(3);
  const [switches, setSwitches] = useState<Record<Switch, boolean>>({ buildAnywhere: false, oneDouble: false });
  const options: MdOptions = { setsToWin, ...switches };
  const changed = SWITCHES.filter((s) => switches[s.key]).length + (setsToWin === 3 ? 0 : 1);
  return (
    <KitApp
      rules={MD_RULES}
      config={CONFIG}
      onBackToHub={onBackToHub}
      optionValue={options}
      optionFields={
        <details className="g-disclosure">
          <summary>
            House rules
            <span className="g-disclosure-meta">{changed === 0 ? 'Official rules' : `${changed} changed`}</span>
          </summary>
          <div className="g-disclosure-body">
            <label className="g-field">
              <span className="g-field-label">Sets to win</span>
              <select aria-label="Sets to win" value={setsToWin} onChange={(e) => setSetsToWin(Number(e.target.value))}>
                {SETS_TO_WIN.map((n) => (
                  <option key={n} value={n}>
                    {setsLabel(n)}
                  </option>
                ))}
              </select>
            </label>
            {SWITCHES.map((s) => (
              <label key={s.key} className="g-switch-row">
                <span className="g-switch-text">
                  <span>{s.label}</span>
                  <span className="g-switch-desc">{s.desc}</span>
                </span>
                <input type="checkbox" role="switch" className="g-switch" aria-label={s.label} checked={switches[s.key]} onChange={() => setSwitches((v) => ({ ...v, [s.key]: !v[s.key] }))} />
              </label>
            ))}
          </div>
        </details>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={mdKit} init={() => createMd(localSeats(setup.seats, setup.difficulty), freshSeed(), options)} onExit={onExit} render={(p) => <MdGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={mdKit}
          gameId="monopoly-deal"
          title="Monopoly Deal"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={mdSeatColor}
          rulesFor={LOBBY_RULES}
          render={(p) => <MdGame {...p} />}
        />
      )}
    />
  );
}
