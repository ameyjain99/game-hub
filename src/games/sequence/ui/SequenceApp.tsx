import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { PLAYER_COUNTS, createSequence, sequenceKit, teamsFor } from '../engine';
import { SequenceGame, TEAM_COLOR } from './SequenceGame';
import { SEQUENCE_RULES } from '../rules';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'sequence',
  title: 'Sequence',
  meta: '2-12 players · 20-30 min',
  localSeats: [2, 3, 4],
  onlineSeats: PLAYER_COUNTS,
  defaultSeats: 2,
  difficulties: DIFFICULTIES,
  seatLabel: (n) => (n === 2 ? 'You + 1 bot' : n === 3 ? 'You + 2 bots, each for themselves' : 'You + a bot partner, vs 2 bots'),
};

export function SequenceApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      rules={SEQUENCE_RULES}
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={sequenceKit} init={() => createSequence(localSeats(setup.seats, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <SequenceGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={sequenceKit}
          gameId="sequence"
          title="Sequence"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={(i, n) => TEAM_COLOR[i % teamsFor(n)]}
          render={(p) => <SequenceGame {...p} />}
        />
      )}
    />
  );
}
