// @vitest-environment jsdom
// Exploding Kittens on screen: selecting cards, the Nope window, and the prompts.
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createEk, type Card, type EkAction, type EkState, type Kind } from '../../../src/games/exploding-kittens/engine';
import { EkGame, ekMoments } from '../../../src/games/exploding-kittens/ui/EkGame';
import { EK_RULES } from '../../../src/games/exploding-kittens/rules';
import { ekCues } from '../../../src/games/exploding-kittens/ui/sound';

afterEach(cleanup);

let nextId = 500;
const cards = (...kinds: Kind[]): Card[] => kinds.map((kind) => ({ id: nextId++, kind }));

/** A three-player view for p0 ("You"), with p0 to move and the given hand. */
function view(hand: Kind[], change: (s: EkState) => Partial<EkState> = () => ({})): EkState {
  const s = createEk(
    [
      { name: 'You', isAI: false },
      { name: 'Ada', isAI: true },
      { name: 'Bo', isAI: true },
    ],
    3,
  );
  const base: EkState = { ...s, turn: 0, deck: [], players: s.players.map((p, i) => (i === 0 ? { ...p, hand: cards(...hand), handCount: hand.length } : { ...p, hand: [], handCount: 8 })) };
  return { ...base, ...change(base) };
}

function show(v: EkState) {
  const onAction = vi.fn<(a: EkAction | { type: 'REMATCH' } | { type: 'RESIGN' }) => void>();
  const nameFor = (id: string) => v.players.find((p) => p.id === id)!.name;
  render(<EkGame view={v} meId="p0" nameFor={nameFor} onAction={onAction} onExit={() => {}} exitLabel="Back" />);
  return onAction;
}

test('on your turn you draw to end it, and the pile says how many Kittens it holds', () => {
  const onAction = show(view(['skip', 'beard']));
  expect(screen.getByText(/2 Kittens/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Draw a card to end your turn' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'DRAW' });
});

test('a single action card is selected, then played', () => {
  const v = view(['skip', 'beard']);
  const onAction = show(v);
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Play Skip' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', cards: [v.players[0].hand[0].id] });
});

