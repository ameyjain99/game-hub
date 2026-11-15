import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { CardKinds, Tokens } from './ui/ruleFigures';
import { MAX_SEATS, MAX_TURNS, MIN_SEATS } from './engine';
import { ROOMS, SECRET_PASSAGES, SUSPECTS, WEAPONS } from './engine/cards';

const passages = Object.entries(SECRET_PASSAGES)
  .filter(([from, to]) => from < (to as string))
  .map(([from, to]) => `the ${from} and the ${to}`)
  .join(', and ');

export const CLUEDO_RULES: GameRules = {
  title: 'Cluedo',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: `A murder mystery for ${MIN_SEATS} to ${MAX_SEATS} detectives. Walk the mansion, make suggestions in its rooms to find out which cards the others hold, and be the first to name the murderer, the weapon and the room in the envelope.`,
        sections: [
          section(
            'The goal',
            p('Be the first to make a correct **accusation**: the exact suspect, weapon and room hidden in the envelope.'),
            terms(
              ['Envelope', 'The hidden answer: one suspect card, one weapon card and one room card.'],
              ['Suggestion', 'A question asked in a room ("Was it this suspect, with this weapon, in this room?") that other players answer by showing a card.'],
              ['Accusation', 'Your final answer. You get one; a wrong accusation puts you out.'],
            ),
          ),
          section('The cards', figure(CardKinds, 'Suspect, weapon and room cards.'), table(['Suspects', 'Weapons', 'Rooms'], ...ROOMS.map((room, i) => [SUSPECTS[i] ?? '', WEAPONS[i] ?? '', room]))),
          section(
            'Setting up',
            figure(Tokens, 'The six suspect tokens.'),
            steps(
              'One suspect, one weapon and one room card are drawn at random into the **envelope**. Nobody sees them.',
              'The other 18 cards are shuffled and dealt one at a time round the table. With 4 or 5 players some hold one card more than others; everyone can see how many cards each player holds.',
              `Players take suspects in seat order: ${SUSPECTS.join(', ')}. All six suspect tokens are on the board even with fewer players, because any of them can be named in a suggestion.`,
              'Each token starts on its own coloured start square at the edge of the mansion.',
              'The six weapons start in six different rooms, chosen at random.',
              'Miss Scarlett (the first seat) takes the first turn; turns go round the seats.',
            ),
            note('The cards in your hand cannot be in the envelope. Neither can any card someone shows you.'),
          ),
          section(
            'The mansion',
            list(
              'The board is a grid of squares: nine rooms, the corridors between them, and the case file in the middle, which nobody walks through.',
              'Each room has one or more doors, marked in gold on its wall. You enter and leave a room only through a door.',
              `Secret passages join opposite corner rooms: ${passages}.`,
              'Any number of tokens can share a room. A corridor square holds one token at a time.',
            ),
          ),
          section(
            'Your turn',
            steps(
              sub(
                'Start your turn with **one** of these:',
                '**Roll the dice** and move (see Moving).',
                '**Take the secret passage**, if you start in a corner room: you go straight into the opposite corner room.',
                '**Stay and suggest**, if a suggestion moved your token into a room since your last turn: you may suggest in that room without moving.',
                '**Accuse** (see Accusing).',
              ),
              'If you entered a room this turn (by walking, by passage, or by staying as above), you may make **one suggestion** there (see Suggesting).',
              'Then you may accuse, or end your turn. If you stopped in a corridor, your turn ends when you stop.',
            ),
          ),
          section(
            'Moving',
            steps(
              'Roll two dice. You may walk **up to** the total, one square at a time, up, down, left or right; never diagonally.',
              'You cannot walk onto or through a square another token stands on.',
              'Leaving a room takes one step, out through any of its doors.',
              'Stepping through a door into a room takes one step and **ends your move**, whatever is left of the roll.',
              'You cannot go back into the room you started your turn in.',
              'If other tokens shut you in (every way out is blocked), your turn ends where you are.',
            ),
            note('GameHub lets you stop short of the full roll on a corridor square. The squares and rooms you can reach light up after you roll.'),
          ),
          section(
            'Suggesting',
            steps(
              'Name a suspect and a weapon. The room is always the room you are in.',
              'The named suspect\'s token and the named weapon are moved into your room. A player whose token is moved this way may stay and suggest there on their next turn.',
              sub(
                'The players after you, in seat order, are asked one at a time:',
                'If they hold **none** of the three named cards, they say so (everyone sees that they passed) and the next player is asked.',
                'The **first** player who holds one or more of the cards must **show you exactly one**. They choose which. Only you and they see the card; everyone else sees only that a card was shown.',
                'Once a card is shown, nobody else is asked.',
              ),
              'If nobody can show a card, everyone sees that too. Any of the three you do not hold yourself may be in the envelope.',
              'Players who are out (after a wrong accusation) are still asked and still show cards.',
            ),
            note('You may name cards from your own hand, to steer what the others can show you. You may name your own suspect.'),
          ),
          section(
            'Accusing',
            steps(
              'On your turn, before you roll or after you move (and suggest), you may accuse: name a suspect, a weapon and a room. The room does not have to be the one you are in.',
              'If all three match the envelope, you **win**, and everyone sees the answer.',
              'If not, you are **out**: you take no more turns and cannot win, but your token stays on the board and you keep showing cards when asked. Everyone sees what you accused.',
              'If every player has accused wrongly, the case closes unsolved and the answer is shown.',
            ),
          ),
          section(
            'The notebook',
            list(
              'Your notebook lists every card against every player. Your own cards, the cards shown to you, and the players who passed on a suggestion are filled in for you.',
              'Tap any other square to mark it yourself: a tick (holds it), a cross (does not), or a question mark. Your marks are for you only.',
              'A card struck through is held by someone, so it is not in the envelope.',
            ),
          ),
          section(
            'Players leaving and the clock',
            list(
              'Online, each turn has a clock. If it runs out: before moving, you roll; after rolling, you move to the first room in reach (or a square); otherwise your turn ends. If you are asked for a card when it runs out, the first of your matching cards is shown.',
              'A player who leaves lays their cards face up for everyone and takes no further part.',
              `After ${MAX_TURNS} turns without a correct accusation the case closes unsolved.`,
            ),
          ),
        ],
      },
    },
  ],
};
