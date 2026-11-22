// The amounts and switches a host can change: Go salary, the Jail fine and
// tries, a Free Parking prize, 10% Income Tax, buying after a first lap, deeds
// dealt at the start, and the turn clock.
import { expect, test } from 'vitest';
import { BOARD, OWNABLE_IDS } from '../../../src/games/monopoly/engine/board';
import { CHANCE, cardText } from '../../../src/games/monopoly/engine/cards';
import { DEFAULT_SETTINGS, createMonopolyGame, currentSeat, type MonopolyState, type Settings } from '../../../src/games/monopoly/engine/state';
import { applyAction, landOn } from '../../../src/games/monopoly/engine/reducer';
import { chooseMonopolyAction } from '../../../src/games/monopoly/engine/bot';
import { logParts } from '../../../src/games/monopoly/ui/logText';
import { MONOPOLY_MONEY as M, formatMoney, moneyText } from '../../../src/games/monopoly/engine/board';

const mk = (settings: Partial<Settings> = {}, seed = 1, n = 2): MonopolyState =>
  createMonopolyGame(Array.from({ length: n }, (_, i) => ({ avatar: String(i), isAI: i > 0 })), seed, { randomizeOrder: false, ...settings });

/** The state after the player to move lands on `space`. */
function land(g: MonopolyState, space: number, collectGo = false): MonopolyState {
  const s = structuredClone(g);
  landOn(s, currentSeat(s), space, collectGo);
  return s;
}

test('the standard values are the defaults, and a value off the list falls back to them', () => {
  expect(mk().settings).toMatchObject({ goSalary: 200, jailFine: 50, jailTurns: 3, freeParkingPrize: 0, incomeTaxTenPercent: false, firstLapBuy: false, dealtProperties: 0, turnSeconds: 90 });
  expect(mk({ goSalary: 999, jailTurns: 0, turnSeconds: 5 }).settings).toMatchObject({ goSalary: 200, jailTurns: 3, turnSeconds: 90 });
});

test('the Go salary is what passing Go pays, and what the Advance to Go card says', () => {
  const g = mk({ goSalary: 400 });
  expect(land(g, 3, true).players[0].cash).toBe(1500 + 400);
  expect(land(mk({ goSalary: 400, doubleGoSalary: true }), 0, true).players[0].cash).toBe(1500 + 800);
  const card = CHANCE.find((c) => c.id === 'ch-go')!;
  expect([cardText(card), cardText(card, 'neo', 400)]).toEqual(['Advance to Go. Collect $200.', 'Advance to Go. Collect $400.']);
});

test('the Jail fine and the number of tries follow the settings', () => {
  const jailed = (settings: Partial<Settings>) => {
    const g = mk(settings);
    Object.assign(g.players[0], { inJail: true, position: 10 });
    g.phase = 'jail';
    return g;
  };
  expect(applyAction(jailed({ jailFine: 200 }), { type: 'PAY_JAIL' }).players[0].cash).toBe(1300);
  // One try only: a failed roll means paying at once and moving.
  for (let seed = 1; seed < 40; seed++) {
    const start = createMonopolyGame([{ avatar: 'a', isAI: false }, { avatar: 'b', isAI: true }], seed, { randomizeOrder: false, jailTurns: 1, jailFine: 100 });
    Object.assign(start.players[0], { inJail: true, position: 10 });
    start.phase = 'jail';
    const out = applyAction(start, { type: 'ROLL_JAIL' });
    if (out.dice![0] === out.dice![1]) continue;
    expect([out.players[0].inJail, out.log.some((l) => l.includes('paid $100 after one try'))]).toEqual([false, true]);
    return;
  }
  throw new Error('no failed jail roll found');
});

test('a Free Parking prize is paid by the bank, with or without the jackpot', () => {
  expect(land(mk({ freeParkingPrize: 250 }), 20).players[0].cash).toBe(1750);
  const g = mk({ freeParkingPrize: 100, freeParkingJackpot: true });
  g.freeParkingPot = 300;
  const out = land(g, 20);
  expect([out.players[0].cash, out.freeParkingPot]).toEqual([1900, 0]);
  expect(land(mk(), 20).players[0].cash).toBe(1500);
});

