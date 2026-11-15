import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleBook, type RuleSection } from '../../shared/rules';
import { HighRanks, HoldemDeal, LowRanks, OmahaDeal, ShortDeal, ShortRanks, StudDeal } from './ui/ruleFigures';
import { HANDS_PER_LEVEL, LEVELS, STARTING_STACK, stakes } from './engine';

const fmt = (n: number) => n.toLocaleString('en-US');

const goal = section(
  'The goal',
  p(`Poker here is a **sit-and-go tournament**. Every player starts with ${fmt(STARTING_STACK)} chips. You win by taking every chip at the table.`),
  list(
    'A player with no chips left when a hand ends is **knocked out**.',
    'The stakes rise every few hands, so the tournament always comes to an end.',
    'The last player with chips wins. Everyone else finishes in the order they were knocked out.',
  ),
);

const levelsCommunity = section(
  'Blinds and how they rise',
  p('Two players put in forced bets, the **blinds**, before the cards are dealt, so every pot is worth fighting for. The blinds rise in **levels**:'),
  table(
    ['Level', 'Small blind', 'Big blind'],
    ...LEVELS.slice(0, 10).map(([sb, bb], i) => [String(i + 1), fmt(sb), fmt(bb)]),
  ),
  p(`Later levels keep climbing to ${fmt(LEVELS[LEVELS.length - 1][0])}/${fmt(LEVELS[LEVELS.length - 1][1])}, where they stay.`),
  list(
    `The level rises every **${HANDS_PER_LEVEL.normal} hands** by default. When the game is set up you can choose every ${HANDS_PER_LEVEL.fast} hands (fast) or every ${HANDS_PER_LEVEL.slow} hands (slow) instead.`,
    'A new level starts with the next hand. The level never changes during a hand.',
  ),
);

const levelsStud = section(
  'Antes, the bring-in and the bets',
  p('Stud has no blinds. Everyone puts in a small **ante** before the deal, and one player must open the betting with the **bring-in**. All bets are fixed sizes. Each level sets four amounts:'),
  table(
    ['Level', 'Ante', 'Bring-in', 'Small bet', 'Big bet'],
    ...LEVELS.slice(0, 10).map((_, i) => {
      const st = stakes({ level: i });
      return [String(i + 1), fmt(st.ante), fmt(st.bringIn), fmt(st.small), fmt(st.big)];
    }),
  ),
  list(
    'The **small bet** is used on third and fourth street; the **big bet**, twice as large, on fifth, sixth and seventh street.',
    'The ante is a fifth of the small bet, rounded to the nearest 5 (never less than 5). The bring-in is half the small bet.',
    `The level rises every **${HANDS_PER_LEVEL.normal} hands** by default (or every ${HANDS_PER_LEVEL.fast} or ${HANDS_PER_LEVEL.slow}, chosen at setup), always between hands.`,
  ),
);

const buttonCommunity = section(
  'The button and the blinds',
  steps(
    'Before the first hand, the **dealer button** goes to a random player.',
    'After every hand the button moves clockwise to the next player who still has chips.',
    'The player to the left of the button posts the **small blind**; the next player posts the **big blind**.',
    '**Heads-up** (only two players left): the button posts the small blind and the other player posts the big blind.',
    'A player who can\'t cover a blind posts every chip they have and is **all-in** for the hand.',
  ),
  note('Even when the big blind is all-in for less, the amount to call is the full big blind.'),
);

const buttonStud = section(
  'The button',
  steps(
    'Before the first hand, the **dealer button** goes to a random player. After every hand it moves clockwise to the next player who still has chips.',
    'In Stud the button posts nothing. It sets where the deal starts (the player to its left gets the first card) and breaks ties for who acts first.',
    'A player who can\'t cover the ante posts every chip they have and is all-in for the hand.',
  ),
);

