import { expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction, advanceToSpace } from '../../../src/games/monopoly/engine/reducer';
import { CHANCE } from '../../../src/games/monopoly/engine/cards';
import { renderLogLine } from '../../../src/games/monopoly/ui/logText';

function mk(): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    1,
    { randomizeOrder: false },
  );
}

const last = (g: MonopolyState) => g.log[g.log.length - 1];

test('the event log records purchases, rent and drawn cards', () => {
  const g = mk();
  g.pendingPurchase = 8;
  g.phase = 'action';
  expect(last(applyAction(g, { type: 'BUY' }))).toBe('{p0} bought Seville for $100');

  const rent = mk();
  rent.ownership[6].owner = 'p1';
  expect(last(advanceToSpace(rent, currentSeat(rent), 6, false))).toBe('{p0} paid $6 rent to {p1}');

  const card = mk();
  const idx = CHANCE.findIndex((c) => c.id === 'ch-dividend');
  card.chanceOrder = [idx, ...Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== idx)];
  expect(advanceToSpace(card, currentSeat(card), 7, false).log).toContain('{p0} drew Chance: Bank pays you a dividend of $50.');
});

test('the log keeps only the most recent entries', () => {
  let g = mk();
  for (let i = 0; i < 200 && g.phase !== 'over'; i++) {
    if (g.phase === 'roll') g = applyAction(g, { type: 'ROLL' });
    else if (g.phase === 'jail') g = applyAction(g, { type: 'ROLL_JAIL' });
    else if (g.pendingPurchase !== null) g = applyAction(g, { type: 'DECLINE' });
    else if (g.pendingAuction) g = applyAction(g, { type: 'PASS_BID' });
    else if (g.players[currentSeat(g)].cash < 0) g = applyAction(g, { type: 'DECLARE_BANKRUPTCY' });
    else g = applyAction(g, { type: 'END_TURN' });
  }
  expect(g.log.length).toBeLessThanOrEqual(60);
});

test('log lines render player tokens as names', () => {
  const names: Record<string, string> = { p0: 'Amey', p1: 'Bot 1' };
  expect(renderLogLine('{p0} paid $6 rent to {p1}', (id) => names[id])).toBe('Amey paid $6 rent to Bot 1');
});
