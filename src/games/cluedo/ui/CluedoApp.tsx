import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { MAX_SEATS, MIN_SEATS, cluedoKit, createCluedo } from '../engine';
import { CLUEDO_RULES } from '../rules';
import { CluedoGame, clSeatColor } from './CluedoGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const config: KitAppConfig = {
  gameId: 'cluedo',
  title: 'Cluedo',
  meta: `${MIN_SEATS}-${MAX_SEATS} players · 20-45 min`,
  localSeats: range(MIN_SEATS, MAX_SEATS),
  onlineSeats: range(MIN_SEATS, MAX_SEATS),
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

export function CluedoApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={config}
      onBackToHub={onBackToHub}
      rules={CLUEDO_RULES}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={cluedoKit} init={() => createCluedo(localSeats(setup.seats, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <CluedoGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={cluedoKit}
          gameId="cluedo"
          title="Cluedo"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={clSeatColor}
          render={(p) => <CluedoGame {...p} />}
        />
      )}
    />
  );
}
