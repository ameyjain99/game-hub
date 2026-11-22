import { figure, list, note, p, section, steps, sub, table, terms, type GameRules } from '../../shared/rules';
import { Deed, Doubles } from './ui/ruleFigures';
import { BOARD, BOARDS, OWNABLE_IDS, isMega, spaceName, type Space } from './engine/board';
import { MEGA, MEGA_UK, MEGA_US } from './engine/mega';
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
/** The 40-square boards (the two Mega boards have their own book). */
const STANDARD_BOARDS = BOARDS.filter((b) => !isMega(b.id));
const boardRows = OWNABLE_IDS.map((id) => STANDARD_BOARDS.map((b) => spaceName(id, b.id)));

const megaRows = (board: Space[]) =>
  board
    .filter((s) => s.kind === 'property')
    .map((s) => [s.name, COLOUR[s.group!], $(s.price!), [...s.rent!, s.skyscraper!].map((r) => $(r)).join(' / '), $(s.houseCost!)]);
const megaHead = ['Property', 'Colour', 'Price', 'Rent: base / 1 / 2 / 3 / 4 houses / hotel / skyscraper', 'Building cost'];

const MEGA_BOOK = {
  summary:
    'Monopoly on a bigger board: 52 squares, 37 properties, a third die, Bus Tickets, skyscrapers and train depots. Everything not mentioned here is played by the Standard rules. 2 to 6 players.',
  sections: [
    section(
      'What is different',
      list(
        'The board has **52 squares**, 13 to a side: 30 streets, 4 railroads, **3 utilities** (Gas Company is the new one), and three new squares: **Auction**, **Bus Ticket** and **Birthday Gift**.',
        'Each colour set has one street more than on the standard board: three streets in the first and last sets, four in the rest.',
        `Every player starts with **${$(MEGA.startingCash)}**.`,
        'A third die, the **speed die**, is rolled with the two white dice on every roll, from the first turn.',
        `The bank also holds **${MEGA.skyscrapers} skyscrapers**, **${MEGA.depots} train depots** and **${MEGA.busTickets} Bus Tickets**.`,
        'Mega US plays in dollars and Mega UK in pounds; the numbers are the same.',
      ),
    ),
    section(
      'The speed die',
      p('Its six faces are **1**, **2**, **3**, **the Bus** and **Mr. Monopoly** twice.'),
      steps(
        '**1, 2 or 3**: add it to the white dice and move the total.',
        sub(
          '**Mr. Monopoly**: move by the white dice and deal with that square as usual. Then take a **bonus move**:',
          'on to the **next unowned property**, which you may buy (or it is auctioned);',
          'if every property is owned, on to the next property where you would **owe rent**, and pay it;',
          'if there is none of those either, you stay where you are.',
        ),
        sub(
          '**The Bus**: move by the white dice and deal with that square as usual. Then choose one:',
          '**take a Bus Ticket** to keep for a later turn (while any are left), or',
          '**ride to the next Chance or Community Chest** square and draw.',
        ),
        '**Doubles** are judged on the white dice only. You still roll again after doubles, and three doubles in one turn still send you to Jail.',
        '**Triples** (both white dice and the speed die show the same number, 1 to 3): move to **any square** on the board and deal with it. You do not roll again, and it does not count as doubles.',
        'The bonus move is lost if the first move sends you to Jail.',
        'In **Jail** you roll only the white dice. The speed die comes back on the turn after you leave.',
        'When a card sends you to a utility, you roll the two white dice for the rent.',
      ),
    ),
    section(
      'Bus Tickets',
      steps(
        'You get one from the Bus on the speed die, the Bus Ticket square, the Birthday Gift square, or in a trade.',
        'On a later turn, **instead of rolling**, hand in a ticket and move to **any square further along the side of the board you are on**, up to and including the corner. Deal with that square as usual. On a corner, you are at the start of the next side.',
        'A ticket takes the place of the whole roll: no dice, no doubles, no speed die bonus. It cannot be used from Jail.',
        `A used ticket is out of the game. There are ${MEGA.busTickets}; when they are gone there are no more.`,
        `**${MEGA.expiringTickets} of the tickets say "all other Bus Tickets expire".** Draw one and every ticket anyone is holding, yours too, is thrown away; you keep only the one you drew.`,
        'Players can see how many tickets each player holds. Tickets can be traded.',
      ),
    ),
    section(
      'The new squares',
      terms(
        ['Auction', 'Choose **any unowned property** on the board. The bank auctions it at once; everyone may bid, you included. If every property is already owned, you move instead to the property where you owe the **highest rent**, and pay it.'],
        ['Bus Ticket', 'Take a Bus Ticket (while any are left).'],
        ['Birthday Gift', `Choose: collect **${$(MEGA.birthdayGift)}** from the bank, or take a Bus Ticket.`],
      ),
    ),
    section(
      'Rent and building',
      steps(
        sub(
          'A street with no buildings charges:',
          'its **base rent**;',
          '**double** when its owner holds **all but one** street of the set (two of three, or three of four);',
          '**triple** when its owner holds the **whole set**.',
        ),
        'You may build houses and hotels as soon as you own **all but one** street of a set, on the streets you own. Building is even across the streets you own, none of them may be mortgaged, and a hotel still follows four houses.',
        '**Skyscrapers.** With the **whole set** and a **hotel on every street** of it, you may replace a hotel with a skyscraper for one more building cost. The hotel goes back to the bank. A skyscraper is the top: nothing is built above it.',
        'Buildings are sold back for half their cost, evenly. A skyscraper sells back to a hotel, a hotel to four houses.',
        'If you complete a set that already has buildings on it, a mortgage on the street that completed it must be paid off at once, and the buildings are spread evenly over the whole set.',
        'Cards that charge per house and per hotel count a skyscraper as a hotel.',
      ),
    ),
    section(
      'Railroads and utilities',
      list(
        'Railroads charge $25, $50, $100 or $200 for one to four owned, as usual.',
        `**Train depots.** On your turn you may build a depot on any railroad you own that is not mortgaged, for **${$(MEGA.depotCost)}**. It **doubles the rent** of that railroad. It sells back for ${$(MEGA.depotCost / 2)}. A railroad with a depot cannot be mortgaged or traded until the depot is sold.`,
        'Utilities charge **4 times** the dice with one owned, **10 times** with two and **20 times** with all three. The dice are the two white dice plus the speed die when it shows a number.',
      ),
    ),
    section(
      'Cards',
      p('The Chance and Community Chest decks are the standard ones. A card that names a place sends you to that place on the Mega board: Go, the first railroad, and the same three streets. "Nearest railroad" and "nearest utility" go forward to the next one, Gas Company included.'),
    ),
    section('Mega US', table(megaHead, ...megaRows(MEGA_US))),
    section('Mega UK', p('The UK board has its own prices in places, so a few streets sit in a different rent row than their US neighbours.'), table(megaHead, ...megaRows(MEGA_UK))),
    section(
      'House rules',
      p('All the Standard house rules and amounts apply to Mega too (see the Standard book). With "Double rent on a full set" off, bare streets charge only the base rent, with all but one or with the whole set.'),
    ),
  ],
};


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
              'The host also picks the **board** (see Boards), the **game length** (see End of the game) and the house rules (see House rules). In an online room the host can change them in the lobby until the game starts.',
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
            p(`A game is played on one of ${BOARDS.length} boards, chosen when it is set up. Two of them, Mega US and Mega UK, are a bigger game with rules of their own: see the Mega Edition book. The other ${STANDARD_BOARDS.length} have the same 40 squares, prices, rents and cards; only the places differ. This book uses the Neo names; a card that sends you to a place names the one on your board.`),
            list(
              ...STANDARD_BOARDS.map((b) => `**${b.name}**: ${b.blurb}.`),
              'The first six are published editions and follow their printed boards; the last four (Classic, Neo, World, Nations) are GameHub\'s own.',
              '**Money.** The US board plays in dollars, the UK and Europe 1991 boards in pounds and India in rupees. The boards that mix countries (World 2008, World 2015, Classic, Neo, World, Nations) play in Monopoly money, written \u20A5. The numbers are the same on all of them, and this book writes them with $. World 2008 plays in millions: every amount is 10,000 times the standard one ($200 for passing Go is \u20A52M), shown as K and M.',
              'On the Europe 1991, Classic and Nations boards each colour set is one country, shown by its flag, and the four transport squares are airports. The US board calls them railroads, the World boards Monopoly Rail, Air, Cruise and Space.',
              'World 2015 uses its 22 cities on the standard squares and plays by the standard rules (the printed game\'s passport stamps are not played); its transport, utility and tax squares are named as on World 2008. Europe 1991 and India use the standard prices, as their own were not published.',
            ),
            table(STANDARD_BOARDS.map((b) => b.name), ...boardRows),
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
              '**Game length.** The host may set the game to 15, 25 or 40 rounds instead of playing until one player is left. A round is one turn for every player still in. When the last round ends, the game stops and the highest net worth wins.',
            ),
          ),
          section(
            'House rules',
            p('The host chooses these before the game. Defaults are shown; the defaults are the official rules. The lobby lists every rule that is switched on.'),
            table(
              ['Rule', 'Default', 'What it does'],
              ['Auctions', onOff(DEFAULT_SETTINGS.auctions), 'Off: a declined property simply stays with the bank.'],
              ['Double rent on a full set', onOff(DEFAULT_SETTINGS.doubleRentFullSet), 'Off: a full set without houses charges only the base rent.'],
              ['Mortgaging', onOff(DEFAULT_SETTINGS.mortgaging), 'Off: properties can never be mortgaged.'],
              ['Even building', onOff(DEFAULT_SETTINGS.evenBuild), 'Off: build and sell houses on any property of a full set in any order.'],
              ['Free Parking jackpot', onOff(DEFAULT_SETTINGS.freeParkingJackpot), 'On: Income Tax and Luxury Tax are paid into a pot instead of the bank; whoever lands on Free Parking takes the whole pot.'],
              ['Double salary on Go', onOff(DEFAULT_SETTINGS.doubleGoSalary), 'On: landing exactly on Go pays $400 instead of $200.'],
              ['No rent from jail', onOff(DEFAULT_SETTINGS.noRentInJail), 'On: owners in Jail collect no rent.'],
              ['Buy only after a first lap', onOff(DEFAULT_SETTINGS.firstLapBuy), 'On: until you have passed (or landed on) Go once, landing on an unowned property does nothing: you cannot buy it and it is not auctioned.'],
              ['Income Tax: 10% if lower', onOff(DEFAULT_SETTINGS.incomeTaxTenPercent), `On: on Income Tax you pay 10% of your net worth (cash, property and buildings) when that is less than ${$(200)}. The game works out the lower amount for you.`],
            ),
            p('These amounts can be changed too. The standard value is shown first.'),
            table(
              ['Setting', 'Choices', 'What it changes'],
              ['Salary for passing Go', `${$(DEFAULT_SETTINGS.goSalary)}; or ${$(100)}, ${$(300)}, ${$(400)}`, 'Paid each time you pass or land on Go, and by the two Advance to Go cards.'],
              ['Fine to leave Jail', `${$(DEFAULT_SETTINGS.jailFine)}; or ${$(100)}, ${$(200)}`, 'What you pay to leave, by choice or after your last failed roll.'],
              ['Rolls for doubles in Jail', `${DEFAULT_SETTINGS.jailTurns} turns; or 1, 2`, 'How many turns you may try for doubles before you must pay the fine.'],
              ['Free Parking prize', `None; or ${$(100)}, ${$(250)}, ${$(500)}`, 'A fixed prize from the bank for landing on Free Parking. It can be combined with the jackpot.'],
              ['Properties dealt at the start', 'None; or 2, 3 each', 'The short game: before the first roll each player is dealt that many title deeds at random and pays the bank their printed prices.'],
              ['Turn clock (online)', `${DEFAULT_SETTINGS.turnSeconds} seconds; or 60, 120, 180`, 'How long a player may sit idle before the game moves for them.'],
            ),
            list(
              'With the Free Parking jackpot on, only the two tax squares feed the pot. Card fines, Jail fines and building costs still go to the bank. The pot starts empty and is emptied each time it is won.',
              'With Auctions off, a property you decline can still be bought by the next player to land on it.',
              'With Mortgaging off, the only way to raise cash is to sell buildings or trade.',
            ),
          ),
          section(
            'Timing',
            list('Online, each turn has a clock (90 seconds unless the host changed it), and every action restarts it. If it runs out, the game makes a cautious move for you: it rolls, declines purchases, passes in auctions, declines trades, settles debts, and ends your turn.'),
          ),
        ],
      },
    },
    { id: 'mega', label: 'Mega Edition', book: MEGA_BOOK },
  ],
};
