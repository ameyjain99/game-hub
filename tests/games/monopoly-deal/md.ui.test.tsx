// @vitest-environment jsdom
// Monopoly Deal on screen: playing a card from the hand, answering an action, paying.
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { buildDeck, createMd, type Claim, type Color, type MdAction, type MdCard, type MdState } from '../../../src/games/monopoly-deal/engine';
import { MdGame, mdMoments } from '../../../src/games/monopoly-deal/ui/MdGame';
import { MD_RULES } from '../../../src/games/monopoly-deal/rules';
import { mdCues } from '../../../src/games/monopoly-deal/ui/sound';

afterEach(cleanup);

const DECK = buildDeck();
const card = (name: string, nth = 0): MdCard => DECK.filter((c) => c.name === name || c.action === name)[nth];
const placed = (name: string, color?: Color) => ({ card: card(name), color: color ?? card(name).colors[0] });

/** A three-player view for p0, in the play phase of p0's turn. */
function view(change: (s: MdState) => Partial<MdState> = () => ({}), mine: Partial<MdState['players'][number]> = {}): MdState {
  const s = createMd(
    [
      { name: 'You', isAI: false },
      { name: 'Ada', isAI: true },
      { name: 'Bo', isAI: true },
    ],
    3,
  );
  const base: MdState = { ...s, turn: 0, phase: 'play', deck: [], players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [], handCount: 0, ...mine } : { ...p, hand: [], handCount: 5 })) };
  return { ...base, ...change(base) };
}
const withPlayer = (s: MdState, id: string, change: Partial<MdState['players'][number]>) => s.players.map((p) => (p.id === id ? { ...p, ...change } : p));

function show(v: MdState) {
  const onAction = vi.fn<(a: MdAction | { type: 'REMATCH' } | { type: 'RESIGN' }) => void>();
  const nameFor = (id: string) => v.players.find((p) => p.id === id)!.name;
  render(<MdGame view={v} meId="p0" nameFor={nameFor} onAction={onAction} onExit={() => {}} exitLabel="Back" />);
  return onAction;
}

