// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { createBlockyard } from '../../../src/games/blockyard/engine';
import { loadWorld } from '../../../src/games/blockyard/ui/BlockyardApp';

const KEY = 'gamehub-blockyard-world';
afterEach(() => localStorage.clear());

test('a saved tally comes back with the world', () => {
  localStorage.setItem(KEY, JSON.stringify({ seed: 5, edits: { 900: 3, 901: 0 }, placed: 12, broken: 7 }));
  expect(loadWorld()).toEqual({ seed: 5, edits: { 900: 3, 901: 0 }, placed: 12, broken: 7 });
});

test('an older save without a tally counts its changed blocks: placed ones and broken ones', () => {
  localStorage.setItem(KEY, JSON.stringify({ seed: 5, edits: { 900: 3, 901: 0, 902: 4 } }));
  expect(loadWorld()).toEqual({ seed: 5, edits: { 900: 3, 901: 0, 902: 4 }, placed: 2, broken: 1 });
});

test('a local world starts its builder at the saved tally', () => {
  const s = createBlockyard([{ name: 'You', isAI: false }], 5, { edits: { 900: 3 }, tally: { placed: 12, broken: 7 } });
  expect(s.players[0]).toMatchObject({ placed: 12, broken: 7 });
});
