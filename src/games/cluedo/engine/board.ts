import { SECRET_PASSAGES, type Room } from './cards';

/**
 * Abstracted board: the nine rooms as a graph. On the real board rooms connect
 * through corridor squares; here each edge is one "step" of a dice roll. This is
 * a deliberate simplification – the deduction game (suggest/disprove/accuse) is
 * faithful; physical square-by-square movement is not modelled.
 */
const ADJACENCY: Record<Room, Room[]> = {
  Study: ['Hall', 'Library'],
  Hall: ['Study', 'Lounge'],
  Lounge: ['Hall', 'Dining Room'],
  Library: ['Study', 'Billiard Room'],
  'Dining Room': ['Lounge', 'Kitchen'],
  'Billiard Room': ['Library', 'Conservatory'],
  Conservatory: ['Billiard Room', 'Ballroom'],
  Ballroom: ['Conservatory', 'Kitchen'],
  Kitchen: ['Ballroom', 'Dining Room'],
};

/**
 * Rooms reachable from `from` with the given dice roll: any room within `roll`
 * steps along the graph, plus the secret-passage destination (a free move from
 * a corner room). Never includes the room you start in.
 */
export function reachableRooms(from: Room, roll: number): Room[] {
  const dist = new Map<Room, number>([[from, 0]]);
  const found = new Set<Room>();
  let frontier: Room[] = [from];

  while (frontier.length > 0) {
    const next: Room[] = [];
    for (const room of frontier) {
      const d = dist.get(room)!;
      if (d >= roll) continue;
      for (const nb of ADJACENCY[room]) {
        if (!dist.has(nb)) {
          dist.set(nb, d + 1);
          found.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }

  const secret = SECRET_PASSAGES[from];
  if (secret) found.add(secret);
  found.delete(from);
  return [...found];
}