test('Income Tax at 10%: the lower of the printed tax and a tenth of your worth', () => {
  const poor = mk({ incomeTaxTenPercent: true });
  poor.players[0].cash = 900;
  expect(land(poor, 4).players[0].cash).toBe(810);
  expect(land(mk({ incomeTaxTenPercent: true, startingCash: 3000 }), 4).players[0].cash).toBe(2800);
  const off = mk();
  off.players[0].cash = 900;
  expect(land(off, 4).players[0].cash).toBe(700);
  // Luxury Tax is never a percentage.
  const lux = mk({ incomeTaxTenPercent: true });
  lux.players[0].cash = 500;
  expect(land(lux, 38).players[0].cash).toBe(400);
});

test('buying waits for a first lap: no offer and no auction until you have passed Go', () => {
  const g = mk({ firstLapBuy: true });
  const early = land(g, 6);
  expect([early.pendingPurchase, early.pendingAuction ?? null, early.ownership[6].owner]).toEqual([null, null, null]);
  expect(early.log.some((l) => l.includes('before passing Go'))).toBe(true);
  const lapped = land(land(g, 1, true), 6);
  expect(lapped.pendingPurchase).toBe(6);
  expect(land(mk(), 6).pendingPurchase).toBe(6);
});

test('the short game deals each player deeds at their printed price before the first roll', () => {
  const g = mk({ dealtProperties: 3 }, 7, 4);
  for (const p of g.players) {
    const mine = OWNABLE_IDS.filter((id) => g.ownership[id].owner === p.id);
    expect(mine).toHaveLength(3);
    expect(p.cash).toBe(1500 - mine.reduce((n, id) => n + BOARD[id].price!, 0));
  }
  expect(g.log).toHaveLength(4);
  // The same seed with nothing dealt gives the game a table without the setting gets.
  const plain = mk({}, 7, 4);
  expect([plain.chanceOrder, plain.turnOrder]).toEqual([mk({ dealtProperties: 0 }, 7, 4).chanceOrder, plain.turnOrder]);
  expect(OWNABLE_IDS.every((id) => plain.ownership[id].owner === null)).toBe(true);
});

test('bots play a game to the end with every setting changed', () => {
  for (let seed = 1; seed <= 4; seed++) {
    let s = createMonopolyGame(Array.from({ length: 4 }, (_, i) => ({ avatar: String(i), isAI: true, difficulty: 'normal' as const })), seed, {
      ...DEFAULT_SETTINGS,
      goSalary: 300,
      jailFine: 100,
      jailTurns: 2,
      freeParkingPrize: 250,
      incomeTaxTenPercent: true,
      firstLapBuy: true,
      dealtProperties: 2,
      roundLimit: 25,
    });
    for (let i = 0; i < 40_000 && s.phase !== 'over'; i++) s = applyAction(s, chooseMonopolyAction(s));
    expect(s.phase, `seed ${seed}`).toBe('over');
  }
});

test('on the India board the move log reads in rupees', () => {
  const text = (line: string, board?: 'india' | 'uk' | 'us' | 'europe' | 'world2008') =>
    logParts(line, (t) => moneyText(t, board)).map((p) => ('text' in p ? p.text : `<${p.player}>`)).join('');
  expect(text('{p0} paid $50 to leave jail', 'india')).toBe('<p0> paid ₹50 to leave jail');
  expect(text('{p0} paid $50 to leave jail', 'uk')).toBe('<p0> paid £50 to leave jail');
  expect(text('{p0} paid $50 to leave jail', 'us')).toBe('<p0> paid $50 to leave jail');
  expect(text('{p0} paid $50 to leave jail', 'europe')).toBe('<p0> paid £50 to leave jail');
  // Boards that mix countries use Monopoly money.
  expect(text('{p0} paid $50 to leave jail')).toBe(`<p0> paid ${M}50 to leave jail`);
  // World 2008 plays in millions: every amount times 10,000.
  expect(text('{p0} paid $50 to leave jail', 'world2008')).toBe(`<p0> paid ${M}500K to leave jail`);
  expect([formatMoney(60, 'world2008'), formatMoney(400, 'world2008'), formatMoney(1500, 'world2008'), formatMoney(-35, 'world2008'), formatMoney(0, 'world2008')]).toEqual([`${M}600K`, `${M}4M`, `${M}15M`, `-${M}350K`, `${M}0`]);
  expect([formatMoney(1500, 'uk'), formatMoney(1500, 'us'), formatMoney(200, 'europe'), formatMoney(2500, 'megaUs'), formatMoney(60, 'megaUk')]).toEqual(['£1,500', '$1,500', '£200', '$2,500', '£60']);
});
