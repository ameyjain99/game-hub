import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleBook } from '../../shared/rules';
import { Builds } from './ui/ruleFigures';

const book = (draw: 1 | 3): RuleBook => ({
  summary: `Klondike, the classic one-player Solitaire. Move all 52 cards onto four foundations, one per suit, from Ace up to King. The stock is turned ${draw === 1 ? 'one card' : 'three cards'} at a time.`,
  sections: [
    section('The goal', p('Move **all 52 cards** onto the four **foundations**, building each one up by suit from Ace to King.')),
    section(
      'The layout',
      terms(
        ['Tableau', 'Seven piles dealt left to right with 1, 2, 3 ... 7 cards. Only the top card of each pile is face up.'],
        ['Stock', 'The other 24 cards, face down.'],
        ['Waste', 'Where cards turned from the stock go, face up. Only its top card can be played.'],
        ['Foundations', 'Four empty spaces, one for each suit.'],
      ),
    ),
    section(
      'Moving cards',
      figure(Builds),
      steps(
        sub(
          '**On the tableau**, build **down** in **alternating colours**: a card may go on a face-up card one rank higher of the other colour.',
          'Example: a red 9 goes on a black 10; a black Queen on a red King.',
        ),
        'Any run of face-up, correctly built cards may be moved together as one unit, by its bottom card.',
        'Only a **King**, or a run headed by a King, may go into an empty tableau pile.',
        '**On a foundation**, build **up by suit**: the Ace first, then the 2 of that suit, and so on to the King. Cards go onto a foundation one at a time.',
        'A card on a foundation may be moved back onto the tableau if it fits there.',
        'When a face-down tableau card is left on top of its pile, it turns face up.',
      ),
      note('Click a card to send it to its best place, or drag it where you want it.'),
    ),
    section(
      'The stock',
      steps(
        draw === 1 ? 'Turn **one card** at a time from the stock onto the waste.' : 'Turn **three cards** at a time from the stock onto the waste (fewer if fewer are left). Only the top one of the three can be played.',
        'When the stock is empty, turn the whole waste back over to make a new stock, in the same order. You may go through the stock as many times as you like.',
      ),
    ),
    section(
      'Scoring',
      p('Points follow the familiar Windows Solitaire scheme. The score never goes below 0.'),
      table(
        ['Move', 'Points'],
        ['Waste to tableau', '+5'],
        ['Waste or tableau to foundation', '+10'],
        ['Turning a tableau card face up', '+5'],
        ['Foundation back to tableau', '-15'],
        ['Turning the waste back over', draw === 1 ? '-100' : '0'],
      ),
    ),
    section(
      'Winning and helpers',
      steps(
        'You win when all 52 cards are on the foundations.',
        'Once the stock and waste are empty and every tableau card is face up, the game can finish itself: press **Finish the game** to send every card home.',
      ),
      list(
        '**Undo** takes back moves one at a time (Ctrl or Cmd + Z), up to 300 moves.',
        '**Hint** shows a useful move, or points you to the stock.',
        'A clock and a move count run while you play. **New deal** starts again with a fresh shuffle.',
      ),
    ),
  ],
});

export const SOLITAIRE_RULES: GameRules = {
  title: 'Solitaire',
  variants: [
    { id: '1', label: 'Draw one', book: book(1) },
    { id: '3', label: 'Draw three', book: book(3) },
  ],
};
