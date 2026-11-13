import type { Triple } from './cards';

/** An accusation wins only if all three parts match the murder envelope. */
export function isCorrectAccusation(accusation: Triple, solution: Triple): boolean {
  return (
    accusation.suspect === solution.suspect &&
    accusation.weapon === solution.weapon &&
    accusation.room === solution.room
  );
}
