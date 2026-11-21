import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import type { CSSProperties } from 'react';
import type { LobbyPiece } from '../../../online/ui/OnlineLobby';
import { KitLocal, freshSeed, localSeats } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { COLORS, colorsFor, createLudo, ludoKit } from '../engine';
import { LUDO_COLOR, LudoGame } from './LudoGame';
import { LUDO_RULES } from '../rules';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

const CONFIG: KitAppConfig = {
  gameId: 'ludo',
  title: 'Ludo',
  meta: '2-4 players · 20-40 min',
  localSeats: [2, 3, 4],
  onlineSeats: [2, 3, 4],
  defaultSeats: 4,
  difficulties: DIFFICULTIES,
};

// Lobby seat colours follow a four-seat table (a smaller table re-seats at start).
const seatColor = (i: number) => LUDO_COLOR[colorsFor(4)[i % 4]];

/** The four colours, to pick yours in the lobby. */
const COLOUR_PIECES: LobbyPiece[] = COLORS.map((c) => ({
  id: c,
  label: c.charAt(0).toUpperCase() + c.slice(1),
  node: <span className="g-piece-token" style={{ '--tc': LUDO_COLOR[c] } as CSSProperties} />,
}));

export function LudoApp({ onBackToHub }: { onBackToHub: () => void }) {
  return (
    <KitApp
      rules={LUDO_RULES}
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
          pieces={COLOUR_PIECES}
          render={(p) => <LudoGame {...p} />}
        />
      )}
    />
  );
}
