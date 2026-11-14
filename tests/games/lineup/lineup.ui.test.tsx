// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { cellsOf, createLineup, lineupKit, type SeqState } from '../../../src/games/lineup/engine';
import { LineupGame } from '../../../src/games/lineup/ui/LineupGame';

afterEach(cleanup);

test('pick a card, its spaces light up, and playing one places your chip', () => {
  const init = (): SeqState => {
    const s = createLineup([{ name: 'You', isAI: false }, { name: 'Bot', isAI: true }], 2);
    return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: ['5D', '2S', '3S', '4S', '6S', '7S', '8S'] } : p)) };
  };
  render(<KitLocal kit={lineupKit} init={init} onExit={() => {}} render={(p) => <LineupGame {...p} />} />);
  fireEvent.click(screen.getByRole('button', { name: '5 of diamonds' }));
  const lit = document.querySelectorAll('.seq-cell.is-target');
  expect(lit).toHaveLength(2);
  fireEvent.click(lit[0]);
  expect(document.querySelectorAll('.seq-cell .seq-chip')).toHaveLength(1);
  expect(screen.getByText('You played 5♦')).toBeTruthy();
  expect(cellsOf('5D')).toHaveLength(2);
});
