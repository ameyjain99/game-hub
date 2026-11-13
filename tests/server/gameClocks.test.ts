import { describe, expect, test } from 'vitest';
import { RoomStore } from '../../server/rooms';

/** A started room: seat 0 is the human host, the rest are bots. */
function startedRoom(gameId: 'monopoly' | 'cluedo', seats: number) {
  const store = new RoomStore();
  const { code, token } = store.createRoom(seats, 'Host', '', {}, gameId);
  for (let i = 1; i < seats; i++) store.setSeatAi(code, token, i, true);
  expect(store.start(code, token)).toEqual({ ok: true });
  return { store, code, token };
}

const FAR_FUTURE = () => Date.now() + 10 * 60_000;

describe('Monopoly turn clock', () => {
  test('gives a longer turn than the 45s default', () => {
    const { store, code } = startedRoom('monopoly', 2);
    const deadline = store.lobbyView(code).turnDeadline!;
    expect(deadline - Date.now()).toBeGreaterThan(60_000);
  });

  test('an expired turn is played out cautiously instead of freezing the game', () => {
    const { store, code } = startedRoom('monopoly', 2);
    const before = store.stateForViewer(code, 'p0');
    expect(store.expireTurns(FAR_FUTURE())).toContain(code);
    const after = store.stateForViewer(code, 'p0');
    expect(after.turns + (after.dice ? 1 : 0)).toBeGreaterThan(before.turns + (before.dice ? 1 : 0));
    expect(store.lobbyView(code).turnDeadline).not.toBeNull(); // clock re-armed for the human
  });

  test('acting refreshes the clock so an active player is never skipped', () => {
    const { store, code, token } = startedRoom('monopoly', 2);
    const state = store.stateForViewer(code, 'p0');
    const first = store.lobbyView(code).turnDeadline!;
    const action = state.phase === 'jail' ? { type: 'ROLL_JAIL' } : { type: 'ROLL' };
    expect(store.submitAction(code, token, action)).toEqual({ ok: true });
    const next = store.lobbyView(code).turnDeadline;
    if (next !== null) expect(next).toBeGreaterThanOrEqual(first);
  });
});

describe('Cluedo turn clock', () => {
  test('runs a clock on the human seat', () => {
    const { store, code } = startedRoom('cluedo', 3);
    expect(store.lobbyView(code).turnDeadline).not.toBeNull();
  });

  test('an expired turn moves the game on', () => {
    const { store, code } = startedRoom('cluedo', 3);
    expect(store.stateForViewer(code, 'p0').players[0].room).toBeNull();
    store.expireTurns(FAR_FUTURE());
    // The idle human was rolled and moved into a room; bots then played on.
    expect(store.stateForViewer(code, 'p0').players[0].room).not.toBeNull();
  });

  test('a room nobody human is connected to ends instead of stalling', () => {
    const { store, code, token } = startedRoom('cluedo', 3);
    store.leaveRoom(code, token); // the only human leaves mid-game
    store.expireTurns(FAR_FUTURE());
    expect(store.stateForViewer(code, 'p0').phase).toBe('over');
  });
});
