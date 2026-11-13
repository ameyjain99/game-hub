import { expect, test } from 'vitest';
import { RoomStore } from '../../server/rooms';
import type { RedactedCluedoState } from '../../src/games/cluedo/engine/redact';

test('a Cluedo room is created, started, and serves redacted state without the solution', () => {
  const store = new RoomStore();
  const { code, token } = store.createRoom(3, 'Host', '', {}, 'cluedo');
  store.setSeatAi(code, token, 1, true, 'normal');
  store.setSeatAi(code, token, 2, true, 'normal');
  expect(store.start(code, token)).toEqual({ ok: true });

  const view = store.stateForViewer(code, 'p0') as RedactedCluedoState;
  expect(view).not.toBeNull();
  expect((view as unknown as Record<string, unknown>).solution).toBeNull(); // hidden until game over
  expect(view.players).toHaveLength(3);
  expect(view.you).toBe('p0');
  expect(view.players.find((p) => p.id === 'p0')!.hand).toBeDefined(); // your own hand
  expect(view.players.find((p) => p.id === 'p1')!.hand).toBeUndefined(); // others hidden
});

test('Cluedo rejects out-of-range seat counts', () => {
  const store = new RoomStore();
  expect(() => store.createRoom(2, 'x', '', {}, 'cluedo')).toThrow();
  expect(() => store.createRoom(7, 'x', '', {}, 'cluedo')).toThrow();
});
