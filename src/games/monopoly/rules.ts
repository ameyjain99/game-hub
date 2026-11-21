import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { Deed, Doubles } from './ui/ruleFigures';
import { BOARD, BOARDS, OWNABLE_IDS, spaceName } from './engine/board';
import { CHANCE, CHEST, cardText } from './engine/cards';
import { DEFAULT_SETTINGS } from './engine/state';

const $ = (n: number) => `$${n.toLocaleString('en-US')}`;
const COLOUR: Record<string, string> = {
  brown: 'Brown',
  lightblue: 'Light blue',
  pink: 'Pink',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  darkblue: 'Dark blue',
};

const propertyRows = BOARD.filter((s) => s.kind === 'property').map((s) => [
  s.name,
  COLOUR[s.group!],
  $(s.price!),
  s.rent!.map((r) => $(r)).join(' / '),
  $(s.houseCost!),
  $(Math.floor(s.price! / 2)),
]);
const stations = BOARD.filter((s) => s.kind === 'railroad').map((s) => s.name).join(', ');
const utilities = BOARD.filter((s) => s.kind === 'utility').map((s) => s.name).join(' and ');
const onOff = (on: boolean) => (on ? 'On' : 'Off');
const boardRows = OWNABLE_IDS.map((id) => BOARDS.map((b) => spaceName(id, b.id)));

