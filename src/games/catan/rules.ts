import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleBook, type RuleSection } from '../../shared/rules';
import { Odds, Pieces, ResourceCards, SeaPieces, Terrains, CitiesKnightsPieces } from './ui/ruleFigures';
import { METROPOLIS_LEVEL, PROGRESS_DECKS, PROGRESS_LIMIT, PROGRESS_NAME, PROGRESS_TEXT, GOODS_BANK, AREAS, AREA_ABILITY, AREA_GOOD, AREA_NAME, BARBARIAN_TRACK, MAX_WALLS, KNIGHTS_PER_LEVEL, CITIES_KNIGHTS_WIN_POINTS, type ProgressCard, type Area } from './citiesKnights';
import type { Layout } from './board';
import { BANK, DEV_CARD_DECKS, ARMY_MIN, ISLAND_BONUS_POINTS, LIMITS, ROAD_MIN, SEAFARERS_WIN_POINTS, WIN_POINTS, type DevCard } from './engine';

function book(layout: Layout): RuleBook {
  const big = layout === 'large';
  const sea = layout === 'newShores';
  const win = sea ? SEAFARERS_WIN_POINTS : WIN_POINTS;
  const seaSections: RuleSection[] = sea
    ? [
        section(
          'The New Shores map',
          figure(SeaPieces),
          list(
            'The map is 58 tiles: the **home island** (19 tiles, as in the island game), the **sea**, and three small **outer islands** of 3 tiles each to the east.',
            'The outer islands hold 9 more producing tiles, two of them **gold fields**, each with its own number token.',
            'The 9 harbours are on the home island\'s coast.',
            'The **pirate** starts on the sea tile in the far south-west corner.',
          ),
        ),
        section(
          'Ships',
          steps(
            `A **ship** costs 1 lumber and 1 wool. You have ${LIMITS.ship} ships.`,
            'A ship goes on a side (edge) that touches **sea**. Coast sides (land on one side, sea on the other) can hold a road or a ship, but not both.',
            'Each ship must join your own settlement or city, or continue a line of your own ships from its end. A ship line may not pass a corner where another player has built.',
            'A road and a ship join only at **your own settlement or city**: a ship cannot continue a road directly, nor a road a ship.',
            'A settlement may be built on a corner your ship line reaches, as on a corner your road reaches. That is how you settle the outer islands.',
            sub(
              '**Moving a ship.** Once per turn, after rolling, you may move **one** of your ships to any other side where you could build one:',
              'only a ship at the **open end** of a line (a line between two of your buildings is closed and cannot move);',
              'not a ship you built this turn;',
              'not a ship on a side of the pirate\'s tile.',
            ),
          ),
          note('In setup, the road of either placement may be a ship instead, if the settlement is on the coast. All setup settlements go on the home island.'),
        ),
        section(
          'The pirate',
          list(
            'When you roll a 7 or play a Knight, you move **either** the robber to another land tile **or** the pirate to another sea tile.',
            'Moving the pirate, you rob one player who has a **ship** on a side of its tile (instead of a building on a corner).',
            'No ship can be built on, or moved from or to, a side of the pirate\'s tile.',
          ),
        ),
        section(
          'Gold fields',
          list(
            'When a gold field\'s number is rolled, each settlement on its corners takes **any 1 resource** of its owner\'s choice from the bank, and each city **any 2**.',
            'Players owed gold field pay pick it one at a time, starting with the player who rolled.',
            'A gold field pays nothing in setup, and nothing while the robber stands on it.',
          ),
        ),
        section(
          'New islands',
          list(
            `The first settlement you build on each **outer island** is worth **${ISLAND_BONUS_POINTS} more points**, on top of its own point. Each outer island can give each player this bonus once.`,
            'Island bonus points are never lost.',
          ),
        ),
      ]
    : [];
  const deck = DEV_CARD_DECKS[layout];
  const n = (c: DevCard) => String(deck.filter((x) => x === c).length);
  const specialBuild: RuleSection[] = big
    ? [
        section(
          'The special build phase',
          p('With 5 or 6 players, turns come round slowly, so every turn ends with a chance for everyone else to build.'),
          steps(
            'When the player whose turn it is ends it, each other player in seat order (starting with the next player) gets one go at **building**.',
            'In your go you may build roads, settlements and cities and buy development cards, paying for them as usual, as many as you can afford.',
            'You may **not** trade (with the bank or with players) or play development cards in the special build phase.',
            'Press **Done building** to pass the go on. When everyone has had their go, the next player\'s turn begins.',
          ),
          note(`You cannot win in the special build phase: if you reach ${WIN_POINTS} points there, you win the moment your own turn begins.`),
        ),
      ]
    : [];
  return {
        summary: sea
          ? `Seafarers: settle the home island, then build ships across the sea to three outer islands with gold fields, and be the first to ${win} points. Island bonus on a new island is worth extra. 3 or 4 players.`
          : `Settle a hex island. Each roll of the dice pays resources to the settlements around the tiles that show its number; trade, build roads, settlements and cities, and be the first to ${win} points. ${big ? '5 or 6 players, on a larger island, with a special build phase after every turn.' : '3 or 4 players.'}`,
        sections: [
          section(
            'The goal',
            p(`Be the first player to have **${win} points** on your own turn.`),
            table(
              ['Source', 'Points'],
              ['Each settlement', '1'],
              ['Each city', '2'],
              [sea ? 'Longest Trade Route (roads and ships)' : 'Longest Road', '2'],
              ['Largest Army', '2'],
              ['Each Victory Point card', '1 (hidden until the end)'],
              ...(sea ? [['Each Island bonus (first settlement on an outer island)', String(ISLAND_BONUS_POINTS)]] : []),
            ),
          ),
          section(
            'The island',
            figure(Terrains, 'Each terrain and what it yields.'),
            figure(Odds, 'A number token\'s dots: how many of the 36 rolls of two dice make it.'),
            terms(
              ['Tiles', big ? '30 hex tiles in rows of 3, 4, 5, 6, 5, 4 and 3: 6 forest, 5 hills, 6 pasture, 6 fields, 5 mountains and 2 desert, shuffled for every game.' : '19 hex tiles in rows of 3, 4, 5, 4 and 3: 4 forest, 3 hills, 4 pasture, 4 fields, 3 mountains and 1 desert, shuffled for every game.'],
              ['Resources', 'Forest yields **lumber**, hills **brick**, pasture **wool**, fields **grain**, mountains **ore**. The desert yield nothing.'],
              ['Number tokens', `Every tile but the desert has a number from 2 to 12 (no 7)${big ? ': two each of 2 and 12 and three each of the rest' : ''}. The dots under it show how likely it is: 6 and 8 (in red) are rolled most often. A 6 or 8 is never placed next to another 6 or 8.`],
              ['Harbours', big ? '11 harbours on the coast: five **3:1** harbours, one **2:1** harbour for each resource, and a second 2:1 wool harbour. Each touches two coastal corners.' : '9 harbours on the coast: four **3:1** harbours and one **2:1** harbour for each resource. Each touches two coastal corners.'],
              ['Robber', big ? 'Starts on one of the two desert. Whatever tile it stands on pays nothing.' : 'Starts on the desert. Whatever tile it stands on pays nothing.'],
              ['Bank', `${BANK[layout]} cards of each resource.`],
              ['Your pieces', `${LIMITS.road} roads, ${LIMITS.settlement} settlements and ${LIMITS.city} cities.`],
            ),
          ),
          ...seaSections,
          section(
            'Setup',
            steps(
              'Players place in **snake order**: the first player, then each player in seat order, then the same order backwards. With 3 players: 1, 2, 3, 3, 2, 1.',
              'On each placement you put a **settlement** on any free corner, then a **road** on one of the edges touching it.',
              '**The distance rule:** a settlement may never stand on a corner next to another settlement or city (at least one empty corner between them).',
              'Your **second** settlement immediately collects one card for each producing tile around it.',
              'Then the first player takes the first turn.',
            ),
          ),
          section(
            'A turn',
            steps(
              'You may play a **Knight** before you roll (see Development cards).',
              sub(
                '**Roll the two dice.** Every tile showing the total pays out:',
                'each settlement on its corners collects **1** card of its resource, each city **2**;',
                'a tile with the robber on it pays nothing;',
                'everyone collects, not just you.',
              ),
              'If the total is **7**, see Rolling a 7.',
              'Then, in any order and as often as you can: **trade**, **build**, **buy** development cards, and play **one** development card.',
              big ? 'End your turn. The special build phase follows (see below), then play passes to the left.' : 'End your turn. Play passes to the left.',
            ),
            note('If the bank cannot pay everyone owed a resource, nobody receives that resource this roll, unless only one player is owed it; they then take what is left.'),
          ),
          section(
            'Rolling a 7',
            steps(
              'No tile pays.',
              'Every player holding **more than 7 cards** discards **half** of them (rounded down) to the bank, choosing which. They are asked one at a time, starting with the player who rolled.',
              sea ? 'The roller then moves **either** the robber to another land tile **or** the pirate to another sea tile (see The pirate).' : 'The roller then **moves the robber** to any other tile.',
              'The roller **robs** one player who has a settlement or city on that tile and holds at least one card: one card is taken from that player at random. If only one player qualifies, they are robbed automatically; if nobody does, nothing is taken.',
            ),
          ),
          section(
            'Building',
            figure(Pieces),
            figure(ResourceCards, 'Your resource cards.'),
            table(
              ['Build', 'Cost', 'Rules'],
              ['Road', '1 lumber, 1 brick', `On an empty edge touching your own road, settlement or city. A road cannot continue through a corner where another player has built.`],
              ['Settlement', '1 lumber, 1 brick, 1 wool, 1 grain', 'On an empty corner touching your own road, following the distance rule.'],
              ['City', '2 grain, 3 ore', 'Replaces one of your settlements (the settlement returns to your supply).'],
              ['Development card', '1 wool, 1 grain, 1 ore', 'The top card of the development card deck, kept secret.'],
              ...(sea ? [['Ship', '1 lumber, 1 wool', 'On an empty side touching sea, joined to your building or ship line (see Ships).']] : []),
            ),
            note('When you have none of a piece left in your supply, you cannot build it.'),
          ),
          section(
            'Trading',
            steps(
              'You may trade only on your own turn, after rolling.',
              sub(
                '**With the bank:** give 4 cards of one resource for 1 card of another.',
                'With a settlement or city on a **3:1** harbour, give 3 of any one resource instead.',
                'With one on a **2:1** harbour, give 2 of that harbour\'s resource.',
              ),
              sub(
                '**With the players:** offer some of your cards for some of theirs. You must offer and ask for at least one card, and may not ask for a resource you are giving.',
                'The offer goes round the table, one player at a time; players who could not pay it are skipped.',
                'Each player accepts or declines. When all have answered, you choose one who accepted and the cards are swapped, or you call it off.',
                'You may withdraw an offer at any time.',
              ),
              'Players may never give cards away for nothing.',
            ),
          ),
          section(
            'Development cards',
            p(`The deck has ${deck.length} cards. You may play **one** development card per turn, at any time during your turn (a Knight even before you roll), but never on the turn you bought it.`),
            table(
              ['Card', 'How many', 'What it does'],
              ['Knight', n('knight'), 'Move the robber and rob, as after a 7 (nobody discards). Played Knights stay in front of you.'],
              ['Victory Point', n('victoryPoint'), '1 point. Kept hidden and never played; it counts the moment you have 10 points.'],
              ['Road Building', n('roadBuilding'), sea ? 'Build two roads or ships (any mix) for free, at once.' : 'Build two roads for free, at once.'],
              ['Year of Plenty', n('yearOfPlenty'), 'Take any two resource cards from the bank.'],
              ['Monopoly', n('monopoly'), 'Name a resource: every other player gives you all of it they hold.'],
            ),
          ),
          ...specialBuild,
          section(
            'Longest Road and Largest Army',
            steps(
              `**Longest ${sea ? 'Route' : 'Road'} (2 points)** goes to the first player with an unbroken ${sea ? 'line of roads and ships' : 'road'} of at least ${ROAD_MIN} pieces. It is counted along a single path: branches do not add up, and no piece is counted twice.${sea ? ' A line passes from road to ship (or back) only at your own settlement or city.' : ''}`,
              'Another player\'s settlement or city on one of your road\'s corners cuts the road there.',
              'Another player takes Longest Road only by building a **longer** road. If a holder\'s road is cut and they are no longer longest, the longest road takes it; if two or more players then tie for longest, nobody holds it until one is longest again.',
              `**Largest Army (2 points)** goes to the first player to have played ${ARMY_MIN} Knights. Another player takes it only by playing **more** Knights.`,
            ),
          ),
          section(
            'Winning',
            steps(
              `The moment the player whose turn it is has ${win} or more points (hidden Victory Point cards included), they win and the game ends.`,
              `You cannot win on someone else's turn: if you reach ${win} then, you win as soon as your turn comes.`,
            ),
          ),
          section(
            'Timing',
            list(
              `Online, each turn has a 60-second clock. If it runs out during the build phase, your turn simply ends${big ? ' (and in the special build phase, your go passes)' : ''}; a trade offer is declined; anything else that must be decided (a placement, a discard, the robber) is played sensibly for you.`,
              'A player who leaves returns their cards to the bank and is skipped; their pieces stay on the island.',
            ),
          ),
        ],
  };
}

