import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { createTtt, ticTacToeKit } from '../engine';
import { MARK_COLOR, TttGame } from './TttGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Perfect (never loses)' },
];

const CONFIG: KitAppConfig = {
  gameId: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  meta: '2 players · 1–2 min a round',
  localSeats: [2],
  onlineSeats: [2],
  defaultSeats: 2,
  difficulties: DIFFICULTIES,
};

const seatColor = (i: number) => (i === 0 ? MARK_COLOR.X : MARK_COLOR.O);

export function TicTacToeApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={ticTacToeKit} init={() => createTtt(localSeats(2, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <TttGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={ticTacToeKit}
          gameId="tic-tac-toe"
          title="Tic-Tac-Toe"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={seatColor}
          render={(p) => <TttGame {...p} />}
        />
      )}
    />
  );
}
