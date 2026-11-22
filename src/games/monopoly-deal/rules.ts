import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { ACTIONS, ACTION_NAME, BIRTHDAY, BUILDING_RENT, COLORS, COLOR_NAME, DEBT, RENT, SET_SIZE, buildDeck, type ActionKind } from './engine';
import { Answers, CardTypes, FullSet } from './ui/ruleFigures';

const M = (n: number) => `${n}M`;
const DECK = buildDeck();
const count = (test: (kind: string) => boolean) => DECK.filter((c) => test(c.kind)).length;
const valueOf = (color: string) => DECK.find((c) => c.kind === 'property' && c.colors[0] === color)!.value;

const ACTION_DOES: Record<ActionKind, string> = {
  'deal-breaker': 'Take a full set from any player, with its House and Hotel.',
  'just-say-no': 'Cancels an action played against you. It is played from your hand when you are asked to answer, and does not count as one of your 3 cards.',
  'sly-deal': 'Take one property from any player. It cannot come from a full set.',
  'forced-deal': 'Swap one of your properties for one of another player\'s. Theirs cannot come from a full set.',
  'debt-collector': `One player of your choice pays you ${M(DEBT)}.`,
  birthday: `Every other player pays you ${M(BIRTHDAY)}.`,
  'pass-go': 'Draw 2 more cards. You may play several in a turn.',
  house: `Laid on a full set of yours: its rent goes up by ${M(BUILDING_RENT.house)}. One per set. Not on Railroads or Utilities.`,
  hotel: `Laid on a full set that has a House: its rent goes up by a further ${M(BUILDING_RENT.hotel)}. One per set.`,
  'double-rent': 'Played together with a Rent card: the rent is doubled. It counts as one of your 3 cards.',
};

