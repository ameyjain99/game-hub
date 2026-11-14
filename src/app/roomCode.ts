/** A game's sub-paths that are app routes, never room codes. */
const ROUTES = new Set(['CREATE', 'JOIN', 'SETUP', 'PLAY']);

/**
 * The room code in what someone typed or pasted: a bare code ("mv67"), an
 * invite link (`.../chess/join?room=MV67`) or a room's own address
 * (`.../chess/MV67`). Upper-cased and at most four characters; empty when a
 * link names no room.
 */
export function codeFrom(text: string): string {
  const t = text.trim();
  if (!/[/?=]/.test(t)) return t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const query = t.match(/[?&]room=([A-Za-z0-9]{4})(?![A-Za-z0-9])/);
  if (query) return query[1].toUpperCase();
  const last = (t.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '').toUpperCase();
  return /^[A-Z0-9]{4}$/.test(last) && !ROUTES.has(last) ? last : '';
}
