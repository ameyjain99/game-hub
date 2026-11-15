/**
 * The mansion: GameHub's own floor plan on a 24 × 24 grid. Nine rooms sit
 * round a central case file; corridors run between them. Letters are room
 * squares (lowercase: a door square of that room), '.' a corridor square, a
 * digit a suspect's start square (also corridor) and 'X' the case file, which
 * nobody walks through. The four corner rooms are joined diagonally by secret
 * passages.
 */
import { ROOMS, SUSPECTS, SECRET_PASSAGES, type Room, type Suspect } from './engine/cards';

export const SIZE = 24;

const MAP = [
  'SSSSSS...HHHHHH...OOOOOO',
  'SSSSSS...HHHHHH...OOOOOO',
  'SSSSSs...hHHHHh...oOOOOO',
  'SSSSSS...HHHHHH...OOOOOO',
  'SSSSSS...HHHHHH...OOOOOO',
  'SSSSSS...HHhHHH...OOOoOO',
  '5......................6',
  'LLLLlL..................',
  'LLLLLL...........DDdDDDD',
  'LLLLLl...XXXXXX..DDDDDDD',
  'LLLLLL...XXXXXX..DDDDDDD',
  'LLLLLL...XXXXXX..dDDDDDD',
  '4........XXXXXX..DDDDDDD',
  'IIIiII...XXXXXX..DDDDDDD',
  'IIIIII...XXXXXX..DDDDDDD',
  'IIIIIi...........DDDdDDD',
  'IIIIII.................2',
  'IIIIII..................',
  '........AaAAAAaA........',
  'CCCCcC..AAAAAAAA..KkKKKK',
  'CCCCCC..aAAAAAAa..KKKKKK',
  'CCCCCC..AAAAAAAA..KKKKKK',
  'CCCCCC..AAAAAAAA..KKKKKK',
  'CCCCCC.3AAAAAAAA1.KKKKKK',
];

const LETTER: Record<string, Room> = {
  S: 'Study',
  H: 'Hall',
  O: 'Lounge',
  L: 'Library',
  I: 'Billiard Room',
  D: 'Dining Room',
  C: 'Conservatory',
  A: 'Ballroom',
  K: 'Kitchen',
};

/** A square's index: row * SIZE + col. */
export const sq = (r: number, c: number) => r * SIZE + c;
export const rowOf = (i: number) => Math.floor(i / SIZE);
export const colOf = (i: number) => i % SIZE;

const at = (r: number, c: number): string => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? MAP[r][c] : '#');
const isWalk = (ch: string) => ch === '.' || /[1-6]/.test(ch);

/** Corridor squares (start squares included). */
export const CORRIDOR: number[] = [];
/** Each suspect's start square. */
export const START = {} as Record<Suspect, number>;
/** Each room's rectangle on the grid. */
export const ROOM_BOX = {} as Record<Room, { r: number; c: number; w: number; h: number }>;
/** Each door: its room, the door square inside the room, and the corridor square outside it. */
export const DOORS: { room: Room; inside: number; outside: number }[] = [];

for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    const ch = MAP[r][c];
    if (isWalk(ch)) CORRIDOR.push(sq(r, c));
    if (/[1-6]/.test(ch)) START[SUSPECTS[Number(ch) - 1]] = sq(r, c);
    const room = LETTER[ch.toUpperCase()];
    if (!room) continue;
    const box = ROOM_BOX[room];
    if (!box) ROOM_BOX[room] = { r, c, w: 1, h: 1 };
    else {
      box.w = Math.max(box.w, c - box.c + 1);
      box.h = Math.max(box.h, r - box.r + 1);
    }
    if (ch !== ch.toUpperCase()) {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (isWalk(at(r + dr, c + dc))) DOORS.push({ room, inside: sq(r, c), outside: sq(r + dr, c + dc) });
      }
    }
  }
}

const WALK = new Set(CORRIDOR);
const NEIGHBOURS = new Map<number, number[]>(
  CORRIDOR.map((i) => [
    i,
    [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]
      .map(([dr, dc]) => sq(rowOf(i) + dr, colOf(i) + dc))
      .filter((j) => WALK.has(j) && Math.abs(colOf(j) - colOf(i)) <= 1),
  ]),
);

/** Where a token is: a room, or a corridor square. */
export type Spot = Room | number;
export const inRoom = (s: Spot): s is Room => typeof s === 'string';

export const passageFrom = (room: Room): Room | undefined => SECRET_PASSAGES[room];

export interface Reach {
  /** Corridor squares within the roll, with the steps to each. */
  squares: Record<number, number>;
  /** Rooms that can be entered within the roll. */
  rooms: Room[];
}

/**
 * Where a token at `from` can go with `steps`: any corridor square up to that
 * many steps away (orthogonally, never through `blocked` squares), and any room
 * whose door it can step through within the roll. Leaving a room costs a step
 * through one of its doors; a token can't come back into the room it left.
 */
export function reachable(from: Spot, steps: number, blocked: Set<number>): Reach {
  const dist = new Map<number, number>();
  const queue: number[] = [];
  const startRoom = inRoom(from) ? from : null;
  if (startRoom) {
    for (const d of DOORS) {
      if (d.room === startRoom && !blocked.has(d.outside) && !dist.has(d.outside)) {
        dist.set(d.outside, 1);
        queue.push(d.outside);
      }
    }
  } else {
    dist.set(from as number, 0);
    queue.push(from as number);
  }
  while (queue.length > 0) {
    const i = queue.shift()!;
    const d = dist.get(i)!;
    if (d >= steps) continue;
    for (const j of NEIGHBOURS.get(i) ?? []) {
      if (!dist.has(j) && !blocked.has(j)) {
        dist.set(j, d + 1);
        queue.push(j);
      }
    }
  }
  const squares: Record<number, number> = {};
  for (const [i, d] of dist) if (d > 0 && d <= steps) squares[i] = d;
  const rooms = ROOMS.filter(
    (room) => room !== startRoom && DOORS.some((door) => door.room === room && dist.has(door.outside) && dist.get(door.outside)! < steps),
  );
  return { squares, rooms };
}

/** Steps from every corridor square to the nearest door of each room, ignoring tokens (for bots). */
export const DISTANCE: Record<Room, Map<number, number>> = Object.fromEntries(
  ROOMS.map((room) => {
    const dist = new Map<number, number>();
    const queue: number[] = [];
    for (const d of DOORS) {
      if (d.room === room && !dist.has(d.outside)) {
        dist.set(d.outside, 1);
        queue.push(d.outside);
      }
    }
    while (queue.length > 0) {
      const i = queue.shift()!;
      for (const j of NEIGHBOURS.get(i) ?? []) {
        if (!dist.has(j)) {
          dist.set(j, dist.get(i)! + 1);
          queue.push(j);
        }
      }
    }
    return [room, dist];
  }),
) as Record<Room, Map<number, number>>;

/** Steps from a spot to a room (0 if already there; via a passage counts as 1). */
export function stepsTo(from: Spot, room: Room): number {
  if (from === room) return 0;
  if (inRoom(from)) {
    if (passageFrom(from) === room) return 1;
    const exits = DOORS.filter((d) => d.room === from).map((d) => DISTANCE[room].get(d.outside) ?? Infinity);
    return 1 + Math.min(...exits);
  }
  return DISTANCE[room].get(from) ?? Infinity;
}
