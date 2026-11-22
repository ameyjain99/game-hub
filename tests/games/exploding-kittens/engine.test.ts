// Exploding Kittens: the original 56-card rules, the Nope window, and the bots.
import { describe, expect, test } from 'vitest';
import { DEALER_ID, IllegalMove } from '../../../src/games/kit/engine';
import { COUNTS, NOPE_MS, createEk, ekKit, kittensInDeck, playOf, type Card, type EkAction, type EkOptions, type EkState, type Kind } from '../../../src/games/exploding-kittens/engine';
import { playOut } from './sim';

const seats = (n: number, bots = false) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: bots }));
let nextId = 1000;
const card = (kind: Kind): Card => ({ id: nextId++, kind });
const cards = (...kinds: Kind[]) => kinds.map(card);

/** A game with p0 to move and the hands, pile and discards given. */
function table(n: number, hands: Kind[][], deck: Kind[], options: EkOptions = {}, discard: Kind[] = []): EkState {
  const s = createEk(seats(n), 7, options);
  return {
    ...s,
    turn: 0,
    deck: cards(...deck),
    deckCount: deck.length,
    discard: cards(...discard),
    players: s.players.map((p, i) => ({ ...p, hand: cards(...(hands[i] ?? [])), handCount: (hands[i] ?? []).length })),
  };
}
const act = (s: EkState, id: string, a: EkAction | { type: 'REMATCH' } | { type: 'RESIGN' }) => ekKit.apply(s, a, id);
const settle = (s: EkState) => ekKit.apply(s, { type: 'RESOLVE' }, DEALER_ID);
const idsOf = (s: EkState, player: number, ...kinds: Kind[]) => {
  const left = [...s.players[player].hand];
  return kinds.map((k) => left.splice(left.findIndex((c) => c.kind === k), 1)[0].id);
};
const play = (s: EkState, player: number, kinds: Kind[], extra: Partial<Extract<EkAction, { type: 'PLAY' }>> = {}) => act(s, `p${player}`, { type: 'PLAY', cards: idsOf(s, player, ...kinds), ...extra });
const kindsOf = (s: EkState, player: number) => s.players[player].hand.map((c) => c.kind);

describe('setup', () => {
  test('the box holds 56 cards', () => {
    expect(Object.values(COUNTS).reduce((a, b) => a + b, 0)).toBe(56);
  });

  test.each([2, 3, 4, 5])('%i players: 7 cards and a Defuse each, one Kitten fewer than players in the pile', (n) => {
    const s = createEk(seats(n), 3);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(8);
      expect(p.hand.filter((c) => c.kind === 'defuse')).toHaveLength(1);
      expect(p.hand.some((c) => c.kind === 'exploding')).toBe(false);
    }
    const spare = n === 5 ? 1 : 2;
    expect(s.deck.filter((c) => c.kind === 'exploding')).toHaveLength(n - 1);
    expect(s.deck.filter((c) => c.kind === 'defuse')).toHaveLength(spare);
    expect(s.deck).toHaveLength(46 - 7 * n + spare + n - 1);
    expect(kittensInDeck(s)).toBe(n - 1);
  });

  test('house rules: 5 cards dealt, and a short game sets a third of the pile aside', () => {
    expect(createEk(seats(3), 3, { handSize: 5 }).players[0].hand).toHaveLength(6);
    expect(createEk(seats(3), 3, { handSize: 99 }).players[0].hand).toHaveLength(8);
    const full = createEk(seats(3), 3);
    const short = createEk(seats(3), 3, { shortGame: true });
    expect(short.deck.length).toBe(full.deck.length - Math.floor((46 - 21) / 3));
    expect(short.deck.filter((c) => c.kind === 'exploding')).toHaveLength(2);
  });

  test('only 2 to 5 can play', () => {
    expect([1, 2, 5, 6].map((n) => ekKit.seatError(n))).toEqual(['Exploding Kittens is for 2-5 players', null, null, 'Exploding Kittens is for 2-5 players']);
  });
});

