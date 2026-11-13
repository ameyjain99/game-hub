import { afterEach, expect, test, vi } from 'vitest';
import { fetchRoomExists } from '../../src/games/ticket-to-ride/net/room';

afterEach(() => vi.unstubAllGlobals());

test('reports whether the room exists from the server', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ exists: true }) })));
  expect(await fetchRoomExists('AB23')).toBe(true);

  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ exists: false }) })));
  expect(await fetchRoomExists('ZZZZ')).toBe(false);
});

test('fails open (treats the room as existing) on a non-ok response or network error', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  expect(await fetchRoomExists('AB23')).toBe(true);

  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('offline');
  }));
  expect(await fetchRoomExists('AB23')).toBe(true);
});
