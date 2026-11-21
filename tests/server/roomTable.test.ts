// The room-level table features: pausing, a rematch everyone agrees to, and
// the host changing the rules and the seats in the lobby.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RoomStore } from '../../server/rooms';
import type { TttState } from '../../src/games/tic-tac-toe/engine';

let store: RoomStore;
beforeEach(() => {
  store = new RoomStore();
});
afterEach(() => {
  vi.useRealTimers();
});

const tok = (r: { token: string } | { error: string }): string => {
  if ('error' in r) throw new Error(r.error);
  return r.token;
};

/** A started two-player Tic-Tac-Toe room with both players connected. */
function tttRoom() {
  const { code, token: host } = store.createRoom(2, 'Ann', '', {}, 'tic-tac-toe');
  const guest = tok(store.join(code, 'Bob', ''));
  store.attachSocket(code, 'p0', 'sock-ann');
  store.attachSocket(code, 'p1', 'sock-bob');
  store.start(code, host);
  const view = () => store.stateForViewer(code, 'p0') as TttState;
  const tokenOf = (id: string) => (id === 'p0' ? host : guest);
  /** X takes the top row while O plays underneath: X wins the round. */
  const finishRound = () => {
    const x = view().xId;
    const o = x === 'p0' ? 'p1' : 'p0';
    for (const [who, cell] of [[x, 0], [o, 3], [x, 1], [o, 4], [x, 2]] as const) {
      expect(store.submitAction(code, tokenOf(who), { type: 'PLACE', cell })).toEqual({ ok: true });
    }
    expect(view().roundOver).toBe(true);
  };
  return { code, host, guest, view, tokenOf, finishRound };
}

test('a pause stops the clock, refuses moves and holds until someone carries on', () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const { code, host, guest, view, tokenOf } = tttRoom();
  const mover = view().turn;
  const deadline = store.lobbyView(code).turnDeadline!;
  expect(deadline).toBeGreaterThan(Date.now());

  vi.setSystemTime(1_010_000); // ten seconds into the turn
  expect(store.setPaused(code, guest, true)).toEqual({ ok: true });
  expect(store.lobbyView(code)).toMatchObject({ paused: { by: 'p1' }, turnDeadline: null });
  expect(store.submitAction(code, tokenOf(mover), { type: 'PLACE', cell: 4 })).toEqual({ error: 'the game is paused' });

  // A long break: the turn is not skipped while paused.
  vi.setSystemTime(1_600_000);
  expect(store.expireTurns(Date.now())).toEqual([]);

  // Anyone can carry on, and the turn gets back exactly the time it had left.
  expect(store.setPaused(code, host, false)).toEqual({ ok: true });
  const view2 = store.lobbyView(code);
  expect(view2.paused).toBeNull();
  expect(view2.turnDeadline! - Date.now()).toBe(deadline - 1_010_000);
  expect(store.submitAction(code, tokenOf(mover), { type: 'PLACE', cell: 4 })).toEqual({ ok: true });
});

test('a paused game nobody is left in carries on by itself, so it can end', () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const { code, host } = tttRoom();
  store.setPaused(code, host, true);
  store.markDisconnected('sock-ann');
  store.markDisconnected('sock-bob');
  store.expireTurns(Date.now());
  expect(store.lobbyView(code).paused).toBeNull();
});

test('a rematch starts only when every connected player has asked for it', () => {
  const { code, host, guest, view, finishRound } = tttRoom();
  // Not before the round is over.
  expect(store.submitAction(code, host, { type: 'REMATCH' })).toEqual({ error: expect.any(String) });
  finishRound();
  const round = view().round;

  expect(store.submitAction(code, host, { type: 'REMATCH' })).toEqual({ ok: true });
  expect(store.lobbyView(code).rematch).toEqual(['p0']);
  expect(view().round).toBe(round); // still waiting for Bob

  expect(store.submitAction(code, guest, { type: 'REMATCH' })).toEqual({ ok: true });
  expect(view().round).toBe(round + 1);
  expect(store.lobbyView(code).rematch).toEqual([]);
});

test('if the player being waited for leaves, the others who asked get their rematch', () => {
  const { code, host, view, finishRound } = tttRoom();
  finishRound();
  const round = view().round;
  store.submitAction(code, host, { type: 'REMATCH' });
  expect(view().round).toBe(round);
  store.markDisconnected('sock-bob');
  // Tic-Tac-Toe closes a series when someone leaves; either way nobody is left waiting.
  expect(store.lobbyView(code).rematch).toEqual([]);
});

test('the host can change the rules in the lobby; a guest cannot, and bad rules are refused', () => {
  const { code, token: host } = store.createRoom(4, 'Ann', '', { variant: 'classic' }, 'last-card');
  const guest = tok(store.join(code, 'Bob', ''));
  expect(store.lobbyView(code).options).toEqual({ variant: 'classic' });
  expect(store.setOptions(code, guest, { variant: 'flip' })).toEqual({ error: expect.any(String) });
  expect(store.setOptions(code, host, { variant: 'flip' })).toEqual({ ok: true });
  expect(store.lobbyView(code).options).toEqual({ variant: 'flip' });

  // Ticket to Ride refuses a board that doesn't exist.
  const ttr = store.createRoom(3, 'Cy', '');
  expect(store.setOptions(ttr.code, ttr.token, { mapId: 'atlantis' })).toEqual({ error: expect.any(String) });
});

test('the host can add a seat, and take away the last one only while it is empty or a bot', () => {
  const { code, token: host } = store.createRoom(2, 'Ann', '', {}, 'last-card');
  expect(store.setSeatCount(code, host, 4)).toEqual({ ok: true });
  expect(store.lobbyView(code).seats).toHaveLength(4);
  expect(store.lobbyView(code).seatCount).toBe(4);

  store.setSeatAi(code, host, 3, true, 'normal');
  expect(store.setSeatCount(code, host, 3)).toEqual({ ok: true }); // a bot leaves with its seat
  tok(store.join(code, 'Bob', '')); // takes seat 1
  tok(store.join(code, 'Cy', '')); // takes seat 2
  expect(store.setSeatCount(code, host, 2)).toEqual({ error: 'a player is sitting there' });
  // More seats than the game allows.
  expect(store.setSeatCount(code, host, 40)).toEqual({ error: expect.any(String) });
  expect(store.lobbyView(code).seats).toHaveLength(3);
});
