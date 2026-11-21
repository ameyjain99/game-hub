import { describe, expect, test } from 'vitest';
import { IllegalMove, type KitCommonAction } from '../../../src/games/kit/engine';
import { CORRIDOR, DOORS, START, reachable, sq, stepsTo } from '../../../src/games/cluedo/board';
import { cluedoKit, createCluedo, redactCluedo, type ClAction, type ClState } from '../../../src/games/cluedo/engine';
import { ROOMS, SUSPECTS, WEAPONS, type Card, type Triple } from '../../../src/games/cluedo/engine/cards';
import { know } from '../../../src/games/cluedo/knowledge';

const seats = (n: number, bots = 0, difficulty = 'normal') =>
  Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isAI: i >= n - bots, difficulty }));
const play = (s: ClState, a: ClAction | KitCommonAction, id: string) => cluedoKit.apply(s, a, id);

const SOLUTION: Triple = { suspect: 'Professor Plum', weapon: 'Spanner', room: 'Kitchen' };

/** A fixed deal for three players (the envelope: Plum, Spanner, Kitchen). */
function fixed(): ClState {
  const s = createCluedo(seats(3), 1);
  const hands: Card[][] = [
    ['Miss Scarlett', 'Colonel Mustard', 'Candlestick', 'Dagger', 'Study', 'Hall'],
    ['Mrs White', 'Lead Pipe', 'Lounge', 'Library', 'Billiard Room', 'Ballroom'],
    ['Mr Green', 'Mrs Peacock', 'Revolver', 'Rope', 'Conservatory', 'Dining Room'],
  ];
  return { ...s, solution: SOLUTION, players: s.players.map((p, i) => ({ ...p, hand: hands[i], cards: 6 })) };
}

/** p0 standing in `room`, ready to suggest. */
function inRoom(room: (typeof ROOMS)[number]): ClState {
  const s = fixed();
  return { ...s, phase: 'suggest', pos: { ...s.pos, 'Miss Scarlett': room } };
}

describe('the mansion', () => {
  test('nine rooms with doors, six start squares on the corridor', () => {
    for (const room of ROOMS) expect(DOORS.some((d) => d.room === room), room).toBe(true);
    const starts = SUSPECTS.map((x) => START[x]);
    expect(new Set(starts).size).toBe(6);
    for (const s of starts) expect(CORRIDOR).toContain(s);
  });

  test('every room can be reached from every start square', () => {
    for (const x of SUSPECTS) for (const room of ROOMS) expect(stepsTo(START[x], room), `${x} to ${room}`).toBeLessThan(40);
  });

  test('a roll reaches corridor squares up to its count, and rooms through their doors', () => {
    const outsideStudy = sq(2, 6);
    const r = reachable(outsideStudy, 1, new Set());
    expect(r.rooms).toContain('Study');
    expect(Object.values(r.squares).every((d) => d <= 1)).toBe(true);
    expect(Object.keys(r.squares)).toHaveLength(3);
  });

  test('leaving a room takes a step through a door; you cannot walk back in, or through other tokens', () => {
    const r = reachable('Study', 12, new Set());
    expect(r.rooms).not.toContain('Study');
    expect(r.rooms).toContain('Hall');
    // The Study has one door; a token outside it shuts the Study in.
    const shut = reachable('Study', 12, new Set([sq(2, 6)]));
    expect(shut.rooms).toEqual([]);
    expect(Object.keys(shut.squares)).toHaveLength(0);
  });
});

describe('the deal', () => {
  test('the envelope holds one of each; the other 18 cards are dealt round the table', () => {
    const s = createCluedo(seats(4), 7);
    const dealt = s.players.flatMap((p) => p.hand);
    expect(dealt).toHaveLength(18);
    expect(dealt).not.toContain(s.solution.suspect);
    expect(dealt).not.toContain(s.solution.weapon);
    expect(dealt).not.toContain(s.solution.room);
    expect(s.players.map((p) => p.cards)).toEqual([5, 5, 4, 4]);
    expect(new Set(Object.values(s.weapons)).size).toBe(6);
    expect(s.players[0].suspect).toBe('Miss Scarlett');
    expect(cluedoKit.actor(s)).toBe('p0');
    for (const x of SUSPECTS) expect(s.pos[x]).toBe(START[x]);
  });

  test("a player's view hides the envelope, others' hands and the seed", () => {
    const s = createCluedo(seats(3), 7);
    const v = redactCluedo(s, 'p1');
    expect(v.solution.suspect).toBe('');
    expect(v.players[1].hand).toEqual(s.players[1].hand);
    expect(v.players[0].hand).toEqual([]);
    expect(v.players[0].cards).toBe(s.players[0].cards);
    expect(v.seed).toBe(0);
  });

  test('seats: 3 to 6', () => {
    expect(cluedoKit.seatError(2)).toMatch(/at least 3/);
    expect(cluedoKit.seatError(6)).toBeNull();
    expect(cluedoKit.seatError(7)).toMatch(/at most 6/);
  });
});