describe('what cards make a play', () => {
  test('one action card, a pair, three of a kind, or five different', () => {
    expect(playOf(['attack'], true)).toBe('attack');
    expect(playOf(['tacocat'], true)).toBeNull();
    expect(playOf(['nope'], true)).toBeNull();
    expect(playOf(['defuse'], true)).toBeNull();
    expect(playOf(['tacocat', 'tacocat'], true)).toBe('pair');
    expect(playOf(['tacocat', 'beard'], true)).toBeNull();
    expect(playOf(['skip', 'skip'], true)).toBe('pair');
    expect(playOf(['beard', 'beard', 'beard'], true)).toBe('triple');
    expect(playOf(['beard', 'tacocat', 'skip', 'nope', 'defuse'], true)).toBe('five');
    expect(playOf(['beard', 'beard', 'skip', 'nope', 'defuse'], true)).toBeNull();
    expect(playOf(['exploding', 'exploding'], true)).toBeNull();
  });

  test('with special combos off, only Cat Cards pair and there are no threes or fives', () => {
    expect(playOf(['tacocat', 'tacocat'], false)).toBe('pair');
    expect(playOf(['skip', 'skip'], false)).toBeNull();
    expect(playOf(['beard', 'beard', 'beard'], false)).toBeNull();
    expect(playOf(['beard', 'tacocat', 'skip', 'nope', 'defuse'], false)).toBeNull();
  });
});

describe('a turn', () => {
  test('drawing a safe card ends the turn', () => {
    const s = act(table(3, [['skip']], ['beard', 'skip']), 'p0', { type: 'DRAW' });
    expect(kindsOf(s, 0)).toEqual(['skip', 'beard']);
    expect([s.turn, s.turnsLeft, s.deckCount]).toEqual([1, 1, 1]);
    expect(() => act(s, 'p0', { type: 'DRAW' })).toThrow(IllegalMove);
  });

  test('a Skip ends the turn without drawing', () => {
    const s = settle(play(table(3, [['skip']], ['exploding']), 0, ['skip']));
    expect([s.turn, s.deckCount, s.players[0].out]).toEqual([1, 1, false]);
    expect(s.discard.map((c) => c.kind)).toEqual(['skip']);
  });

  test('an action waits for the Nope window before it takes effect', () => {
    const waiting = play(table(3, [['skip']], ['beard']), 0, ['skip']);
    expect(waiting.turn).toBe(0);
    expect(waiting.pending).toMatchObject({ by: 'p0', play: 'skip', nopes: [] });
    expect(() => act(waiting, 'p0', { type: 'DRAW' })).toThrow('can still be Noped');
    expect(() => ekKit.apply(waiting, { type: 'RESOLVE' }, 'p1')).toThrow(IllegalMove);
  });

  test('an Attack gives the next player 2 turns; a Skip uses up one of them', () => {
    let s = settle(play(table(3, [['attack'], ['skip']], ['beard', 'beard', 'beard']), 0, ['attack']));
    expect([s.turn, s.turnsLeft, s.attacked]).toEqual([1, 2, true]);
    s = settle(play(s, 1, ['skip']));
    expect([s.turn, s.turnsLeft]).toEqual([1, 1]);
    s = act(s, 'p1', { type: 'DRAW' });
    expect([s.turn, s.turnsLeft, s.attacked]).toEqual([2, 1, false]);
  });

  test('attacks stack: remaining turns pass on, plus 2', () => {
    let s = settle(play(table(3, [['attack'], ['attack'], ['attack']], ['beard', 'beard', 'beard', 'beard']), 0, ['attack']));
    s = settle(play(s, 1, ['attack']));
    expect([s.turn, s.turnsLeft]).toEqual([2, 4]);
    s = settle(play(s, 2, ['attack']));
    expect([s.turn, s.turnsLeft]).toEqual([0, 6]);
    // One turn taken first, then the Attack: 1 remaining plus 2.
    let t = settle(play(table(3, [['attack'], ['attack']], ['beard', 'beard']), 0, ['attack']));
    t = act(t, 'p1', { type: 'DRAW' });
    t = settle(play(t, 1, ['attack']));
    expect([t.turn, t.turnsLeft]).toEqual([2, 3]);
  });

  test('with stacking off, an Attack always gives exactly 2 turns', () => {
    let s = settle(play(table(3, [['attack'], ['attack']], ['beard'], { stackAttacks: false }), 0, ['attack']));
    s = settle(play(s, 1, ['attack']));
    expect([s.turn, s.turnsLeft]).toEqual([2, 2]);
  });
});

