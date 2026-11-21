import { useState } from 'react';
import { rulesFromSpec } from '../../../online/ui/LobbyRules';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { VARIANTS, createPoker, pokerKit, type Speed, type Variant } from '../engine';
import { PokerGame, pkSeatColor } from './PokerGame';
import { POKER_RULES } from '../rules';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const VARIANT_HINT: Record<Variant, string> = {
  holdem: 'Two cards each, five shared · No limit',
  omaha: 'Four cards each; use exactly two of them · Pot limit',
  shortdeck: '36 cards, 6 to ace; a flush beats a full house · No limit',
  stud: 'Seven cards each, four of them face up · Fixed limit',
  razz: 'Seven-card stud where the lowest hand wins · Fixed limit',
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const LOBBY_RULES = rulesFromSpec([
  { key: 'variant', label: 'Game', choices: (Object.keys(VARIANTS) as Variant[]).map((v) => ({ value: v, label: VARIANTS[v].name })) },
  {
    key: 'speed',
    label: 'Stakes rise',
    choices: [
      { value: 'normal', label: 'Every 10 hands' },
      { value: 'fast', label: 'Every 6 hands (fast)' },
      { value: 'slow', label: 'Every 15 hands (slow)' },
    ],
  },
]);

export function PokerApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [variant, setVariant] = useState<Variant>('holdem');
  const [speed, setSpeed] = useState<Speed>('normal');
  const max = VARIANTS[variant].maxSeats;
  const config: KitAppConfig = {
    gameId: 'poker',
    title: 'Poker',
    meta: `2-${max} players · 20-60 min`,
    localSeats: range(2, max),
    onlineSeats: range(2, max),
    defaultSeats: Math.min(6, max),
    difficulties: DIFFICULTIES,
    seatLabel: (n) => (n === 2 ? 'You + 1 bot' : `You + ${n - 1} bots`),
  };
  return (
    <KitApp
      config={config}
      onBackToHub={onBackToHub}
      rules={POKER_RULES}
      rulesVariant={variant}
      optionValue={{ variant, speed }}
      optionFields={
        <>
          <label className="g-field">
            <span className="g-field-label">Game</span>
            <select aria-label="Game" value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
              {(Object.keys(VARIANTS) as Variant[]).map((v) => (
                <option key={v} value={v}>
                  {VARIANTS[v].name}
                </option>
              ))}
            </select>
            <span className="g-hint pk-variant-hint">{VARIANT_HINT[variant]}</span>
          </label>
          <label className="g-field">
            <span className="g-field-label">Stakes rise</span>
            <select aria-label="Stakes rise" value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
              <option value="fast">Every 6 hands (fast)</option>
              <option value="normal">Every 10 hands</option>
              <option value="slow">Every 15 hands (slow)</option>
            </select>
          </label>
        </>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal kit={pokerKit} init={() => createPoker(localSeats(setup.seats, setup.difficulty), freshSeed(), { variant, speed })} onExit={onExit} render={(p) => <PokerGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={pokerKit}
          gameId="poker"
          title="Poker"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={pkSeatColor}
          rulesFor={LOBBY_RULES}
          render={(p) => <PokerGame {...p} />}
        />
      )}
    />
  );
}
