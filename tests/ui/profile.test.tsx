// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TicketToRideProfile } from '../../src/games/ticket-to-ride/ui/TicketToRideProfile';
import { rulebookUrl } from '../../src/games/ticket-to-ride/engine/maps/rulebook';
import { AVATARS } from '../../src/games/ticket-to-ride/ui/avatars';

afterEach(cleanup);

test('creating a room submits name, avatar, board, mode and player count', () => {
  const onSubmit = vi.fn();
  render(<TicketToRideProfile action="start" onBack={vi.fn()} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Amey' } });
  fireEvent.click(screen.getByRole('button', { name: `avatar ${AVATARS[2]}` }));
  fireEvent.change(screen.getByLabelText('Mode'), { target: { value: '1910' } });
  fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: /create game/i }));
  expect(onSubmit).toHaveBeenCalledWith('Amey', AVATARS[2], 4, '1910', 'usa');
});

test('the Board dropdown is on the create page and picking a single-mode board hides Mode', () => {
  render(<TicketToRideProfile action="start" onBack={vi.fn()} onSubmit={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Board'), { target: { value: 'europe' } });
  expect(screen.queryByLabelText('Mode')).toBeNull();
  const link = screen.getByRole('link', { name: /rules/i }) as HTMLAnchorElement;
  expect(link.getAttribute('href')).toBe(rulebookUrl('europe.pdf'));
});

test('joining only collects name and avatar – no mode or player count', () => {
  const onSubmit = vi.fn();
  render(<TicketToRideProfile action="join" onBack={vi.fn()} onSubmit={onSubmit} />);
  expect(screen.queryByLabelText('Mode')).toBeNull();
  expect(screen.queryByLabelText('Number of players')).toBeNull();
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Amey' } });
  fireEvent.click(screen.getByRole('button', { name: /join game/i }));
  expect(onSubmit).toHaveBeenCalledWith('Amey', expect.any(String));
});

test('submit is disabled until a name is entered', () => {
  render(<TicketToRideProfile action="join" onBack={vi.fn()} onSubmit={vi.fn()} />);
  const submit = screen.getByRole('button', { name: /join game/i }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Priya' } });
  expect(submit.disabled).toBe(false);
});
