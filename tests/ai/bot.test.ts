import { describe, it, expect } from 'vitest';
import { chooseAction } from '../../src/games/ticket-to-ride/ai/bot';
import { createGame } from '../../src/games/ticket-to-ride/engine/setup';
import { applyAction } from '../../src/games/ticket-to-ride/engine/reducer';
import { legalActions } from '../../src/games/ticket-to-ride/engine/selectors';
import { finalScores } from '../../src/games/ticket-to-ride/engine/scoring';
import { bonusesFor } from '../../src/games/ticket-to-ride/engine/bonuses';
import type { Difficulty, GameState } from '../../src/games/ticket-to-ride/engine/types';

function actor(s: GameState): string | null {
  if (s.phase === 'setup-tickets') {
    const p = s.players.find((x) => x.pendingTickets.length > 0);
    return p?.id ?? null;
  }
  return s.players[s.current]?.id ?? null;
}

function playOut(difficulties: Difficulty[], seed: number): GameState {
  let s = createGame(
    difficulties.map((d, i) => ({ name: `AI${i}`, isAI: true, difficulty: d })),
    seed,
  );
  let iters = 0;
  while (s.phase !== 'game-over' && iters < 20000) {
    iters++;
    const id = actor(s);
    if (!id) break;
    const player = s.players.find((p) => p.id === id)!;
    const action = chooseAction(s, id, player.difficulty ?? 'normal');
    // every chosen action must be legal
    expect(legalActions(s, id)).toContainEqual(action);
    s = applyAction(s, action);
  }
  expect(s.phase).toBe('game-over');
  return s;
}

/** Fast-forward a fresh game past setup-tickets into the first real turn. */
function toFirstTurn(difficulties: Difficulty[], seed: number): GameState {
  let s = createGame(
    difficulties.map((d, i) => ({ name: `AI${i}`, isAI: true, difficulty: d })),
    seed,
  );
  while (s.phase === 'setup-tickets') {
    const id = actor(s)!;
    s = applyAction(s, chooseAction(s, id, 'normal'));
  }
  return s;
}

describe('chooseAction', () => {
  it('always returns a legal action across difficulties and seeds', () => {
    // Pair each difficulty with a hard bot so the game always terminates — a
    // low-on-trains normal stops claiming, so normal-vs-normal would never end.
    for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (const seed of [1, 2, 3]) {
        playOut([d, 'hard'], seed);
      }
    }
  });

  it('normal stops claiming routes once it is below 10 trains, drawing instead', () => {
    const s = toFirstTurn(['normal', 'hard'], 1);
    const p0 = s.players[0];
    p0.trainsLeft = 9;
    // A full hand makes many routes claimable; a normal bot at full trains would
    // take one. Below the threshold it must draw a train card instead.
    for (const c of Object.keys(p0.hand) as (keyof typeof p0.hand)[]) p0.hand[c] = 12;
    s.current = 0;
    s.phase = 'turn';

    const legal = legalActions(s, p0.id);
    expect(legal.some((a) => a.type === 'CLAIM_ROUTE')).toBe(true); // a claim was available
    expect(legal.some((a) => a.type === 'DRAW_TRAIN')).toBe(true);
    const action = chooseAction(s, p0.id, 'normal');
    expect(action.type).toBe('DRAW_TRAIN');
  });

  it('an all-AI game reaches game-over and produces scores', () => {
    const s = playOut(['normal', 'hard', 'easy'], 42);
    const scores = finalScores(s.players, bonusesFor('usa'));
    for (const p of s.players) expect(typeof scores[p.id].total).toBe('number');
  });

  it('hard is not weaker than easy on average across seeds', () => {
    let hardWins = 0;
    let easyWins = 0;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const seed of seeds) {
      // p0 hard vs p1 easy
      const s = playOut(['hard', 'easy'], seed);
      const scores = finalScores(s.players, bonusesFor('usa'));
      if (scores['p0'].total > scores['p1'].total) hardWins++;
      else if (scores['p1'].total > scores['p0'].total) easyWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(easyWins);
  });
});
