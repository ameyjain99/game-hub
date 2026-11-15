import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleSection } from '../../shared/rules';
import { TrainCards, Tickets } from './ui/ruleFigures';
import { getMap } from './engine/maps';

const routeTable = (withEight: boolean) =>
  table(['Route length', '1', '2', '3', '4', '5', '6', ...(withEight ? ['8'] : [])], ['Points', '1', '2', '4', '7', '10', '15', ...(withEight ? ['21'] : [])]);

interface ModeText {
  europe: boolean;
  /** How many tickets, and which. */
  ticketText: string;
  deal: number;
  keep: number;
  draw: number;
  longest: boolean;
  globetrotter: boolean;
  extraSetup?: string;
}

function book(m: ModeText): RuleSection[] {
  const turnChoices: [string, string][] = [
    ['Draw train cards', 'Take up to two train cards (see Drawing train cards).'],
    ['Claim a route', 'Play cards to claim one route on the map (see Claiming a route).'],
    ['Draw destination tickets', `Draw ${m.draw} tickets and keep at least one (see Destination tickets).`],
  ];
  if (m.europe) turnChoices.push(['Build a train station', 'Place one of your stations in a city (see Train stations).']);
  return [
    section(
      'The goal',
      p('Score the most points. Points come from claiming routes, from connecting the cities on your destination tickets, and from the end-of-game bonus. Tickets you fail to connect **cost** you their value.'),
    ),
    section(
      'What is in play',
      figure(TrainCards, 'Train cards: eight colours, and the locomotive, which is wild.'),
      terms(
        ['Map', m.europe ? 'Europe: 47 cities joined by routes of 1 to 8 spaces, including tunnels and ferries.' : 'The United States and southern Canada: 36 cities joined by routes of 1 to 6 spaces.'],
        ['Trains', 'Each player has **45 trains** in their colour.'],
        ['Train cards', '110 cards: 12 in each of 8 colours (red, orange, yellow, green, blue, purple, white, black) and 14 locomotives. **Locomotives are wild**: each counts as any colour.'],
        ['Destination tickets', m.ticketText],
        ...(m.europe ? ([['Train stations', 'Each player has **3 stations**.']] as [string, string][]) : []),
      ),
    ),
    section(
      'Setup',
      steps(
        'The train cards are shuffled. Each player is dealt **4 train cards**.',
        'Five cards are turned face up next to the deck: the **market**. Whenever the market shows **three or more locomotives** at once, all five are discarded and five new cards are turned up (repeated if needed).',
        sub(
          `Each player is dealt **${m.deal} destination tickets** and must keep **at least ${m.keep}**. Everyone chooses at the same time.`,
          ...(m.extraSetup ? [m.extraSetup] : []),
          m.europe ? 'Tickets not kept at setup go back in the box (out of the game).' : 'Tickets not kept go to the bottom of the ticket pile.',
        ),
        'When everyone has chosen, the first player in the seat order (the host online, you on this device) takes the first turn. Play goes round the seats.',
      ),
    ),
    section('Your turn', p(`On your turn you must do exactly **one** of these ${m.europe ? 'four' : 'three'} things:`), terms(...turnChoices)),
    section(
      'Drawing train cards',
      steps(
        'Take two cards, one at a time. Each one may be a face-up card from the market or the top card of the deck (unseen).',
        'When you take a face-up card, it is replaced at once from the deck before your next draw.',
        sub(
          '**Locomotives in the market:**',
          'Taking a face-up locomotive as your **first** card ends your turn: it is your only card.',
          'You may **not** take a face-up locomotive as your second card.',
          'A locomotive drawn blind from the deck is an ordinary draw.',
        ),
        'When the deck runs out, the discards are shuffled into a new deck. If there are no cards left to draw at all, you may not choose this action. If after your first card no second card can be taken (no deck cards and only locomotives face up), your turn ends.',
      ),
    ),
    section(
      'Claiming a route',
      steps(
        'A route is the line of coloured spaces between two neighbouring cities. To claim it, play cards from your hand equal to its **length**.',
        sub(
          'The cards must be one colour:',
          'a coloured route needs that colour;',
          'a **grey** route takes any single colour, your choice;',
          'locomotives can stand in for any of the cards.',
        ),
        'Place your trains on it: you need at least as many trains left as its length. Score its points at once (see Scoring).',
        'You may claim **any** open route on the map; it does not have to connect to your other routes.',
        'You may claim only one route per turn.',
        sub(
          '**Double routes** (two parallel routes between the same cities):',
          'One player may never claim both.',
          'With **2 or 3 players**, once either of the pair is claimed, the other is closed to everyone.',
          'With 4 or 5 players, both can be claimed, by different players.',
        ),
        ...(m.europe
          ? [
              sub(
                '**Ferries** (routes with locomotive symbols) need at least that many **locomotives** among the cards you play.',
                'The other cards follow the route\'s colour rule as usual.',
              ),
              sub(
                '**Tunnels** (routes with dark borders). First play the route\'s normal cost. Then the top **three** deck cards are turned over:',
                'each one that matches the colour you paid with, and each locomotive, adds **one card** to the cost;',
                'if you paid only with locomotives, only locomotives turned over add to the cost;',
                'you then pay the extra in cards of your colour or locomotives, and claim the tunnel;',
                'or you decline: you take all your cards back, the route stays open, and your turn ends.',
                'The three turned cards are discarded either way.',
              ),
            ]
          : []),
      ),
    ),
    section(
      'Destination tickets',
      figure(Tickets, 'A ticket names two cities and its points. At the end a completed one adds them (tick), a missed one takes them away (cross).'),
      steps(
        'A ticket names two cities and a value. You complete it by linking those two cities with a **continuous chain of your own routes**' + (m.europe ? ' (stations can help; see Train stations).' : '.'),
        'Your tickets are secret until the end of the game.',
        `On a ticket turn, draw **${m.draw}** tickets from the pile (fewer if fewer are left) and keep **at least one**. You may keep more. Tickets you return go to the **bottom** of the pile.`,
        'Kept tickets can never be thrown away later.',
        'You may not choose this action when the pile is empty.',
      ),
      note('Online, drawing tickets adds 30 seconds to your turn clock.'),
    ),
    ...(m.europe
      ? [
          section(
            'Train stations',
            steps(
              'On your turn you may build a station in **any city that has no station** yet, even one with no routes of yours.',
              'Your first station costs **1** card, your second **2** cards, your third **3** cards, all of one colour (locomotives count as any colour).',
              'At the end of the game, each of your stations lets you use **one** route of another player that touches its city, as if it were yours, to complete your tickets. It does not score that route\'s points.',
              'Each station gives one route only. If several would help, the one that scores you the most ticket points is used.',
              'Every station you **never build** is worth **4 points** at the end.',
            ),
          ),
        ]
      : []),
    section(
      'End of the game',
      steps(
        'When a player ends their turn with **2 or fewer trains** left, the final round begins.',
        'Every player, including that one, gets **one more turn**. Then the game ends.',
      ),
    ),
    section(
      'Scoring',
      p('**Routes** score as you claim them:'),
      routeTable(m.europe),
      steps(
        'At the end, each player reveals their tickets. Each **completed** ticket adds its value; each **uncompleted** ticket subtracts its value.',
        ...(m.longest
          ? [`**${m.europe ? 'European Express' : 'Longest Continuous Path'}: +10** to the player with the longest continuous chain of their own routes (counted in train spaces; a chain may pass through a city more than once but may not reuse a route). Tied players each score it.`]
          : []),
        ...(m.globetrotter ? ['**Globetrotter: +15** to the player who completed the most tickets. Tied players each score it; nobody scores it if no one completed a ticket.'] : []),
        ...(m.europe ? ['**Stations:** +4 for each station a player did not build.'] : []),
        'The highest total wins.',
        sub(
          'Ties are broken in this order:',
          'most completed tickets;',
          ...(m.longest ? [`holding the ${m.europe ? 'European Express' : 'Longest Continuous Path'} bonus.`] : []),
          'If still tied, the players share the win.',
        ),
      ),
    ),
    section(
      'Timing and leaving',
      list(
        'Online, each turn has a 45-second clock. If it runs out, your turn ends: a tunnel you were deciding on is declined, and if you were choosing tickets, the first one offered is kept.',
        'A player who leaves (or is removed) is out: their train cards go to the discards, their tickets back in the pile, and their routes and stations are freed for others to claim. They are not scored.',
      ),
    ),
  ];
}

