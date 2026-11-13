import { useCallback, useEffect, useState } from 'react';
import { clearSessionFor, loadSessionFor } from './session-storage';
import type { OnlineIntent } from './useOnlineSession';

/** A step in a game's flow below the hub, each with its own URL:
 *  `/<game>` landing · `/<game>/create` · `/<game>/join?room=CODE` ·
 *  `/<game>/<CODE>` online room · `/<game>/play` local game. */
export type GameStep =
  | { kind: 'landing' }
  | { kind: 'create' }
  | { kind: 'join'; code: string }
  | { kind: 'online'; intent: OnlineIntent }
  | { kind: 'local' };

/** Sub-paths that are app routes, never room codes. */
const RESERVED = new Set(['create', 'join', 'setup', 'play']);

const subPath = (): string => window.location.pathname.replace(/^\/+/, '').split('/')[1] ?? '';
const roomQuery = (): string | null => {
  const r = new URLSearchParams(window.location.search).get('room');
  return r ? r.toUpperCase() : null;
};

function pathFor(base: string, step: GameStep): string {
  switch (step.kind) {
    case 'landing':
    case 'online': // refined to /<code> once the room reports it (syncCode)
      return base;
    case 'create':
      return `${base}/create`;
    case 'join':
      return `${base}/join?room=${step.code}`;
    case 'local':
      return `${base}/play`;
  }
}

/** The step a cold load lands on. A stored session for this game always
 *  resumes its room; a `/<code>` link we don't belong to, or a bare `/join`,
 *  falls back to the landing (and the URL is corrected on mount). */
function stepFromUrl(gameId: string): GameStep {
  const sub = subPath();
  if (loadSessionFor(gameId)) return { kind: 'online', intent: { kind: 'resume' } };
  if (sub === 'create') return { kind: 'create' };
  if (sub === 'setup' || sub === 'play') return { kind: 'local' };
  if (sub === 'join') {
    const code = roomQuery();
    return code ? { kind: 'join', code } : { kind: 'landing' };
  }
  return { kind: 'landing' };
}

/**
 * URL-backed navigation for a game's own flow, so every screen is a shareable,
 * refresh-safe link and the browser Back button works. Shared by Monopoly and
 * Cluedo (same contract as Ticket to Ride's routing).
 */
export function useGameRoute(gameId: string, onBackToHub: () => void) {
  const base = `/${gameId}`;
  const [step, setStep] = useState<GameStep>(() => stepFromUrl(gameId));

  const navigate = useCallback(
    (next: GameStep) => {
      if (next.kind !== 'online') {
        const path = pathFor(base, next);
        if (window.location.pathname + window.location.search !== path) window.history.pushState({}, '', path);
      }
      setStep(next);
    },
    [base],
  );

  useEffect(() => {
    const session = loadSessionFor(gameId);
    if (session) {
      window.history.replaceState({}, '', `${base}/${session.code}`);
    } else if (subPath() && !RESERVED.has(subPath())) {
      window.history.replaceState({}, '', base); // a /<code> this browser isn't in
    } else if (subPath() === 'join' && !roomQuery()) {
      window.history.replaceState({}, '', base); // /join with no room
    }
    const onPop = () => {
      if (window.location.pathname.startsWith(base)) setStep(stepFromUrl(gameId));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [base, gameId]);

  /** The online room reports its code → the URL becomes `/<game>/<code>`. */
  const syncCode = useCallback(
    (code: string | null) => {
      if (code && window.location.pathname !== `${base}/${code}`) {
        window.history.replaceState({}, '', `${base}/${code}`);
      }
    },
    [base],
  );

  /** Leave to the hub, giving up this game's seat (never another game's). */
  const exit = useCallback(() => {
    clearSessionFor(gameId);
    onBackToHub();
  }, [gameId, onBackToHub]);

  return { step, navigate, syncCode, exit };
}
