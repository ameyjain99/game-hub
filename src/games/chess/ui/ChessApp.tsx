import { useState } from 'react';
import { KitApp, type KitAppConfig } from '../../kit/ui/KitApp';
import { KitLocal, freshSeed } from '../../kit/ui/KitLocal';
import { KitOnline } from '../../kit/ui/KitOnline';
import { chessKit, createChess, fallbackMove, type ChessAction, type ChessState } from '../engine';
import { ChessGame, COLOR_ACCENT } from './ChessGame';
import { ENGINE_LEVELS, engineLevel, parseUci, stockfish } from './stockfish';

const CONFIG: KitAppConfig = {
  gameId: 'chess',
  title: 'Chess',
  meta: '2 players · 10–60 min',
  localSeats: [2],
  onlineSeats: [2],
  defaultSeats: 2,
  difficulties: ENGINE_LEVELS.map((l) => ({ value: l.value, label: l.label })),
  difficultyLabel: 'Computer strength',
  defaultDifficulty: 'max',
};

type PlayAs = 'white' | 'black' | 'random';

/** Stockfish's reply for the computer's seat (a simple stand-in if it can't load). */
async function engineMove(s: ChessState): Promise<ChessAction> {
  const bot = s.players.find((p) => p.isAI);
  try {
    const uci = await stockfish().bestMove(
      s.moves.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`),
      engineLevel(bot?.difficulty),
    );
    return { type: 'MOVE', ...parseUci(uci) };
  } catch {
    return fallbackMove(s);
  }
}

export function ChessApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [playAs, setPlayAs] = useState<PlayAs>('white');
  return (
    <KitApp
      config={CONFIG}
      onBackToHub={onBackToHub}
      localExtra={
        <label className="g-field">
          <span className="g-field-label">You play</span>
          <select aria-label="You play" value={playAs} onChange={(e) => setPlayAs(e.target.value as PlayAs)}>
            <option value="white">White</option>
            <option value="black">Black</option>
            <option value="random">Random</option>
          </select>
        </label>
      }
      renderLocal={(setup, onExit) => (
        <KitLocal
          kit={chessKit}
          init={() => {
            const white = playAs === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : playAs;
            const seats = [
              { name: 'You', isAI: false },
              { name: 'Stockfish', isAI: true, difficulty: setup.difficulty },
            ];
            return createChess(seats, freshSeed(), { whiteSeat: white === 'white' ? 0 : 1 });
          }}
          asyncBot={engineMove}
          onExit={onExit}
          render={(p) => <ChessGame {...p} />}
        />
      )}
      renderOnline={(intent, onExit, onCode) => (
        <KitOnline
          kit={chessKit}
          gameId="chess"
          title="Chess"
          intent={intent}
          onExit={onExit}
          onCode={onCode}
          difficulties={[]}
          colorFor={(i) => (i === 0 ? COLOR_ACCENT.w : COLOR_ACCENT.b)}
          render={(p) => <ChessGame {...p} />}
        />
      )}
    />
  );
}