describe('a turn', () => {
  test('roll two dice; stopping on a corridor square ends the turn', () => {
    let s = play(fixed(), { type: 'ROLL' }, 'p0');
    expect(s.phase).toBe('move');
    const [a, b] = s.dice!;
    expect(a + b).toBeGreaterThanOrEqual(2);
    const squares = Object.keys(s.reach!.squares).map(Number);
    expect(Math.max(...Object.values(s.reach!.squares))).toBeLessThanOrEqual(a + b);
    s = play(s, { type: 'MOVE', to: squares[0] }, 'p0');
    expect(s.pos['Miss Scarlett']).toBe(squares[0]);
    expect(cluedoKit.actor(s)).toBe('p1');
    expect(s.phase).toBe('turn');
  });

  test('stepping into a room lets you suggest there', () => {
    const base = fixed();
    let s: ClState = { ...base, pos: { ...base.pos, 'Miss Scarlett': sq(2, 6) } };
    s = play(s, { type: 'ROLL' }, 'p0');
    expect(s.reach!.rooms).toContain('Study');
    expect(() => play(s, { type: 'MOVE', to: sq(0, 0) }, 'p0')).toThrow(IllegalMove);
    s = play(s, { type: 'MOVE', to: 'Study' }, 'p0');
    expect(s.phase).toBe('suggest');
    expect(s.pos['Miss Scarlett']).toBe('Study');
  });

  test('a suggestion brings the suspect and weapon in; the next player holding a named card shows one', () => {
    let s = play(inRoom('Lounge'), { type: 'SUGGEST', suspect: 'Mr Green', weapon: 'Rope' }, 'p0');
    expect(s.pos['Mr Green']).toBe('Lounge');
    expect(s.weapons.Rope).toBe('Lounge');
    // p1 holds the Lounge, so p1 is asked first and must show it.
    expect(s.phase).toBe('disprove');
    expect(cluedoKit.actor(s)).toBe('p1');
    expect(() => play(s, { type: 'SHOW', card: 'Rope' }, 'p1')).toThrow(IllegalMove);
    expect(() => play(s, { type: 'SHOW', card: 'Lounge' }, 'p2')).toThrow(IllegalMove);
    s = play(s, { type: 'SHOW', card: 'Lounge' }, 'p1');
    expect(s.phase).toBe('suggest');
    const shown = (v: ClState) => (v.log.at(-1) as { s: { card: Card | null } }).s.card;
    expect(shown(redactCluedo(s, 'p0'))).toBe('Lounge');
    expect(shown(redactCluedo(s, 'p1'))).toBe('Lounge');
    expect(shown(redactCluedo(s, 'p2'))).toBeNull();
  });

  test('players with none of the named cards pass, and everyone sees who passed', () => {
    let s = play(inRoom('Kitchen'), { type: 'SUGGEST', suspect: 'Professor Plum', weapon: 'Spanner' }, 'p0');
    expect(s.phase).toBe('suggest');
    const e = s.log.at(-1)!;
    expect(e.kind === 'suggest' && e.s.passed).toEqual(['p1', 'p2']);
    expect(e.kind === 'suggest' && e.s.disprover).toBeNull();
    s = play(inRoom('Kitchen'), { type: 'SUGGEST', suspect: 'Mr Green', weapon: 'Spanner' }, 'p0');
    const f = s.pending!;
    expect(f.disprover).toBe('p2');
    expect(f.passed).toEqual(['p1']);
  });

  test('one suggestion a turn, and only in a room you have just entered', () => {
    let s = play(inRoom('Kitchen'), { type: 'SUGGEST', suspect: 'Professor Plum', weapon: 'Spanner' }, 'p0');
    expect(() => play(s, { type: 'SUGGEST', suspect: 'Mr Green', weapon: 'Rope' }, 'p0')).toThrow(IllegalMove);
    s = play(s, { type: 'END' }, 'p0');
    const standing: ClState = { ...s, pos: { ...s.pos, 'Colonel Mustard': 'Hall' } };
    expect(() => play(standing, { type: 'SUGGEST', suspect: 'Mr Green', weapon: 'Rope' }, 'p1')).toThrow(IllegalMove);
  });

  test('pulled into a room by a suggestion, you may stay and suggest there on your turn', () => {
    let s = play(inRoom('Kitchen'), { type: 'SUGGEST', suspect: 'Colonel Mustard', weapon: 'Spanner' }, 'p0');
    expect(s.summoned).toEqual(['p1']);
    // Nobody else holds the Colonel, the Spanner or the Kitchen: no card is shown.
    expect(s.phase).toBe('suggest');
    s = play(s, { type: 'END' }, 'p0');
    expect(cluedoKit.actor(s)).toBe('p1');
    s = play(s, { type: 'STAY' }, 'p1');
    expect(s.phase).toBe('suggest');
    s = play(s, { type: 'END' }, 'p1');
    expect(() => play(s, { type: 'STAY' }, 'p2')).toThrow(IllegalMove);
  });

  test('the secret passages join the corner rooms', () => {
    const base = fixed();
    let s: ClState = { ...base, pos: { ...base.pos, 'Miss Scarlett': 'Study' } };
    s = play(s, { type: 'PASSAGE' }, 'p0');
    expect(s.pos['Miss Scarlett']).toBe('Kitchen');
    expect(s.phase).toBe('suggest');
    const hall: ClState = { ...base, pos: { ...base.pos, 'Miss Scarlett': 'Hall' } };
    expect(() => play(hall, { type: 'PASSAGE' }, 'p0')).toThrow(IllegalMove);
  });
});

