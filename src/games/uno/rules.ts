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
  '"UNO!"',
  steps(
    'When you play your next-to-last card, you must call **"UNO!"** as you play it (or press the call button straight after).',
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

const timing = section(
  'Timing',
  list('Online, each turn has a 30-second clock. If it runs out, you draw a card, or keep the card you drew and pass.', 'With **Draw until you can play** on, the card you drew is played for you instead.'),
);

const STACK_INTRO =
  'A draw card does not hit at once. The player who would draw may instead **answer with a draw card as big or bigger**. The amounts add up and the total passes to the next player. The first player who cannot or will not answer draws the **whole total** and loses their turn.';
const STACK_DETAILS = [
  'An answer does not need to match the colour, and a wild draw card may always be used as an answer, whatever you hold.',
  'While cards are owed to you, a draw card is the **only** card you may play. Otherwise you take the total.',
  'There is no limit to how long a stack can grow.',
  'If a player goes out by playing a draw card, the next player still draws the total before the points are counted.',
];

/** The switches a host can turn on, with what answers what when draw cards stack. */
const house = (mode: 'classic' | 'flip') =>
  section(
    'House rules',
    p('The host can switch these on when setting up a game, or in the lobby before it starts. All are **off** unless switched on, and the side panel lists the ones in play.'),
    terms(
      ['Stack draw cards', STACK_INTRO],
      ['Same numbers together', 'On your turn you may play **several number cards of the same number** at once, in any colours. The first must be a legal play; the others only need the same number. The **last** card you put down sets the colour. It counts as one turn.'],
      [
        'Wild Draw any time',
        mode === 'classic' ? 'A Wild Draw 4 may be played even when you hold a card of the colour in play.' : 'A Wild Draw 2 may be played even when you hold a card of the colour in play.',
      ],
      ['Draw until you can play', 'With nothing to play (or if you would rather not), you draw **until you draw a card that fits**. You keep every card you drew, and you **must play** the one that fits. There is no "keep it and pass".'],
      [
        'Sevens and zeros',
        mode === 'classic'
          ? 'Play a **7** and you swap hands with a player of your choice. Play a **0** and every hand moves on to the next player in the direction of play. A 7 or 0 that is your last card simply wins the hand.'
          : 'Play a **7** and you swap hands with a player of your choice (there are no 0s in the Flip deck). A 7 that is your last card simply wins the hand.',
      ],
    ),
    p('**What answers what** when Stack draw cards is on:'),
    mode === 'classic'
      ? table(['Card owed', 'You may answer with'], ['Draw 2', 'Draw 2, Wild Draw 4'], ['Wild Draw 4', 'Wild Draw 4 only (a Draw 2 is smaller)'])
      : table(
          ['Card owed', 'You may answer with'],
          ['Draw 1 (light)', 'Draw 1, Wild Draw 2'],
          ['Wild Draw 2 (light)', 'Wild Draw 2 only'],
          ['Draw 5 (dark)', 'Draw 5'],
          ['Wild Draw Colour (dark)', 'Nothing: it cannot be answered, and it cannot answer a draw card'],
        ),
    list(...STACK_DETAILS, ...(mode === 'flip' ? ['A Flip card cannot be played while cards are owed, so a stack always stays on one side.'] : [])),
    note('With several house rules on together: a group of 7s swaps hands once and a group of 0s passes hands on once; a group that leaves you one card needs the "UNO!" call; a group may empty your hand and win.'),
  );

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
      ['Wild Draw 4', 'Name the colour; the next player draws 4 cards and loses their turn. You may play it **only if you hold no card of the colour in play** (wilds do not count as a colour). The game enforces this: the card cannot be played otherwise, so there is no challenge.'],
    ),
    note('By the standard rules draw cards cannot be passed on: the player made to draw cannot answer with a draw card of their own. The **Stack draw cards** house rule changes that (see House rules).'),
  ),
  call,
  end('Only the player who goes out scores. The traditional target is 500 points: the result shows when someone passes it, and you may keep dealing hands.'),
  section(
    'Points',
    p('Each card still in a hand when someone goes out is worth this much **to the player who went out**:'),
    table(['Card', 'Points'], ['Number cards', 'Face value (0 to 9)'], ['Skip, Reverse, Draw 2', '20'], ['Wild', '40'], ['Wild Draw 4', '50']),
  ),
  house('classic'),
  timing,
];

const flip: RuleSection[] = [
  goal,
  deal('Flip uses 112 double-sided cards. Every card has a **light** face and a **dark** face. Play starts on the light side. You can always see the other face of every card in the other players\' hands, and of the top card of the draw pile.'),
  section(
    'The two sides',
    table(
      ['', 'Light side', 'Dark side'],
      ['Colours', 'Red, yellow, green, blue', 'Pink, teal, orange, purple'],
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
      ['Wild Draw 2', 'Light side. Name the colour; the next player draws 2 and loses their turn. Only if you hold no card of the colour in play (the game enforces this).'],
      ['Wild Draw Colour', 'Dark side. Name the colour; the next player draws cards one by one **until they draw a card of that colour**, keeps them all, and loses their turn.'],
      ['Flip', 'The whole table turns over: every hand, the draw pile and the discard pile now show their other face. The new top card sets the colour (no colour if it is a Wild), and its action does not happen. Play then continues with the next player.'],
    ),
    note('By the standard rules draw cards cannot be passed on: the player made to draw cannot answer with a draw card of their own. The **Stack draw cards** house rule changes that (see House rules).'),
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
    p('Each card still in a hand when someone goes out is worth this much **to the player who went out**, counted on the side in play.'),
  ),
  house('flip'),
  timing,
];

