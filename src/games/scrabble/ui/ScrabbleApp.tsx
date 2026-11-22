import { useEffect, useState, type ReactNode } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { Loader } from '../../../shared/Loader';
import { getDictionary, loadDictionary } from '../dictionary';
import { createScrabble, scrabbleKit } from '../engine';
import { ScrabbleGame, scrabbleSeatColor } from './ScrabbleGame';
import { SCRABBLE_RULES } from '../rules';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard (best word every turn)' },
];

const CONFIG: KitAppConfig = {
  gameId: 'scrabble',
  title: 'Scrabble',
  meta: '2-4 players · 45-90 min',
  localSeats: [2, 3, 4],
  onlineSeats: [2, 3, 4],
  defaultSeats: 2,
  difficulties: DIFFICULTIES,
};

/** Hold the game until the word list (≈1.7 MB) has loaded. */
function WithDictionary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !!getDictionary());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (ready) return;
    loadDictionary().then(
      () => setReady(true),
      (e: Error) => setError(e.message),
    );
  }, [ready]);
  if (error) return <Loader full label={`Couldn't load the word list (${error}). Refresh to try again.`} />;
  if (!ready) return <Loader full label="Loading the dictionary..." />;
  return <>{children}</>;
}

export function ScrabbleApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      rules={SCRABBLE_RULES}
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <WithDictionary>
          <KitLocal kit={scrabbleKit} init={() => createScrabble(localSeats(setup.seats, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <ScrabbleGame {...p} />} />
        </WithDictionary>
      )}
      renderOnline={(intent, onExit, onCode) => (
        <WithDictionary>
          <KitOnline
            kit={scrabbleKit}
            gameId="scrabble"
            title="Scrabble"
            intent={intent}
            onExit={onExit}
            onCode={onCode}
            difficulties={DIFFICULTIES}
            colorFor={scrabbleSeatColor}
            render={(p) => <ScrabbleGame {...p} />}
          />
        </WithDictionary>
      )}
    />
  );
}