export const MONOPOLY_RULES: GameRules = {
  title: 'Monopoly',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'Roll the dice, travel round the board, buy property, collect rent and build houses and hotels. Players who cannot pay their debts go bankrupt; the last player left wins. 2 to 6 players.',
        sections: [
          section('The goal', p('Be the **last player who is not bankrupt**. You drive others out by owning property they must pay rent on.')),
          section(
            'Setup',
            steps(
              `Every player starts with **${$(DEFAULT_SETTINGS.startingCash)}** (the host can choose ${$(500)} to ${$(3000)} instead) and a token on **Go**.`,
              'The bank holds all property, **32 houses** and **12 hotels**. The bank never runs out of money.',
              'Chance and Community Chest are each a shuffled deck of 16 cards.',
              'Turn order: online it is decided at random; on this device you go first, then the bots in order.',
            ),
          ),
          section(
            'A turn',
            figure(Doubles, 'Doubles: move, act, then roll again.'),
            steps(
              'Roll the two dice and move your token clockwise that many spaces.',
              sub('Do what the space you land on says (see Spaces).', 'If you **pass or land on Go**, collect $200 from the bank.'),
              'During your turn you may also build, sell buildings, mortgage, pay off mortgages, and propose trades (see Managing your property).',
              sub(
                '**Doubles** (both dice the same): after you finish with the space, roll again and take another move.',
                'Three doubles in a row in one turn send you straight to Jail. You do not move for the third roll.',
              ),
              'End your turn. You may not end it while you owe money, while a purchase is still to be decided, or while an auction or trade is open.',
            ),
          ),
          section(
            'Spaces',
            terms(
              ['Unowned property', 'Buy it for its printed price, or decline. If you decline (or cannot afford it), it goes to **auction** (see Auctions).'],
              ['Someone else\'s property', 'Pay its owner rent (see Rent). No rent is due on a mortgaged property.'],
              ['Your own property', 'Nothing happens.'],
              ['Chance / Community Chest', 'Take the top card of that deck and do what it says at once (see Cards).'],
              ['Income Tax', `Pay the bank ${$(200)}.`],
              ['Luxury Tax', `Pay the bank ${$(100)}.`],
              ['Go To Jail', 'Go directly to Jail. You do not pass Go and do not collect $200, and you get no extra roll for doubles.'],
              ['Jail', 'If you just land here, you are only visiting. Nothing happens.'],
              ['Free Parking', 'Nothing happens (unless the Free Parking jackpot house rule is on).'],
              ['Go', 'Collect $200 for passing or landing (see the Double salary house rule).'],
            ),
          ),
          section(
            'Rent',
            figure(Deed, 'Title deeds show the rent, the house cost and the mortgage value.'),
            steps(
              'A **colour property** with no houses charges its base rent. If the owner owns **every property of that colour** (a full set), the base rent is doubled, as long as none of them has a house.',
              'A property with houses or a hotel charges the rent for that many houses, or the hotel rent.',
              `**Stations** (${stations}) charge ${$(25)}, ${$(50)}, ${$(100)} or ${$(200)} for 1, 2, 3 or 4 stations owned by the same player.`,
              `**Utilities** (${utilities}) charge 4 times the dice total if the owner has one utility, or 10 times if they own both. The dice total is the roll that brought you there (for a card that moved you, the roll you made this turn).`,
              'A **mortgaged** property charges no rent. The other properties of its set still count toward a full set.',
            ),
            table(['Property', 'Colour', 'Price', 'Rent: base / 1 / 2 / 3 / 4 houses / hotel', 'House cost', 'Mortgage'], ...propertyRows),
            p(`Stations cost ${$(200)} and utilities ${$(150)}. Their mortgage value is half that.`),
          ),
          section(
            'Auctions',
            steps(
              'When a property goes to auction, **every player still in the game** may bid, including the player who declined it.',
              'Bidding goes round in turn order, starting with the player whose turn it is.',
              'On your bid you either raise the high bid (by any amount, to at most the cash you hold) or pass. Once you pass, you are out of this auction.',
              'The auction ends when every player except the high bidder has passed. The high bidder pays their bid and takes the property.',
              'If nobody bids at all, the property stays with the bank.',
            ),
            note('Bids are paid from cash in hand. You cannot mortgage or sell to raise a bid during the auction.'),
          ),
          section(
            'Managing your property',
            p('On your own turn (before or after rolling, but never during an auction or trade), you may:'),
            steps(
              sub(
                '**Build a house** on a colour property, paying its house cost to the bank. Only if:',
                'you own every property of that colour;',
                'none of them is mortgaged;',
                'you build **evenly**: no property of the set may have two more houses than another (see Even building);',
                'the bank still has a house to sell you.',
              ),
              'After four houses, the next purchase is a **hotel**: pay one more house cost and the four houses go back to the bank. The bank must have a hotel left. A property holds at most one hotel.',
              'If the bank has no houses (or hotels) left, nobody can build them until some are sold back.',
              '**Sell a building** back to the bank for **half** its house cost. Sell evenly too. Selling a hotel turns it back into four houses.',
              '**Mortgage** a property to the bank for half its price. You may not mortgage a colour property while any property of its set has buildings. Sell them first.',
              '**Pay off a mortgage** for the mortgage value **plus 10% interest** (rounded up).',
            ),
          ),
          section(
            'Trading',
            steps(
              'On your turn, after rolling, you may offer a trade to one other player: any mix of cash, properties and Get Out of Jail Free cards, in either direction.',
              'Only properties with **no buildings** on them can be traded.',
              'The other player accepts or declines. Nothing moves unless both sides can still deliver everything when it is accepted.',
              'A player who receives a **mortgaged** property pays the bank 10% of its mortgage value straight away. The property stays mortgaged.',
            ),
          ),
          section(
            'Jail',
            steps(
              'You go to Jail by landing on Go To Jail, by a card, or by rolling three doubles in one turn. Your token goes straight to Jail. You may still manage your property before ending the turn, but you get no extra roll.',
              sub(
                'At the start of each of your turns in Jail, choose one:',
                '**Pay $50**, then roll and move as normal.',
                '**Use a Get Out of Jail Free card**, then roll and move as normal.',
                '**Roll for doubles.** If you roll doubles, you leave Jail and move by that roll; you do **not** roll again. If not, you stay in Jail and your turn ends.',
              ),
              'If your **third** roll in Jail is not doubles, you must pay $50, leave, and move by that roll.',
              'While in Jail you still collect rent, build, trade and mortgage (unless the No rent from jail house rule is on).',
            ),
          ),
          section(
            'Boards',
            p('A game is played on one of four boards, chosen when it is set up. Every board has the same 40 squares, prices, rents and cards; only the places differ. On the Nations board each colour set is a country and the stations are airports. This book uses the Classic names; a card that sends you to a place names the one on your board.'),
            table(BOARDS.map((b) => b.name), ...boardRows),
          ),
          section(
            'Cards',
            table(['Chance'], ...CHANCE.map((c) => [cardText(c)])),
            table(['Community Chest'], ...CHEST.map((c) => [cardText(c)])),
            list(
              'An "Advance to" card moves you forward to that space; if it passes Go you collect $200. "Go back 3 spaces" never collects $200.',
              'A "nearest Station" or "nearest Utility" card moves you forward to the next one. If it is owned, you pay the usual rent to its owner; if not, you may buy it.',
              'A Get Out of Jail Free card is kept until used (or traded). While a player holds one, it is not in its deck.',
              'Used cards go to the bottom of their deck; the deck order stays the same all game.',
            ),
          ),
          section(
            'Debts and bankruptcy',
            steps(
              'If you owe more cash than you have, you must raise it by selling buildings and mortgaging property. You cannot end your turn while your cash is below zero.',
              'If a payment comes due when it is not your turn (for example a card makes you pay every player), the game sells and mortgages for you automatically.',
              sub(
                'If you **cannot** raise enough even by selling and mortgaging everything, you are **bankrupt** and out of the game:',
                'Owing **another player**: they receive all your cash, properties (with their buildings, mortgaged or not) and Get Out of Jail Free cards.',
                'Owing **the bank**: your properties return to the bank unowned, unmortgaged and without buildings, and your Get Out of Jail Free cards go back to their decks.',
              ),
            ),
          ),
          section(
            'End of the game',
            steps(
              'When only one player is not bankrupt, that player wins.',
              'If every human player has left, the game ends and the remaining players are ranked by net worth: cash, plus property at its price (half if mortgaged), plus the cost of buildings.',
              'A game that reaches 2,000 turns also ends this way.',
            ),
          ),
          section(
            'House rules',
            p('The host chooses these before the game. Defaults are shown.'),
            table(
              ['Rule', 'Default', 'What it does'],
              ['Auctions', onOff(DEFAULT_SETTINGS.auctions), 'Off: a declined property simply stays with the bank.'],
              ['Double rent on a full set', onOff(DEFAULT_SETTINGS.doubleRentFullSet), 'Off: a full set without houses charges only the base rent.'],
              ['Mortgaging', onOff(DEFAULT_SETTINGS.mortgaging), 'Off: properties can never be mortgaged.'],
              ['Even building', onOff(DEFAULT_SETTINGS.evenBuild), 'Off: build and sell houses on any property of a full set in any order.'],
              ['Free Parking jackpot', onOff(DEFAULT_SETTINGS.freeParkingJackpot), 'On: Income Tax and Luxury Tax are paid into a pot instead of the bank; whoever lands on Free Parking takes the whole pot.'],
              ['Double salary on Go', onOff(DEFAULT_SETTINGS.doubleGoSalary), 'On: landing exactly on Go pays $400 instead of $200.'],
              ['No rent from jail', onOff(DEFAULT_SETTINGS.noRentInJail), 'On: owners in Jail collect no rent.'],
            ),
          ),
          section(
            'Timing',
            list('Online, each turn has a 90-second clock, and every action restarts it. If it runs out, the game makes a cautious move for you: it rolls, declines purchases, passes in auctions, declines trades, settles debts, and ends your turn.'),
          ),
        ],
      },
    },
  ],
};
