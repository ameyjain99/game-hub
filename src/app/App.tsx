import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { HubScreen } from './HubScreen';
import { TicketToRideApp } from '../games/ticket-to-ride/ui/TicketToRideApp';
import { CluedoApp } from '../games/cluedo/ui/CluedoApp';
import { MonopolyApp } from '../games/monopoly/ui/MonopolyApp';
import { loadSession } from '../online/session-storage';
import { GAMES } from '../games/registry';
import { Loader } from '../shared/Loader';

/** The top-level location: the hub, or a specific game by id. */
type Stage = { kind: 'hub' } | { kind: 'game'; gameId: string };

const HUB_PATH = '/';

type GameApp = ComponentType<{ onBackToHub: () => void }>;

/** Each playable game's flow. The newer games load on demand, in their own chunks. */
const GAME_APPS: Record<string, GameApp> = {
  'ticket-to-ride': TicketToRideApp,
  cluedo: CluedoApp,
  monopoly: MonopolyApp,
  'tic-tac-toe': lazy(() => import('../games/tic-tac-toe/ui/TicTacToeApp').then((m) => ({ default: m.TicTacToeApp }))),
  checkers: lazy(() => import('../games/checkers/ui/CheckersApp').then((m) => ({ default: m.CheckersApp }))),
  chess: lazy(() => import('../games/chess/ui/ChessApp').then((m) => ({ default: m.ChessApp }))),
  wordgrid: lazy(() => import('../games/wordgrid/ui/WordgridApp').then((m) => ({ default: m.WordgridApp }))),
  'last-card': lazy(() => import('../games/last-card/ui/LastCardApp').then((m) => ({ default: m.LastCardApp }))),
  blockyard: lazy(() => import('../games/blockyard/ui/BlockyardApp').then((m) => ({ default: m.BlockyardApp }))),
  minesweeper: lazy(() => import('../games/minesweeper/ui/MinesweeperApp').then((m) => ({ default: m.MinesweeperApp }))),
  sudoku: lazy(() => import('../games/sudoku/ui/SudokuApp').then((m) => ({ default: m.SudokuApp }))),
  solitaire: lazy(() => import('../games/solitaire/ui/SolitaireApp').then((m) => ({ default: m.SolitaireApp }))),
  lineup: lazy(() => import('../games/lineup/ui/LineupApp').then((m) => ({ default: m.LineupApp }))),
  ludo: lazy(() => import('../games/ludo/ui/LudoApp').then((m) => ({ default: m.LudoApp }))),
  'snakes-and-ladders': lazy(() =>
    import('../games/snakes-and-ladders/ui/SnakesAndLaddersApp').then((m) => ({ default: m.SnakesAndLaddersApp })),
  ),
};

/**
 * The stage a URL path maps to: a live game's path opens that game by id;
 * anything else is the hub. Each game owns its own internal steps.
 */
export function routeForPath(path: string): Stage {
  const id = path.replace(/^\/+/, '').split('/')[0];
  const game = GAMES.find((g) => g.id === id && g.status === 'live');
  return game ? { kind: 'game', gameId: game.id } : { kind: 'hub' };
}

/** Where to start: a URL that names a game opens that game; otherwise a stored
 *  online session resumes into its own game (reload reclaims the seat). */
export function initialRoute(): Stage {
  const fromUrl = routeForPath(window.location.pathname);
  if (fromUrl.kind === 'game') return fromUrl;
  const session = loadSession();
  if (session) return { kind: 'game', gameId: session.gameId ?? 'ticket-to-ride' };
  return fromUrl;
}

/**
 * Top-level router: the hub and each game live on their own URL path, so the
 * browser Back button works. Each game component manages its own flow below.
 */
export function App() {
  const [stage, setStage] = useState<Stage>(initialRoute);

  const navigate = (next: Stage, path: string) => {
    window.history.pushState({}, '', path);
    setStage(next);
  };

  // Keep the UI in sync when the user presses the browser Back/Forward button.
  useEffect(() => {
    const onPop = () => setStage(routeForPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const goHome = () => navigate({ kind: 'hub' }, HUB_PATH);

  const Game = stage.kind === 'game' ? GAME_APPS[stage.gameId] : undefined;
  if (Game) {
    return (
      <Suspense fallback={<Loader full label="Loading game..." />}>
        <Game onBackToHub={goHome} />
      </Suspense>
    );
  }

  // The hub – and the fallback for any game without a flow wired up yet.
  return (
    <HubScreen
      onSelect={(id) => navigate({ kind: 'game', gameId: id }, `/${id}`)}
      onJoin={(id, code) => navigate({ kind: 'game', gameId: id }, `/${id}/join?room=${code}`)}
    />
  );
}