const handCommunity = (holeCards: number, deck: string): RuleSection =>
  section(
    'A hand, step by step',
    steps(
      'The small and big blinds are posted.',
      `Each player is dealt **${holeCards} cards face down** (hole cards), one at a time, starting with the player to the left of the button. The deck is ${deck}; it is shuffled before every hand and there are no burn cards.`,
      sub(
        '**Pre-flop betting.** The player to the left of the big blind acts first; play goes clockwise.',
        'Heads-up, the button (who posted the small blind) acts first.',
        'The big blind acts last and may raise even if everyone only called.',
      ),
      '**The flop:** three cards are dealt face up in the middle. They are shared by everyone.',
      sub('**Betting on the flop.** The first player still in, clockwise from the button, acts first.', 'Heads-up, that is the big blind: the button acts last after the flop.'),
      '**The turn:** a fourth shared card face up, then a betting round in the same order.',
      '**The river:** a fifth and last shared card, then a final betting round.',
      '**Showdown:** every player still in turns their cards face up and the best hand wins (see Winning the pot).',
    ),
    figure(holeCards === 4 ? OmahaDeal : deck.startsWith('36') ? ShortDeal : HoldemDeal, holeCards === 4 ? 'In Omaha your hand is **exactly two** of your four cards plus **exactly three** shared cards.' : 'Your hand is the best five of your two cards and the five shared cards, in any mix.'),
    note('If everyone but one player folds at any point, that player wins the pot at once and the hand ends. No more cards are dealt and nobody shows.'),
    note('When everyone still in is all-in (or only one player has chips behind and owes nothing), the rest of the shared cards are dealt with no more betting.'),
  );

const handStud = (low: boolean): RuleSection =>
  section(
    'A hand, step by step',
    steps(
      'Every player puts in the **ante**.',
      '**Third street:** each player gets two cards face down, then one card face up. Cards go out one at a time, starting with the player to the left of the button.',
      sub(
        low
          ? '**The bring-in** goes to the player with the **highest** upcard (aces are low, so a king is highest). If two upcards share a rank, the higher suit brings it in; suits rank spades (highest), hearts, diamonds, clubs.'
          : '**The bring-in** goes to the player with the **lowest** upcard (aces are high, so a 2 is lowest). If two upcards share a rank, the lower suit brings it in; suits rank clubs (lowest), diamonds, hearts, spades.',
        'That player must either post the bring-in, or complete it to a full small bet. They may not fold or check.',
        'The others then act clockwise: fold, call the bring-in, or complete to the small bet. After a completion, raises are one small bet each.',
      ),
      sub(
        '**Fourth street:** each player still in gets one more card face up, then a betting round with the small bet.',
        low
          ? 'The player whose face-up cards make the **lowest** hand acts first (ace-to-five, see Hand rankings). Pairs showing count against a hand.'
          : 'The player whose face-up cards make the **highest** hand acts first: a pair beats no pair, then the highest card, then the next.',
        'On a tie, the tied player nearest the button\'s left acts first. If that player is all-in, the next player clockwise acts first.',
        'There is no double bet on fourth street, even when someone shows a pair.',
      ),
      '**Fifth street** and **sixth street:** one more card face up each, then a betting round with the **big bet**. The best hand showing acts first, as on fourth street.',
      '**Seventh street:** a last card **face down**, then a final betting round with the big bet, started by the same player who started sixth street\'s.',
      `**Showdown:** every player still in turns all their cards up and makes the best five-card hand from their seven. ${low ? 'The lowest hand wins.' : 'The highest hand wins.'}`,
    ),
    figure(StudDeal, 'Your seven cards in Stud: the face-down ones are seen only by you.'),
    note('The deck holds 52 cards. If, when a street is dealt, there are fewer cards left than players still in (this can only happen on seventh street with eight players), one card is dealt face up in the middle instead. Everyone uses it as their seventh card.'),
    note('If everyone but one player folds, that player wins the pot at once and nobody shows. If everyone still in is all-in, the remaining cards are dealt with no more betting.'),
  );

const yourTurn = section(
  'Your turn to bet',
  p('When it is your turn you choose one action:'),
  terms(
    ['Fold', 'Give up the hand and every chip you put in. You can fold whenever it is your turn (except while the Stud bring-in is yours to post).'],
    ['Check', 'Pass without betting. Only allowed when nobody has bet in this round, or you have already matched the bet.'],
    ['Call', 'Match the largest bet in front of anyone this round.'],
    ['Bet', 'Put in the first chips of a round.'],
    ['Raise', 'Increase the largest bet. A raise is stated as the total you are raising **to**.'],
    ['All-in', 'Put in every chip you have. You can always do this, even if it is less than a call or a full raise.'],
  ),
  steps(
    'A betting round goes clockwise until every player still in has acted at least once and everyone has put in the same amount, or has no chips left.',
    'A player who is all-in stays in the hand but takes no more actions. They can only win the chips they matched (see Winning the pot).',
    'If a bet or raise is not fully called by anyone, the uncalled part goes straight back to the player who made it.',
  ),
  note('Online, each turn has a 30-second clock. When it runs out you check if you can; otherwise you fold. In Stud, an unanswered bring-in is posted for you.'),
);