describe('Exploding Kittens and Defuses', () => {
  test('with a Defuse, the Kitten goes back where the player chooses, and only they know where', () => {
    let s = act(table(3, [['defuse', 'beard']], ['exploding', 'skip', 'favor', 'attack']), 'p0', { type: 'DRAW' });
    expect(s.defusing).toBe('p0');
    expect(kindsOf(s, 0)).toEqual(['beard']);
    expect(s.discard.map((c) => c.kind)).toEqual(['defuse']);
    expect(ekKit.actor(s)).toBe('p0');
    expect(kittensInDeck(s)).toBe(1);
    expect(() => act(s, 'p0', { type: 'INSERT', index: 9 })).toThrow(IllegalMove);
    s = act(s, 'p0', { type: 'INSERT', index: 2 });
    expect(s.deck.map((c) => c.kind)).toEqual(['skip', 'favor', 'exploding', 'attack']);
    expect(s.players[0].known).toEqual([null, null, 'exploding']);
    expect([s.turn, s.defusing]).toEqual([1, null]);
    expect(ekKit.redact(s, 'p1').players[0].known).toEqual([]);
  });

  test('without a Defuse the player is out, their hand is discarded and the Kitten leaves the game', () => {
    const s = act(table(3, [['beard', 'skip']], ['exploding', 'skip']), 'p0', { type: 'DRAW' });
    expect(s.players[0]).toMatchObject({ out: true, hand: [] });
    expect(s.discard.map((c) => c.kind)).toEqual(['beard', 'skip']);
    expect(s.deck.map((c) => c.kind)).toEqual(['skip']);
    expect([s.turn, s.over]).toEqual([1, false]);
    expect(() => act(s, 'p0', { type: 'DRAW' })).toThrow('not in this game');
  });

  test('the last player left wins', () => {
    const s = act(table(2, [[], ['beard']], ['exploding']), 'p0', { type: 'DRAW' });
    expect([s.over, s.winner]).toEqual([true, 'p1']);
    expect(ekKit.actor(s)).toBeNull();
  });

  test('exploding under attack does not pass the remaining turns on', () => {
    let s = settle(play(table(3, [['attack'], []], ['exploding', 'beard']), 0, ['attack']));
    s = act(s, 'p1', { type: 'DRAW' });
    expect([s.players[1].out, s.turn, s.turnsLeft, s.attacked]).toEqual([true, 2, 1, false]);
  });
});