const goodName = { paper: 'paper', cloth: 'cloth', coin: 'coin' } as const;

function citiesKnightsBook(): RuleBook {
  const progressCardRows = (g: Area) => {
    const counts = new Map<ProgressCard, number>();
    for (const e of PROGRESS_DECKS[g]) counts.set(e, (counts.get(e) ?? 0) + 1);
    return [...counts].map(([e, n]) => [PROGRESS_NAME[e], String(n), PROGRESS_TEXT[e]]);
  };
  return {
    summary: `Cities & Knights: cities make commodities, commodities buy city improvements, and knights defend the island against a barbarian ship that attacks every few turns. Progress cards replace development cards. Be the first to ${CITIES_KNIGHTS_WIN_POINTS} points. 3 or 4 players.`,
    sections: [
      section(
        'The goal',
        p(`Be the first player to have **${CITIES_KNIGHTS_WIN_POINTS} points** on your own turn.`),
        table(
          ['Source', 'Points'],
          ['Each settlement', '1'],
          ['Each city', '2'],
          ['Each Metropolis (on top of its city)', '2'],
          ['Longest Road', '2'],
          ['Each Defender of Catan point', '1'],
          ['Each point progress card (Printer, Constitution)', '1'],
          ['The merchant, while it is yours', '1'],
        ),
        note('Cities & Knights uses the standard 19-tile island, harbours, robber and Longest Road. There are no development cards and no Largest Army.'),
      ),
      section(
        'What is new',
        figure(CitiesKnightsPieces),
        terms(
          ['Commodities', `Paper, cloth and coin: cards like resources, made only by cities. The bank holds ${GOODS_BANK} of each.`],
          ['City improvements', 'Trade, Politics and Science. Improving an area costs its commodity and brings abilities and Metropolises.'],
          ['Knights', 'Your defenders, on corners of your roads. Strength 1, 2 or 3; inactive or active.'],
          ['The barbarian ship', `A ship on a track of ${BARBARIAN_TRACK} spaces. When it reaches the last space, the barbarians attack every city.`],
          ['The event die', 'A third die rolled with the two others: three ship faces and one gate for each area.'],
          ['Progress cards', 'Cards drawn from three area decks of 18 when the event die shows a gate.'],
          ['The merchant', 'A pawn placed by a Merchant progress card. Whoever placed it last trades its tile\'s resource 2 for 1 and holds 1 point.'],
          ['The red die', 'One of the two number dice is red. Besides adding to the total, it decides who draws progress cards.'],
        ),
      ),
      section(
        'Setup',
        steps(
          'Players place in snake order, as in the island game: a settlement and a road, then, going back round, a **city** and a road.',
          'The distance rule applies to both. The city collects one resource for each producing tile around it (no commodities).',
          'The barbarian ship starts at the first space of its track.',
        ),
      ),
      section(
        'A turn',
        steps(
          sub(
            '**Roll all three dice**: the red and the yellow number dice, and the event die. (An **Alchemist** is played instead of rolling the number dice: you set them, and only the event die is rolled.) The event die is settled first:',
            '**A ship**: the barbarian ship moves one space. On the last space the barbarians attack (see The barbarians attack).',
            "**A gate**: each player whose level in that area is at least the red die's value less one draws a progress card from that area's deck (level 1 draws on a red 1 or 2, level 2 on 1 to 3, up to level 5 on any number), in seat order from the roller.",
          ),
          sub(
            'Then the number dice pay out as usual, except for cities:',
            '**A city on forest, pasture or mountains** takes 1 of the resource **and 1 commodity** (paper, cloth or coin).',
            'A city on hills or fields takes 2 resources as usual. A settlement takes 1 resource.',
          ),
          'On a 7, see Rolling a 7.',
          'If the event die calls for choices (the city a player loses, a deck to draw from, a progress card to put back), they are made before anything is paid out.',
          'Then, in any order: trade, build, hire and activate knights, buy city improvements, build walls, and play any number of progress cards.',
          'End your turn.',
        ),
      ),
      section(
        'Rolling a 7',
        steps(
          `Every player holding more cards (resources and commodities together) than their **hand limit** discards half, rounded down, choosing which. The limit is 7, plus 2 for each wall they have (at most ${MAX_WALLS} walls).`,
          '**Until the barbarians have attacked for the first time, the robber does not move** and nobody is robbed.',
          'After that, the roller moves the robber and robs one player beside it, as in the island game. A robbery can take a commodity as well as a resource.',
        ),
      ),
      section(
        'City improvements and Metropolises',
        table(
          ['Area', 'Paid in', 'Level 3 brings'],
          ...AREAS.map((g) => [AREA_NAME[g], goodName[AREA_GOOD[g]], AREA_ABILITY[g]]),
        ),
        steps(
          'Each area has levels 1 to 5. **Level n costs n of that area\'s commodity** (level 1 costs 1, level 5 costs 5). You may improve as often as you can pay, but only while you have at least one city.',
          `**Metropolis:** the first player to reach level ${METROPOLIS_LEVEL} in an area takes its Metropolis (2 points), placed on one of their cities that holds no Metropolis. Without such a city you cannot take level ${METROPOLIS_LEVEL} while the Metropolis is free.`,
          `A player who reaches **level 5** while the holder is still at level ${METROPOLIS_LEVEL} takes the Metropolis from them. Only one player can reach level 5 in each area; from then on its Metropolis is theirs for good.`,
          'A city with a Metropolis can never be pillaged.',
          "Science's level 3 ability: on any roll other than 7 that pays you nothing at all, you take one resource of your choice from the bank.",
        ),
      ),
      section(
        'Knights',
        table(
          ['Action', 'Cost', 'Rules'],
          ['Hire', '1 wool, 1 ore', 'A strength-1 knight on an empty corner touching your own road. It starts inactive.'],
          ['Activate', '1 grain', 'An inactive knight becomes active. It cannot move or chase until a later turn.'],
          ['Promote', '1 wool, 1 ore', 'One strength higher, at most once a turn for each knight. Strength 3 needs your Politics at level 3.'],
          ['Move', 'free', 'An active knight moves along your own roads to an empty corner (it may not pass another player\'s piece), then becomes inactive.'],
          ['Displace', 'free', 'An active knight moves, as above, onto a corner held by a **weaker** rival knight. That knight\'s owner moves it to any empty corner connected to that corner by their own roads, or it leaves the board if there is none. Yours is then inactive.'],
          ['Chase the robber', 'free', 'After the first attack only: an active knight on a corner of the robber\'s tile sends the robber to another numbered tile, and you rob as after a 7. The knight is then inactive.'],
        ),
        list(
          `You own ${KNIGHTS_PER_LEVEL} knights of each strength.`,
          'A knight blocks other players\' roads through its corner, and nobody may build a settlement on it.',
          'Knights do not count for the distance rule.',
        ),
      ),
      section(
        'The barbarians attack',
        steps(
          '**Their strength** is the number of cities on the island (every player\'s, Metropolises included).',
          '**The defence** is the total strength of all **active** knights, whoever owns them.',
          'If the defence is **at least** the barbarians\' strength, they are beaten off. The player with the most active strength takes a **Defender of Catan point** (1 point). If two or more tie for the most, nobody takes the point: each of them instead draws a progress card from the deck of their choice, in seat order from the roller.',
          'If the defence is **weaker**, the players with the least active strength (among those who have a city without a Metropolis) each lose one city **of their choice**: it goes back to being a settlement, and its wall, if any, is lost.',
          'The roll that brought the attack pays out only after this is settled, so a lost city already pays as a settlement.',
          'Either way, every knight is then inactive, and the barbarian ship goes back to the start of its track.',
        ),
      ),
      section(
        'City walls',
        list(
          `A wall costs 2 brick and goes round one of your cities (one wall per city, at most ${MAX_WALLS} in all).`,
          'Each wall raises your hand limit for a 7 by 2.',
          'A wall is lost when its city is pillaged.',
        ),
      ),
      section(
        'ProgressCards',
        steps(
          `You may hold at most **${PROGRESS_LIMIT} progress cards**. If you draw a fifth on someone else's turn, you put one of your choice back under its deck at once. On your own turn you may keep a fifth until you end the turn, when you put one back.`,
          'Play any number of progress cards on your turn, after rolling. The **Alchemist** is the exception: it is played before rolling, in place of the number dice. A played progress card goes back under its own deck.',
          '**Printer** and **Constitution** are worth 1 point each and are shown the moment they are drawn; they never count toward the limit, and a Spy cannot take them.',
          'When a progress card makes other players hand over cards (Saboteur, Wedding, Commercial Harbor), **they choose which**. With a **Master Merchant** you see the other player\'s cards, and with a **Spy** their progress cards, and you choose.',
          '**Bishop** cannot be played until the barbarians have attacked for the first time.',
          '**The merchant**: a Merchant progress card puts the merchant pawn on a land tile next to one of your settlements or cities. While it stands there, you trade that tile\'s resource with the bank 2 for 1, and it is worth 1 point to you. The next Merchant played, by anyone, moves it and its point. The robber does not affect it.',
          '**Deserter**: the player you name removes one of their knights, their choice. You may then place one of yours of the same strength on your road, free and as activated or inactive as theirs was (a strength-1 knight if you have none of that strength left).',
          '**Diplomat**: an open road is one with nothing of its owner\'s (building, knight or other road) at one end. A road of another player\'s goes back to them; one of yours you may build again elsewhere at once, free, or keep off the board.',
          '**Intrigue**: the rival knight must stand on a corner touching one of your roads. Its owner moves it as if displaced.',
          '**Inventor**: any two number tokens on the island, except a 2, 12, 6 or 8, even under the robber.',
        ),
        table(['Science progress card', 'How many', 'What it does'], ...progressCardRows('science')),
        table(['Politics progress card', 'How many', 'What it does'], ...progressCardRows('politics')),
        table(['Trade progress card', 'How many', 'What it does'], ...progressCardRows('trade')),
      ),
      section(
        'Trading',
        list(
          'Resources trade with the bank and harbours as in the island game.',
          'Commodities trade with the bank 4 for 1, 3 for 1 at a 3:1 harbour, and 2 for 1 with the Trade area at level 3. The 2:1 resource harbours do not take commodities.',
          'Offers to other players may include commodities as well as resources.',
          'The merchant\'s tile resource trades 2 for 1 for whoever placed it; a Merchant Fleet makes one card 2 for 1 for the rest of your turn.',
        ),
      ),
      section(
        'Winning',
        steps(
          `The moment the player whose turn it is has ${CITIES_KNIGHTS_WIN_POINTS} or more points, they win.`,
          `If you reach ${CITIES_KNIGHTS_WIN_POINTS} on someone else's turn (a progress card or an attack), you win as soon as your turn comes.`,
        ),
      ),
    ],
  };
}

export const CATAN_RULES: GameRules = {
  title: 'Catan',
  variants: [
    { id: 'standard', label: '3-4 players', book: book('standard') },
    { id: 'large', label: '5-6 players', book: book('large') },
    { id: 'seafarers', label: 'Seafarers', book: book('newShores') },
    { id: 'cities-knights', label: 'Cities & Knights', book: citiesKnightsBook() },
  ],
};
