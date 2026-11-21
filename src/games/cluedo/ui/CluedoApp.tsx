import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import type { CSSProperties } from 'react';
import type { LobbyPiece } from '../../../online/ui/OnlineLobby';
import { SUSPECTS } from '../engine/cards';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';
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

/** The six suspects, to pick who you play in the lobby. */
const SUSPECT_PIECES: LobbyPiece[] = SUSPECTS.map((s) => ({
  id: s,
  label: s,
  node: (
    <span className="g-piece-token" style={{ '--tc': SUSPECT_COLOR[s], color: inkOn(s) } as CSSProperties}>
      {suspectInitial(s)}
    </span>
  ),
}));

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
          pieces={SUSPECT_PIECES}
          render={(p) => <CluedoGame {...p} />}
        />
      )}
    />
  );
}