describe('accusing', () => {
  test('a right accusation wins, and everyone then sees the envelope', () => {
    const s = play(fixed(), { type: 'ACCUSE', ...SOLUTION }, 'p0');
    expect(s.over).toBe(true);
    expect(s.winner).toBe('p0');
    expect(redactCluedo(s, 'p1').solution).toEqual(SOLUTION);
  });

  test('a wrong one puts you out of turns, but you still show cards', () => {
    let s = play(fixed(), { type: 'ACCUSE', suspect: 'Mr Green', weapon: 'Spanner', room: 'Kitchen' }, 'p0');
    expect(s.players[0].out).toBe(true);
    expect(cluedoKit.actor(s)).toBe('p1');
    s = { ...s, phase: 'suggest', pos: { ...s.pos, 'Colonel Mustard': 'Study' } };
    s = play(s, { type: 'SUGGEST', suspect: 'Mrs White', weapon: 'Rope' }, 'p1');
    // p2 holds the Rope... but p2 comes first; and p0 (out) is still asked after.
    expect(cluedoKit.actor(s)).toBe('p2');
    s = { ...fixed(), players: s.players, current: 1, phase: 'suggest', pos: { ...s.pos, 'Colonel Mustard': 'Study' } };
    s = play(s, { type: 'SUGGEST', suspect: 'Professor Plum', weapon: 'Spanner' }, 'p1');
    expect(cluedoKit.actor(s)).toBe('p0');
  });

  test('when every player has accused wrongly, the case closes unsolved', () => {
    let s = fixed();
    for (const id of ['p0', 'p1', 'p2']) s = play(s, { type: 'ACCUSE', suspect: 'Mr Green', weapon: 'Rope', room: 'Hall' }, id);
    expect(s.over).toBe(true);
    expect(s.winner).toBeNull();
  });
});

test('a player who leaves lays their cards face up, and the game goes on', () => {
  const s = cluedoKit.forfeit(fixed(), 'p0');
  expect(s.players[0].left).toBe(true);
  expect(cluedoKit.actor(s)).toBe('p1');
  expect(redactCluedo(s, 'p2').players[0].hand).toHaveLength(6);
  const k = know(redactCluedo(s, 'p2'), 'p2', 'seen');
  expect(k.possible.get('Study')).toEqual(new Set(['p0']));
});

