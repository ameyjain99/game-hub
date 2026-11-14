export interface StoredSession {
  code: string;
  token: string;
  playerId: string;
  /** Which game this session belongs to, so a reload resumes the right one. */
  gameId?: string;
}

const KEY = 'ttr:online';

export function saveSession(s: StoredSession): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof v?.code === 'string' && typeof v.token === 'string' && typeof v.playerId === 'string') {
      return { code: v.code, token: v.token, playerId: v.playerId, gameId: v.gameId };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

/** Sessions saved before gameId existed are Ticket to Ride's. */
const gameOf = (s: StoredSession): string => s.gameId ?? 'ticket-to-ride';

/** The stored session only if it belongs to `gameId` – a game must never resume
 *  (or render) another game's room. */
export function loadSessionFor(gameId: string): StoredSession | null {
  const s = loadSession();
  return s && gameOf(s) === gameId ? s : null;
}

/** Clear the stored session only if it belongs to `gameId`, so leaving one game
 *  never drops a seat held in another. */
export function clearSessionFor(gameId: string): void {
  if (loadSessionFor(gameId)) clearSession();
}
