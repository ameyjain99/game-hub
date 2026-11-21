// Chess clocks: each player has a bank of time that only runs on their own
// move, and running out loses the game.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RoomStore } from '../../server/rooms';
import type { ChessState } from '../../src/games/chess/engine';

let store: RoomStore;
beforeEach(() => {
  store = new RoomStore();
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

const MIN = 60_000;

function chessRoom(options: unknown) {
  const { code, token: host } = store.createRoom(2, 'Ann', '', options, 'chess');
  const joined = store.join(code, 'Bob', '');
  if ('error' in joined) throw new Error(joined.error);
  store.attachSocket(code, 'p0', 'sock-ann');
  store.attachSocket(code, 'p1', 'sock-bob');
  store.start(code, host);
  const view = () => store.stateForViewer(code, 'p0') as ChessState;
  return { code, host, guest: joined.token, view };
}

test('a game without a clock has none', () => {
  const { code } = chessRoom({});
  expect(store.lobbyView(code).clocks ?? null).toBeNull();
  expect(store.lobbyView(code).turnDeadline).toBeNull();
});

test('time runs only on the player to move', () => {
  const { code, host, guest } = chessRoom({ clockMin: 5 });
  expect(store.lobbyView(code).clocks).toEqual([5 * MIN, 5 * MIN]);
  expect(store.lobbyView(code).turnDeadline).toBe(1_000_000 + 5 * MIN);

  vi.setSystemTime(1_020_000); // White thinks for 20 seconds
  expect(store.submitAction(code, host, { type: 'MOVE', from: 'e2', to: 'e4' })).toEqual({ ok: true });
  expect(store.lobbyView(code).clocks).toEqual([5 * MIN - 20_000, 5 * MIN]);

  vi.setSystemTime(1_050_000); // Black thinks for 30
  expect(store.lobbyView(code).clocks).toEqual([5 * MIN - 20_000, 5 * MIN - 30_000]);
  expect(store.submitAction(code, guest, { type: 'MOVE', from: 'e7', to: 'e5' })).toEqual({ ok: true });
  expect(store.lobbyView(code).clocks).toEqual([5 * MIN - 20_000, 5 * MIN - 30_000]);
  expect(store.lobbyView(code).turnDeadline).toBe(1_050_000 + 5 * MIN - 20_000);
});

test('a pause stops both clocks', () => {
  const { code, host } = chessRoom({ clockMin: 5 });
  vi.setSystemTime(1_010_000);
  store.setPaused(code, host, true);
  vi.setSystemTime(1_500_000);
  expect(store.lobbyView(code).clocks).toEqual([5 * MIN - 10_000, 5 * MIN]);
  store.setPaused(code, host, false);
  expect(store.lobbyView(code).turnDeadline).toBe(1_500_000 + 5 * MIN - 10_000);
});

test('running out of time loses the game', () => {
  const { code, view } = chessRoom({ clockMin: 5 });
  expect(store.expireTurns(1_000_000 + 5 * MIN - 1)).toEqual([]);
  expect(store.expireTurns(1_000_000 + 5 * MIN)).toEqual([code]);
  expect(view().over).toBe(true);
  expect(view().result).toBe('time');
  expect(view().winner).toBe('p1');
  expect(store.lobbyView(code).clocks).toEqual([0, 5 * MIN]);
  expect(store.lobbyView(code).turnDeadline).toBeNull();
});

test('nobody can add time to a chess clock, and a rematch starts with full clocks', () => {
  const { code, host, guest } = chessRoom({ clockMin: 5 });
  expect(store.extendTime(code, guest, 15_000)).toHaveProperty('error');
  vi.setSystemTime(1_030_000);
  store.submitAction(code, host, { type: 'RESIGN' });
  expect(store.lobbyView(code).turnDeadline).toBeNull();
  store.submitAction(code, host, { type: 'REMATCH' });
  store.submitAction(code, guest, { type: 'REMATCH' });
  expect(store.lobbyView(code).clocks).toEqual([5 * MIN, 5 * MIN]);
  expect(store.lobbyView(code).turnDeadline).toBe(1_030_000 + 5 * MIN);
});
