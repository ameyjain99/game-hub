import { beforeEach, expect, test } from 'vitest';
import { RoomStore } from '../../server/rooms';
import { AVATARS } from '../../src/games/ticket-to-ride/ui/avatars';
import type { GameState, Hand } from '../../src/games/ticket-to-ride/engine/types';

let store: RoomStore;
// The store returns game-agnostic state; these are all Ticket to Ride rooms.
const viewer = (code: string, pid: string): GameState | null =>
  store.stateForViewer(code, pid) as GameState | null;
beforeEach(() => {
  store = new RoomStore();
});

const token = (r: { token: string } | { error: string }): string => {
  if ('error' in r) throw new Error(`expected ok, got error: ${r.error}`);
  return r.token;
};

const sum = (h: Hand): number => Object.values(h).reduce((a, b) => a + b, 0);

/** Confirm both players' starting tickets so the game reaches the turn phase. */
function finishSetup(code: string, hostTok: string, guestTok: string): void {
  for (const [tok, pid] of [
    [hostTok, 'p0'],
    [guestTok, 'p1'],
  ] as const) {
    const me = viewer(code, pid)!.players.find((p) => p.id === pid)!;
    store.submitAction(code, tok, {
      type: 'CONFIRM_SETUP_TICKETS',
      playerId: pid,
      keptIds: me.pendingTickets.slice(0, 2).map((t) => t.id),
    });
  }
}

test('createRoom yields a 4-char code and seats the host at 0', () => {
  const r = store.createRoom(3, 'Amey', '');
  expect(r.code).toMatch(/^[A-Z2-9]{4}$/);
  expect(r.playerId).toBe('p0');
  expect(store.lobbyView(r.code).seats[0].name).toBe('Amey');
});

test('join assigns a free avatar when the requested one is already taken', () => {
  const { code } = store.createRoom(3, 'host', AVATARS[0]);
  store.join(code, 'guest', AVATARS[0]); // wants the host's avatar
  const seats = store.lobbyView(code).seats;
  expect(seats[0].avatar).toBe(AVATARS[0]);
  expect(seats[1].avatar).not.toBe(AVATARS[0]);
  expect(seats[1].avatar).not.toBe('');
});

test('setAvatar rejects a taken avatar but accepts a free one', () => {
  const { code } = store.createRoom(3, 'host', AVATARS[0]);
  const guestTok = token(store.join(code, 'guest', AVATARS[1]));
  expect(store.setAvatar(code, guestTok, AVATARS[0])).toEqual({ error: expect.any(String) });
  const ok = store.setAvatar(code, guestTok, AVATARS[2]);
  expect('error' in ok).toBe(false);
  expect(store.lobbyView(code).seats[1].avatar).toBe(AVATARS[2]);
});

test('adding an AI gives it a free avatar distinct from the humans', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', AVATARS[0]);
  store.setSeatAi(code, hostTok, 1, true, 'normal');
  const ai = store.lobbyView(code).seats[1];
  expect(ai.isAI).toBe(true);
  expect(ai.avatar).not.toBe('');
  expect(ai.avatar).not.toBe(AVATARS[0]);
});

test('createRoom rejects out-of-range seat counts', () => {
  expect(() => store.createRoom(1, 'x', '')).toThrow();
  expect(() => store.createRoom(6, 'x', '')).toThrow();
});

// Review Focus #2
test('join errors on unknown / full / started room', () => {
  expect(store.join('ZZZZ', 'x', '')).toEqual({ error: expect.any(String) });
  const { code } = store.createRoom(2, 'host', '');
  store.join(code, 'p2', ''); // fills seat 1
  expect(store.join(code, 'late', '')).toEqual({ error: expect.any(String) });
});

// Review Focus #3
test('reconnect rejects an unknown token without touching the seat', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  expect(store.reconnect(code, 'bogus')).toEqual({ error: expect.any(String) });
  expect(store.reconnect(code, hostTok)).toEqual({ playerId: 'p0' });
});

// Review Focus #4
test('start rejects while a seat is unfilled, succeeds once AI-filled', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  expect(store.start(code, hostTok)).toEqual({ error: expect.any(String) });
  store.setSeatAi(code, hostTok, 1, true, 'normal');
  expect(store.start(code, hostTok)).toEqual({ ok: true });
  expect(viewer(code, 'p0')).not.toBeNull();
});

test('start requires the host token', () => {
  const { code } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  expect(store.start(code, guestTok)).toEqual({ error: expect.any(String) });
});

test('submitAction applies a legal action and rejects an illegal one', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);

  const me = viewer(code, 'p0')!.players.find((p) => p.id === 'p0')!;
  expect(
    store.submitAction(code, hostTok, {
      type: 'CONFIRM_SETUP_TICKETS',
      playerId: 'p0',
      keptIds: me.pendingTickets.slice(0, 2).map((t) => t.id),
    }),
  ).toEqual({ ok: true });

  // A route claim during the setup phase is illegal.
  const illegal = store.submitAction(code, guestTok, {
    type: 'CLAIM_ROUTE',
    routeId: 'anything',
    combo: { colorCount: 1, locomotives: 0 },
  });
  expect(illegal).toEqual({ error: expect.any(String) });
});

test('submitAction rejects an action from a player whose turn it is not', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // turn phase, p0 to move

  const res = store.submitAction(code, guestTok, { type: 'DRAW_TRAIN', source: 'deck' });
  expect(res).toEqual({ error: expect.any(String) });
});

