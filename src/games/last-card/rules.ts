import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleSection } from '../../shared/rules';
import { ClassicCards, FlipCards, Matching } from './ui/ruleFigures';

const goal = section(
  'The goal',
  p('Be the first to play every card from your hand. Going out wins the hand, and you score points for the cards still in everyone else\'s hands.'),
);

const deal = (deckText: string) =>
  section(
    'Setup',
    steps(
      deckText,
      'The deck is shuffled and each player is dealt **7 cards**.',
      'The rest form the face-down **draw pile**. Cards are turned up from it, one at a time, onto the **discard pile** until the top card is not a Wild Draw card. That card starts the pile.',
      'The starting card sets the colour to match (a Wild starts with no colour, so any card may follow). Its action, if any, does **not** happen.',
      'Hand 1 is started by the first player in the seat order; each new hand is started by the next player. Play goes clockwise at first.',
    ),
  );

const turn = section(
  'A turn',
  steps(
    sub(
      'Play one card from your hand onto the discard pile if it **matches** the top card:',
      'the **same colour** as the colour in play; or',
      'the **same number** (number cards); or',
      'the **same symbol** (action cards: Skip on Skip, Draw 2 on Draw 2, and so on); or',
      'any **Wild** card. You then name the colour in play.',
    ),
    sub(
      'If you cannot or will not play, **draw one card** from the draw pile.',
      'If that card matches, you may play it at once (and only it), or keep it and pass.',
      'If it does not match, your turn ends.',
    ),
    'The card\'s action, if any, takes place (see Action cards). Then the next player in the current direction takes their turn.',
  ),
  figure(Matching, 'A green 7 on the pile: any green card or any 7 may go on it.'),
  note('The draw pile never runs out while there are discards: the discards under the top card are shuffled to make a new draw pile. If there are no cards left at all, drawing simply passes your turn.'),
);

const call = section(
  '"Last card!"',
  steps(
    'When you play your next-to-last card, you must call **"Last card!"** as you play it (or press the call button straight after).',
    'If you don\'t, any other player may **catch** you before the next player takes their turn. A caught player draws **2 cards**.',
    'Once the next player acts, it is too late to catch you.',
  ),
);

const end = (target: string) =>
  section(
    'Going out and scoring',
    steps(
      'The moment you play your last card, you win the hand. If that card has an action, it still happens first.',
      'You score the points of every card left in the other players\' hands.',
      'Scores carry over. Press Deal the next hand to play on.',
    ),
    p(target),
  );

const timing = section('Timing', list('Online, each turn has a 30-second clock. If it runs out, you draw a card, or keep the card you drew and pass.'));

const classic: RuleSection[] = [
  goal,
  deal('Classic uses 108 cards: in each of four colours (red, yellow, green, blue) one 0, two each of 1 to 9, two Skips, two Reverses and two Draw 2s; plus four Wilds and four Wild Draw 4s.'),
  turn,
  section(
    'Action cards',
    figure(ClassicCards),
    terms(
      ['Skip', 'The next player loses their turn.'],
      ['Reverse', 'Play changes direction. With only two players it works like a Skip: you play again.'],
      ['Draw 2', 'The next player draws 2 cards and loses their turn.'],
      ['Wild', 'Name the colour in play. Can be played on anything.'],
      ['Wild Draw 4', 'Name the colour; the next player draws 4 cards and loses their turn. You may play it **only if you hold no card of the colour in play**.'],
    ),
    note('Draw cards cannot be passed on: the player made to draw cannot answer with a draw card of their own.'),
  ),
  call,
  end('The traditional target is 500 points: the result shows when someone passes it, and you may keep dealing hands.'),
  section(
    'Points',
    table(['Card', 'Points'], ['Number cards', 'Face value (0 to 9)'], ['Skip, Reverse, Draw 2', '20'], ['Wild', '40'], ['Wild Draw 4', '50']),
  ),
  timing,
];

const flip: RuleSection[] = [
  goal,
  deal('Flip uses 112 double-sided cards. Every card has a **light** face and a **dark** face. Play starts on the light side. You can always see the other face of every card in the other players\' hands, and of the top card of the draw pile.'),
  section(
    'The two sides',
    table(
      ['', 'Light side', 'Dark side'],
      ['Colours', 'Red, yellow, green, blue', 'Rose, jade, amber, violet'],
      ['Numbers', 'Two each of 1 to 9 per colour (no 0s)', 'Two each of 1 to 9 per colour'],
      ['Actions per colour (two each)', 'Skip, Reverse, Draw 1, Flip', 'Skip Everyone, Reverse, Draw 5, Flip'],
      ['Wilds', 'Four Wilds, four Wild Draw 2s', 'Four Wilds, four Wild Draw Colours'],
    ),
  ),
  turn,
  section(
    'Action cards',
    figure(FlipCards, 'Light side above, dark side below.'),
    terms(
      ['Skip', 'The next player loses their turn.'],
      ['Skip Everyone', 'Every other player is skipped: you play again at once.'],
      ['Reverse', 'Play changes direction. With only two players it works like a Skip.'],
      ['Draw 1 / Draw 5', 'The next player draws 1 (light) or 5 (dark) cards and loses their turn.'],
      ['Wild', 'Name the colour in play.'],
      ['Wild Draw 2', 'Light side. Name the colour; the next player draws 2 and loses their turn. Only if you hold no card of the colour in play.'],
      ['Wild Draw Colour', 'Dark side. Name the colour; the next player draws cards one by one **until they draw a card of that colour**, keeps them all, and loses their turn.'],
      ['Flip', 'The whole table turns over: every hand, the draw pile and the discard pile now show their other face. The new top card sets the colour (no colour if it is a Wild), and its action does not happen. Play then continues with the next player.'],
    ),
    note('Draw cards cannot be passed on: the player made to draw cannot answer with a draw card of their own.'),
  ),
  call,
  end('Points are counted on the side in play when the hand ends. The traditional target is 500 points: the result shows when someone passes it, and you may keep dealing hands.'),
  section(
    'Points',
    table(
      ['Card', 'Points'],
      ['Number cards', 'Face value'],
      ['Draw 1', '10'],
      ['Skip, Reverse, Flip, Draw 5', '20'],
      ['Skip Everyone', '30'],
      ['Wild', '40'],
      ['Wild Draw 2', '50'],
      ['Wild Draw Colour', '60'],
    ),
  ),
  timing,
];

export const LAST_CARD_RULES: GameRules = {
  title: 'Last Card',
  variants: [
    {
      id: 'classic',
      label: 'Classic',
      book: { summary: 'Match the colour or the symbol on the discard pile, use action cards to slow everyone down, and be first to empty your hand. 2 to 10 players.', sections: classic },
    },
    {
      id: 'flip',
      label: 'Flip',
      book: { summary: 'Last Card with double-sided cards. A Flip card turns the whole table over to the dark side, where the actions are harsher, and back again. 2 to 10 players.', sections: flip },
    },
  ],
};