const bettingNoLimit = section(
  'How much you can bet: no limit',
  steps(
    'The smallest bet is the big blind.',
    'The smallest raise is the size of the largest bet or raise made so far in this round (never less than the big blind). Example: blinds 10/20; a player raises to 60, a raise of 40, so the next raise must go to at least 100.',
    'The largest bet or raise is all your chips.',
    sub(
      'An all-in for less than a full raise does **not** reopen the betting:',
      'Players who already acted in this round may now only call or fold.',
      'Players who have not acted yet may still raise; the smallest raise is still based on the last full raise.',
    ),
  ),
);

const bettingPotLimit = section(
  'How much you can bet: pot limit',
  steps(
    'The smallest bet is the big blind, and the smallest raise is the size of the largest bet or raise so far this round (at least the big blind), as in no limit.',
    sub(
      'The **largest** raise is to the current bet plus the size of the pot after you call.',
      'The pot here means every chip in the middle plus every bet in front of the players, plus your call.',
      'Example: blinds 10/20, first to act before the flop. The pot after calling is 10 + 20 + 20 = 50, so you may raise to at most 20 + 50 = 70.',
      'With nobody betting yet, you may bet at most the size of the pot.',
    ),
    'You may always go all-in if your chips are fewer than the largest allowed bet.',
    'An all-in for less than a full raise does not reopen the betting: players who already acted may only call or fold.',
  ),
);

const bettingFixed = section(
  'How much you can bet: fixed limit',
  steps(
    'Every bet and raise is exactly one bet: the **small bet** on third and fourth street, the **big bet** on fifth, sixth and seventh street.',
    'Completing the bring-in to the small bet counts as the round\'s bet. Posting the bring-in does not.',
    'A round allows **one bet and three raises**. After that, players may only call or fold.',
    'With only two players left in the hand, there is no limit on the number of raises.',
    'A player without enough chips for a full bet may go all-in for less. That does not reopen the betting: players who already acted may only call or fold, and the next raise is one full bet above the all-in.',
  ),
);

const pots = (low: boolean, omaha: boolean) =>
  section(
    'Winning the pot',
    steps(
      'At the showdown every hand still in is turned face up. Nobody may throw their cards away unseen.',
      omaha
        ? 'Each player makes their best five-card hand from **exactly two** of their four hole cards and **exactly three** of the five shared cards. Four shared cards of one suit give you no flush unless two of your own cards are that suit too.'
        : 'Each player makes their best five-card hand from all the cards available to them. Unused cards play no part.',
      low
        ? 'The **lowest** hand wins (see Hand rankings). Compare hands by their highest card first; the lower one wins. If those are equal, compare the next card down, and so on.'
        : 'The **highest** hand wins (see Hand rankings). Between two hands of the same kind, the higher ranks win: compare the most important cards first (a pair before its kickers), then each kicker in turn.',
      'Suits never decide who wins. Hands that are exactly equal in rank split the pot.',
    ),
    p('**Side pots.** When a player is all-in for less than others bet, the chips are split into pots:'),
    steps(
      'The **main pot** holds, from every player, up to the amount the smallest all-in player put in. Every player still in can win it.',
      'Each **side pot** holds the next layer of chips, up to the next all-in amount. Only the players who put in that much can win it.',
      'Each pot goes to the best hand among the players who can win it.',
      'Example: A is all-in for 100, B for 300, and C covers both. The main pot is 300 (100 from each) and any of A, B and C can win it. The side pot is 400 (200 each from B and C) and only B or C can win it.',
    ),
    p('**Splitting.** A pot that is split shares its chips equally. Chips that do not divide evenly go one each to the winners nearest the button\'s left, clockwise.'),
  );

const ranksHigh = section(
  'Hand rankings',
  p('From best to worst. A hand is always exactly five cards.'),
  figure(HighRanks),
  table(
    ['Hand', 'What it is'],
    ['Straight flush', 'Five in a row, all one suit. Ace-high is a royal flush.'],
    ['Four of a kind', 'Four cards of one rank.'],
    ['Full house', 'Three of one rank and two of another.'],
    ['Flush', 'Five cards of one suit.'],
    ['Straight', 'Five ranks in a row, mixed suits.'],
    ['Three of a kind', 'Three of one rank.'],
    ['Two pair', 'Two pairs.'],
    ['One pair', 'Two of one rank.'],
    ['High card', 'None of the above.'],
  ),
  list('Aces are high, and also low in the five-high straight A-2-3-4-5 (the lowest straight). A straight cannot wrap around: Q-K-A-2-3 is not a straight.'),
);