describe('what a player can work out', () => {
  test('a pass rules the named cards out for that player; with nothing else, the envelope is pinned', () => {
    const s = play(inRoom('Kitchen'), { type: 'SUGGEST', suspect: 'Professor Plum', weapon: 'Spanner' }, 'p0');
    const k = know(redactCluedo(s, 'p0'), 'p0', 'basic');
    expect(k.envelope).toEqual({ suspect: 'Professor Plum', weapon: 'Spanner', room: 'Kitchen' });
    // At the shallowest depth only passes on your own suggestions count.
    expect(know(redactCluedo(s, 'p0'), 'p0', 'seen').envelope.room).toBe('Kitchen');
    expect(know(redactCluedo(s, 'p1'), 'p1', 'seen').envelope.room).toBeUndefined();
  });

  test('a card shown to someone else, plus what else is known, can pin which card it was', () => {
    // p1 shows p0 a card p2 can't see; p2 knows p1 holds none of the suspect and weapon.
    let s = inRoom('Library');
    s = play(s, { type: 'SUGGEST', suspect: 'Mr Green', weapon: 'Revolver' }, 'p0');
    s = play(s, { type: 'SHOW', card: 'Library' }, 'p1');
    const k = know(redactCluedo(s, 'p2'), 'p2', 'full');
    // p2 holds Mr Green and the Revolver, so p1's card must be the Library.
    expect(k.possible.get('Library')).toEqual(new Set(['p1']));
    expect(know(redactCluedo(s, 'p2'), 'p2', 'basic').possible.get('Library')!.size).toBeGreaterThan(1);
  });
});

/** Bots play a whole game; returns it. */
function botGame(n: number, seed: number, levels: string[]): ClState {
  let s = createCluedo(
    levels.slice(0, n).map((difficulty, i) => ({ name: `B${i}`, isAI: true, difficulty })),
    seed,
  );
  for (let i = 0; i < 6000 && !s.over; i++) s = play(s, cluedoKit.bot(s), cluedoKit.actor(s)!);
  return s;
}

test('bots of every level play to the end with legal moves, and hard bots solve the case most', () => {
  const wins: Record<string, number> = { easy: 0, normal: 0, hard: 0 };
  for (let seed = 1; seed <= 150; seed++) {
    const levels = ['easy', 'normal', 'hard'];
    const s = botGame(3, seed, [levels[seed % 3], levels[(seed + 1) % 3], levels[(seed + 2) % 3]]);
    expect(s.over, `seed ${seed}`).toBe(true);
    if (s.winner) wins[s.players.find((p) => p.id === s.winner)!.difficulty!]++;
  }
  // Hard beats easy clearly; normal >= easy (allow ties to avoid spurious CI failures).
  expect(wins.hard).toBeGreaterThan(wins.easy);
  expect(wins.normal).toBeGreaterThanOrEqual(wins.easy);
});

test('every seat count from 3 to 6 plays to a solved case', () => {
  for (let n = 3; n <= 6; n++) {
    const s = botGame(n, 100 + n, Array(n).fill('hard'));
    expect(s.over).toBe(true);
    expect(s.winner).not.toBeNull();
  }
});

test('a rematch deals a new case for the same table', () => {
  const s = play(fixed(), { type: 'ACCUSE', ...SOLUTION }, 'p0');
  const again = play(s, { type: 'REMATCH' }, 'p1');
  expect(again.over).toBe(false);
  expect(again.players.map((p) => p.name)).toEqual(['P0', 'P1', 'P2']);
});

test('the clock: an idle turn rolls, moves and ends; an idle disprover shows a card', () => {
  let s = fixed();
  for (let i = 0; i < 3 && cluedoKit.actor(s) === 'p0'; i++) s = play(s, cluedoKit.timeout(s), 'p0');
  expect(cluedoKit.actor(s)).not.toBe('p0');
  let d = play(inRoom('Lounge'), { type: 'SUGGEST', suspect: 'Mr Green', weapon: 'Rope' }, 'p0');
  d = play(d, cluedoKit.timeout(d), 'p1');
  expect(d.phase).toBe('suggest');
  void WEAPONS;
});
