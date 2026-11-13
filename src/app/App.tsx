import { useEffect, useState } from 'react';
import { HubScreen } from './HubScreen';
import { TicketToRideApp } from '../games/ticket-to-ride/ui/TicketToRideApp';
import { CluedoApp } from '../games/cluedo/ui/CluedoApp';
import { MonopolyApp } from '../games/monopoly/ui/MonopolyApp';
import { loadSession } from '../online/session-storage';
import { GAMES } from '../games/registry';

/** The top-level location: the hub, or a specific game by id. */
type Stage = { kind: 'hub' } | { kind: 'game'; gameId: string };

const HUB_PATH = '/';

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

  if (stage.kind === 'game' && stage.gameId === 'ticket-to-ride') {
    return <TicketToRideApp onBackToHub={goHome} />;
  }
  if (stage.kind === 'game' && stage.gameId === 'cluedo') {
    return <CluedoApp onBackToHub={goHome} />;
  }
  if (stage.kind === 'game' && stage.gameId === 'monopoly') {
    return <MonopolyApp onBackToHub={goHome} />;
  }

  // The hub — and the fallback for any game without a flow wired up yet.
  return <HubScreen onSelect={(id) => navigate({ kind: 'game', gameId: id }, `/${id}`)} />;
}
