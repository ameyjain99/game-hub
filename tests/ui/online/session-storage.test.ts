// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { clearSession, loadSession, saveSession } from '../../../src/online/session-storage';

afterEach(() => localStorage.clear());

test('save then load round-trips the session', () => {
  saveSession({ code: 'AB23', token: 't', playerId: 'p1' });
  expect(loadSession()).toEqual({ code: 'AB23', token: 't', playerId: 'p1' });
});

test('clear removes it', () => {
  saveSession({ code: 'AB23', token: 't', playerId: 'p1' });
  clearSession();
  expect(loadSession()).toBeNull();
});

test('load returns null on empty/corrupt storage', () => {
  expect(loadSession()).toBeNull();
  localStorage.setItem('ttr:online', 'not json');
  expect(loadSession()).toBeNull();
});