// Review Focus #5
test('a disconnect on the disconnected players turn leaves the game paused', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok);

  store.attachSocket(code, 'p0', 'sock0');
  const before = viewer(code, 'p1')!;
  expect(before.phase).toBe('turn');
  expect(before.current).toBe(0);

  expect(store.markDisconnected('sock0')).toEqual({ code });
  const after = viewer(code, 'p1')!;
  expect(after.current).toBe(0); // still p0's turn – paused, no auto-advance
  expect(store.lobbyView(code).seats[0].connected).toBe(false);
});

test('any member can replace a dropped player (incl. the host) and the game advances', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // p0 (host) to move

  // The host drops; the guest (not the host) replaces them so play isn't stuck.
  store.attachSocket(code, 'p0', 'sock0');
  store.markDisconnected('sock0');
  expect(store.replaceWithAi(code, guestTok, 0, 'normal')).toEqual({ ok: true });

  const st = viewer(code, 'p1')!;
  expect(st.players[0].isAI).toBe(true);
  // the bot took p0's turn, so play moved to the remaining human (or ended)
  expect(st.current === 1 || st.phase === 'game-over').toBe(true);
});

test('replaceWithAi refuses to replace a still-connected player', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // everyone connected

  // You can only swap out someone who has actually dropped.
  expect(store.replaceWithAi(code, guestTok, 0, 'normal')).toHaveProperty('error');
  expect(viewer(code, 'p1')!.players[0].isAI).toBe(false);
});

test('a member can remove a dropped player entirely; the seat frees and they leave the game', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // p0 (host) to move

  store.attachSocket(code, 'p0', 'sock0');
  store.markDisconnected('sock0');
  expect(store.removeSeat(code, guestTok, 0)).toEqual({ ok: true });

  const st = viewer(code, 'p1')!;
  expect(st.players[0].removed).toBe(true);
  // Two-player game: removing one leaves a single player → the game ends.
  expect(st.phase).toBe('game-over');
  // The freed seat opens back up in the lobby view.
  expect(store.lobbyView(code).seats[0].name).toBeNull();
});

test('removeSeat refuses a still-connected player', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok);

  expect(store.removeSeat(code, guestTok, 0)).toHaveProperty('error');
});

test('a turn timeout with no connected human left ends the game on its own', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // p0's turn, clock armed

  // Both humans drop – nobody is left to drive the game.
  store.attachSocket(code, 'p0', 'sock0');
  store.attachSocket(code, 'p1', 'sock1');
  store.markDisconnected('sock0');
  store.markDisconnected('sock1');

  // When p0's clock runs out, the game ends rather than skipping turns forever.
  const expired = store.expireTurns(Date.now() + 10 * 60_000);
  expect(expired).toContain(code);
  expect(viewer(code, 'p0')!.phase).toBe('game-over');
});

test('a turn timeout with a human still connected just skips, not ends', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // p0's turn

  // p0 drops but the guest (p1) stays connected.
  store.attachSocket(code, 'p0', 'sock0');
  store.attachSocket(code, 'p1', 'sock1');
  store.markDisconnected('sock0');

  store.expireTurns(Date.now() + 10 * 60_000);
  // Still in play – it's just the guest's turn now.
  expect(viewer(code, 'p1')!.phase).not.toBe('game-over');
});

test('stateForViewer hides the other players hand but keeps its total', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  store.join(code, 'guest', '');
  store.start(code, hostTok);

  const view = viewer(code, 'p0')!;
  const me = view.players.find((p) => p.id === 'p0')!;
  const opp = view.players.find((p) => p.id === 'p1')!;
  expect(sum(me.hand)).toBe(4); // starting hand, visible to self
  expect(sum(opp.hand)).toBe(4); // total public
  expect(view.rngState).toBe(0); // seed never leaves the server
});

test('a turn clock starts only once play reaches a turn', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  // During the simultaneous starting-ticket pick there is no per-turn clock.
  expect(store.lobbyView(code).turnDeadline).toBeNull();

  finishSetup(code, hostTok, guestTok); // p0 to move
  const deadline = store.lobbyView(code).turnDeadline;
  expect(deadline).not.toBeNull();
  expect(deadline!).toBeGreaterThan(Date.now());
});

test('an expired turn is skipped and play advances', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // p0 to move
  expect(viewer(code, 'p1')!.current).toBe(0);

  const deadline = store.lobbyView(code).turnDeadline!;
  expect(store.expireTurns(deadline - 1)).toEqual([]); // not yet
  expect(store.expireTurns(deadline + 1)).toEqual([code]); // timed out → skip
  expect(viewer(code, 'p1')!.current).toBe(1); // p0's turn forfeited
});

test('anyone but the current player can grant +20s; drawing tickets adds +30s', () => {
  const { code, token: hostTok } = store.createRoom(2, 'host', '');
  const guestTok = token(store.join(code, 'guest', ''));
  store.start(code, hostTok);
  finishSetup(code, hostTok, guestTok); // p0 (host) to move

  const before = store.lobbyView(code).turnDeadline!;
  // The current player cannot extend their own clock.
  expect(store.extendTime(code, hostTok, 20_000)).toHaveProperty('error');
  // The other player can.
  expect(store.extendTime(code, guestTok, 20_000)).toEqual({ ok: true });
  expect(store.lobbyView(code).turnDeadline!).toBe(before + 20_000);

  // Drawing destination tickets buys +30s (same turn).
  const afterExtend = store.lobbyView(code).turnDeadline!;
  store.submitAction(code, hostTok, { type: 'DRAW_TICKETS' });
  expect(store.lobbyView(code).turnDeadline!).toBe(afterExtend + 30_000);
});
