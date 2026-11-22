import { useState } from 'react';
import type { UnoOptions } from '../engine';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createUno, unoKit, type Variant } from '../engine';
import { UnoGame, unoSeatColor } from './UnoGame';
import { UNO_RULES } from '../rules';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'uno',
  title: 'Uno',
  meta: '2-10 players · 15-30 min',
  localSeats: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  onlineSeats: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

type HouseKey = Exclude<keyof UnoOptions, 'variant'>;
/** The house rules a table can switch on. No Mercy plays with most of them built in. */
const HOUSE: { key: HouseKey; label: string; desc: string; inNoMercy: boolean }[] = [
  { key: 'stack', label: 'Stack draw cards', desc: 'Answer a draw card with one as big or bigger to pass the total on', inNoMercy: true },
  { key: 'together', label: 'Same numbers together', desc: 'Play several cards of one number in a single turn; the last sets the colour', inNoMercy: false },
  { key: 'freeWild', label: 'Wild Draw any time', desc: 'Play a Wild Draw 4 (or Wild Draw 2) even when you hold the colour in play', inNoMercy: true },
  { key: 'drawToMatch', label: 'Draw until you can play', desc: 'With nothing to play, keep drawing until a card fits, then you must play it', inNoMercy: true },
  { key: 'sevenZero', label: 'Sevens and zeros', desc: 'A 7 swaps hands with a player you choose; a 0 passes every hand on', inNoMercy: true },
];

const LOBBY_RULES = rulesFromSpec([
  {
    key: 'variant',
    label: 'Mode',
    choices: [
      { value: 'classic', label: 'Classic' },
      { value: 'flip', label: 'Flip (two-sided deck)' },
      { value: 'no-mercy', label: 'No Mercy (endless stacking, 25 cards and you are out)' },
    ],
  },
  ...HOUSE.map((h) => ({
    key: h.key,
    label: h.inNoMercy ? `${h.label} (always on in No Mercy)` : h.label,
    choices: [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ],
  })),
]);

export function UnoApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [variant, setVariant] = useState<Variant>('classic');
  const [house, setHouse] = useState<Record<HouseKey, boolean>>({ stack: false, together: false, freeWild: false, drawToMatch: false, sevenZero: false });
  const options: UnoOptions = { variant, ...house };
  const on = HOUSE.filter((h) => house[h.key] || (h.inNoMercy && variant === 'no-mercy')).length;
  return (
    <KitApp
      rules={UNO_RULES}
      rulesVariant={variant}
      config={CONFIG}
      onBackToHub={onBackToHub}
      optionValue={options}
      optionFields={
        <>
        <label className="g-field">
          <span className="g-field-label">Mode</span>
          <select aria-label="Mode" value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
            <option value="classic">Classic</option>
            <option value="flip">Flip - two-sided deck, a light and a dark side</option>
            <option value="no-mercy">No Mercy - harsher cards, endless stacking, 25 cards and you are out</option>
          </select>
        </label>
        <details className="g-disclosure">
          <summary>
            House rules
            <span className="g-disclosure-meta">{on} on</span>
          </summary>
          <div className="g-disclosure-body">
            {HOUSE.map((h) => {
              const forced = h.inNoMercy && variant === 'no-mercy';
              return (
                <label key={h.key} className="g-switch-row">
                  <span className="g-switch-text">
                    <span>{h.label}</span>
                    <span className="g-switch-desc">{forced ? `Always on in No Mercy. ${h.desc}` : h.desc}</span>
                  </span>
                  <input type="checkbox" role="switch" className="g-switch" aria-label={h.label} checked={house[h.key] || forced} disabled={forced} onChange={() => setHouse((v) => ({ ...v, [h.key]: !v[h.key] }))} />
                </label>
              );
            })}
          </div>
        </details>
        </>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={unoKit} init={() => createUno(localSeats(setup.seats, setup.difficulty), freshSeed(), options)} onExit={onExit} render={(p) => <UnoGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={unoKit}
          gameId="uno"
          title="Uno"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={unoSeatColor}
          rulesFor={LOBBY_RULES}
          render={(p) => <UnoGame {...p} />}
        />
      )}
    />
  );
}
