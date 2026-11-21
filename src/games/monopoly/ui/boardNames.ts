import { createContext, useContext } from 'react';
import { boardCurrency, spaceFlag, spaceName, type BoardId } from '../engine/board';

/** The board the game on screen is played on (set once, by the game screen). */
export const BoardContext = createContext<BoardId>('neo');

/** The flag a lot flies on the board in play, if that board has flags. */
export function useSpaceFlag(): (id: number) => string | null {
  const board = useContext(BoardContext);
  return (id) => spaceFlag(id, board);
}

/** What a square is called on the board in play. */
export function useSpaceName(): (id: number) => string {
  const board = useContext(BoardContext);
  return (id) => spaceName(id, board);
}

/** Currency symbol for the board in play ($ or ₹). */
export function useCurrency(): string {
  const board = useContext(BoardContext);
  return boardCurrency(board);
}
