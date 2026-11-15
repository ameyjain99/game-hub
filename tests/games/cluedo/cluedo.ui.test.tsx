// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { cluedoKit, createCluedo, type ClState } from '../../../src/games/cluedo/engine';
import { CluedoGame } from '../../../src/games/cluedo/ui/CluedoGame';
import { sq } from '../../../src/games/cluedo/board';

afterEach(cleanup);

const seats = [
  { name: 'You', isAI: false },
  { name: 'Bot 1', isAI: true },
  { name: 'Bot 2', isAI: true },
];

const show = (init: () => ClState) => render(<KitLocal kit={cluedoKit} init={init} onExit={() => {}} render={(p) => <CluedoGame {...p} />} />);

test('your turn: roll, then the reachable squares and rooms light up', () => {
  const base = createCluedo(seats, 5);
  show(() => ({ ...base, pos: { ...base.pos, 'Miss Scarlett': sq(2, 6) } }));
  fireEvent.click(screen.getByRole('button', { name: 'Roll the dice' }));
  expect(screen.getAllByRole('button', { name: 'Move here' }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Enter the Study' }));
  expect(screen.getByText(/Suggest who did it in the Study/)).toBeTruthy();
});

test('a suggestion is built from a suspect and a weapon', () => {
  const base = createCluedo(seats, 5);
  show(() => ({ ...base, phase: 'suggest', pos: { ...base.pos, 'Miss Scarlett': 'Hall' } }));
  const go = screen.getByRole('button', { name: 'Suggest' }) as HTMLButtonElement;
  expect(go.disabled).toBe(true);
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Suspect' })).getByRole('radio', { name: /Mr Green/ }));
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Weapon' })).getByRole('radio', { name: 'Rope' }));
  expect(go.disabled).toBe(false);
  fireEvent.click(go);
  expect(screen.queryByRole('button', { name: 'Suggest' })).toBeNull();
});

test('asked to disprove, you choose from only the named cards you hold', () => {
  const base = createCluedo(seats, 5);
  const mine = base.players[0].hand;
  const s: ClState = {
    ...base,
    current: 1,
    phase: 'disprove',
    pending: { triple: { suspect: 'Mr Green', weapon: 'Rope', room: 'Hall', ...pinned(mine[0]) }, disprover: 'p0', passed: [] },
  };
  show(() => s);
  const choices = screen.getAllByRole('button').filter((b) => b.classList.contains('cl-card'));
  expect(choices.map((b) => b.textContent)).toContain(`${kindOf(mine[0])}${mine[0]}`);
  fireEvent.click(choices.find((b) => b.textContent!.endsWith(mine[0]))!);
  expect(screen.queryByText(/Show one card/)).toBeNull();
});

test('accusing asks you to name all three, and says what a wrong guess costs', () => {
  show(() => createCluedo(seats, 5));
  fireEvent.click(screen.getByRole('button', { name: 'Accuse' }));
  const dialog = screen.getByRole('dialog', { name: 'Make an accusation' });
  expect(within(dialog).getByText(/you are out/)).toBeTruthy();
  const accuse = within(dialog).getByRole('button', { name: 'Accuse' }) as HTMLButtonElement;
  expect(accuse.disabled).toBe(true);
});

test('when the case closes everyone sees the answer', () => {
  const base = createCluedo(seats, 5);
  show(() => ({ ...base, over: true, phase: 'over', winner: 'p1' }));
  expect(document.querySelector('.kit-status')!.textContent).toBe('Bot 1 solved the case');
  expect(screen.getByText('Case solved')).toBeTruthy();
  expect(screen.getAllByText(base.solution.suspect).length).toBeGreaterThan(0);
});

const SUSPECT_NAMES = ['Miss Scarlett', 'Colonel Mustard', 'Mrs White', 'Mr Green', 'Mrs Peacock', 'Professor Plum'];
const WEAPON_NAMES = ['Candlestick', 'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Spanner'];
const kindOf = (c: string) => (SUSPECT_NAMES.includes(c) ? 'suspect' : WEAPON_NAMES.includes(c) ? 'weapon' : 'room');
/** A triple slot holding `card`. */
const pinned = (card: string) => ({ [kindOf(card)]: card });
