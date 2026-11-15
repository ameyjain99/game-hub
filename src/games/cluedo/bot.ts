/**
 * Cluedo bots. Each reasons only from its own view (see knowledge.ts): easy
 * from the cards it has seen, normal also from who passed, hard from every
 * clue the table gives. A bot accuses only when it is certain, walks toward
 * rooms that could still be the murder room, and suggests cards that could
 * still be in the envelope. A hard bot that has solved a category names one
 * of its own cards there, so every card shown to it answers the rest.
 */
import { DISTANCE, inRoom, passageFrom } from './board';
import { cluedoActor, matching, redactCluedo, type ClAction, type ClPlayer, type ClState } from './engine';
import { ROOMS, SUSPECTS, WEAPONS, type Card, type Room, type Suspect, type Weapon } from './engine/cards';
import { know, type Depth, type Knowledge } from './knowledge';

type Level = 'easy' | 'normal' | 'hard';
const DEPTH: Record<Level, Depth> = { easy: 'seen', normal: 'basic', hard: 'full' };

const pick = <T>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

/** Rooms worth suggesting in: any that may be the murder room, or every room once it's known. */
function targets(k: Knowledge, level: Level): Room[] {
  if (!k.envelope.room) return k.open.rooms;
  return level === 'hard' ? [k.envelope.room] : [...ROOMS];
}

/** One card to name in a category: one still open, or, once solved, the answer (or, for a
 *  hard bot, a card of its own, so nobody can show it). */
function name<T extends Card>(cards: readonly T[], open: T[], solved: T | undefined, me: ClPlayer, level: Level, rand: () => number): T {
  if (solved) {
    const own = cards.filter((c) => me.hand.includes(c));
    return level === 'hard' && own.length > 0 ? pick(own, rand) : solved;
  }
  return pick(open, rand);
}

function show(v: ClState, me: ClPlayer, level: Level, rand: () => number): Card {
  const options = matching(me.hand, v.pending!.triple);
  if (level === 'easy') return options[0];
  if (level === 'hard') {
    // Show the asker a card they have already seen from you, if one fits.
    const asker = v.players[v.current].id;
    const before = v.log.filter((e) => e.kind === 'suggest' && e.s.player === asker && e.s.disprover === me.id).map((e) => (e.kind === 'suggest' ? e.s.card : null));
    const again = options.find((c) => before.includes(c));
    if (again) return again;
  }
  return pick(options, rand);
}

export function cluedoBot(full: ClState, rand: () => number): ClAction {
  const id = cluedoActor(full)!;
  const v = redactCluedo(full, id);
  const me = v.players.find((p) => p.id === id)!;
  const level: Level = me.difficulty === 'easy' || me.difficulty === 'hard' ? me.difficulty : 'normal';
  if (v.phase === 'disprove') return { type: 'SHOW', card: show(v, me, level, rand) };

  const k = know(v, id, DEPTH[level]);
  const { suspect, weapon, room } = k.envelope;
  const accuse: ClAction | null = suspect && weapon && room ? { type: 'ACCUSE', suspect, weapon, room } : null;
  const here = v.pos[me.suspect];
  const goals = targets(k, level);

  switch (v.phase) {
    case 'turn': {
      if (accuse) return accuse;
      if (inRoom(here) && v.summoned.includes(id) && goals.includes(here)) return { type: 'STAY' };
      const passage = inRoom(here) ? passageFrom(here) : undefined;
      if (passage && goals.includes(passage) && level !== 'easy') return { type: 'PASSAGE' };
      return { type: 'ROLL' };
    }
    case 'move': {
      const reach = v.reach!;
      const rooms = reach.rooms.filter((r) => goals.includes(r));
      if (rooms.length > 0) return { type: 'MOVE', to: pick(rooms, rand) };
      // No goal in reach: get as close as possible to the nearest one.
      const squares = Object.keys(reach.squares).map(Number);
      const away = (sq: number) => Math.min(...goals.map((g) => DISTANCE[g].get(sq) ?? Infinity));
      const best = Math.min(...squares.map(away));
      const closest = squares.filter((sq) => away(sq) === best);
      if (closest.length > 0 && best < Infinity) return { type: 'MOVE', to: pick(closest, rand) };
      return { type: 'MOVE', to: reach.rooms[0] ?? pick(squares, rand) };
    }
    case 'suggest': {
      if (accuse) return accuse;
      if (v.suggested) return { type: 'END' };
      return {
        type: 'SUGGEST',
        suspect: name<Suspect>(SUSPECTS, k.open.suspects, suspect, me, level, rand),
        weapon: name<Weapon>(WEAPONS, k.open.weapons, weapon, me, level, rand),
      };
    }
    default:
      return { type: 'END' };
  }
}