const ranksShort = section(
  'Hand rankings (Short Deck)',
  p('From best to worst. Two changes from regular poker: a **flush beats a full house**, and **three of a kind beats a straight**.'),
  figure(ShortRanks),
  table(
    ['Hand', 'What it is'],
    ['Straight flush', 'Five in a row, all one suit.'],
    ['Four of a kind', 'Four cards of one rank.'],
    ['Flush', 'Five cards of one suit.'],
    ['Full house', 'Three of one rank and two of another.'],
    ['Three of a kind', 'Three of one rank.'],
    ['Straight', 'Five ranks in a row. The ace plays low in A-6-7-8-9, the lowest straight.'],
    ['Two pair', 'Two pairs.'],
    ['One pair', 'Two of one rank.'],
    ['High card', 'None of the above.'],
  ),
);

const ranksLow = section(
  'Hand rankings (Razz)',
  p('Razz uses **ace-to-five low**: the lowest hand wins.'),
  figure(LowRanks, 'Lowest first: the lower the top card, the better.'),
  list(
    '**Aces are always low.** The ranks run A (lowest), 2, 3 ... 10, J, Q, K (highest).',
    '**Straights and flushes do not count.** A-2-3-4-5 of one suit is simply the best possible hand.',
    'Any five different ranks beat any hand with a pair. Between two such hands, the one with the lower highest card wins: 8-7-4-2-A beats 9-4-3-2-A. If the highest cards match, compare the next ones down.',
    'A hand with a pair beats one with two pairs, which beats three of a kind, then a full house, then four of a kind (the worst). Between two hands with a pair, the lower pair wins.',
    'From seven cards you use the five that make the lowest hand.',
  ),
);

const knockout = section(
  'Knockouts and the finish',
  steps(
    'When a hand ends, every player left with no chips is out.',
    'Players knocked out in the same hand: the one who started that hand with more chips finishes higher. If they started with the same amount, they share the place.',
    'When one player holds every chip, the tournament is over and they win.',
    'A player who leaves (or is removed) finishes in the place they were in when they left. Their chips leave the table; chips they already bet stay in the pot.',
  ),
);

const book = (summary: string, ...sections: RuleSection[]): RuleBook => ({ summary, sections });

export const POKER_RULES: GameRules = {
  title: 'Poker',
  variants: [
    {
      id: 'holdem',
      label: "Texas Hold'em",
      book: book(
        "No-limit Texas Hold'em: two private cards each and five shared cards. Make the best five-card hand, or make everyone else fold. 2 to 9 players.",
        goal,
        levelsCommunity,
        buttonCommunity,
        handCommunity(2, 'the standard 52 cards'),
        yourTurn,
        bettingNoLimit,
        pots(false, false),
        ranksHigh,
        knockout,
      ),
    },
    {
      id: 'omaha',
      label: 'Omaha',
      book: book(
        'Pot-limit Omaha: four private cards each and five shared cards. Your hand must use exactly two of your cards and exactly three shared cards. 2 to 9 players.',
        goal,
        levelsCommunity,
        buttonCommunity,
        handCommunity(4, 'the standard 52 cards'),
        yourTurn,
        bettingPotLimit,
        pots(false, true),
        ranksHigh,
        knockout,
      ),
    },
    {
      id: 'shortdeck',
      label: 'Short Deck',
      book: book(
        "No-limit Short Deck Hold'em: Hold'em with the 2s to 5s taken out of the deck. With fewer cards a flush beats a full house, and three of a kind beats a straight. 2 to 6 players.",
        goal,
        levelsCommunity,
        buttonCommunity,
        handCommunity(2, '36 cards: 6 to ace in each suit'),
        yourTurn,
        bettingNoLimit,
        pots(false, false),
        ranksShort,
        knockout,
      ),
    },
    {
      id: 'stud',
      label: 'Seven-Card Stud',
      book: book(
        'Fixed-limit Seven-Card Stud: each player gets seven cards of their own, four of them face up, over five betting rounds. There are no shared cards and no blinds. Best five-card hand wins. 2 to 8 players.',
        goal,
        levelsStud,
        buttonStud,
        handStud(false),
        yourTurn,
        bettingFixed,
        pots(false, false),
        ranksHigh,
        knockout,
      ),
    },
    {
      id: 'razz',
      label: 'Razz',
      book: book(
        'Fixed-limit Razz: Seven-Card Stud where the lowest hand wins. Aces are low, and straights and flushes do not count, so A-2-3-4-5 is the best hand. 2 to 8 players.',
        goal,
        levelsStud,
        buttonStud,
        handStud(true),
        yourTurn,
        bettingFixed,
        pots(true, false),
        ranksLow,
        knockout,
      ),
    },
  ],
};
