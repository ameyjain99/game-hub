import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { PLAYER_COUNTS, createLineup, lineupKit, teamsFor } from '../engine';
import { LineupGame, TEAM_COLOR } from './LineupGame';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'lineup',
  title: 'Lineup',
  meta: '2–12 players · 20–30 min',
  localSeats: [2, 3, 4],
  onlineSeats: PLAYER_COUNTS,
  defaultSeats: 2,
  difficulties: DIFFICULTIES,
  seatLabel: (n) => (n === 2 ? 'You + 1 bot' : n === 3 ? 'You + 2 bots, each for themselves' : 'You + a bot partner, vs 2 bots'),
};

export function LineupApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      renderLocal={(setup, onExit) => (
        <KitLocal kit={lineupKit} init={() => createLineup(localSeats(setup.seats, setup.difficulty), freshSeed())} onExit={onExit} render={(p) => <LineupGame {...p} />} />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={lineupKit}
          gameId="lineup"
          title="Lineup"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={DIFFICULTIES}
          colorFor={(i, n) => TEAM_COLOR[i % teamsFor(n)]}
          render={(p) => <LineupGame {...p} />}
        />
      )}
    />
  );
}
