import { describe, expect, test } from 'vitest';
import { createMonopolyGame, currentSeat, type MonopolyState } from '../../../src/games/monopoly/engine/state';
import { applyAction, advanceToSpace } from '../../../src/games/monopoly/engine/reducer';
import { redactFor } from '../../../src/games/monopoly/engine/redact';
import { CHANCE } from '../../../src/games/monopoly/engine/cards';

// The UI animates dice and reveals cards from these public event fields, so a
// repeated roll (3 + 4 twice) or a repeated card still reads as a new event.

function mk(seed = 1): MonopolyState {
  return createMonopolyGame(
    [
      { avatar: 'a', isAI: false },
      { avatar: 'b', isAI: true },
    ],
    seed,
    { randomizeOrder: false },
  );
}

/** A seed whose first roll is not doubles, so the turn passes cleanly. */
function plainSeed(): number {
  for (let s = 1; s < 5000; s++) {
    const out = applyAction(mk(s), { type: 'ROLL' });
    if (out.dice![0] !== out.dice![1] && out.pendingPurchase === null && out.phase === 'action') return s;
  }
  throw new Error('no plain seed');
}

describe('roll sequence', () => {
  test('a new game has rolled nothing and drawn nothing', () => {
    const g = mk();
    expect(g.rollSeq).toBe(0);
    expect(g.lastCard).toBeNull();
  });

  test('every roll bumps the sequence', () => {
    let g = mk(plainSeed());
    g = applyAction(g, { type: 'ROLL' });
    expect(g.rollSeq).toBe(1);
    g = applyAction(g, { type: 'END_TURN' });
    g = applyAction(g, { type: 'ROLL' });
    expect(g.rollSeq).toBe(2);
  });

  test('a roll for doubles in jail bumps it too', () => {
    const g = mk();
    g.players[0].inJail = true;
    g.players[0].position = 10;
    g.phase = 'jail';
    const out = applyAction(g, { type: 'ROLL_JAIL' });
    expect(out.rollSeq).toBe(1);
  });
});

describe('last card drawn', () => {
  test('records the deck, its text, who drew it, and the roll it came from', () => {
    const g = mk();
    const idx = CHANCE.findIndex((c) => c.id === 'ch-dividend');
    g.chanceOrder = [idx, ...Array.from({ length: 16 }, (_, i) => i).filter((i) => i !== idx)];
    g.chancePtr = 0;
    g.rollSeq = 4;
    const out = advanceToSpace(g, currentSeat(g), 7, false); // Chance
    expect(out.lastCard).toEqual({
      deck: 'chance',
      text: 'Bank pays you a dividend of $50.',
      playerId: 'p0',
      atRoll: 4,
    });
  });

  test('both event fields are public, so redaction keeps them', () => {
    const g = mk();
    g.rollSeq = 3;
    g.lastCard = { deck: 'chest', text: 'x', playerId: 'p1', atRoll: 3 };
    const view = redactFor(g, 'p0');
    expect(view.rollSeq).toBe(3);
    expect(view.lastCard).toEqual(g.lastCard);
  });
});
