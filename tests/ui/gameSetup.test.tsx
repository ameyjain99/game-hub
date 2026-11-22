// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SetupButton, SetupContext } from '../../src/shared/ui/GameSetup';

test("the eye opens the game's setup, a line per choice, and Escape closes it", () => {
  render(
    <SetupContext.Provider value={['Expansion: Seafarers', 'Bot difficulty: Hard', 'Until one player is left']}>
      <SetupButton />
    </SetupContext.Provider>,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: "This game's setup" }));
  const lines = [...screen.getByRole('dialog').querySelectorAll('li')].map((li) => [...li.children].map((c) => c.textContent));
  expect(lines).toEqual([['Expansion', 'Seafarers'], ['Bot difficulty', 'Hard'], ['Until one player is left']]);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a game with nothing to choose shows no eye, and given lines win over the context', () => {
  const { rerender } = render(<SetupButton />);
  expect(screen.queryByRole('button')).toBeNull();
  rerender(
    <SetupContext.Provider value={['Mode: Classic']}>
      <SetupButton lines={['Map: Europe']} />
    </SetupContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: "This game's setup" }));
  expect(screen.getByRole('dialog').textContent).toContain('Europe');
  expect(screen.getByRole('dialog').textContent).not.toContain('Classic');
});