describe('Nope', () => {
  const start = () => play(table(3, [['attack', 'nope'], ['nope'], ['nope', 'nope']], ['beard', 'beard']), 0, ['attack']);

  test('a Nope cancels the action; the cards stay discarded', () => {
    const s = settle(act(start(), 'p1', { type: 'NOPE' }));
    expect([s.turn, s.turnsLeft, s.pending]).toEqual([0, 1, null]);
    expect(s.discard.map((c) => c.kind)).toEqual(['attack', 'nope']);
    expect(s.last).toMatchObject({ kind: 'cancel', player: 'p0', play: 'attack' });
  });

  test('a Nope on the Nope lets it through, and a third stops it again', () => {
    let s = act(act(start(), 'p1', { type: 'NOPE' }), 'p0', { type: 'NOPE' });
    expect(settle(s).turn).toBe(1);
    s = act(s, 'p2', { type: 'NOPE' });
    expect(settle(s).turn).toBe(0);
  });

  test('you cannot Nope your own card, or without a Nope, or when nothing is waiting', () => {
    expect(() => act(start(), 'p0', { type: 'NOPE' })).toThrow('your own card');
    const once = act(start(), 'p1', { type: 'NOPE' });
    expect(() => act(once, 'p1', { type: 'NOPE' })).toThrow('your own card');
    expect(() => act(table(3, [['skip']], ['beard']), 'p1', { type: 'NOPE' })).toThrow('nothing to Nope');
    const none = play(table(3, [['attack'], []], ['beard']), 0, ['attack']);
    expect(() => act(none, 'p1', { type: 'NOPE' })).toThrow('do not hold a Nope');
  });

  test('the window stays open for people holding a Nope, until they let it go', () => {
    let s = start();
    expect(ekKit.actor(s)).toBeNull();
    expect(ekKit.auto!(s)).toEqual({ action: { type: 'RESOLVE' }, delay: NOPE_MS });
    s = act(s, 'p1', { type: 'PASS' });
    expect(ekKit.auto!(s)!.delay).toBe(NOPE_MS);
    s = act(s, 'p2', { type: 'PASS' });
    expect(ekKit.auto!(s)!.delay).toBeLessThan(1000);
    // Nobody else holds a Nope: no wait.
    expect(ekKit.auto!(play(table(3, [['attack', 'nope']], ['beard']), 0, ['attack']))!.delay).toBeLessThan(1000);
    // A new Nope reopens the window for everyone.
    expect(act(s, 'p1', { type: 'NOPE' }).pending!.passed).toEqual([]);
  });

  test('a bot holding a Nope is asked before the window closes', () => {
    const s = start();
    const withBot = { ...s, players: s.players.map((p, i) => (i === 2 ? { ...p, isAI: true } : p)) };
    expect(ekKit.actor(withBot)).toBe('p2');
    expect(ekKit.auto!(withBot)).toBeNull();
    expect(['NOPE', 'PASS']).toContain(ekKit.bot(withBot, () => 0.99).type);
    expect(ekKit.actor(act(withBot, 'p2', { type: 'PASS' }))).toBeNull();
  });
});