const noMercy: RuleSection[] = [
  goal,
  section(
    'Setup',
    steps(
      'No Mercy uses **152 cards**. In each of four colours (red, yellow, green, blue): two each of 0 to 9, three Skips, three Reverses, two Draw 2s, two Draw 4s, two Skip Everyones and two Discard Alls. Plus four each of Wild Reverse Draw 4, Wild Draw 6, Wild Draw 10 and Wild Draw Colour.',
      'The deck is shuffled and each player is dealt **7 cards**.',
      'Cards are turned up from the draw pile until a **number card** shows. It starts the discard pile and sets the colour.',
      'Hand 1 is started by the first player in the seat order; each new hand is started by the next player. Play goes clockwise at first.',
    ),
  ),
  section(
    'Your turn',
    steps(
      'Play one card that matches the **colour** or the **symbol** of the top card, or any wild card.',
      'If you cannot play (or would rather not), **draw until you draw a card that fits**. You keep every card you drew, and you **must play** the one that fits.',
      'If cards are owed to you (see Stacking), you may only answer with a draw card or take them.',
    ),
    note('There is no "keep it and pass" in No Mercy, and a wild draw card may be played whatever you hold.'),
  ),
  section(
    'Stacking',
    p(STACK_INTRO),
    table(
      ['Card owed', 'You may answer with'],
      ['Draw 2', 'Draw 2, Draw 4, Wild Reverse Draw 4, Wild Draw 6, Wild Draw 10'],
      ['Draw 4', 'Draw 4, Wild Reverse Draw 4, Wild Draw 6, Wild Draw 10'],
      ['Wild Reverse Draw 4', 'Draw 4, Wild Reverse Draw 4, Wild Draw 6, Wild Draw 10'],
      ['Wild Draw 6', 'Wild Draw 6, Wild Draw 10'],
      ['Wild Draw 10', 'Wild Draw 10 only'],
      ['Wild Draw Colour', 'Nothing: it cannot be answered, and it cannot answer a draw card'],
    ),
    list(...STACK_DETAILS, 'A **Wild Reverse Draw 4** used as an answer turns play round, so the total goes back the way it came.', 'Taking a big total can push you to 25 cards and out of the hand.'),
  ),
  section(
    'Action cards',
    terms(
      ['Skip', 'The next player loses their turn.'],
      ['Skip Everyone', 'Every other player is skipped: you play again at once.'],
      ['Reverse', 'Play changes direction. With only two players it works like a Skip.'],
      ['Draw 2 / Draw 4', 'The next player owes 2 or 4 cards (see Stacking).'],
      ['Discard All', 'Every other card of that colour in your hand goes to the discard pile with it.'],
      ['Wild Reverse Draw 4', 'Name the colour. Play turns round, and the player now next owes 4.'],
      ['Wild Draw 6 / Wild Draw 10', 'Name the colour; the next player owes 6 or 10.'],
      ['Wild Draw Colour', 'Name the colour; the next player draws cards one by one **until they draw a card of that colour**, keeps them all, and loses their turn. It cannot be answered, and it cannot answer a draw card.'],
    ),
  ),
  section(
    'Sevens and zeros',
    list(
      'Play a **7** and you **swap hands** with a player of your choice.',
      'Play a **0** and **every hand moves on** to the next player in the direction of play.',
      'A 7 or 0 that is your last card simply wins the hand: nothing is swapped.',
    ),
  ),
  section(
    'The limit: 25 cards',
    list(
      'A player who holds **25 cards or more** is **out of the hand** at once.',
      'Their cards go under the draw pile. The points of those cards wait in a pot for whoever wins the hand.',
      'Play goes on without them. If only one player is left, that player wins the hand.',
      'Everyone is back in for the next hand.',
    ),
  ),
  section(
    'House rules',
    p('No Mercy already plays with stacking, drawing until you can play, a free wild draw and sevens and zeros: those cannot be switched off. One more can be switched on by the host:'),
    terms(['Same numbers together', 'On your turn you may play **several number cards of the same number** at once, in any colours. The first must be a legal play; the **last** one sets the colour. A group of 7s swaps hands once, and a group of 0s passes hands on once.']),
  ),
  call,
  end('The winner of a hand also takes the pot from any hands that were knocked out. The traditional target is 500 points: the result shows when someone passes it, and you may keep dealing hands.'),
  section(
    'Points',
    p('Each card still in a hand when someone goes out is worth this much **to the player who went out**:'),
    table(['Card', 'Points'], ['Number cards', 'Face value (0 to 9)'], ['Skip, Reverse, Draw 2, Draw 4, Discard All', '20'], ['Skip Everyone', '30'], ['Wild Reverse Draw 4, Wild Draw 6, Wild Draw 10', '50'], ['Wild Draw Colour', '60']),
  ),
  section('Timing', list('Online, each turn has a 30-second clock. If it runs out, you draw; if you had already drawn, the card you drew is played for you.')),
];

export const UNO_RULES: GameRules = {
  title: 'Uno',
  variants: [
    {
      id: 'classic',
      label: 'Classic',
      book: { summary: 'Match the colour or the symbol on the discard pile, use action cards to slow everyone down, and be first to empty your hand. 2 to 10 players.', sections: classic },
    },
    {
      id: 'flip',
      label: 'Flip',
      book: { summary: 'Uno with double-sided cards. A Flip card turns the whole table over to the dark side, where the actions are harsher, and back again. 2 to 10 players.', sections: flip },
    },
    {
      id: 'no-mercy',
      label: 'No Mercy',
      book: { summary: 'Uno without mercy: draw cards stack without end, you draw until you can play, sevens and zeros move whole hands around, and holding 25 cards puts you out of the hand. 2 to 10 players.', sections: noMercy },
    },
  ],
};
