import { describe, expect, test } from 'vitest';
import { DEALER_ID, IllegalMove } from '../../../src/games/kit/engine';
import {
  bringInSeat,
  createPoker,
  optionsFor,
  pokerKit,
  stakes,
  type PokerAction,
  type PokerState,
} from '../../../src/games/poker/engine';
import type { Variant } from '../../../src/games/poker/cards';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: false }));
const create = (n: number, variant: Variant = 'holdem', seed = 1) => createPoker(seats(n), seed, { variant });
/** The seat `k` places after the button. */
const at = (s: PokerState, k: number) => (s.button + k) % s.players.length;
const act = (s: PokerState, a: PokerAction) => pokerKit.apply(s, a, s.players[s.toAct!].id);
const dealerStep = (s: PokerState) => pokerKit.apply(s, pokerKit.auto!(s)!.action, DEALER_ID);
/** Let the dealer deal until someone must act or the hand's result is up. */
function settle(s: PokerState): PokerState {
  while (s.phase === 'dealing') s = dealerStep(s);
  return s;
}
/** Give seats chosen cards, and put `top` on top of the deck. */
function rig(s: PokerState, holes: Record<number, string>, top = ''): PokerState {
  const cards = top ? top.split(' ') : [];
  return {
    ...s,
    players: s.players.map((p, i) => (holes[i] ? { ...p, hole: holes[i].split(' ') } : p)),
    deck: [...cards, ...s.deck.filter((c) => !cards.includes(c))],
  };
}
const chips = (s: PokerState) => s.pot + s.players.reduce((t, p) => t + p.stack + p.bet, 0);

