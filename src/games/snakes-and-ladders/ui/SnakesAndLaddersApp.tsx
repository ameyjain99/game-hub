import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createSnl, snlKit } from '../engine';
import { SnlGame, snlColor } from './SnlGame';

// The dice decide everything, so bots have one level.
const DIFFICULTIES = [{ value: 'normal', label: 'Bot' }];

const CONFIG: KitAppConfig = {
  gameId: 'snakes-and-ladders',
  title: 'Snakes & Ladders',
  meta: '2–6 players · 10–20 min',
  localSeats: [2, 3, 4, 5, 6],
  onlineSeats: [2, 3, 4, 5, 6],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

export function SnakesAndLaddersApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={snlKit} init={() => createSnl(localSeats(setup.seats, 'normal'), freshSeed())} onExit={onExit} render={(p) => <SnlGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={snlKit}
          gameId="snakes-and-ladders"
          title="Snakes & Ladders"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={snlColor}
          render={(p) => <SnlGame {...p} />}
        />
      )}
    />
  );
}
