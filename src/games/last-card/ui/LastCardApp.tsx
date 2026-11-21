import { useState } from 'react';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createLastCard, lastCardKit, type Variant } from '../engine';
import { LastCardGame, lcSeatColor } from './LastCardGame';
import { LAST_CARD_RULES } from '../rules';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'last-card',
  title: 'Last Card',
  meta: '2-10 players · 15-30 min',
  localSeats: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  onlineSeats: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

const LOBBY_RULES = rulesFromSpec([
  {
    key: 'variant',
    label: 'Mode',
    choices: [
      { value: 'classic', label: 'Classic' },
      { value: 'flip', label: 'Flip (two-sided deck)' },
      { value: 'unlimited', label: 'No Mercy (endless stacking, 25 cards and you are out)' },
    ],
  },
  {
    key: 'stack',
    label: 'Stacking draw cards (always on in No Mercy)',
    choices: [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ],
  },
]);

export function LastCardApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [variant, setVariant] = useState<Variant>('classic');
  const [stack, setStack] = useState(false);
  return (
    <KitApp
      rules={LAST_CARD_RULES}
      rulesVariant={variant}
      config={CONFIG}
      onBackToHub={onBackToHub}
      optionValue={{ variant, stack }}
      optionFields={
        <>
        <label className="g-field">
          <span className="g-field-label">Mode</span>
          <select aria-label="Mode" value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
            <option value="classic">Classic</option>
            <option value="flip">Flip - two-sided deck, a light and a dark side</option>
            <option value="unlimited">No Mercy - harsher cards, endless stacking, 25 cards and you are out</option>
          </select>
        </label>
        <label className="g-switch-row">
          <span className="g-switch-text">
            <span>Stack draw cards</span>
            <span className="g-switch-desc">{variant === 'unlimited' ? 'Always on in No Mercy: answer any draw card with one as big or bigger' : 'Answer a Draw 2 with a Draw 2 (or a Wild Draw 4 with one) to pass the total on'}</span>
          </span>
          <input type="checkbox" role="switch" className="g-switch" checked={stack || variant === 'unlimited'} disabled={variant === 'unlimited'} onChange={() => setStack(!stack)} />
        </label>
        </>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={lastCardKit} init={() => createLastCard(localSeats(setup.seats, setup.difficulty), freshSeed(), { variant, stack })} onExit={onExit} render={(p) => <LastCardGame {...p} />} />
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
          rulesFor={LOBBY_RULES}
          render={(p) => <LastCardGame {...p} />}
        />
      )}
    />
  );
}