describe("Texas Hold'em", () => {
  test('the two seats after the button post the blinds; two cards each; the next seat acts first', () => {
    const s = create(4);
    expect(stakes(s)).toMatchObject({ sb: 10, bb: 20 });
    expect(s.players[at(s, 1)].bet).toBe(10);
    expect(s.players[at(s, 2)].bet).toBe(20);
    expect(s.players.every((p) => p.hole.length === 2)).toBe(true);
    expect(s.toAct).toBe(at(s, 3));
    expect(s.street).toBe('preflop');
  });

  test('heads-up, the button posts the small blind and acts first before the flop, last after it', () => {
    let s = create(2);
    expect(s.players[s.button].bet).toBe(10);
    expect(s.toAct).toBe(s.button);
    s = act(s, { type: 'CALL' });
    expect(s.toAct).toBe(at(s, 1)); // the big blind's option
    s = settle(act(s, { type: 'CHECK' }));
    expect(s.street).toBe('flop');
    expect(s.board).toHaveLength(3);
    expect(s.toAct).toBe(at(s, 1));
  });

  test('checking it down deals the flop, turn and river, then shows every hand', () => {
    let s = create(3);
    s = act(s, { type: 'CALL' }); // button
    s = act(s, { type: 'CALL' }); // small blind
    s = settle(act(s, { type: 'CHECK' })); // big blind's option
    expect(s.pot).toBe(60);
    for (const street of ['flop', 'turn', 'river']) {
      expect(s.street).toBe(street);
      expect(s.toAct).toBe(at(s, 1));
      for (let i = 0; i < 3; i++) s = act(s, { type: 'CHECK' });
      s = settle(s);
    }
    expect(s.board).toHaveLength(5);
    expect(s.phase).toBe('result');
    expect(s.result?.showdown).toBe(true);
    expect(chips(s)).toBe(4500);
  });

  test('no-limit: a raise is at least the size of the last raise, and all-in is always allowed', () => {
    let s = create(3);
    s = act(s, { type: 'RAISE', to: 60 }); // button: a raise of 40
    const o = optionsFor(s)!;
    expect(o.minTo).toBe(100);
    expect(o.maxTo).toBe(1500);
    expect(() => act(s, { type: 'RAISE', to: 90 })).toThrow(IllegalMove);
    s = act(s, { type: 'RAISE', to: 1500 });
    expect(s.players[at(s, 1)].allIn).toBe(true);
  });

  test("an all-in short of a full raise doesn't reopen the betting for those who acted", () => {
    let s = create(3);
    s.players[at(s, 2)].stack = 50; // the big blind has 70 in all
    s = act(s, { type: 'RAISE', to: 60 }); // button
    s = act(s, { type: 'CALL' }); // small blind
    s = act(s, { type: 'RAISE', to: 70 }); // big blind all-in: 10 more is short of a 40 raise
    expect(s.toAct).toBe(s.button);
    const o = optionsFor(s)!;
    expect(o.toCall).toBe(10);
    expect(o.canRaise).toBe(false);
    expect(() => act(s, { type: 'RAISE', to: 200 })).toThrow(IllegalMove);
  });

  test('everyone folds to a raise: the raiser takes the pot and the uncalled chips come back', () => {
    let s = create(3);
    const [btn, sb, bb] = [0, 1, 2].map((k) => at(s, k));
    s = act(s, { type: 'RAISE', to: 60 });
    s = act(s, { type: 'FOLD' });
    s = act(s, { type: 'FOLD' });
    expect(s.phase).toBe('result');
    expect(s.result?.showdown).toBe(false);
    expect([s.players[btn].stack, s.players[sb].stack, s.players[bb].stack]).toEqual([1530, 1490, 1480]);
  });

  test('side pots: each pot goes to the best hand among the players who paid into it', () => {
    let s = create(3);
    const [c, a, b] = [0, 1, 2].map((k) => at(s, k)); // button C, small blind A, big blind B
    s.players[a].stack = 90; // 100 in all
    s.players[b].stack = 280; // 300 in all
    s = rig(s, { [a]: 'AS AD', [b]: 'KS KD', [c]: 'QS QD' }, '2C 7H 9D 3S 4H');
    s = act(s, { type: 'RAISE', to: 1500 }); // C all-in
    s = act(s, { type: 'CALL' }); // A all-in for 100
    s = settle(act(s, { type: 'CALL' })); // B all-in for 300: the board runs out
    expect(s.board).toEqual(['2C', '7H', '9D', '3S', '4H']);
    expect(s.result?.pots.map((p) => [p.amount, p.winners])).toEqual([
      [300, [s.players[a].id]],
      [400, [s.players[b].id]],
    ]);
    expect([s.players[a].stack, s.players[b].stack, s.players[c].stack]).toEqual([300, 400, 1200]);
  });

  test('a split pot shares evenly; the odd chip goes to the first winner after the button', () => {
    let s = create(3);
    const [c, a, b] = [0, 1, 2].map((k) => at(s, k));
    s.players[a].stack = 25; // 35 in all
    s = rig(s, { [a]: 'TC 2D', [b]: 'TD 2H', [c]: '3C 2S' }, '5C 6D 7H 8S 9C');
    s = act(s, { type: 'CALL' }); // C calls 20
    s = act(s, { type: 'RAISE', to: 35 }); // A all-in, short of a full raise
    s = act(s, { type: 'CALL' }); // B
    s = settle(act(s, { type: 'CALL' })); // C
    while (s.phase === 'betting') s = settle(act(s, { type: 'CHECK' }));
    expect(s.result?.pots).toEqual([{ amount: 105, winners: [s.players[a].id, s.players[b].id] }]);
    expect(s.players[a].stack).toBe(53);
    expect(s.players[b].stack).toBe(1500 - 35 + 52);
  });
});

describe('Omaha', () => {
  test('four cards each, and pot-limit caps a raise at the pot after calling', () => {
    const s = create(3, 'omaha');
    expect(s.players.every((p) => p.hole.length === 4)).toBe(true);
    expect(optionsFor(s)!.maxTo).toBe(70);
  });
});

describe('Short Deck', () => {
  test('deals from 36 cards: no 2s to 5s', () => {
    const s = create(6, 'shortdeck');
    expect(s.deck.length + 12).toBe(36);
    expect([...s.deck, ...s.players.flatMap((p) => p.hole as string[])].some((c) => '2345'.includes(c[0]))).toBe(false);
  });

  test('allows six players at most', () => {
    expect(pokerKit.seatError(6, { variant: 'shortdeck' })).toBeNull();
    expect(pokerKit.seatError(7, { variant: 'shortdeck' })).not.toBeNull();
    expect(pokerKit.seatError(9, { variant: 'holdem' })).toBeNull();
    expect(pokerKit.seatError(9, { variant: 'stud' })).not.toBeNull();
  });
});

