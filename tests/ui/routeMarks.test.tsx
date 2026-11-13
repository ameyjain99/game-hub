// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouteSegment } from '../../src/games/ticket-to-ride/ui/components/RouteSegment';
import { Board } from '../../src/games/ticket-to-ride/ui/components/Board';
import { ClaimDialog } from '../../src/games/ticket-to-ride/ui/components/ClaimDialog';
import { getRoute } from '../../src/games/ticket-to-ride/engine/selectors';
import { cityById, getMap } from '../../src/games/ticket-to-ride/engine/maps';
import { emptyHand } from '../../src/games/ticket-to-ride/engine/deck';

afterEach(cleanup);

function segment(routeId: string, ownerColor: string | null = null) {
  const route = getRoute(routeId)!;
  const { container } = render(
    <svg>
      <RouteSegment
        route={route}
        from={cityById.get(route.a)!}
        to={cityById.get(route.b)!}
        ownerColor={ownerColor}
        claimable={false}
      />
    </svg>,
  );
  return container;
}

test('an open tunnel draws a casing around every car slot', () => {
  const tunnel = getRoute('paris-zurich')!;
  expect(tunnel.isTunnel).toBe(true);
  expect(segment('paris-zurich').querySelectorAll('.tunnel-casing')).toHaveLength(tunnel.length);
  expect(segment('dieppe-paris').querySelectorAll('.tunnel-casing')).toHaveLength(0);
});

test('an open ferry marks one slot per required locomotive', () => {
  const ferry = getRoute('london-amsterdam')!;
  expect(ferry.locomotivesRequired).toBe(2);
  expect(segment('london-amsterdam').querySelectorAll('.loco-slot')).toHaveLength(2);
  expect(segment('smyrna-palermo').querySelectorAll('.loco-slot')).toHaveLength(
    getRoute('smyrna-palermo')!.locomotivesRequired,
  );
  expect(segment('dieppe-paris').querySelectorAll('.loco-slot')).toHaveLength(0);
});

const board = (mapId: 'usa' | 'europe') => {
  const map = getMap(mapId);
  return render(<Board claimedBy={{}} playerColors={{}} cities={map.cities} routes={map.routes} />);
};

test('a board with tunnels and ferries shows a legend for them', () => {
  board('europe');
  const legend = screen.getByTestId('board-legend');
  expect(legend.textContent).toContain('Tunnel');
  expect(legend.textContent).toContain('Ferry');
});

test('a board without tunnels or ferries shows no legend', () => {
  board('usa');
  expect(screen.queryByTestId('board-legend')).toBeNull();
});

test('claiming a ferry says how many locomotives it needs', () => {
  render(<ClaimDialog routeId="london-amsterdam" hand={emptyHand()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByTestId('claim-dialog').textContent).toContain('ferry: needs 2 locomotives');
});

test('claiming a tunnel warns that it may cost extra cards', () => {
  render(<ClaimDialog routeId="paris-zurich" hand={emptyHand()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByTestId('claim-dialog').textContent).toContain('tunnel: may cost extra');
});
