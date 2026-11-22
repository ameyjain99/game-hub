import { useState } from 'react';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { HAND_SIZES, createEk, ekKit, type EkOptions } from '../engine';
import { EK_RULES } from '../rules';
import { EkGame, ekSeatColor } from './EkGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'exploding-kittens',
  title: 'Exploding Kittens',
  meta: '2-5 players · 15 min',
  localSeats: [2, 3, 4, 5],
  onlineSeats: [2, 3, 4, 5],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

type Switch = 'anyCombos' | 'stackAttacks' | 'shortGame';
/** The switches a table can flip; `standard` is the official rule. */
const SWITCHES: { key: Switch; label: string; desc: string; standard: boolean }[] = [
  { key: 'anyCombos', label: 'Combos with any cards', desc: 'Any two or three matching cards, and five different cards, make a combo. Off: only Cat Cards pair', standard: true },
  { key: 'stackAttacks', label: 'Attacks stack', desc: 'Attack while under attack and the next player takes your remaining turns plus 2. Off: always 2', standard: true },
  { key: 'shortGame', label: 'Short game', desc: 'A third of the draw pile is set aside unseen before the Kittens go in', standard: false },
];

const handLabel = (n: number) => (n === 7 ? '7 (official)' : String(n));

const LOBBY_RULES = rulesFromSpec([
  { key: 'handSize', label: 'Cards dealt', choices: HAND_SIZES.map((n) => ({ value: n, label: handLabel(n) })) },
  ...SWITCHES.map((s) => ({
    key: s.key,
    label: s.label,
    choices: [s.standard, !s.standard].map((on) => ({ value: on, label: `${on ? 'On' : 'Off'}${on === s.standard ? ' (official)' : ''}` })),
  })),
]);

export function EkApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [handSize, setHandSize] = useState(7);
  const [switches, setSwitches] = useState<Record<Switch, boolean>>({ anyCombos: true, stackAttacks: true, shortGame: false });
  const options: EkOptions = { handSize, ...switches };
  const changed = SWITCHES.filter((s) => switches[s.key] !== s.standard).length + (handSize === 7 ? 0 : 1);
  return (
    <KitApp
      rules={EK_RULES}
      config={CONFIG}
      onBackToHub={onBackToHub}
      optionValue={options}
      localSummary={LOBBY_RULES(options, null).summary}
      optionFields={
        <details className="g-disclosure">
          <summary>
            House rules
            <span className="g-disclosure-meta">{changed === 0 ? 'Official rules' : `${changed} changed`}</span>
          </summary>
          <div className="g-disclosure-body">
            <label className="g-field">
              <span className="g-field-label">Cards dealt</span>
              <select aria-label="Cards dealt" value={handSize} onChange={(e) => setHandSize(Number(e.target.value))}>
                {HAND_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {handLabel(n)}
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
        <KitLocal kit={ekKit} init={() => createEk(localSeats(setup.seats, setup.difficulty), freshSeed(), options)} onExit={onExit} render={(p) => <EkGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={ekKit}
          gameId="exploding-kittens"
          title="Exploding Kittens"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={ekSeatColor}
          rulesFor={LOBBY_RULES}
          render={(p) => <EkGame {...p} />}
        />
      )}
    />
  );
}
