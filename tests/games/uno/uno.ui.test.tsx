// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createUno, unoKit, type UnoState } from '../../../src/games/uno/engine';
import { UnoGame } from '../../../src/games/uno/ui/UnoGame';

afterEach(cleanup);

test('your playable cards are live; a wild asks for a colour', () => {
  const init = (): UnoState => {
    const s = createUno([{ name: 'You', isAI: false }, { name: 'Bot', isAI: true }], 4);
    const wild = { id: 9001, light: { kind: 'wild' as const, color: null }, dark: null };
    const red = { id: 9002, light: { kind: 'number' as const, color: 'red' as const, value: 4 }, dark: null };
    const top = { id: 9003, light: { kind: 'number' as const, color: 'blue' as const, value: 9 }, dark: null };
    return { ...s, discard: [top], color: 'blue', players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [wild, red], handCount: 2 } : p)) };
  };
  render(<KitLocal kit={unoKit} init={init} onExit={() => {}} render={(p) => <UnoGame {...p} />} />);
  expect((screen.getByRole('button', { name: /^red 4/i }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^wild$/i }));
  expect(screen.getByRole('dialog', { name: /choose a colour/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Green' }));
  expect(screen.getByText(/You played Wild → Green/)).toBeTruthy();
});

const onTop = (color: UnoState['color']) => (): UnoState => {
  const s = createUno([{ name: 'You', isAI: false }, { name: 'Bot', isAI: true }], 4);
  const wild = { id: 9003, light: { kind: 'wild' as const, color: null }, dark: null };
  return { ...s, discard: [wild], color };
};

test('an opening Wild tells you to play any card', () => {
  render(<KitLocal kit={unoKit} init={onTop(null)} onExit={() => {}} render={(p) => <UnoGame {...p} />} />);
  expect(screen.getByText(/play any card/i)).toBeTruthy();
  expect(screen.queryByText(/on Wild$/)).toBeNull();
});

test('a Wild with a chosen colour names that colour in the status', () => {
  render(<KitLocal kit={unoKit} init={onTop('green')} onExit={() => {}} render={(p) => <UnoGame {...p} />} />);
  expect(screen.getByText(/on Wild · Green/)).toBeTruthy();
});