const usa = getMap('usa');
const ticketCount = (modeId: string) => usa.modes.find((m) => m.id === modeId)?.tickets.length ?? 0;

export const TTR_RULES: GameRules = {
  title: 'Ticket to Ride',
  variants: [
    {
      id: 'usa:default',
      label: 'USA',
      book: {
        summary: 'Collect train cards, claim railway routes across North America and connect the cities on your secret destination tickets. 2 to 5 players.',
        sections: book({
          europe: false,
          ticketText: `${ticketCount('default')} tickets, each naming two cities and a value.`,
          deal: 3,
          keep: 2,
          draw: 3,
          longest: true,
          globetrotter: false,
        }),
      },
    },
    {
      id: 'usa:1910',
      label: 'USA · 1910',
      book: {
        summary: 'The USA map with the 1910 tickets: 35 new destinations, and the Globetrotter bonus for the most completed tickets in place of the Longest Path. 2 to 5 players.',
        sections: book({
          europe: false,
          ticketText: `${ticketCount('1910')} new 1910 tickets. None repeats a route of the original tickets.`,
          deal: 3,
          keep: 2,
          draw: 3,
          longest: false,
          globetrotter: true,
        }),
      },
    },
    {
      id: 'usa:mega',
      label: 'USA · Mega',
      book: {
        summary: 'The USA map with every ticket in play (69) and both bonus cards. You start with more tickets and draw more each time. 2 to 5 players.',
        sections: book({
          europe: false,
          ticketText: `All ${ticketCount('mega')} tickets: the 35 new 1910 tickets, the 30 original tickets (4 with revised values) and the 4 Mystery Train tickets.`,
          deal: 5,
          keep: 3,
          draw: 4,
          longest: true,
          globetrotter: true,
        }),
      },
    },
    {
      id: 'usa:big-cities',
      label: 'USA · Big Cities',
      book: {
        summary: 'The USA map where every destination involves a big city: Chicago, Dallas, Houston, Los Angeles, Miami, New York or Seattle. 2 to 5 players.',
        sections: book({
          europe: false,
          ticketText: `${ticketCount('big-cities')} tickets: every ticket of the full set (69) with at least one big city on it. The big cities are Chicago, Dallas, Houston, Los Angeles, Miami, New York and Seattle.`,
          deal: 4,
          keep: 2,
          draw: 4,
          longest: true,
          globetrotter: false,
          extraSetup: 'The printed rule gives no bonus card for this mode, so GameHub plays it with the standard Longest Continuous Path bonus.',
        }),
      },
    },
    {
      id: 'europe:default',
      label: 'Europe',
      book: {
        summary: 'Claim routes across Europe from Edinburgh to Constantinople. Tunnels can cost extra cards, ferries need locomotives, and train stations let you borrow one rival route each. 2 to 5 players.',
        sections: book({
          europe: true,
          ticketText: 'Regular tickets plus 6 long-route tickets.',
          deal: 4,
          keep: 2,
          draw: 3,
          longest: true,
          globetrotter: false,
          extraSetup: 'The 4 tickets are 1 long-route ticket and 3 regular ones. Long-route tickets not dealt leave the game.',
        }),
      },
    },
  ],
};
