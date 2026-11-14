// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { soundCues } from '../../src/games/monopoly/ui/sound';
import { MonopolyGame } from '../../src/games/monopoly/ui/MonopolyGame';
import { createMonopolyGame, type MonopolyState } from '../../src/games/monopoly/engine/state';
import { applyAction } from '../../src/games/monopoly/engine/reducer';
import { groupIds } from '../../src/games/monopoly/engine/board';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const SEVILLE = 8;

/** You (p0) and a bot (p1), You first. Seed 5's first roll lands You on Seville. */
function game(): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: '', isAI: false },
      { avatar: '', isAI: true },
    ],
    5,
    { randomizeOrder: false },
  );
}

const act = (s: MonopolyState, ...actions: Parameters<typeof applyAction>[1][]) =>
  actions.reduce((acc, a) => applyAction(acc, a), s);

describe('which sounds a change makes, for the viewer', () => {
  test('a roll rattles the dice; buying rings up the sale (not a payment)', () => {
    const start = game();
    const rolled = act(start, { type: 'ROLL' });
    expect(soundCues(start, rolled, 'p0')).toContain('dice');
    const bought = act(rolled, { type: 'BUY' });
    expect(soundCues(rolled, bought, 'p0')).toEqual(['buy']);
  });

  test('rent sounds as a payment for the payer and money in for the owner', () => {
    const start = game();
    start.ownership[SEVILLE].owner = 'p1';
    const landed = act(start, { type: 'ROLL' });
    expect(soundCues(start, landed, 'p0')).toEqual(['dice', 'pay']);
    expect(soundCues(start, landed, 'p1')).toEqual(['dice', 'receive']);
  });

  test('your turn starting chimes on your screen only', () => {
    const before = act(game(), { type: 'ROLL' }, { type: 'BUY' });
    const after = act(before, { type: 'END_TURN' });
    expect(soundCues(before, after, 'p1')).toContain('turn');
    expect(soundCues(before, after, 'p0')).not.toContain('turn');
  });

  test('a drawn card, and a trip to jail', () => {
    const before = game();
    const drawn = { ...before, lastCard: { deck: 'chance' as const, text: 'x', playerId: 'p1', atRoll: 0 } };
    expect(soundCues(before, drawn, 'p0')).toEqual(['card']);
    const jailed = { ...before, players: before.players.map((p) => (p.id === 'p1' ? { ...p, inJail: true } : p)) };
    expect(soundCues(before, jailed, 'p0')).toEqual(['jail']);
  });

  test('auctions: every raise, then the hammer for a sale or a quiet close without one', () => {
    const open = act(game(), { type: 'ROLL' }, { type: 'DECLINE' });
    const bid = act(open, { type: 'BID', amount: 10 });
    expect(soundCues(open, bid, 'p0')).toEqual(['bid']);
    const sold = act(bid, { type: 'PASS_BID' });
    expect(soundCues(bid, sold, 'p0')).toEqual(['sold']); // the winner's payment is the sale
    const unsold = act(open, { type: 'PASS_BID' }, { type: 'PASS_BID' });
    expect(soundCues(open, unsold, 'p0')).toEqual(['auctionClosed']);
  });

  test('trades: an offer arriving for you, then accepted or turned down', () => {
    const ready = act(game(), { type: 'ROLL' }, { type: 'BUY' });
    const offer = act(ready, {
      type: 'PROPOSE_TRADE',
      trade: {
        from: 'p0',
        to: 'p1',
        give: { cash: 0, properties: [SEVILLE], getOutCards: 0 },
        receive: { cash: 50, properties: [], getOutCards: 0 },
      },
    });
    expect(soundCues(ready, offer, 'p1')).toEqual(['tradeOffer']);
    expect(soundCues(ready, offer, 'p0')).toEqual([]);
    expect(soundCues(offer, act(offer, { type: 'RESPOND_TRADE', accept: true }), 'p0')).toEqual(['tradeDone']);
    expect(soundCues(offer, act(offer, { type: 'RESPOND_TRADE', accept: false }), 'p0')).toEqual(['tradeDeclined']);
  });

  test('completing a colour set', () => {
    const before = game();
    const [a, b] = groupIds('brown');
    before.ownership[a].owner = 'p1';
    const after = { ...before, ownership: { ...before.ownership, [b]: { ...before.ownership[b], owner: 'p1' } } };
    expect(soundCues(before, after, 'p0')).toContain('set');
  });

  test('nothing changed, nothing plays', () => {
    const s = game();
    expect(soundCues(s, s, 'p0')).toEqual([]);
  });
});

describe('the mute switch', () => {
  test('Monopoly has one, and it is shared with every game', () => {
    render(<MonopolyGame view={game()} meId="p0" nameFor={(id) => id} onAction={vi.fn()} onExit={() => {}} exitLabel="Back" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute sounds' }));
    expect(screen.getByRole('button', { name: 'Unmute sounds' })).toBeTruthy();
    expect(localStorage.getItem('gamehub-muted')).toBe('1');
  });

  test('a mute set in Ticket to Ride before sounds were shared still holds', async () => {
    localStorage.setItem('ttr-muted', '1');
    vi.resetModules();
    const sound = await import('../../src/shared/sound');
    expect(sound.isMuted()).toBe(true);
  });
});