test('your turn starts by drawing; after that the pips count the 3 plays', () => {
  const onAction = show(view(() => ({ phase: 'draw' }), { hand: [card('1M')] }));
  fireEvent.click(screen.getByRole('button', { name: 'Draw 2 cards' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'DRAW' });
  cleanup();
  show(view(() => ({ plays: 1 })));
  expect(screen.getByLabelText('2 of 3 plays left')).toBeTruthy();
});

test('a money card goes in the bank; a property is laid down', () => {
  const onAction = show(view(undefined, { hand: [card('5M'), card('Boardwalk')] }));
  fireEvent.click(screen.getByRole('button', { name: /^5M/ }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '5M' })).getByRole('button', { name: 'Put it in the bank' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'BANK', card: card('5M').id });
  fireEvent.click(screen.getByRole('button', { name: /^Boardwalk/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Lay it down' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PROPERTY', card: card('Boardwalk').id });
});

test('a wild asks which colour it is laid as', () => {
  const onAction = show(view(undefined, { hand: [card('Red / Yellow Wild')], props: [placed('Kentucky Avenue')] }));
  fireEvent.click(screen.getByRole('button', { name: /^Red \/ Yellow Wild/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Lay it as Red (2/3)' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PROPERTY', card: card('Red / Yellow Wild').id, color: 'red' });
});

test('a Rent card charges a colour you own, with a Double the Rent if you add one', () => {
  const hand = [card('Rent: Dark Blue / Green'), card('double-rent')];
  const onAction = show(view(undefined, { hand, props: [placed('Park Place'), placed('Boardwalk')] }));
  fireEvent.click(screen.getByRole('button', { name: /^Rent: Dark Blue/ }));
  const menu = screen.getByRole('dialog', { name: 'Rent: Dark Blue / Green' });
  expect(within(menu).queryByRole('button', { name: /Green rent/ })).toBeNull();
  fireEvent.click(within(menu).getByRole('button', { name: /Charge Dark Blue rent/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Double the Rent' }));
  expect(screen.getByRole('button', { name: /^Charge everyone/ }).textContent).toContain('16M');
  fireEvent.click(screen.getByRole('button', { name: /^Charge everyone/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', card: hand[0].id, color: 'darkblue', target: undefined, doubles: [hand[1].id] });
});

test('a Sly Deal offers only properties outside full sets; a Deal Breaker only full sets', () => {
  const hand = [card('sly-deal'), card('deal-breaker')];
  const v = view((s) => ({ players: withPlayer({ ...s, players: withPlayer(s, 'p0', { hand, handCount: 2 }) }, 'p1', { props: [placed('Park Place'), placed('Boardwalk'), placed('Kentucky Avenue')] }) }));
  const onAction = show(v);
  fireEvent.click(screen.getByRole('button', { name: /^Sly Deal/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Play it: take a property' }));
  const taking = screen.getByRole('dialog', { name: 'Choose a property to take' });
  expect(within(taking).queryByRole('button', { name: /Boardwalk/ })).toBeNull();
  fireEvent.click(within(taking).getByRole('button', { name: 'Kentucky Avenue, from Ada' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', card: hand[0].id, target: 'p1', take: card('Kentucky Avenue').id });
  fireEvent.click(screen.getByRole('button', { name: /^Deal Breaker/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Play it: take a full set' }));
  fireEvent.click(screen.getByRole('button', { name: /Ada's Dark Blue set/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', card: hand[1].id, target: 'p1', color: 'darkblue' });
});

test('a debt is paid with cards you choose, and the button waits until they cover it', () => {
  const claim: Claim = { to: 'p1', from: 'p0', kind: 'pay', why: 'Debt Collector', amount: 5 };
  const onAction = show(view(() => ({ turn: 1, claims: [claim] }), { bank: [card('2M'), card('4M')], props: [placed('Boardwalk')] }));
  const dialog = screen.getByRole('dialog', { name: 'Pay what you owe' });
  const payButton = () => within(dialog).getByRole('button', { name: /^Pay / }) as HTMLButtonElement;
  expect(payButton().disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: /^2M/ }));
  expect(payButton().disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: /^4M/ }));
  expect(payButton().textContent).toContain('6M');
  fireEvent.click(payButton());
  expect(onAction).toHaveBeenCalledWith({ type: 'PAY', cards: [card('2M').id, card('4M').id] });
  expect(within(dialog).queryByRole('button', { name: 'Just Say No' })).toBeNull();
});

test('holding a Just Say No, you can refuse a debt or a steal, or answer one played against you', () => {
  const steal: Claim = { to: 'p1', from: 'p0', kind: 'steal', why: 'Sly Deal', card: card('Boardwalk').id };
  const mine = { hand: [card('just-say-no')], props: [placed('Boardwalk')] };
  const onAction = show(view(() => ({ turn: 1, claims: [steal] }), mine));
  expect(screen.getByText(/they take Boardwalk/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Just Say No' }));
  fireEvent.click(screen.getByRole('button', { name: 'Let it happen' }));
  expect(onAction.mock.calls.map((c) => c[0])).toEqual([{ type: 'NO' }, { type: 'ACCEPT' }]);
  cleanup();
  // My own Sly Deal was refused: answer it or let it stand.
  const again = show(view(() => ({ claims: [{ ...steal, to: 'p0', from: 'p1' }], nos: 1 }), { hand: [card('just-say-no')] }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Answer the Just Say No' })).getByRole('button', { name: 'Just Say No back' }));
  expect(again).toHaveBeenCalledWith({ type: 'NO' });
});

test('ending a turn with more than 7 cards asks which to discard', () => {
  const hand = ['1M', '2M', '3M', '4M', '5M', '10M', 'Boardwalk', 'Park Place'].map((n) => card(n));
  const onAction = show(view(undefined, { hand, handCount: 8 }));
  fireEvent.click(screen.getByRole('button', { name: 'End turn (discard 1)' }));
  const go = screen.getByRole('button', { name: 'Discard and end turn' }) as HTMLButtonElement;
  expect(go.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /^1M/ }));
  fireEvent.click(go);
  expect(onAction).toHaveBeenCalledWith({ type: 'END', discard: [card('1M').id] });
});

test('a wild on your table can be turned to its other colour on your turn', () => {
  const onAction = show(view(undefined, { props: [placed('Red / Yellow Wild', 'red')] }));
  fireEvent.click(screen.getByRole('button', { name: /lying as Red: change colour/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Yellow (1/3)' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'MOVE', card: card('Red / Yellow Wild').id, color: 'yellow' });
});

test("everyone's sets are on the table with their count and rent; a full set is marked", () => {
  show(view((s) => ({ players: withPlayer(s, 'p1', { props: [placed('Park Place'), placed('Boardwalk')], bank: [card('5M')] }) })));
  expect(screen.getByLabelText('Dark Blue: 2 of 2, a full set').className).toContain('is-full');
  expect(screen.getAllByText(/1\/3/).length).toBeGreaterThan(0);
});

test('the table is told of a Deal Breaker, a Just Say No and a completed set, each with its sound', () => {
  const before = view();
  const events = [
    { seq: 1, player: 'p1', kind: 'set' as const, target: 'p2', color: 'darkblue' as const, cards: ['Park Place', 'Boardwalk'] },
    { seq: 2, player: 'p0', kind: 'no' as const, target: 'p1', card: 'Sly Deal', count: 1 },
    { seq: 3, player: 'p2', kind: 'rent' as const, color: 'green' as const, amount: 7 },
    { seq: 4, player: 'p2', kind: 'bank' as const, card: '1M', amount: 1 },
  ];
  const after: MdState = { ...before, history: events, last: events[3], players: withPlayer(before, 'p1', { props: [placed('Park Place'), placed('Boardwalk')] }) };
  const who = (id: string) => (id === 'p0' ? 'You' : id);
  expect(mdMoments(before, after, who, () => '#fff').map((m) => `${m.kicker}: ${m.title}`)).toEqual(['p1: Deal Breaker!', 'You: Just Say No!', 'p2: Rent: ₥7M', 'p1: Dark Blue set complete']);
  expect(mdCues(before, after, 'p0')).toEqual(['set', 'no', 'rent', 'bank']);
});

test('the rule book covers every action card and every house rule', () => {
  const text = JSON.stringify(MD_RULES);
  for (const name of ['Deal Breaker', 'Just Say No', 'Sly Deal', 'Forced Deal', 'Debt Collector', "It's My Birthday", 'Pass Go', 'House', 'Hotel', 'Double the Rent', 'Sets to win', 'Build on Railroads and Utilities', 'No change is given']) {
    expect(text, name).toContain(name);
  }
});