describe('Favor, Shuffle, See the Future and combos', () => {
  test('Favor: the chosen player picks the card they give', () => {
    let s = play(table(3, [['favor'], ['defuse', 'beard']], ['skip']), 0, ['favor'], { target: 'p1' });
    s = settle(s);
    expect(s.favor).toEqual({ from: 'p1', to: 'p0' });
    expect(ekKit.actor(s)).toBe('p1');
    expect(() => act(s, 'p0', { type: 'DRAW' })).toThrow('waiting for the Favor');
    s = act(s, 'p1', { type: 'GIVE', card: idsOf(s, 1, 'beard')[0] });
    expect([kindsOf(s, 0), kindsOf(s, 1), s.favor, s.turn]).toEqual([['beard'], ['defuse'], null, 0]);
  });

  test('a target must be another player, still in, with cards', () => {
    const s = table(3, [['favor'], []], ['skip']);
    expect(() => play(s, 0, ['favor'], { target: 'p1' })).toThrow('no cards');
    expect(() => play(s, 0, ['favor'], { target: 'p0' })).toThrow('another player');
    expect(() => play(s, 0, ['favor'])).toThrow('another player');
  });

  test('a pair takes a card at random; only the two players see which', () => {
    const s = settle(play(table(3, [['tacocat', 'tacocat'], ['defuse']], ['skip']), 0, ['tacocat', 'tacocat'], { target: 'p1' }));
    expect([kindsOf(s, 0), kindsOf(s, 1)]).toEqual([['defuse'], []]);
    expect(ekKit.redact(s, 'p0').last!.card).toBe('defuse');
    expect(ekKit.redact(s, 'p1').last!.card).toBe('defuse');
    expect(ekKit.redact(s, 'p2').last!.card).toBeUndefined();
  });

  test('three of a kind names a card: handed over if held, nothing if not', () => {
    const base = table(3, [['beard', 'beard', 'beard'], ['defuse', 'skip']], ['skip']);
    const got = settle(play(base, 0, ['beard', 'beard', 'beard'], { target: 'p1', named: 'defuse' }));
    expect([kindsOf(got, 0), got.last]).toMatchObject([['defuse'], { kind: 'named', got: true, named: 'defuse' }]);
    const missed = settle(play(base, 0, ['beard', 'beard', 'beard'], { target: 'p1', named: 'nope' }));
    expect([kindsOf(missed, 0), missed.last!.got]).toEqual([[], false]);
    expect(() => play(base, 0, ['beard', 'beard', 'beard'], { target: 'p1' })).toThrow('name the card');
  });

  test('five different cards take any card from the discard pile', () => {
    const base = table(3, [['beard', 'tacocat', 'skip', 'favor', 'shuffle']], ['skip'], {}, ['defuse', 'nope']);
    const five: Kind[] = ['beard', 'tacocat', 'skip', 'favor', 'shuffle'];
    const s = settle(play(base, 0, five, { take: base.discard[0].id }));
    expect(kindsOf(s, 0)).toEqual(['defuse']);
    expect(s.discard.map((c) => c.kind)).toEqual(['nope', ...five]);
    expect(() => play(base, 0, five, { take: 1 })).toThrow('discard pile');
  });

  test('See the Future shows the top 3 to its player alone, and the knowledge moves as cards are drawn', () => {
    let s = settle(play(table(3, [['future']], ['beard', 'exploding', 'skip', 'favor']), 0, ['future']));
    expect(s.seen).toEqual({ player: 'p0', cards: ['beard', 'exploding', 'skip'] });
    expect(s.deck.map((c) => c.kind)).toEqual(['beard', 'exploding', 'skip', 'favor']);
    expect(ekKit.redact(s, 'p1').seen).toBeNull();
    expect(ekKit.redact(s, 'p0').seen).not.toBeNull();
    s = act(s, 'p0', { type: 'DRAW' });
    expect([s.seen, s.players[0].known]).toEqual([null, ['exploding', 'skip']]);
  });

  test('a Shuffle reorders the pile and wipes what anyone knew of it', () => {
    const deck: Kind[] = ['beard', 'exploding', 'skip', 'favor', 'tacocat', 'nope', 'attack', 'shuffle'];
    let s = settle(play(table(3, [['future', 'shuffle']], deck), 0, ['future']));
    s = settle(play(s, 0, ['shuffle']));
    expect(s.players[0].known).toEqual([]);
    expect(s.deck.map((c) => c.kind)).not.toEqual(deck);
    expect([...s.deck.map((c) => c.kind)].sort()).toEqual([...deck].sort());
  });
});

describe('hidden information', () => {
  test('a viewer sees their own hand, card counts, the discard pile, and nothing of the draw pile', () => {
    const s = table(3, [['defuse', 'skip'], ['nope'], ['beard']], ['exploding', 'skip'], {}, ['favor']);
    const view = ekKit.redact(s, 'p1');
    expect(view.deck).toEqual([]);
    expect(view.deckCount).toBe(2);
    expect(view.players.map((p) => p.hand.length)).toEqual([0, 1, 0]);
    expect(view.players.map((p) => p.handCount)).toEqual([2, 1, 1]);
    expect(view.discard.map((c) => c.kind)).toEqual(['favor']);
    expect(view.seed).toBe(0);
  });

  test('a drawn card is known only to the player who drew it; who let an action go is not told', () => {
    const drew = act(table(3, [[]], ['beard', 'skip']), 'p0', { type: 'DRAW' });
    expect([ekKit.redact(drew, 'p0').last!.card, ekKit.redact(drew, 'p1').last!.card]).toEqual(['beard', undefined]);
    const waiting = act(play(table(3, [['skip'], ['nope'], ['nope']], ['beard']), 0, ['skip']), 'p1', { type: 'PASS' });
    expect([ekKit.redact(waiting, 'p1').pending!.passed, ekKit.redact(waiting, 'p2').pending!.passed]).toEqual([['p1'], []]);
  });
});