describe('Seven-Card Stud', () => {
  test('antes, two cards down and one up, and the bring-in acts first', () => {
    const s = create(3, 'stud');
    expect(stakes(s)).toMatchObject({ ante: 5, bringIn: 10, small: 20, big: 40 });
    expect(s.players.every((p) => p.hole.length === 3 && p.up.join() === 'false,false,true')).toBe(true);
    expect(s.pot).toBe(15);
    expect(s.toAct).toBe(bringInSeat(s));
    const o = optionsFor(s)!;
    expect(o.bringIn).toBe(10);
    expect(o.minTo).toBe(20); // or complete to the small bet
    expect(o.canCheck).toBe(false);
  });

  test('the lowest upcard brings in; on equal ranks, clubs are lowest, then diamonds, hearts, spades', () => {
    const s = create(3, 'stud');
    const up = (cards: string[], variant: Variant = 'stud') => ({ ...s, variant, players: s.players.map((p, i) => ({ ...p, hole: ['AS', 'AH', cards[i]] })) });
    expect(bringInSeat(up(['5D', '2H', '9C']))).toBe(1);
    expect(bringInSeat(up(['2S', '2C', '2D']))).toBe(1);
    // Razz: the highest upcard (aces are low) brings in; on equal ranks, spades are highest.
    expect(bringInSeat(up(['KD', 'KS', '3C'], 'razz'))).toBe(1);
    expect(bringInSeat(up(['AD', '2S', '3C'], 'razz'))).toBe(2);
  });

  test('fourth street goes to the best board showing; fifth street bets double', () => {
    let s = create(3, 'stud');
    s = act(s, { type: 'BRING_IN' });
    s = act(s, { type: 'RAISE', to: 20 }); // completes
    while (s.phase === 'betting') s = act(s, { type: 'CALL' });
    // Deal order runs clockwise from the seat after the button.
    s = rig(s, { [at(s, 1)]: '9S 9H 2C', [at(s, 2)]: 'AS AH 5H', [at(s, 0)]: 'JS JH KH' }, '7D 5S QC');
    s = settle(s);
    expect(s.street).toBe('fourth');
    expect(s.players.every((p) => p.hole.length === 4)).toBe(true);
    expect(s.toAct).toBe(at(s, 2)); // a pair of fives showing
    expect(optionsFor(s)!.minTo).toBe(20);
    while (s.phase === 'betting') s = act(s, { type: 'CHECK' });
    s = settle(s);
    expect(s.street).toBe('fifth');
    expect(optionsFor(s)!.minTo).toBe(40);
  });

  test('fixed limit stops at a bet and three raises, unless only two players are in', () => {
    let s = create(3, 'stud');
    s = act(s, { type: 'BRING_IN' });
    for (const to of [20, 40, 60, 80]) s = act(s, { type: 'RAISE', to });
    expect(optionsFor(s)!.canRaise).toBe(false);
    s = act(s, { type: 'FOLD' });
    expect(optionsFor(s)!.canRaise).toBe(true);
  });

  test('when the deck runs short on seventh street, one card is dealt face up for everyone', () => {
    let s = create(8, 'stud');
    s = act(s, { type: 'BRING_IN' });
    while (s.phase === 'betting') s = act(s, { type: 'CALL' });
    s = settle(s);
    while (s.street !== 'seventh') {
      while (s.phase === 'betting') s = act(s, { type: 'CHECK' });
      s = settle(s);
    }
    expect(s.board).toHaveLength(1);
    expect(s.players.every((p) => p.hole.length === 6)).toBe(true);
  });
});

describe('Razz', () => {
  test('on later streets the lowest board acts first', () => {
    let s = create(3, 'razz');
    s = act(s, { type: 'BRING_IN' });
    while (s.phase === 'betting') s = act(s, { type: 'CALL' });
    s = rig(s, { [at(s, 1)]: '9S 9H 2C', [at(s, 2)]: 'AS AH 5H', [at(s, 0)]: 'JS JH KH' }, '3D 5S QC');
    s = settle(s);
    expect(s.toAct).toBe(at(s, 1)); // 3-2 showing
  });
});

