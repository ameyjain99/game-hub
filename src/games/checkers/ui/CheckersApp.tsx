import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { checkersKit, createCheckers } from '../engine';
import { CheckersGame } from './CheckersGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'checkers',
  title: 'Checkers',
  meta: '2 players · 15–30 min',
  localSeats: [2],
  onlineSeats: [2],
  defaultSeats: 2,
  difficulties: DIFFICULTIES,
};

const seatColor = (i: number) => (i === 0 ? '#8d97ab' : '#efe8da');

export function CheckersApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={checkersKit} init={() => createCheckers(localSeats(2, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <CheckersGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={checkersKit}
          gameId="checkers"
          title="Checkers"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={seatColor}
          render={(p) => <CheckersGame {...p} />}
        />
      )}
    />
  );
}
