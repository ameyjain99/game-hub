// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitLocal } from '../../../src/games/kit/ui/KitLocal';
import { createHexstead, hexKit, legalHomesteadSpots, legalRoadSpots, type HxState } from '../../../src/games/hexstead/engine';
import { HexsteadGame } from '../../../src/games/hexstead/ui/HexsteadGame';
import { HEXSTEAD_RULES } from '../../../src/games/hexstead/rules';
import { RulesContext } from '../../../src/shared/rules';

afterEach(cleanup);

const seats = [{ name: 'You', isAI: false }, { name: 'Bot 1', isAI: true }, { name: 'Bot 2', isAI: true }];

test('setup: the free corners light up; placing a homestead then offers the roads beside it', () => {
  render(<KitLocal kit={hexKit} init={() => createHexstead(seats, 4)} onExit={() => {}} render={(p) => <HexsteadGame {...p} />} />);
  const corners = screen.getAllByRole('button', { name: 'Build here' });
  expect(corners.length).toBe(54);
  fireEvent.click(corners[10]);
  const roads = screen.getAllByRole('button', { name: 'Build a road here' });
  expect(roads.length).toBeGreaterThanOrEqual(2);
  expect(roads.length).toBeLessThanOrEqual(3);
  expect(screen.queryAllByRole('button', { name: 'Build here' })).toHaveLength(0);
});

/** Play the setup: each player takes the first legal corner and road offered. */
function setUp(s: HxState): HxState {
  while (s.phase === 'setup') {
    const id = hexKit.actor(s)!;
    if (s.setup!.needRoad) s = hexKit.apply(s, { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] }, id);
    else s = hexKit.apply(s, { type: 'BUILD_HOMESTEAD', vertex: legalHomesteadSpots(s, id)[0] }, id);
  }
  return { ...s, players: s.players.map((p) => ({ ...p, hand: { timber: 0, clay: 0, wool: 0, grain: 0, stone: 0 } })) };
}

test('during setup the dock explains setup instead of showing build buttons', () => {
  render(<KitLocal kit={hexKit} init={() => createHexstead(seats, 4)} onExit={() => {}} render={(p) => <HexsteadGame {...p} />} />);
  expect(screen.queryByTitle(/^Town:/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
  expect(screen.getByText(/building opens once everyone is placed/i)).toBeTruthy();
});

test('the build buttons show their costs and stay off until you can afford them', () => {
  render(<KitLocal kit={hexKit} init={() => setUp(createHexstead(seats, 4))} onExit={() => {}} render={(p) => <HexsteadGame {...p} />} />);
  const town = screen.getByTitle(/^Town: 2 grain, 3 stone/);
  expect((town as HTMLButtonElement).disabled).toBe(true);
});

/** Wardens after setup, at p0's ("You") turn. */
const wardens = (patch: (s: HxState) => HxState) => () => patch(setUp(createHexstead(seats, 4, { mode: 'wardens' })));
const show = (init: () => HxState) => render(<KitLocal kit={hexKit} init={init} onExit={() => {}} render={(p) => <HexsteadGame {...p} />} />);

test('Wardens: a choice you owe opens its panel, and you pick the cards yourself', () => {
  show(
    wardens((s) => ({
      ...s,
      phase: 'main',
      turn: 1,
      dice: [3, 4],
      asks: [{ kind: 'discard', player: 'p0', count: 2 }],
      players: s.players.map((p, i) => (i === 0 ? { ...p, hand: { timber: 2, clay: 0, wool: 2, grain: 0, stone: 0 } } : p)),
    })),
  );
  const panel = screen.getByRole('dialog', { name: /Saboteur · discard 2/ });
  expect(panel).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'One more Timber' }));
  fireEvent.click(screen.getByRole('button', { name: 'One more Wool' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard 2 / 2' }));
  expect(screen.queryByRole('dialog', { name: /Saboteur/ })).toBeNull();
  expect(screen.getByText('You discard 2 cards')).toBeTruthy();
});

test('Wardens: the Alchemist sets the red and yellow dice before the roll', () => {
  show(wardens((s) => ({ ...s, phase: 'roll', turn: 0, players: s.players.map((p, i) => (i === 0 ? { ...p, edicts: ['alchemist'] } : p)) })));
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Red die: 2' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Yellow die: 4' }));
  fireEvent.click(screen.getByRole('button', { name: /Set them: 2 \+ 4 = 6/ }));
  expect(screen.getByText('You rolled 2 + 4')).toBeTruthy();
});

test('Wardens: the rule book opens on the Wardens tab', () => {
  render(
    <RulesContext.Provider value={{ rules: HEXSTEAD_RULES }}>
      <KitLocal kit={hexKit} init={wardens((s) => ({ ...s, phase: 'main', turn: 0 }))} onExit={() => {}} render={(p) => <HexsteadGame {...p} />} />
    </RulesContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Rules' }));
  expect(screen.getByRole('tab', { name: 'Wardens' }).getAttribute('aria-selected')).toBe('true');
});
