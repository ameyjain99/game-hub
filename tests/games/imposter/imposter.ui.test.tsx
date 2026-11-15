// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createImposter, imposterKit, type ImposterState } from '../../../src/games/imposter/engine';
import { ImposterGame } from '../../../src/games/imposter/ui/ImposterGame';
import { categoryById, wordsIn } from '../../../src/games/imposter/words';

afterEach(cleanup);

const seats = [
  { name: 'You', isAI: false },
  { name: 'Bot 1', isAI: true },
  { name: 'Bot 2', isAI: true },
  { name: 'Bot 3', isAI: true },
];

/** A round where you are crew (Bot 1 is the imposter) and clue first. */
function yourClue(): ImposterState {
  const s = createImposter(seats, 8);
  return { ...s, round: { ...s.round, imposter: 'p1', order: ['p0', 'p1', 'p2', 'p3'] } };
}

const show = (init: () => ImposterState) =>
  render(<KitLocal kit={imposterKit} init={init} onExit={() => {}} render={(p) => <ImposterGame {...p} />} />);

test('your word card starts face down and shows the word when tapped', () => {
  const s = yourClue();
  show(() => s);
  const card = screen.getByRole('button', { name: 'Show your word' });
  expect(card.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(card);
  expect(screen.getByRole('button', { name: 'Hide your word' })).toBeTruthy();
  expect(within(card).getByText(s.round.word)).toBeTruthy();
});

test('a Classic imposter is told so, and is not shown the word', () => {
  const base = createImposter(seats, 8, { mode: 'classic' });
  const s = { ...base, round: { ...base.round, imposter: 'p0' } };
  show(() => s);
  const card = screen.getByRole('button', { name: 'Show your word' });
  expect(within(card).getByText('the imposter')).toBeTruthy();
  expect(within(card).queryByText(s.round.word)).toBeNull();
});

test('on your turn you give a one-word clue; your own word is refused', () => {
  const s = yourClue();
  show(() => s);
  const input = screen.getByPlaceholderText('One word');
  const give = screen.getByRole('button', { name: 'Give clue' }) as HTMLButtonElement;
  fireEvent.change(input, { target: { value: s.round.word.toLowerCase() } });
  expect(give.disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toMatch(/your word/i);
  fireEvent.change(input, { target: { value: 'quokka' } });
  fireEvent.click(give);
  const mine = screen.getByRole('list', { name: 'Your clues' });
  expect(within(mine).getByText('quokka')).toBeTruthy();
});

test('in the vote you tap a player; the count stays hidden until every vote is in', () => {
  const base = yourClue();
  const s: ImposterState = {
    ...base,
    phase: 'vote',
    round: { ...base.round, turn: 8, ballots: [{}], candidates: ['p0', 'p1', 'p2', 'p3'] },
  };
  show(() => s);
  expect(screen.queryByRole('button', { name: 'Vote for You' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Vote for Bot 2' }));
  expect(screen.getByText(/You voted for/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Vote for/ })).toBeNull();
  expect(screen.queryByText(/1 vote$/)).toBeNull();
});

test('a caught Classic imposter picks the word from the category', () => {
  const base = createImposter(seats, 8, { mode: 'classic' });
  const s: ImposterState = { ...base, phase: 'guess', round: { ...base.round, imposter: 'p0', votedOut: 'p0', ballots: [{ p1: 'p0', p2: 'p0', p3: 'p0', p0: 'p1' }] } };
  show(() => s);
  for (const w of wordsIn(categoryById(s.round.category))) expect(screen.getByRole('button', { name: w })).toBeTruthy();
  expect(screen.getByText('3 votes')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: s.round.word }));
  expect(screen.getAllByText(/caught but named the word/).length).toBeGreaterThan(0);
});
