import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleBook, type RuleSection } from '../../shared/rules';
import { Odds, Pieces, ResourceCards, SeaPieces, Terrains, WardensPieces } from './ui/ruleFigures';
import { CAPITAL_LEVEL, EDICT_DECKS, EDICT_LIMIT, EDICT_NAME, EDICT_TEXT, GOODS_BANK, GUILDS, GUILD_ABILITY, GUILD_GOOD, GUILD_NAME, MARAUDER_TRACK, MAX_WALLS, WARDENS_PER_LEVEL, WARDENS_WIN_POINTS, type Edict, type Guild } from './wardens';
import type { Layout } from './board';
import { BANK, CHARTER_DECKS, GUARD_MIN, LANDFALL_POINTS, LIMITS, ROAD_MIN, SEA_WIN_POINTS, WIN_POINTS, type Charter } from './engine';

function book(layout: Layout): RuleBook {
  const big = layout === 'large';
  const sea = layout === 'newShores';
  const win = sea ? SEA_WIN_POINTS : WIN_POINTS;
  const seaSections: RuleSection[] = sea
    ? [
        section(
          'The New Shores map',
          figure(SeaPieces),
          list(
            'The map is 58 tiles: the **home island** (19 tiles, as in the island game), the **sea**, and three small **outer islands** of 3 tiles each to the east.',
            'The outer islands hold 9 more producing tiles, two of them **goldfields**, each with its own number token.',
            'The 9 harbours are on the home island\'s coast.',
            'The **corsair** starts on the sea tile in the far south-west corner.',
          ),
        ),
        section(
          'Ships',
          steps(
            `A **ship** costs 1 timber and 1 wool. You have ${LIMITS.ship} ships.`,
            'A ship goes on a side (edge) that touches **sea**. Coast sides (land on one side, sea on the other) can hold a road or a ship, but not both.',
            'Each ship must join your own homestead or town, or continue a line of your own ships from its end. A ship line may not pass a corner where another player has built.',
            'A road and a ship join only at **your own homestead or town**: a ship cannot continue a road directly, nor a road a ship.',
            'A homestead may be built on a corner your ship line reaches, as on a corner your road reaches. That is how you settle the outer islands.',
            sub(
              '**Moving a ship.** Once per turn, after rolling, you may move **one** of your ships to any other side where you could build one:',
              'only a ship at the **open end** of a line (a line between two of your buildings is closed and cannot move);',
              'not a ship you built this turn;',
              'not a ship on a side of the corsair\'s tile.',
            ),
          ),
          note('In setup, the road of either placement may be a ship instead, if the homestead is on the coast. All setup homesteads go on the home island.'),
        ),
        section(
          'The corsair',
          list(
            'When you roll a 7 or play a Ranger, you move **either** the raider to another land tile **or** the corsair to another sea tile.',
            'Moving the corsair, you rob one player who has a **ship** on a side of its tile (instead of a building on a corner).',
            'No ship can be built on, or moved from or to, a side of the corsair\'s tile.',
          ),
        ),
        section(
          'Goldfields',
          list(
            'When a goldfield\'s number is rolled, each homestead on its corners takes **any 1 resource** of its owner\'s choice from the bank, and each town **any 2**.',
            'Players owed goldfield pay pick it one at a time, starting with the player who rolled.',
            'A goldfield pays nothing in setup, and nothing while the raider stands on it.',
          ),
        ),
        section(
          'Landfall',
          list(
            `The first homestead you build on each **outer island** is worth **${LANDFALL_POINTS} more points**, on top of its own point. Each outer island can give each player this bonus once.`,
            'Landfall points are never lost.',
          ),
        ),
      ]
    : [];
  const deck = CHARTER_DECKS[layout];
  const n = (c: Charter) => String(deck.filter((x) => x === c).length);
  const specialBuild: RuleSection[] = big
    ? [
        section(
          'The special build phase',
          p('With 5 or 6 players, turns come round slowly, so every turn ends with a chance for everyone else to build.'),
          steps(
            'When the player whose turn it is ends it, each other player in seat order (starting with the next player) gets one go at **building**.',
            'In your go you may build roads, homesteads and towns and buy charter cards, paying for them as usual, as many as you can afford.',
            'You may **not** trade (with the bank or with players) or play charter cards in the special build phase.',
            'Press **Done building** to pass the go on. When everyone has had their go, the next player\'s turn begins.',
          ),
          note(`You cannot win in the special build phase: if you reach ${WIN_POINTS} points there, you win the moment your own turn begins.`),
        ),
      ]
    : [];
  return {
        summary: sea
          ? `Open Sea: settle the home island, then build ships across the sea to three outer islands with goldfields, and be the first to ${win} points. Landfall on a new island is worth extra. 3 or 4 players.`
          : `Settle a hex island. Each roll of the dice pays resources to the homesteads around the tiles that show its number; trade, build roads, homesteads and towns, and be the first to ${win} points. ${big ? '5 or 6 players, on a larger island, with a special build phase after every turn.' : '3 or 4 players.'}`,
        sections: [
          section(
            'The goal',
            p(`Be the first player to have **${win} points** on your own turn.`),
            table(
              ['Source', 'Points'],
              ['Each homestead', '1'],
              ['Each town', '2'],
              [sea ? 'Longest Route (roads and ships)' : 'Longest Road', '2'],
              ['Biggest Guard', '2'],
              ['Each Monument card', '1 (hidden until the end)'],
              ...(sea ? [['Each Landfall (first homestead on an outer island)', String(LANDFALL_POINTS)]] : []),
            ),
          ),
          section(
            'The island',
            figure(Terrains, 'Each terrain and what it yields.'),
            figure(Odds, 'A number token\'s dots: how many of the 36 rolls of two dice make it.'),
            terms(
              ['Tiles', big ? '30 hex tiles in rows of 3, 4, 5, 6, 5, 4 and 3: 6 forest, 5 hills, 6 pasture, 6 fields, 5 mountains and 2 badlands, shuffled for every game.' : '19 hex tiles in rows of 3, 4, 5, 4 and 3: 4 forest, 3 hills, 4 pasture, 4 fields, 3 mountains and 1 badlands, shuffled for every game.'],
              ['Resources', 'Forest yields **timber**, hills **clay**, pasture **wool**, fields **grain**, mountains **stone**. The badlands yield nothing.'],
              ['Number tokens', `Every tile but the badlands has a number from 2 to 12 (no 7)${big ? ': two each of 2 and 12 and three each of the rest' : ''}. The dots under it show how likely it is: 6 and 8 (in red) are rolled most often. A 6 or 8 is never placed next to another 6 or 8.`],
              ['Harbours', big ? '11 harbours on the coast: five **3:1** harbours, one **2:1** harbour for each resource, and a second 2:1 wool harbour. Each touches two coastal corners.' : '9 harbours on the coast: four **3:1** harbours and one **2:1** harbour for each resource. Each touches two coastal corners.'],
              ['Raider', big ? 'Starts on one of the two badlands. Whatever tile it stands on pays nothing.' : 'Starts on the badlands. Whatever tile it stands on pays nothing.'],
              ['Bank', `${BANK[layout]} cards of each resource.`],
              ['Your pieces', `${LIMITS.road} roads, ${LIMITS.homestead} homesteads and ${LIMITS.town} towns.`],
            ),
          ),
          ...seaSections,
          section(
            'Setup',
            steps(
              'Players place in **snake order**: the first player, then each player in seat order, then the same order backwards. With 3 players: 1, 2, 3, 3, 2, 1.',
              'On each placement you put a **homestead** on any free corner, then a **road** on one of the edges touching it.',
              '**The distance rule:** a homestead may never stand on a corner next to another homestead or town (at least one empty corner between them).',
              'Your **second** homestead immediately collects one card for each producing tile around it.',
              'Then the first player takes the first turn.',
            ),
          ),
          section(
            'A turn',
            steps(
              'You may play a **Ranger** before you roll (see Charter cards).',
              sub(
                '**Roll the two dice.** Every tile showing the total pays out:',
                'each homestead on its corners collects **1** card of its resource, each town **2**;',
                'a tile with the raider on it pays nothing;',
                'everyone collects, not just you.',
              ),
              'If the total is **7**, see Rolling a 7.',
              'Then, in any order and as often as you can: **trade**, **build**, **buy** charter cards, and play **one** charter card.',
              big ? 'End your turn. The special build phase follows (see below), then play passes to the left.' : 'End your turn. Play passes to the left.',
            ),
            note('If the bank cannot pay everyone owed a resource, nobody receives that resource this roll, unless only one player is owed it; they then take what is left.'),
          ),
          section(
            'Rolling a 7',
            steps(
              'No tile pays.',
              'Every player holding **more than 7 cards** discards **half** of them (rounded down) to the bank, choosing which. They are asked one at a time, starting with the player who rolled.',
              sea ? 'The roller then moves **either** the raider to another land tile **or** the corsair to another sea tile (see The corsair).' : 'The roller then **moves the raider** to any other tile.',
              'The roller **robs** one player who has a homestead or town on that tile and holds at least one card: one card is taken from that player at random. If only one player qualifies, they are robbed automatically; if nobody does, nothing is taken.',
            ),
          ),
          section(
            'Building',
            figure(Pieces),
            figure(ResourceCards, 'Your resource cards.'),
            table(
              ['Build', 'Cost', 'Rules'],
              ['Road', '1 timber, 1 clay', `On an empty edge touching your own road, homestead or town. A road cannot continue through a corner where another player has built.`],
              ['Homestead', '1 timber, 1 clay, 1 wool, 1 grain', 'On an empty corner touching your own road, following the distance rule.'],
              ['Town', '2 grain, 3 stone', 'Replaces one of your homesteads (the homestead returns to your supply).'],
              ['Charter card', '1 wool, 1 grain, 1 stone', 'The top card of the charter deck, kept secret.'],
              ...(sea ? [['Ship', '1 timber, 1 wool', 'On an empty side touching sea, joined to your building or ship line (see Ships).']] : []),
            ),
            note('When you have none of a piece left in your supply, you cannot build it.'),
          ),
          section(
            'Trading',
            steps(
              'You may trade only on your own turn, after rolling.',
              sub(
                '**With the bank:** give 4 cards of one resource for 1 card of another.',
                'With a homestead or town on a **3:1** harbour, give 3 of any one resource instead.',
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
            'Charter cards',
            p(`The deck has ${deck.length} cards. You may play **one** charter card per turn, at any time during your turn (a Ranger even before you roll), but never on the turn you bought it.`),
            table(
              ['Card', 'How many', 'What it does'],
              ['Ranger', n('ranger'), 'Move the raider and rob, as after a 7 (nobody discards). Played Rangers stay in front of you.'],
              ['Monument', n('monument'), '1 point. Kept hidden and never played; it counts the moment you have 10 points.'],
              ['Roadworks', n('roadworks'), sea ? 'Build two roads or ships (any mix) for free, at once.' : 'Build two roads for free, at once.'],
              ['Bounty', n('bounty'), 'Take any two resource cards from the bank.'],
              ['Market', n('market'), 'Name a resource: every other player gives you all of it they hold.'],
            ),
          ),
          ...specialBuild,
          section(
            'Longest Road and Biggest Guard',
            steps(
              `**Longest ${sea ? 'Route' : 'Road'} (2 points)** goes to the first player with an unbroken ${sea ? 'line of roads and ships' : 'road'} of at least ${ROAD_MIN} pieces. It is counted along a single path: branches do not add up, and no piece is counted twice.${sea ? ' A line passes from road to ship (or back) only at your own homestead or town.' : ''}`,
              'Another player\'s homestead or town on one of your road\'s corners cuts the road there.',
              'Another player takes Longest Road only by building a **longer** road. If a holder\'s road is cut and they are no longer longest, the longest road takes it; if two or more players then tie for longest, nobody holds it until one is longest again.',
              `**Biggest Guard (2 points)** goes to the first player to have played ${GUARD_MIN} Rangers. Another player takes it only by playing **more** Rangers.`,
            ),
          ),
          section(
            'Winning',
            steps(
              `The moment the player whose turn it is has ${win} or more points (hidden Monuments included), they win and the game ends.`,
              `You cannot win on someone else's turn: if you reach ${win} then, you win as soon as your turn comes.`,
            ),
          ),
          section(
            'Timing',
            list(
              `Online, each turn has a 60-second clock. If it runs out during the build phase, your turn simply ends${big ? ' (and in the special build phase, your go passes)' : ''}; a trade offer is declined; anything else that must be decided (a placement, a discard, the raider) is played sensibly for you.`,
              'A player who leaves returns their cards to the bank and is skipped; their pieces stay on the island.',
            ),
          ),
        ],
  };
}

const goodName = { parchment: 'parchment', linen: 'linen', silver: 'silver' } as const;

function wardensBook(): RuleBook {
  const edictRows = (g: Guild) => {
    const counts = new Map<Edict, number>();
    for (const e of EDICT_DECKS[g]) counts.set(e, (counts.get(e) ?? 0) + 1);
    return [...counts].map(([e, n]) => [EDICT_NAME[e], String(n), EDICT_TEXT[e]]);
  };
  return {
    summary: `Wardens: towns make commodities, commodities buy guild improvements, and wardens defend the island against a marauder fleet that lands every few turns. Edicts replace charter cards. Be the first to ${WARDENS_WIN_POINTS} points. 3 or 4 players.`,
    sections: [
      section(
        'The goal',
        p(`Be the first player to have **${WARDENS_WIN_POINTS} points** on your own turn.`),
        table(
          ['Source', 'Points'],
          ['Each homestead', '1'],
          ['Each town', '2'],
          ['Each Capital (on top of its town)', '2'],
          ['Longest Road', '2'],
          ['Each Defender point', '1'],
          ['Each point edict (Printing Press, Charter of Rights)', '1'],
          ['The merchant, while it is yours', '1'],
        ),
        note('Wardens uses the standard 19-tile island, harbours, raider and Longest Road. There are no charter cards and no Biggest Guard.'),
      ),
      section(
        'What is new',
        figure(WardensPieces),
        terms(
          ['Commodities', `Parchment, linen and silver: cards like resources, made only by towns. The bank holds ${GOODS_BANK} of each.`],
          ['Guilds', 'Trade, Council and Academy. Improving a guild costs its commodity and brings abilities and Capitals.'],
          ['Wardens', 'Your defenders, on corners of your roads. Strength 1, 2 or 3; resting or mustered.'],
          ['The marauder fleet', `A ship on a track of ${MARAUDER_TRACK} spaces. When it lands it attacks every town.`],
          ['The omen die', 'A third die rolled with the two others: three ship faces and one gate for each guild.'],
          ['Edicts', 'Cards drawn from three guild decks of 18 when the omen die shows a gate.'],
          ['The merchant', 'A pawn placed by a Merchant edict. Whoever placed it last trades its tile\'s resource 2 for 1 and holds 1 point.'],
          ['The red die', 'One of the two number dice is red. Besides adding to the total, it decides who draws edicts.'],
        ),
      ),
      section(
        'Setup',
        steps(
          'Players place in snake order, as in the island game: a homestead and a road, then, going back round, a **town** and a road.',
          'The distance rule applies to both. The town collects one resource for each producing tile around it (no commodities).',
          'The marauder fleet starts at the first space of its track.',
        ),
      ),
      section(
        'A turn',
        steps(
          sub(
            '**Roll all three dice**: the red and the yellow number dice, and the omen die. (An **Alchemist** is played instead of rolling the number dice: you set them, and only the omen die is rolled.) The omen die is settled first:',
            '**A ship**: the fleet moves one space. On the last space it lands (see The marauders land).',
            "**A gate**: each player whose level in that guild is at least the red die's value less one draws an edict from that guild's deck (level 1 draws on a red 1 or 2, level 2 on 1 to 3, up to level 5 on any number), in seat order from the roller.",
          ),
          sub(
            'Then the number dice pay out as usual, except for towns:',
            '**A town on forest, pasture or mountains** takes 1 of the resource **and 1 commodity** (parchment, linen or silver).',
            'A town on hills or fields takes 2 resources as usual. A homestead takes 1 resource.',
          ),
          'On a 7, see Rolling a 7.',
          'If the omen die calls for choices (the town a player loses, a deck to draw from, an edict to put back), they are made before anything is paid out.',
          'Then, in any order: trade, build, recruit and muster wardens, improve guilds, build walls, and play any number of edicts.',
          'End your turn.',
        ),
      ),
      section(
        'Rolling a 7',
        steps(
          `Every player holding more cards (resources and commodities together) than their **hand limit** discards half, rounded down, choosing which. The limit is 7, plus 2 for each wall they have (at most ${MAX_WALLS} walls).`,
          '**Until the marauders have landed for the first time, the raider does not move** and nobody is robbed.',
          'After that, the roller moves the raider and robs one player beside it, as in the island game. A robbery can take a commodity as well as a resource.',
        ),
      ),
      section(
        'Guilds and Capitals',
        table(
          ['Guild', 'Paid in', 'Level 3 brings'],
          ...GUILDS.map((g) => [GUILD_NAME[g], goodName[GUILD_GOOD[g]], GUILD_ABILITY[g]]),
        ),
        steps(
          'Each guild has levels 1 to 5. **Level n costs n of that guild\'s commodity** (level 1 costs 1, level 5 costs 5). You may improve as often as you can pay, but only while you have at least one town.',
          `**Capital:** the first player to reach level ${CAPITAL_LEVEL} in a guild takes its Capital (2 points), placed on one of their towns that holds no Capital. Without such a town you cannot take level ${CAPITAL_LEVEL} while the Capital is free.`,
          `A player who reaches **level 5** while the holder is still at level ${CAPITAL_LEVEL} takes the Capital from them. Only one player can reach level 5 in each guild; from then on its Capital is theirs for good.`,
          'A town with a Capital can never be pillaged.',
          "The Academy's level 3 ability: on any roll other than 7 that pays you nothing at all, you take one resource of your choice from the bank.",
        ),
      ),
      section(
        'Wardens',
        table(
          ['Action', 'Cost', 'Rules'],
          ['Recruit', '1 wool, 1 stone', 'A strength-1 warden on an empty corner touching your own road. It starts resting.'],
          ['Muster', '1 grain', 'A resting warden becomes mustered. It cannot move or chase until a later turn.'],
          ['Promote', '1 wool, 1 stone', 'One strength higher, at most once a turn for each warden. Strength 3 needs your Council at level 3.'],
          ['Move', 'free', 'A mustered warden moves along your own roads to an empty corner (it may not pass another player\'s piece), then rests.'],
          ['Displace', 'free', 'A mustered warden moves, as above, onto a corner held by a **weaker** rival warden. That warden\'s owner moves it to any empty corner connected to that corner by their own roads, or it leaves the board if there is none. Yours then rests.'],
          ['Chase the raider', 'free', 'After the first landing only: a mustered warden on a corner of the raider\'s tile sends the raider to another numbered tile, and you rob as after a 7. The warden then rests.'],
        ),
        list(
          `You own ${WARDENS_PER_LEVEL} wardens of each strength.`,
          'A warden blocks other players\' roads through its corner, and nobody may build a homestead on it.',
          'Wardens do not count for the distance rule.',
        ),
      ),
      section(
        'The marauders land',
        steps(
          '**Their strength** is the number of towns on the island (every player\'s, Capitals included).',
          '**The defence** is the total strength of all **mustered** wardens, whoever owns them.',
          'If the defence is **at least** the marauders\' strength, they are beaten off. The player with the most mustered strength takes a **Defender point** (1 point). If two or more tie for the most, nobody takes the point: each of them instead draws an edict from the deck of their choice, in seat order from the roller.',
          'If the defence is **weaker**, the players with the least mustered strength (among those who have a town without a Capital) each lose one town **of their choice**: it goes back to being a homestead, and its wall, if any, is lost.',
          'The roll that brought the landing pays out only after this is settled, so a lost town already pays as a homestead.',
          'Either way, every warden then rests, and the fleet goes back to the start of its track.',
        ),
      ),
      section(
        'Walls',
        list(
          `A wall costs 2 clay and goes round one of your towns (one wall per town, at most ${MAX_WALLS} in all).`,
          'Each wall raises your hand limit for a 7 by 2.',
          'A wall is lost when its town is pillaged.',
        ),
      ),
      section(
        'Edicts',
        steps(
          `You may hold at most **${EDICT_LIMIT} edicts**. If you draw a fifth on someone else's turn, you put one of your choice back under its deck at once. On your own turn you may keep a fifth until you end the turn, when you put one back.`,
          'Play any number of edicts on your turn, after rolling. The **Alchemist** is the exception: it is played before rolling, in place of the number dice. A played edict goes back under its own deck.',
          '**Printing Press** and **Charter of Rights** are worth 1 point each and are shown the moment they are drawn; they never count toward the limit, and a Spy cannot take them.',
          'When an edict makes other players hand over cards (Saboteur, Wedding, Commercial Harbour), **they choose which**. With a **Master Merchant** you see the other player\'s cards, and with a **Spy** their edicts, and you choose.',
          '**Bishop** cannot be played until the marauders have landed for the first time.',
          '**The merchant**: a Merchant edict puts the merchant pawn on a land tile next to one of your homesteads or towns. While it stands there, you trade that tile\'s resource with the bank 2 for 1, and it is worth 1 point to you. The next Merchant played, by anyone, moves it and its point. The raider does not affect it.',
          '**Deserter**: the player you name removes one of their wardens, their choice. You may then place one of yours of the same strength on your road, free and as mustered or resting as theirs was (a strength-1 warden if you have none of that strength left).',
          '**Diplomat**: an open road is one with nothing of its owner\'s (building, warden or other road) at one end. A road of another player\'s goes back to them; one of yours you may build again elsewhere at once, free, or keep off the board.',
          '**Intrigue**: the rival warden must stand on a corner touching one of your roads. Its owner moves it as if displaced.',
          '**Inventor**: any two number tokens on the island, except a 2, 12, 6 or 8, even under the raider.',
        ),
        table(['Academy edict', 'How many', 'What it does'], ...edictRows('academy')),
        table(['Council edict', 'How many', 'What it does'], ...edictRows('council')),
        table(['Trade edict', 'How many', 'What it does'], ...edictRows('trade')),
      ),
      section(
        'Trading',
        list(
          'Resources trade with the bank and harbours as in the island game.',
          'Commodities trade with the bank 4 for 1, 3 for 1 at a 3:1 harbour, and 2 for 1 with the Trade guild at level 3. The 2:1 resource harbours do not take commodities.',
          'Offers to other players may include commodities as well as resources.',
          'The merchant\'s tile resource trades 2 for 1 for whoever placed it; a Merchant Fleet makes one card 2 for 1 for the rest of your turn.',
        ),
      ),
      section(
        'Winning',
        steps(
          `The moment the player whose turn it is has ${WARDENS_WIN_POINTS} or more points, they win.`,
          `If you reach ${WARDENS_WIN_POINTS} on someone else's turn (an edict or a landing), you win as soon as your turn comes.`,
        ),
      ),
    ],
  };
}

export const HEXSTEAD_RULES: GameRules = {
  title: 'Hexstead',
  variants: [
    { id: 'standard', label: '3-4 players', book: book('standard') },
    { id: 'large', label: '5-6 players', book: book('large') },
    { id: 'sea', label: 'Open Sea', book: book('newShores') },
    { id: 'wardens', label: 'Wardens', book: wardensBook() },
  ],
};
