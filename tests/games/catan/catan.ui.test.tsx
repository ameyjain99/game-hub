// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createCatan, catanKit, legalSettlementSpots, legalRoadSpots, type CatanState } from '../../../src/games/catan/engine';
import { CatanGame } from '../../../src/games/catan/ui/CatanGame';
import { CATAN_RULES } from '../../../src/games/catan/rules';
import { RulesContext } from '../../../src/shared/rules';

afterEach(cleanup);

const seats = [{ name: 'You', isAI: false }, { name: 'Bot 1', isAI: true }, { name: 'Bot 2', isAI: true }];

test('setup: the free corners light up; placing a settlement then offers the roads beside it', () => {
  render(<KitLocal kit={catanKit} init={() => createCatan(seats, 4)} onExit={() => {}} render={(p) => <CatanGame {...p} />} />);
  const corners = screen.getAllByRole('button', { name: 'Build here' });
  expect(corners.length).toBe(54);
  fireEvent.click(corners[10]);
  const roads = screen.getAllByRole('button', { name: 'Build a road here' });
  expect(roads.length).toBeGreaterThanOrEqual(2);
  expect(roads.length).toBeLessThanOrEqual(3);
  expect(screen.queryAllByRole('button', { name: 'Build here' })).toHaveLength(0);
});

/** Play the setup: each player takes the first legal corner and road offered. */
function setUp(s: CatanState): CatanState {
  while (s.phase === 'setup') {
    const id = catanKit.actor(s)!;
    if (s.setup!.needRoad) s = catanKit.apply(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }, id);
    else s = catanKit.apply(s, { type: 'BUILD_SETTLEMENT', vertex: legalSettlementSpots(s, id)[0] }, id);
  }
  return { ...s, players: s.players.map((p) => ({ ...p, hand: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 } })) };
}

test('during setup the dock explains setup instead of showing build buttons', () => {
  render(<KitLocal kit={catanKit} init={() => createCatan(seats, 4)} onExit={() => {}} render={(p) => <CatanGame {...p} />} />);
  expect(screen.queryByTitle(/^City:/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
  expect(screen.getByText(/building opens once everyone is placed/i)).toBeTruthy();
});

test('the build buttons show their costs and stay off until you can afford them', () => {
  render(<KitLocal kit={catanKit} init={() => setUp(createCatan(seats, 4))} onExit={() => {}} render={(p) => <CatanGame {...p} />} />);
  const city = screen.getByTitle(/^City: 2 grain, 3 ore/);
  expect((city as HTMLButtonElement).disabled).toBe(true);
});

/** Cities & Knights after setup, at p0's ("You") turn. */
const knights = (patch: (s: CatanState) => CatanState) => () => patch(setUp(createCatan(seats, 4, { mode: 'cities-knights' })));
const show = (init: () => CatanState) => render(<KitLocal kit={catanKit} init={init} onExit={() => {}} render={(p) => <CatanGame {...p} />} />);

test('Cities & Knights: a choice you owe opens its panel, and you pick the cards yourself', () => {
  show(
    knights((s) => ({
      ...s,
      phase: 'main',
      turn: 1,
      dice: [3, 4],
      asks: [{ kind: 'discard', player: 'p0', count: 2 }],
      players: s.players.map((p, i) => (i === 0 ? { ...p, hand: { lumber: 2, brick: 0, wool: 2, grain: 0, ore: 0 } } : p)),
    })),
  );
  const panel = screen.getByRole('dialog', { name: /Saboteur · discard 2/ });
  expect(panel).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'One more Lumber' }));
  fireEvent.click(screen.getByRole('button', { name: 'One more Wool' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard 2 / 2' }));
  expect(screen.queryByRole('dialog', { name: /Saboteur/ })).toBeNull();
  expect(screen.getByText('You discard 2 cards')).toBeTruthy();
});

test('Cities & Knights: the Alchemist sets the red and yellow dice before the roll', () => {
  show(knights((s) => ({ ...s, phase: 'roll', turn: 0, players: s.players.map((p, i) => (i === 0 ? { ...p, progressCards: ['alchemist'] } : p)) })));
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Red die: 2' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Yellow die: 4' }));
  fireEvent.click(screen.getByRole('button', { name: /Set them: 2 \+ 4 = 6/ }));
  expect(screen.getByText('You rolled 2 + 4')).toBeTruthy();
});

test('Cities & Knights: the rule book opens on the Cities & Knights tab', () => {
  render(
    <RulesContext.Provider value={{ rules: CATAN_RULES }}>
      <KitLocal kit={catanKit} init={knights((s) => ({ ...s, phase: 'main', turn: 0 }))} onExit={() => {}} render={(p) => <CatanGame {...p} />} />
    </RulesContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
  expect(screen.getByRole('tab', { name: 'Cities & Knights' }).getAttribute('aria-selected')).toBe('true');
});
