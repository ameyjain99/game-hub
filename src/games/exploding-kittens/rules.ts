import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { CARD_NAME, COUNTS, NOPE_MS, type Kind } from './engine';
import { ActionCards, CatCards, KittenAndDefuse, Pair } from './ui/ruleFigures';

const count = (k: Kind) => String(COUNTS[k]);

export const EK_RULES: GameRules = {
  title: 'Exploding Kittens',
  variants: [
    {
      id: 'original',
      label: 'Original',
      book: {
        summary:
          'A game of chance and nerve for 2 to 5 players. Somewhere in the draw pile are Exploding Kittens. Draw one without a Defuse and you are out. Every other card helps you avoid them, or push them onto someone else. The last player left wins.',
        sections: [
          section('The goal', p('Be the **last player who has not exploded**.')),
          section(
            'The cards',
            p('The original box: 56 cards.'),
            figure(KittenAndDefuse, 'The card that ends your game, and the one that saves you from it.'),
            figure(ActionCards, 'The action cards.'),
            figure(CatCards, 'The five Cat Cards. They do nothing alone.'),
            table(
              ['Card', 'In the box', 'What it does'],
              [CARD_NAME.exploding, count('exploding'), 'Drawn without a Defuse, it puts you out of the game.'],
              [CARD_NAME.defuse, count('defuse'), 'Saves you from a Kitten you draw. The Defuse is discarded and you put the Kitten back in the draw pile, anywhere, in secret.'],
              [CARD_NAME.attack, count('attack'), 'Ends your turn without drawing, and the next player takes 2 turns in a row.'],
              [CARD_NAME.skip, count('skip'), 'Ends your turn without drawing.'],
              [CARD_NAME.favor, count('favor'), 'A player you choose gives you one card from their hand. They choose which.'],
              [CARD_NAME.shuffle, count('shuffle'), 'The draw pile is shuffled.'],
              [CARD_NAME.future, count('future'), 'You alone look at the top 3 cards of the draw pile. Their order does not change.'],
              [CARD_NAME.nope, count('nope'), 'Stops any action or combo. Can be played at any time, by anyone.'],
              ['Cat Cards', '5 kinds × 4', 'No power alone. Played in pairs (see Combos).'],
            ),
          ),
          section(
            'Setup',
            steps(
              'The Exploding Kittens and the Defuses are taken out of the deck. The rest is shuffled and each player is dealt **7 cards**, then **1 Defuse**: 8 cards each.',
              'Spare Defuses go back into the deck: **2** at a table of 2, 3 or 4, **1** at a table of 5. The other spares are out of the game.',
              'Exploding Kittens go into the deck: **one fewer than the number of players**. The deck is shuffled and becomes the face-down **draw pile**.',
              'A player chosen at random goes first. Play goes round the table in seat order.',
            ),
          ),
          section(
            'A turn',
            steps(
              sub(
                '**Play cards, or don\'t.** You may play as many cards as you like, one action or combo at a time:',
                'select the card or cards in your hand and press the play button;',
                'the action waits a moment so that it can be Noped (see Nope), then takes effect;',
                'then you may play again.',
              ),
              '**Draw one card** from the top of the draw pile. This ends your turn. If it is not an Exploding Kitten, it goes into your hand.',
              'An **Attack** or a **Skip** ends your turn instead, without drawing.',
            ),
            note('There is no limit to the cards in your hand, and you never have to play one.'),
          ),
          section(
            'Drawing an Exploding Kitten',
            steps(
              'Everyone sees it.',
              sub(
                'If you hold a **Defuse**, it is played for you and discarded. You then put the Kitten back in the draw pile:',
                'on top, at the bottom, or under any number of cards you choose;',
                'nobody else is told where.',
              ),
              'Your turn then ends.',
              'If you hold **no Defuse**, you explode: you are out of the game. Your hand goes to the discard pile and that Kitten leaves the game.',
            ),
            note('An Exploding Kitten and a Defuse cannot be Noped.'),
          ),
          section(
            'Attack and extra turns',
            steps(
              'An Attack ends your turn at once, without drawing. The next player must take **2 turns** in a row: they play and draw, then play and draw again.',
              'A **Skip** played by a player under attack ends only one of those turns.',
              'If a player under attack plays an **Attack** of their own, their remaining turns pass to the next player, **plus 2**. Attacked for 2 turns and answering with an Attack straight away makes the next player take 4; the next Attack makes it 6.',
              'A player who explodes during an attack takes the remaining turns with them: the next player takes one ordinary turn.',
            ),
          ),
          section(
            'Nope',
            steps(
              'When any action card or combo is played, it does not take effect at once. Any player holding a Nope may play it to cancel that action. The cards played are still discarded.',
              'A Nope can itself be Noped, which lets the action happen after all, and so on. An odd number of Nopes cancels the action; an even number lets it through.',
              'You cannot Nope your own card (but you can Nope someone\'s Nope on it).',
              `If you hold a Nope, you are given ${NOPE_MS / 1000} seconds to use it, or you can press **Let it happen**. When nobody who could Nope is still deciding, the action goes ahead.`,
              'Nope works on Attack, Skip, Favor, Shuffle, See the Future and every combo. It does not work on an Exploding Kitten or a Defuse.',
            ),
          ),
          section(
            'Combos',
            figure(Pair, 'Two cards with the same name.'),
            terms(
              ['Two of a kind', 'Play two cards with the same name, choose a player, and take **one card at random** from their hand.'],
              ['Three of a kind', 'Play three cards with the same name, choose a player and **name a card**. If they hold one, they must hand it over. If not, you get nothing.'],
              ['Five different cards', 'Play any five cards with five different names and take **any one card** from the discard pile.'],
            ),
            list(
              'A combo uses the cards as plain cards: their own actions do not happen.',
              'Any cards with matching names can make a combo, not only Cat Cards. A table can limit pairs to Cat Cards and switch threes and fives off (see House rules).',
              'You cannot choose a player who has no cards.',
              'The five cards of a five-card combo cannot be the card you take back.',
            ),
          ),
          section(
            'The end',
            steps('When all players but one have exploded or left, the last player wins.', 'The draw pile can never run out first: it always holds one Kitten fewer than there are players left.'),
          ),
          section(
            'House rules',
            p('The host chooses these before the game. The first value is the official rule.'),
            table(
              ['Rule', 'Choices', 'What it changes'],
              ['Cards dealt', '7; or 5', 'The cards each player is dealt before their Defuse. Fewer cards make a quicker, harsher game.'],
              ['Combos with any cards', 'On; or Off', 'Off: only two matching Cat Cards make a pair, and there are no three-of-a-kind or five-card combos (the rules of a first game).'],
              ['Attacks stack', 'On; or Off', 'Off: an Attack always gives the next player exactly 2 turns, even if the attacker was under attack.'],
              ['Short game', 'Off; or On', 'On: after the deal, a third of the draw pile is set aside unseen before the Kittens and Defuses go in.'],
            ),
          ),
          section(
            'The clock and leaving',
            list(
              'Online, the player to act has 40 seconds. If the time runs out, the game draws a card for them, gives their least useful card to a Favor, or puts a Defused Kitten back at a random depth.',
              'A player who leaves is out of the game. Their hand is discarded and one Exploding Kitten is taken out of the draw pile, so the pile still holds one fewer Kitten than there are players. After that, nobody can rely on what they knew of the pile\'s order.',
              'After a Shuffle, or after another player puts a Kitten back, what you knew of the top of the pile no longer holds, and the screen stops showing it.',
            ),
          ),
        ],
      },
    },
  ],
};
