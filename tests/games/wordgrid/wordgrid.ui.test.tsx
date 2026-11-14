// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { buildDictionary, setDictionary } from '../../../src/games/wordgrid/dictionary';
import { createWordgrid, wordgridKit, type WgState } from '../../../src/games/wordgrid/engine';
import { WordgridGame } from '../../../src/games/wordgrid/ui/WordgridGame';

beforeAll(() => setDictionary(buildDictionary(readFileSync('public/words/enable.txt', 'utf8'))));
afterEach(cleanup);

test('type a word at the centre: it previews its score, and Play lays it', () => {
  const init = (): WgState => {
    const s = createWordgrid([{ name: 'You', isAI: false }, { name: 'Bot', isAI: true }], 2);
    const rack = 'CATSXYZ'.split('').map((letter, i) => ({ id: 900 + i, letter }));
    return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, rack, rackCount: 7 } : p)) };
  };
  render(<KitLocal kit={wordgridKit} init={init} onExit={() => {}} render={(p) => <WordgridGame {...p} />} />);
  fireEvent.click(screen.getByRole('gridcell', { name: 'Row 8, column 7: empty' }));
  for (const key of ['c', 'a', 't']) fireEvent.keyDown(window, { key });
  expect(screen.getByRole('button', { name: 'Play · 10' })).toBeTruthy();
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(screen.getByText('You played CAT for 10')).toBeTruthy();
});

test('a non-word says so and cannot be played', () => {
  const init = (): WgState => {
    const s = createWordgrid([{ name: 'You', isAI: false }, { name: 'Bot', isAI: true }], 2);
    const rack = 'XQZJKVW'.split('').map((letter, i) => ({ id: 900 + i, letter }));
    return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, rack, rackCount: 7 } : p)) };
  };
  render(<KitLocal kit={wordgridKit} init={init} onExit={() => {}} render={(p) => <WordgridGame {...p} />} />);
  fireEvent.click(screen.getByRole('gridcell', { name: 'Row 8, column 8: centre star, double word' }));
  fireEvent.keyDown(window, { key: 'x' });
  fireEvent.keyDown(window, { key: 'q' });
  expect(screen.getByText(/XQ isn't in the dictionary/)).toBeTruthy();
  expect((screen.getByRole('button', { name: /^play/i }) as HTMLButtonElement).disabled).toBe(true);
});
