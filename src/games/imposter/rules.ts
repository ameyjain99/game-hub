import { figure, list, note, p, section, steps, sub, table, terms, type GameRules, type RuleBook } from '../../shared/rules';
import { ClassicCards, DecoyCards } from './ui/ruleFigures';
import { DISCUSS_MS, MAX_CLUE, MAX_SEATS, MIN_SEATS, type Mode } from './engine';
import { CATEGORIES } from './words';

const talk = `${DISCUSS_MS / 1000} seconds`;

function book(mode: Mode): RuleBook {
  const classic = mode === 'classic';
  return {
    summary: classic
      ? `Everyone but one player is shown a secret word. The **imposter** is shown only its category, and knows they are the imposter. Give one-word clues, talk, and vote out the player you think is bluffing. A caught imposter can still score by naming the word. ${MIN_SEATS} to ${MAX_SEATS} players.`
      : `Everyone is shown a secret word, but one player, the **imposter**, is shown a different word from the same category, a close neighbour of the real one, and is **not told** they are the imposter. Give one-word clues, talk, and vote out the player whose word is different. ${MIN_SEATS} to ${MAX_SEATS} players.`,
    sections: [
      section(
        'The goal',
        p('Score the most points over all the rounds.'),
        terms(
          ['Crew', 'Every player who is not the imposter this round. They all hold the same word.'],
          ['Imposter', classic ? 'The one player shown only the category. They know who they are.' : 'The one player holding the different word. They do not know who they are.'],
          ['Word', `The secret word of the round. It is always one of the ten words of its category (${CATEGORIES.length} categories in all).`],
        ),
      ),
      section(
        'Setting up a game',
        steps(
          `Choose the **rounds**: 3, 5, or one per player. With one per player, every player is the imposter exactly once.`,
          'Choose the **clues each round**: 1, 2 or 3 per player.',
          'Every player starts with 0 points.',
        ),
      ),
      section(
        'Dealing a round',
        figure(classic ? ClassicCards : DecoyCards),
        steps(
          'A category and a word are drawn. A word is never used twice in one game.',
          'One player becomes the imposter. Nobody is the imposter a second time until every player still in the game has been the imposter once; the order is random.',
          classic
            ? sub('Each player sees a card:', 'The crew sees the **category** and the **word**.', 'The imposter sees the **category** and "You are the imposter". They do not see the word.')
            : sub(
                'Each player sees a card with the **category** and a word:',
                'The crew\'s cards show the word.',
                'The imposter\'s card shows the **other word of its pair**: words come in close pairs (Lion and Tiger, Pancake and Waffle). Nothing on the card says it is different.',
              ),
          'Cards start face down; tap yours to look, and again to hide it.',
          'The first clue-giver moves one seat round the table each round. The first round starts at a random seat.',
        ),
      ),
      section(
        'Giving clues',
        steps(
          'Starting with the first clue-giver and going round the table, each player gives **one clue**. The table goes round as many times as the clues-each setting: twice by default.',
          sub(
            'A clue must be:',
            `**One word** of letters (a hyphen or apostrophe inside it is allowed), at most ${MAX_CLUE} letters long.`,
            '**New this round**: not a clue anyone already gave this round, ignoring capitals.',
            classic
              ? 'For the crew: **not the word**, a word containing it, or a part of it three letters or longer ("Pancakes" and "cake" are both out for Pancake). The imposter is not checked against the word, because blocking a clue would tell them what the word is.'
              : 'Not **the word on your own card**, a word containing it, or a part of it three letters or longer. Everyone, the imposter included, is checked against their own card only.',
          ),
          'Every clue appears under its player\'s name for everyone to see.',
          'If a player\'s clock runs out, they give **no clue** for that turn and play moves on. A missing clue is shown as "no clue".',
        ),
        note(
          classic
            ? 'The crew wants clues that prove they know the word without making it obvious, because a caught imposter can still score by naming it. The imposter wants clues that sound like they know the word.'
            : 'Every player should watch whether the others\' clues fit their own word. If they don\'t, you may be the imposter: then your best move is to clue toward the word the others seem to have.',
        ),
      ),
      section(
        'Talking it over',
        steps(
          'When every clue is given, the table talks (on video, online). Nothing is typed.',
          `The vote opens when **every human player has pressed Ready**, or after **${talk}**, whichever comes first. A table of bots goes straight to the vote.`,
        ),
      ),
      section(
        'The vote',
        steps(
          'Every player votes for **one other player**. You cannot vote for yourself.',
          'Votes can be cast in any order. Everyone sees **who has voted**, but nobody sees **for whom** until every vote is in.',
          'A player whose clock runs out casts no vote.',
          sub(
            'When every vote is in, they are counted:',
            'The player with **the most votes** is voted out.',
            'If two or more players tie for the most votes, there is **one runoff**: every player votes again, this time only for one of the tied players (a tied player votes for another tied player).',
            'If the runoff ties again, or nobody voted, **nobody** is voted out.',
          ),
        ),
      ),
      section(
        'Ending the round',
        steps(
          sub(
            'The voted-out player is revealed:',
            'If nobody was voted out, or the voted-out player is crew, the **imposter escapes**.',
            classic
              ? 'If the voted-out player is the imposter, they are **caught**. They then get **one guess**: they pick the word from the ten words of the category. The clock applies; running out counts as a wrong guess.'
              : 'If the voted-out player is the imposter, they are **caught**. There is no guess in Decoy.',
          ),
          'Everyone then sees the word' + (classic ? '' : ' and the imposter\'s word') + ', who the imposter was, and how each player voted.',
          'Points are scored (see Scoring). The next round is dealt after a short pause.',
        ),
      ),
      section(
        'Scoring',
        table(
          ['What happened', 'Points'],
          ['The imposter escapes', '+2 to the imposter'],
          ...(classic ? [['The imposter is caught and names the word', '+1 to the imposter']] : []),
          [classic ? 'The imposter is caught and misses the word' : 'The imposter is caught', '+1 to every other player still in the game'],
        ),
        p('Nobody else scores in a round the imposter wins.'),
      ),
      section(
        'Winning',
        steps('After the last round, the player with the most points wins.', 'Players tied on the most points share the win.'),
      ),
      section(
        'Players leaving',
        list(
          'A player who leaves is skipped for clues and votes from then on, and cannot win.',
          'If the **imposter** leaves during a round, the round ends at once and scores nothing.',
          `If fewer than ${MIN_SEATS} players are left, the game ends and the scores stand.`,
        ),
      ),
    ],
  };
}

export const IMPOSTER_RULES: GameRules = {
  title: 'Imposter',
  variants: [
    { id: 'classic', label: 'Classic', book: book('classic') },
    { id: 'decoy', label: 'Decoy', book: book('decoy') },
  ],
};