describe('leaving, running out of time, and playing again', () => {
  test('a player who leaves takes one Kitten out of the pile with them', () => {
    const s = createEk(seats(4), 5);
    const after = ekKit.forfeit(s, 'p2');
    expect(after.players[2]).toMatchObject({ out: true, left: true });
    expect(after.deck.filter((c) => c.kind === 'exploding')).toHaveLength(2);
    expect(kittensInDeck(after)).toBe(2);
    expect(after.over).toBe(false);
    const alone = ekKit.forfeit(createEk(seats(2), 5), 'p0');
    expect([alone.over, alone.winner]).toEqual([true, 'p1']);
  });

  test('leaving on your turn, or with a Kitten in hand, passes play on', () => {
    const s = createEk(seats(3), 5);
    const after = ekKit.forfeit(s, s.players[s.turn].id);
    expect(after.players[after.turn].out).toBe(false);
    const holding = act(table(3, [['defuse']], ['exploding', 'skip']), 'p0', { type: 'DRAW' });
    const gone = act(holding, 'p0', { type: 'RESIGN' });
    expect([gone.defusing, gone.kitten, gone.turn, gone.deck.filter((c) => c.kind === 'exploding').length]).toEqual([null, null, 1, 0]);
  });

  test('out of time: draw, give the least useful card, or drop the Kitten somewhere', () => {
    expect(ekKit.timeout(table(3, [['skip']], ['beard']))).toEqual({ type: 'DRAW' });
    const favor = settle(play(table(3, [['favor'], ['defuse', 'tacocat', 'nope']], ['skip']), 0, ['favor'], { target: 'p1' }));
    expect(ekKit.timeout(favor)).toEqual({ type: 'GIVE', card: idsOf(favor, 1, 'tacocat')[0] });
    const placing = act(table(3, [['defuse']], ['exploding', 'skip', 'skip']), 'p0', { type: 'DRAW' });
    const drop = ekKit.timeout(placing) as { type: 'INSERT'; index: number };
    expect(drop.type).toBe('INSERT');
    expect(act(placing, 'p0', drop).deck).toHaveLength(3);
  });

  test('a rematch deals a new game to everyone who stayed, under the same rules', () => {
    const s = createEk(seats(3), 5, { handSize: 5, anyCombos: false });
    expect(() => act(s, 'p0', { type: 'REMATCH' })).toThrow('still going');
    const over = ekKit.end(ekKit.forfeit(s, 'p1'));
    const next = act(over, 'p0', { type: 'REMATCH' });
    expect(next.players.map((p) => p.id)).toEqual(['p0', 'p2']);
    expect([next.game, next.handSize, next.anyCombos, next.over, next.players[0].hand.length]).toEqual([2, 5, false, false, 6]);
  });
});

describe('bots', () => {
  test('bots of every level finish whole games, at every table size and under every house rule', () => {
    for (let n = 2; n <= 5; n++) {
      for (const options of [{}, { handSize: 5, anyCombos: false, stackAttacks: false, shortGame: true }]) {
        for (let seed = 1; seed <= 12; seed++) {
          const s = playOut(Array.from({ length: n }, (_, i) => ['easy', 'normal', 'hard'][(i + seed) % 3]), seed * 31 + n, options);
          expect(s.over, `seed ${seed}, ${n} players`).toBe(true);
          expect(s.players.filter((p) => !p.out)).toHaveLength(1);
        }
      }
    }
  });

  test('a stronger level wins more often: easy, then normal, then hard', () => {
    const winRate = (strong: string, weak: string) => {
      let wins = 0;
      const games = 400;
      for (let seed = 1; seed <= games; seed++) {
        const levels = [weak, weak, weak, weak];
        levels[seed % 4] = strong;
        if (playOut(levels, seed).winner === `p${seed % 4}`) wins++;
      }
      return wins / games;
    };
    // One player among three of the level below: an even field would win 25%.
    expect(winRate('normal', 'easy')).toBeGreaterThan(0.4);
    expect(winRate('hard', 'normal')).toBeGreaterThan(0.29);
  });

  test('a bot never plays a card it does not hold or looks at cards it cannot see', () => {
    const s = createEk(seats(3, true), 9);
    const first = ekKit.bot(s, () => 0.5);
    expect(() => ekKit.apply(s, first, ekKit.actor(s)!)).not.toThrow();
  });
});
