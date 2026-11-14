import { useEffect, useState } from 'react';
import { LocalGame } from './LocalGame';
import { TicketToRideLanding } from './TicketToRideLanding';
import { TicketToRideProfile } from './TicketToRideProfile';
import { JoinRoomGate } from './JoinRoomGate';
import { OnlineGame, type OnlineIntent } from './online/OnlineGame';
import { clearSessionFor, loadSessionFor } from '../../../online/session-storage';

/** The start/join choice awaiting a name + avatar (the board is picked on the
 *  create page, so starting carries nothing yet). */
type Pending =
  | { kind: 'start' }
  | { kind: 'join'; code: string };

/** A step within the Ticket to Ride flow (the hub sits above this). */
type Step =
  | { kind: 'landing' }
  | { kind: 'profile'; pending: Pending }
  | { kind: 'online'; intent: OnlineIntent }
  | { kind: 'local' };

const GAME_ID = 'ticket-to-ride';
const BASE = '/ticket-to-ride';

/** Sub-segments that are app routes, not room codes. */
const RESERVED = new Set(['create', 'join', 'setup', 'play']);

/** The path a step owns. Online refines to `/<code>` once a room exists; local
 *  refines to `/setup` (setup) or `/play` (playing). A join link carries its
 *  room in the query (`/join?room=ABCD`) so it opens directly for a newcomer. */
function pathForStep(step: Step): string {
  switch (step.kind) {
    case 'landing':
      return BASE;
    case 'profile':
      return step.pending.kind === 'start' ? `${BASE}/create` : `${BASE}/join?room=${step.pending.code}`;
    case 'local':
      return `${BASE}/setup`;
    case 'online':
      return BASE; // OnlineGame reports the code; see syncCode below
  }
}

/** The sub-segment after `/ticket-to-ride/`, e.g. 'create', 'setup', or a room code. */
function subPath(): string {
  return window.location.pathname.replace(/^\/+/, '').split('/')[1] ?? '';
}

/** The `?room=` code on a join link, upper-cased. */
function roomQuery(): string | null {
  const r = new URLSearchParams(window.location.search).get('room');
  return r ? r.toUpperCase() : null;
}

/** The full path+query, for comparing against a step's target path. */
function currentPath(): string {
  return window.location.pathname + window.location.search;
}

/** The step a cold load lands on:
 *  - `/<code>` loads only when this browser belongs to that room (session code
 *    matches); otherwise it resumes this browser's own room, or lands.
 *  - a stored session always resumes its room.
 *  - `/setup`,`/play` → local; `/join?room=ABCD` → the join flow; everything
 *    else (`/create`, unknown, bare) → the landing. */
function stepFromUrl(): Step {
  const sub = subPath();
  const session = loadSessionFor(GAME_ID);
  if (sub && !RESERVED.has(sub)) {
    // A room-code path: resume only if it's the room we're actually in.
    if (session && session.code === sub.toUpperCase()) {
      return { kind: 'online', intent: { kind: 'resume' } };
    }
    // Not a member – fall back to our own room if we have one, else the landing
    // (the URL is corrected to the parent path on mount).
    return session ? { kind: 'online', intent: { kind: 'resume' } } : { kind: 'landing' };
  }
  if (session) return { kind: 'online', intent: { kind: 'resume' } };
  if (sub === 'setup' || sub === 'play') return { kind: 'local' };
  if (sub === 'create') return { kind: 'profile', pending: { kind: 'start' } };
  if (sub === 'join') {
    const code = roomQuery();
    // `/join` without a room is not a real page → treated as the landing (and the
    // URL is corrected to the parent path on mount).
    return code ? { kind: 'profile', pending: { kind: 'join', code } } : { kind: 'landing' };
  }
  return { kind: 'landing' };
}

/**
 * The whole Ticket to Ride experience below the hub: landing → (for online) a
 * name+avatar step → the room, or local play. Each step is reflected in the URL
 * (`/ticket-to-ride/create|join|setup|play|<code>`) so links are shareable and the
 * browser Back button works. Owns its own session; `onBackToHub` returns to the hub.
 */
export function TicketToRideApp({ onBackToHub }: { onBackToHub: () => void }) {
  const [step, setStep] = useState<Step>(stepFromUrl);

  /** Go to a step and push its path (online defers its `/<code>` to syncCode). */
  const navigate = (next: Step) => {
    if (next.kind !== 'online') {
      const path = pathForStep(next);
      if (currentPath() !== path) window.history.pushState({}, '', path);
    }
    setStep(next);
  };

  useEffect(() => {
    // On a resumed session, reflect the room code in the URL (so it's not just `/`).
    const s = loadSessionFor(GAME_ID);
    if (s) {
      window.history.replaceState({}, '', `${BASE}/${s.code}`);
    } else if (subPath() && !RESERVED.has(subPath())) {
      // A `/<code>` link this browser doesn't belong to → bounce to the landing.
      window.history.replaceState({}, '', BASE);
    } else if (subPath() === 'join' && !roomQuery()) {
      // `/join` with no room is not a real destination → bounce to the landing.
      window.history.replaceState({}, '', BASE);
    }
    // Back/forward within Ticket to Ride re-derives the step; leaving to the hub
    // is handled one level up (App).
    const onPop = () => {
      if (window.location.pathname.startsWith(BASE)) setStep(stepFromUrl());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exitToHub = () => {
    clearSessionFor(GAME_ID);
    onBackToHub();
  };

  /** OnlineGame reports its room code → URL becomes `/ticket-to-ride/<code>`. */
  const syncCode = (code: string | null) => {
    if (code && window.location.pathname !== `${BASE}/${code}`) {
      window.history.replaceState({}, '', `${BASE}/${code}`);
    }
  };
  /** LocalGame reports setup (`/setup`) vs in-progress (`/play`). */
  const syncLocalPhase = (inGame: boolean) => {
    const path = `${BASE}/${inGame ? 'play' : 'setup'}`;
    if (window.location.pathname !== path) window.history.replaceState({}, '', path);
  };

  if (step.kind === 'local')
    return (
      <LocalGame
        onBackToHub={exitToHub}
        onPlayOnline={() => navigate({ kind: 'landing' })}
        onPhase={syncLocalPhase}
      />
    );
  if (step.kind === 'online') return <OnlineGame intent={step.intent} onExit={exitToHub} onCode={syncCode} />;

  if (step.kind === 'profile') {
    const p = step.pending;
    // Joining first checks the room exists (JoinRoomGate); creating goes straight
    // to the name step.
    if (p.kind === 'join') {
      return (
        <JoinRoomGate
          code={p.code}
          onBack={() => navigate({ kind: 'landing' })}
          onSubmit={(name, avatar) =>
            navigate({ kind: 'online', intent: { kind: 'join', code: p.code, name, avatar } })
          }
        />
      );
    }
    return (
      <TicketToRideProfile
        action="start"
        onBack={() => navigate({ kind: 'landing' })}
        onSubmit={(name, avatar, seatCount, modeId, mapId) =>
          navigate({
            kind: 'online',
            intent: { kind: 'start', seatCount: seatCount!, name, avatar, mapId: mapId!, modeId },
          })
        }
      />
    );
  }

  return (
    <TicketToRideLanding
      onStart={() => navigate({ kind: 'profile', pending: { kind: 'start' } })}
      onJoin={(code) => navigate({ kind: 'profile', pending: { kind: 'join', code } })}
      onLocal={() => navigate({ kind: 'local' })}
      onBackToHub={exitToHub}
    />
  );
}
