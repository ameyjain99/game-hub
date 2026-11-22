import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { Chips, Jacks } from './ui/ruleFigures';

export const SEQUENCE_RULES: GameRules = {
  title: 'Sequence',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'Play a card from your hand and put a chip on a matching space of the board. Make lines of five chips in a row. Jacks are wild: two-eyed Jacks place anywhere, one-eyed Jacks remove a rival chip. 2 to 12 players, in teams.',
        sections: [
          section(
            'The goal',
            p('Be the first team to complete the lines it needs: **two lines** when there are two teams, **one line** when there are three.'),
            terms(['Line', 'Five of your team\'s chips in a straight row: across, down or diagonal. The four corner spaces count as a chip of every team.']),
          ),
          section(
            'Players and teams',
            figure(Chips, 'Each team plays chips of its own colour.'),
            table(
              ['Players', 'Teams', 'Lines needed', 'Cards in hand'],
              ['2', '2 (one player each)', '2', '7'],
              ['3', '3 (one player each)', '1', '6'],
              ['4', '2 teams of 2', '2', '6'],
              ['6', '3 teams of 2', '1', '5'],
              ['8', '2 teams of 4', '2', '4'],
              ['9', '3 teams of 3', '1', '4'],
              ['10', '2 teams of 5', '2', '3'],
              ['12', '3 teams of 4', '1', '3'],
            ),
            list('Teammates sit alternately round the table: with two teams, every other seat; with three teams, every third seat. A team shares its chips and its lines.'),
          ),
          section(
            'The board and the cards',
            steps(
              'The board has 100 spaces: every card of two decks except the Jacks (96 spaces), plus a **free corner** in each corner.',
              'Each card appears on the board twice, far apart.',
              'The draw pile is two full decks: 104 cards, including 8 Jacks.',
              'Each player is dealt a hand (see the table above). The first player in the seat order goes first; turns go round the seats.',
            ),
          ),
          section(
            'A turn',
            figure(Jacks),
            steps(
              'Play one card from your hand face up on the discard pile.',
              sub(
                'Put one of your team\'s chips on the board as the card allows:',
                'A **plain card**: on either of its two spaces, if that space is empty.',
                'A **two-eyed Jack** (diamonds or clubs): on **any** empty space.',
                'A **one-eyed Jack** (hearts or spades): instead of placing, **remove** one chip of another team. You may not remove a chip that is part of a completed line.',
              ),
              'Draw one card from the pile. When the pile runs out, all the discards are shuffled to make a new one.',
            ),
          ),
          section(
            'Dead cards',
            steps(
              'A plain card is **dead** when both of its spaces already hold chips.',
              'Once per turn, before you play, you may discard a dead card and draw a replacement. Then play your turn as normal.',
              'If you have no card you can play at all, discard any card, draw a replacement, and your turn ends.',
            ),
          ),
          section(
            'Making lines',
            steps(
              'A line is made the moment five of your team\'s spaces in a row are filled (corners count).',
              'One chip can complete lines in several directions at once, but at most one new line in each direction.',
              'A second line may **share one space** with a line you already have, but no more. So nine chips in a row, built up over two turns, can be two lines.',
              'Chips in a completed line are locked: no one-eyed Jack can remove them.',
            ),
          ),
          section(
            'Winning',
            steps(
              'The moment a team has the number of lines it needs, it wins the game.',
              'Each win scores a point for the team. Press Play again for a new deal.',
            ),
            note('Players who leave are skipped. If only one team still has players, that team wins.'),
          ),
          section('Timing', list('Online, each turn has a 45-second clock. If it runs out, a sensible card is played for you.')),
        ],
      },
    },
  ],
};
