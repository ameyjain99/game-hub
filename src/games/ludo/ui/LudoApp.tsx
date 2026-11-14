import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { colorsFor, createLudo, ludoKit } from '../engine';
import { LUDO_COLOR, LudoGame } from './LudoGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'ludo',
  title: 'Ludo',
  meta: '2–4 players · 20–40 min',
  localSeats: [2, 3, 4],
  onlineSeats: [2, 3, 4],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

// Lobby seat colours follow a four-seat table (a smaller table re-seats at start).
const seatColor = (i: number) => LUDO_COLOR[colorsFor(4)[i % 4]];

export function LudoApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={ludoKit} init={() => createLudo(localSeats(setup.seats, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <LudoGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={ludoKit}
          gameId="ludo"
          title="Ludo"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={seatColor}
          render={(p) => <LudoGame {...p} />}
        />
      )}
    />
  );
}
