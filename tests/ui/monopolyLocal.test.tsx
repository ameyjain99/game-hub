// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MonopolyLocalGame } from '../../src/games/monopoly/ui/MonopolyLocalGame';

afterEach(cleanup);

// Seed 5's first roll for p0 is a non-doubles total of 8 – landing on Seville (8),
// an unowned property – so the flow is deterministic.
function renderLocal() {
  return render(<MonopolyLocalGame playerCount={2} difficulty="normal" seed={5} onBackToHub={() => {}} />);
}

test('rolling advances the token and offers to buy an unowned property', () => {
  renderLocal();
  fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
  // Landing on Seville offers Buy / Decline.
  expect(screen.getByRole('button', { name: /^buy/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /decline/i })).toBeTruthy();
});

test('buying a property lists it under Your properties and marks the board', () => {
  renderLocal();
  fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
  fireEvent.click(screen.getByRole('button', { name: /^buy/i }));
  // The sidebar's property row (its button is named just "Seville")...
  expect(screen.getByRole('button', { name: 'Seville' })).toBeTruthy();
  // ...and the board cell now reports its owner.
  expect(screen.getByRole('button', { name: /^Seville, owned by You/ })).toBeTruthy();
});

test('ending the turn hands play to the bot, which plays and returns the turn', async () => {
  renderLocal();
  fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
  fireEvent.click(screen.getByRole('button', { name: /^buy/i }));
  fireEvent.click(screen.getByRole('button', { name: /end turn/i }));
  // The bot takes its turn on a timer; eventually it's the human's roll again.
  await waitFor(() => expect(screen.getByRole('button', { name: /roll dice/i })).toBeTruthy(), {
    timeout: 4000,
  });
});
