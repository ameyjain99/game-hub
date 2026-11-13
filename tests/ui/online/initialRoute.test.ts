// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { initialRoute } from '../../../src/app/App';
import { saveSession } from '../../../src/online/session-storage';

afterEach(() => localStorage.clear());

test('no stored session starts at the hub', () => {
  expect(initialRoute()).toEqual({ kind: 'hub' });
});

test('a stored session resumes the online game (reclaim on reload)', () => {
  saveSession({ code: 'AB23', token: 't', playerId: 'p1' });
  expect(initialRoute()).toEqual({ kind: 'game', gameId: 'ticket-to-ride' });
});

test('a stored Cluedo session resumes into Cluedo on reload', () => {
  saveSession({ code: 'CD45', token: 't', playerId: 'p0', gameId: 'cluedo' });
  expect(initialRoute()).toEqual({ kind: 'game', gameId: 'cluedo' });
});
