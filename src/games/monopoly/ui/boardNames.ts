import { createContext, useContext } from 'react';
import { formatMoney, moneyText, spaceFlag, spaceName, spacesOf, type BoardId, type Space } from '../engine/board';
import { GROUP_COLOR } from './board-layout';

/** The board the game on screen is played on (set once, by the game screen). */
export const BoardContext = createContext<BoardId>('neo');

/** The squares of the board in play. */
export function useSpaces(): Space[] {
  return spacesOf(useContext(BoardContext));
}

/** A lot's swatch colour: its group, or neutral for stations and utilities. */
export function useSwatch(): (id: number) => string {
  const spaces = useSpaces();
  return (id) => (spaces[id].group ? GROUP_COLOR[spaces[id].group!] : '#8a8f98');
}

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

/** Prints an amount the way the board in play does ($200, \u00A3200, \u20B9200, \u20A52M). */
export function useMoney(): (amount?: number) => string {
  const board = useContext(BoardContext);
  return (amount = 0) => formatMoney(amount, board);
}

/** Rewrites the dollar amounts in a line of text (a log line, a card) for the board in play. */
export function useMoneyText(): (text: string) => string {
  const board = useContext(BoardContext);
  return (text) => moneyText(text, board);
}
