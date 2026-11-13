// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TunnelDialog } from '../../src/games/ticket-to-ride/ui/components/TunnelDialog';
import { TicketCard } from '../../src/games/ticket-to-ride/ui/components/TicketCard';
import type { PendingTunnel } from '../../src/games/ticket-to-ride/engine/types';

afterEach(cleanup);

const pending: PendingTunnel = {
  routeId: 'paris-zurich',
  combo: { color: 'green', colorCount: 2, locomotives: 0 },
  flipped: ['green', 'red', 'locomotive'],
  extra: 2,
};

test('the tunnel panel uses the horizontal popover layout (head · cards · actions)', () => {
  const { container } = render(<TunnelDialog pending={pending} canAfford onResolve={vi.fn()} />);
  // Root is a .popover so the top bar's `flex-direction: row` applies (no vertical scroll).
  expect(container.querySelector('.popover.tunnel-dialog')).toBeTruthy();
  // A fixed head block, the flipped cards in a strip, and the actions — side by side.
  expect(container.querySelector('.popover-head')).toBeTruthy();
  expect(container.querySelectorAll('.tunnel-flipped [data-card]')).toHaveLength(3);
  expect(screen.getByRole('button', { name: /pay/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
});

test('the tunnel panel states how many extra cards are needed and of what', () => {
  render(<TunnelDialog pending={pending} canAfford onResolve={vi.fn()} />);
  const text = screen.getByTestId('tunnel-dialog').textContent ?? '';
  expect(text).toContain('2');
  expect(text).toContain('green');
});

test('a long-route ticket card is marked so it reads as distinct', () => {
  const { container } = render(
    <TicketCard ticket={{ id: 'cadiz__stockholm', a: 'cadiz', b: 'stockholm', points: 21, long: true }} />,
  );
  expect(container.querySelector('.ticket-card.long')).toBeTruthy();
});

test('a regular ticket card is not marked long', () => {
  const { container } = render(
    <TicketCard ticket={{ id: 'paris__wien', a: 'paris', b: 'wien', points: 8 }} />,
  );
  expect(container.querySelector('.ticket-card.long')).toBeNull();
});