describe('the tournament', () => {
  const foldOut = (s: PokerState) => {
    while (s.phase === 'betting') s = act(s, { type: 'FOLD' });
    return dealerStep(s);
  };

  test('blinds rise every ten hands at normal speed', () => {
    let s = create(3);
    for (let i = 0; i < 10; i++) s = foldOut(s);
    expect(s.hand).toBe(11);
    expect(stakes(s)).toMatchObject({ sb: 15, bb: 30 });
  });

  test('the button moves one seat each hand', () => {
    const s = create(4);
    expect(foldOut(s).button).toBe(at(s, 1));
  });

  test('a player with no chips is out, and the last one with chips wins', () => {
    let s = create(2);
    const [btn, bb] = [s.button, at(s, 1)];
    s = rig(s, { [btn]: 'AS AD', [bb]: '7C 2D' }, 'KH 9S 4C 3D 8H');
    s = act(s, { type: 'RAISE', to: 1500 });
    s = settle(act(s, { type: 'CALL' }));
    expect(s.players[btn].stack).toBe(3000);
    s = dealerStep(s);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(s.players[btn].id);
    expect(s.players[bb]).toMatchObject({ out: true, place: 2 });
  });

  test('players knocked out in the same hand: the one who started it with more chips places higher', () => {
    let s = create(3);
    const [c, a, b] = [0, 1, 2].map((k) => at(s, k));
    s.players[a].stack = 190; // 200 in all
    s.players[b].stack = 280; // 300 in all
    s = rig(s, { [a]: '7C 2D', [b]: '8C 3D', [c]: 'AS AD' }, 'KH 9S 4C JD QH');
    s = act(s, { type: 'RAISE', to: 1500 });
    s = act(s, { type: 'CALL' });
    s = dealerStep(settle(act(s, { type: 'CALL' })));
    expect(s.over).toBe(true);
    expect(s.players[b].place).toBe(2);
    expect(s.players[a].place).toBe(3);
  });
});

describe('hidden cards', () => {
  test("you see only your own cards (and Stud's upcards) until the showdown", () => {
    const s = create(3);
    const v = pokerKit.redact(s, s.players[0].id);
    expect(v.players[0].hole).toEqual(s.players[0].hole);
    expect(v.players[1].hole.every((c) => c === null)).toBe(true);
    expect(v.deck).toEqual([]);
    const stud = create(3, 'stud');
    const sv = pokerKit.redact(stud, stud.players[0].id);
    expect(sv.players[1].hole).toEqual([null, null, stud.players[1].hole[2]]);
  });

  test('an idle player checks when they can, otherwise folds; an idle bring-in posts it', () => {
    let s = create(3);
    expect(pokerKit.timeout(s)).toEqual({ type: 'FOLD' });
    s = act(s, { type: 'CALL' });
    s = act(s, { type: 'CALL' });
    expect(pokerKit.timeout(s)).toEqual({ type: 'CHECK' });
    expect(pokerKit.timeout(create(3, 'stud'))).toEqual({ type: 'BRING_IN' });
  });
});

describe('bots', () => {
  test.each(['holdem', 'omaha', 'shortdeck', 'stud', 'razz'] as Variant[])(
    '%s: bots play a whole tournament legally, never making or losing a chip',
    (variant) => {
      const bots = ['easy', 'normal', 'hard'].map((difficulty, i) => ({ name: `B${i}`, isAI: true, difficulty }));
      let s = createPoker(bots, 11, { variant, speed: 'fast' });
      let r = 5;
      const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 6000 && !s.over; i++) {
        const auto = pokerKit.auto!(s);
        if (auto) s = pokerKit.apply(s, auto.action, DEALER_ID);
        else s = pokerKit.apply(s, pokerKit.bot(s, rand), pokerKit.actor(s)!);
        expect(chips(s)).toBe(4500);
      }
      expect(s.over).toBe(true);
    },
    60_000,
  );
});