export const MD_RULES: GameRules = {
  title: 'Monopoly Deal',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary:
          'The Monopoly card game for 2 to 5 players. Collect properties, bank money, charge rent and steal sets with action cards. The first player with 3 full property sets of different colours wins. A game takes about 15 minutes.',
        sections: [
          section('The goal', p('Be the first to have **3 full property sets of different colours** on the table in front of you.')),
          section(
            'The cards',
            p(`There are ${DECK.length} playing cards.`),
            figure(CardTypes, 'The five kinds of card. The value in the corner is what a card is worth as payment.'),
            table(
              ['Kind', 'Cards', 'What they are for'],
              ['Money', String(count((k) => k === 'money')), `Six 1M, five 2M, three 3M, three 4M, two 5M and one 10M. They go in your bank and pay your debts.`],
              ['Property', String(count((k) => k === 'property')), 'Laid on the table in colour sets. Collecting sets wins the game.'],
              ['Property wild', String(count((k) => k === 'wild')), 'Stands for a property of either colour it shows. Two multicoloured wilds stand for any colour; they have no value and cannot be used to pay.'],
              ['Rent', String(count((k) => k === 'rent')), 'Ten two-colour Rent cards charge every other player; three any-colour Rent cards charge one player.'],
              ['Action', String(count((k) => k === 'action')), 'Played for what they say, or banked as money.'],
            ),
            table(
              ['Colour', 'Cards in a full set', 'Value of each', 'Rent with 1 / 2 / 3 / 4'],
              ...COLORS.map((c) => [COLOR_NAME[c], String(SET_SIZE[c]), M(valueOf(c)), RENT[c].map(M).join(' / ')]),
            ),
            table(['Action card', 'In the deck', 'Bank value', 'What it does'], ...(Object.keys(ACTIONS) as ActionKind[]).map((k) => [ACTION_NAME[k], String(ACTIONS[k][0]), M(ACTIONS[k][1]), ACTION_DOES[k]])),
          ),
          section(
            'Setup',
            steps('The deck is shuffled and each player is dealt **5 cards**.', 'The rest is the face-down draw pile.', 'A player chosen at random goes first. Play goes round the table in seat order.'),
          ),
          section(
            'A turn',
            steps(
              '**Draw 2 cards** from the draw pile. If your hand is empty at the start of your turn, draw **5** instead.',
              sub(
                '**Play up to 3 cards**, in any order and of any kind. You may play none. Each of these is one card played:',
                'a money card, or an action or Rent card used as money, put into your **bank**;',
                'a property or a property wild laid on the table in your **collection**;',
                'an action card or a Rent card played for what it does. A Double the Rent played with a Rent card is a second card.',
              ),
              '**End your turn.** If you hold more than **7 cards**, you choose which to discard down to 7.',
            ),
            list(
              'A card that has been played cannot be taken back into your hand.',
              'Properties never go in the bank. A card banked as money stays money for the rest of the game.',
              'On your turn you may turn a property wild of yours to its other colour (a multicoloured wild to any colour) as often as you like. It does not count as a card played.',
              'When the draw pile runs out, the discard pile is shuffled to make a new one.',
            ),
          ),
          section(
            'Property sets',
            figure(FullSet, 'Three Light Blue properties make a full set.'),
            steps(
              'Each colour needs a fixed number of properties for a full set (see the table above). Wild cards count as properties of the colour they are lying in.',
              'A full set must contain at least one card that is not a multicoloured wild.',
              'Your properties of one colour lie together as one set. Extra properties beyond a full set stay in it and change nothing.',
              `A **House** can be laid on a full set, and a **Hotel** on a full set that has a House. If the set stops being full, its House and Hotel stay with it but add no rent until it is full again.`,
            ),
          ),
          section(
            'Rent and paying',
            steps(
              'A Rent card charges rent on **one colour** it shows, a colour you own property in. The rent is the amount for the number of properties you hold in that colour, plus the House and Hotel on a full set.',
              'A player who owes money chooses what to pay with: cards from their **bank**, and **properties** from their collection, each at its printed value. Houses and Hotels can be paid too.',
              '**No change is given.** If you can only pay 2M with a 5M card, the other player keeps all of it.',
              'You never pay from your hand.',
              'If everything you have on the table is worth no more than you owe, you pay all of it and the debt is settled. With nothing on the table you pay nothing.',
              'Money and buildings paid go into the receiver\'s bank. A property paid goes into the receiver\'s collection, in the colour it was lying in.',
            ),
          ),
          section(
            'Just Say No',
            figure(Answers, 'An action played against you, and the card that refuses it.'),
            steps(
              'When an action is played against you (rent, a debt, a birthday, a Sly Deal, a Forced Deal, a Deal Breaker), you answer it. If you hold a Just Say No you may play it: the action does nothing to you.',
              'The player who played the action may answer your Just Say No with one of their own, and the action goes ahead. You may answer that with another, and so on.',
              'When an action charges several players, each answers for themselves: a Just Say No protects only the player who played it.',
              'A Just Say No played this way does not count as one of the 3 cards of a turn.',
            ),
            note('When you hold no Just Say No, a property taken from you simply goes, and a debt you cannot fully cover is paid with everything you have: the game does not stop to ask about a choice you do not have.'),
          ),
          section(
            'Taking properties',
            terms(
              ['Sly Deal', 'Choose any one property of another player that is not in a full set. It joins your collection in the colour it was lying in.'],
              ['Forced Deal', 'Choose a property of another player that is not in a full set, and one of your own to give them in exchange. Yours may come from any of your sets.'],
              ['Deal Breaker', 'Choose a full set of another player. All its cards, and its House and Hotel, join your collection.'],
            ),
            note('Every property of one colour a player holds counts as the same set here: once a colour is a full set, none of its cards can be taken by a Sly Deal or a Forced Deal, and a Deal Breaker takes them all.'),
          ),
          section(
            'The end',
            steps(
              'The moment a player has **3 full sets of different colours**, they win. This can happen on another player\'s turn, when a payment hands you the property you needed.',
              'If every other player has left, the last player wins.',
            ),
          ),
          section(
            'House rules',
            p('The host chooses these before the game. The first value is the official rule.'),
            table(
              ['Rule', 'Choices', 'What it changes'],
              ['Sets to win', '3; or 2, 4', 'How many full sets of different colours win the game.'],
              ['Build on Railroads and Utilities', 'Off; or On', 'On: Houses and Hotels may also be laid on full Railroad and Utility sets.'],
              ['One Double the Rent per Rent card', 'Off; or On', 'Off: holding both Double the Rent cards, you may play both with one Rent card for four times the rent (that is all 3 cards of the turn).'],
            ),
          ),
          section(
            'The clock and leaving',
            list(
              'Online, the player to act has 60 seconds. If the time runs out on your turn, the game draws for you and ends your turn, discarding your lowest cards if you hold more than 7. If it runs out while you owe money, you pay in the cheapest way; any other action against you goes ahead.',
              'A player who leaves is out of the game. Their hand, bank and properties go to the discard pile.',
            ),
          ),
        ],
      },
    },
  ],
};
