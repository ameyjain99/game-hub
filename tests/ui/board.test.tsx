// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Board } from '../../src/games/ticket-to-ride/ui/components/Board';
import { CITIES } from '../../src/games/ticket-to-ride/engine/data/usa/cities';
import { ROUTES } from '../../src/games/ticket-to-ride/engine/data/usa/routes';

afterEach(cleanup);

describe('Board', () => {
  it('renders every route and city', () => {
    const { container } = render(<Board claimedBy={{}} playerColors={{}} />);
    expect(container.querySelectorAll('[data-route-id]').length).toBe(ROUTES.length);
    expect(container.querySelectorAll('[data-city-id]').length).toBe(CITIES.length);
  });

  it('marks claimable routes and fires the claim callback', () => {
    const clicked: string[] = [];
    const { container } = render(
      <Board
        claimedBy={{}}
        playerColors={{}}
        claimableRouteIds={new Set(['boston-new-york'])}
        onClaimRoute={(id) => clicked.push(id)}
      />,
    );
    const el = container.querySelector('[data-route-id="boston-new-york"]') as SVGGElement;
    expect(el.classList.contains('claimable')).toBe(true);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toEqual(['boston-new-york']);
  });

  it('marks highlighted cities (e.g. hovered ticket endpoints)', () => {
    const { container } = render(
      <Board
        claimedBy={{}}
        playerColors={{}}
        highlightCityIds={new Set(['denver', 'pittsburgh'])}
      />,
    );
    const denver = container.querySelector('[data-city-id="denver"]') as SVGGElement;
    const boston = container.querySelector('[data-city-id="boston"]') as SVGGElement;
    expect(denver.classList.contains('highlighted')).toBe(true);
    expect(boston.classList.contains('highlighted')).toBe(false);
  });

  it('subtly marks ticket-endpoint cities (persistent highlight)', () => {
    const { container } = render(
      <Board claimedBy={{}} playerColors={{}} subtleCityIds={new Set(['seattle'])} />,
    );
    const seattle = container.querySelector('[data-city-id="seattle"]') as SVGGElement;
    expect(seattle.classList.contains('subtle')).toBe(true);
  });

  it('a strongly-highlighted city is not also marked subtle', () => {
    const { container } = render(
      <Board
        claimedBy={{}}
        playerColors={{}}
        highlightCityIds={new Set(['denver'])}
        subtleCityIds={new Set(['denver'])}
      />,
    );
    const denver = container.querySelector('[data-city-id="denver"]') as SVGGElement;
    expect(denver.classList.contains('highlighted')).toBe(true);
    expect(denver.classList.contains('subtle')).toBe(false);
  });

  it('colors a claimed route in the owner color', () => {
    const { container } = render(
      <Board claimedBy={{ 'boston-new-york': 'p0' }} playerColors={{ p0: '#d1352b' }} />,
    );
    const el = container.querySelector('[data-route-id="boston-new-york"] rect') as SVGRectElement;
    expect(el.getAttribute('fill')).toBe('#d1352b');
  });
});