test('cards that do nothing together cannot be played', () => {
  show(view(['beard', 'tacocat']));
  fireEvent.click(screen.getByRole('button', { name: 'Beard Cat' }));
  expect((screen.getByRole('button', { name: 'These cards do nothing together' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.getByRole('button', { name: 'Draw a card to end your turn' })).toBeTruthy();
});

test('a pair asks whose hand to take from', () => {
  const v = view(['beard', 'beard']);
  const onAction = show(v);
  for (const c of screen.getAllByRole('button', { name: 'Beard Cat' })) fireEvent.click(c);
  fireEvent.click(screen.getByRole('button', { name: 'Play the pair: steal a card' }));
  const dialog = screen.getByRole('dialog', { name: 'Choose a player' });
  fireEvent.click(within(dialog).getByRole('button', { name: /Bo/ }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', cards: v.players[0].hand.map((c) => c.id), target: 'p2' });
});

test('three of a kind asks for a player, then the card to name', () => {
  const v = view(['beard', 'beard', 'beard']);
  const onAction = show(v);
  for (const c of screen.getAllByRole('button', { name: 'Beard Cat' })) fireEvent.click(c);
  fireEvent.click(screen.getByRole('button', { name: 'Play three: ask for a card' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Choose a player' })).getByRole('button', { name: /Ada/ }));
  const naming = screen.getByRole('dialog', { name: 'Name a card' });
  expect(within(naming).queryByRole('button', { name: 'Exploding Kitten' })).toBeNull();
  fireEvent.click(within(naming).getByRole('button', { name: 'Defuse' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', cards: v.players[0].hand.map((c) => c.id), target: 'p1', named: 'defuse' });
});

test('five different cards take a card from the discard pile', () => {
  const v = view(['beard', 'tacocat', 'skip', 'favor', 'shuffle'], () => ({ discard: cards('defuse', 'nope') }));
  const onAction = show(v);
  for (const name of ['Beard Cat', 'Tacocat', 'Skip', 'Favor', 'Shuffle']) fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(screen.getByRole('button', { name: 'Play five: take a discard' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Take a card from the discard pile' })).getByRole('button', { name: 'Defuse' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PLAY', cards: v.players[0].hand.map((c) => c.id), take: v.discard[0].id });
});

test('someone else\'s action can be Noped or let go, if you hold a Nope', () => {
  const pending = { by: 'p1', play: 'attack' as const, cards: ['attack' as const], nopes: [], passed: [] };
  const onAction = show(view(['nope'], () => ({ turn: 1, pending })));
  expect(screen.getByText('Nope it?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nope!' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'NOPE' });
  fireEvent.click(screen.getByRole('button', { name: 'Let it happen' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'PASS' });
  cleanup();
  show(view(['skip'], () => ({ turn: 1, pending })));
  expect(screen.queryByRole('button', { name: 'Nope!' })).toBeNull();
  cleanup();
  // Your own card: no Nope for you, and the table sees the Nopes on it.
  show(view(['nope'], () => ({ pending: { ...pending, by: 'p0', nopes: ['p1'] } })));
  expect(screen.getByText('Ada: Nope')).toBeTruthy();
  expect(screen.getByText('As it stands, nothing happens')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Nope!' })).toBeTruthy();
});

test('a Favor asked of you is answered by choosing a card', () => {
  const v = view(['defuse', 'beard'], () => ({ turn: 1, favor: { from: 'p0', to: 'p1' } }));
  const onAction = show(v);
  expect(screen.getByText('Ada asks a Favor: choose a card to give')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Beard Cat' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'GIVE', card: v.players[0].hand[1].id });
});

test('a Defused Kitten goes back at the depth you choose', () => {
  const onAction = show(view(['beard'], () => ({ defusing: 'p0', deckCount: 9 })));
  const dialog = screen.getByRole('dialog', { name: 'Put the Kitten back' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Bottom' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Put it back' }));
  expect(onAction).toHaveBeenCalledWith({ type: 'INSERT', index: 9 });
});

test('See the Future shows its three cards to you, and the pile keeps the reminder', () => {
  const seen = { player: 'p0', cards: ['beard', 'exploding', 'skip'] as Kind[] };
  show(view(['skip'], (s) => ({ seen, players: s.players.map((p, i) => (i === 0 ? { ...p, known: seen.cards } : p)) })));
  const dialog = screen.getByRole('dialog', { name: 'The top three cards' });
  expect(within(dialog).getByText('Next')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
  expect(screen.queryByRole('dialog', { name: 'The top three cards' })).toBeNull();
  expect(screen.getByTitle('What you know of the top of the draw pile').textContent).toContain('Exploding Kitten');
});

test('an exploded player watches; the winner is named at the end', () => {
  show(view([], (s) => ({ turn: 1, players: s.players.map((p, i) => (i === 0 ? { ...p, out: true, hand: [] } : p)) })));
  expect(screen.getByText(/You exploded/)).toBeTruthy();
  cleanup();
  show(view([], (s) => ({ over: true, winner: 'p1', players: s.players.map((p, i) => (i === 1 ? p : { ...p, out: true })) })));
  expect(screen.getByText('is the last one standing')).toBeTruthy();
});

test('the table is told of a Kitten going off, a Defuse, a Nope and an Attack; each has its sound', () => {
  const before = view(['skip']);
  const events = [
    { seq: 1, player: 'p1', kind: 'explode' as const },
    { seq: 2, player: 'p2', kind: 'defuse' as const },
    { seq: 3, player: 'p0', kind: 'nope' as const, target: 'p2', count: 1 },
    { seq: 4, player: 'p2', kind: 'attack' as const, target: 'p0', count: 2 },
    { seq: 5, player: 'p2', kind: 'draw' as const },
  ];
  const after = { ...before, history: events, last: events[4] };
  const who = (id: string) => (id === 'p0' ? 'You' : id);
  expect(ekMoments(before, after, who, () => '#fff').map((m) => `${m.kicker}: ${m.title}`)).toEqual(['p1: exploded!', 'p2: Defused a Kitten', 'You: Nope!', 'p2: Attack!']);
  expect(ekCues(before, after, 'p0')).toEqual(['boom', 'defuse', 'nope', 'attack', 'draw']);
});

test('the rule book covers every card and every house rule', () => {
  const text = JSON.stringify(EK_RULES);
  for (const name of ['Exploding Kitten', 'Defuse', 'Nope', 'Attack', 'Skip', 'Favor', 'Shuffle', 'See the Future', 'Cat Cards', 'Two of a kind', 'Three of a kind', 'Five different cards', 'Cards dealt', 'Attacks stack', 'Short game']) {
    expect(text, name).toContain(name);
  }
});
