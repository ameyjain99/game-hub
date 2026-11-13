/**
 * Chance and Community Chest decks (16 cards each), under generic text. Each card
 * carries a structured `effect` the reducer applies; the deck order is shuffled
 * per game from the seeded RNG and hidden by redaction.
 */

export type CardEffect =
  | { kind: 'move-to'; space: number; collectGo?: boolean }
  | { kind: 'move-rel'; delta: number }
  | { kind: 'nearest'; target: 'railroad' | 'utility' }
  | { kind: 'collect'; amount: number }
  | { kind: 'pay'; amount: number }
  | { kind: 'pay-per-building'; perHouse: number; perHotel: number }
  | { kind: 'jail' }
  | { kind: 'get-out-free' }
  | { kind: 'collect-from-each'; amount: number }
  | { kind: 'pay-each'; amount: number };

export interface CardDef {
  id: string;
  text: string;
  effect: CardEffect;
}

export const CHANCE: CardDef[] = [
  { id: 'ch-go', text: 'Advance to Go. Collect $200.', effect: { kind: 'move-to', space: 0, collectGo: true } },
  { id: 'ch-illinois', text: 'Advance to Budapest.', effect: { kind: 'move-to', space: 24, collectGo: true } },
  { id: 'ch-charles', text: 'Advance to Dublin.', effect: { kind: 'move-to', space: 11, collectGo: true } },
  { id: 'ch-util', text: 'Advance to the nearest Utility.', effect: { kind: 'nearest', target: 'utility' } },
  { id: 'ch-rail1', text: 'Advance to the nearest Station.', effect: { kind: 'nearest', target: 'railroad' } },
  { id: 'ch-rail2', text: 'Advance to the nearest Station.', effect: { kind: 'nearest', target: 'railroad' } },
  { id: 'ch-dividend', text: 'Bank pays you a dividend of $50.', effect: { kind: 'collect', amount: 50 } },
  { id: 'ch-free', text: 'Get Out of Jail Free.', effect: { kind: 'get-out-free' } },
  { id: 'ch-back3', text: 'Go back 3 spaces.', effect: { kind: 'move-rel', delta: -3 } },
  { id: 'ch-jail', text: 'Go to Jail. Do not pass Go.', effect: { kind: 'jail' } },
  { id: 'ch-repairs', text: 'Make general repairs: $25 per house, $100 per hotel.', effect: { kind: 'pay-per-building', perHouse: 25, perHotel: 100 } },
  { id: 'ch-fine', text: 'Speeding fine. Pay $15.', effect: { kind: 'pay', amount: 15 } },
  { id: 'ch-reading', text: 'Take a trip to North Station.', effect: { kind: 'move-to', space: 5, collectGo: true } },
  { id: 'ch-boardwalk', text: 'Advance to Tokyo.', effect: { kind: 'move-to', space: 39 } },
  { id: 'ch-chairman', text: 'You have been elected Chairman. Pay each player $50.', effect: { kind: 'pay-each', amount: 50 } },
  { id: 'ch-loan', text: 'Your building loan matures. Collect $150.', effect: { kind: 'collect', amount: 150 } },
];

export const CHEST: CardDef[] = [
  { id: 'cc-go', text: 'Advance to Go. Collect $200.', effect: { kind: 'move-to', space: 0, collectGo: true } },
  { id: 'cc-bankerror', text: 'Bank error in your favour. Collect $200.', effect: { kind: 'collect', amount: 200 } },
  { id: 'cc-doctor', text: "Doctor's fee. Pay $50.", effect: { kind: 'pay', amount: 50 } },
  { id: 'cc-stock', text: 'From sale of stock you get $50.', effect: { kind: 'collect', amount: 50 } },
  { id: 'cc-free', text: 'Get Out of Jail Free.', effect: { kind: 'get-out-free' } },
  { id: 'cc-jail', text: 'Go to Jail. Do not pass Go.', effect: { kind: 'jail' } },
  { id: 'cc-holiday', text: 'Holiday fund matures. Collect $100.', effect: { kind: 'collect', amount: 100 } },
  { id: 'cc-taxrefund', text: 'Income tax refund. Collect $20.', effect: { kind: 'collect', amount: 20 } },
  { id: 'cc-birthday', text: 'It is your birthday. Collect $10 from every player.', effect: { kind: 'collect-from-each', amount: 10 } },
  { id: 'cc-life', text: 'Life insurance matures. Collect $100.', effect: { kind: 'collect', amount: 100 } },
  { id: 'cc-hospital', text: 'Pay hospital fees of $100.', effect: { kind: 'pay', amount: 100 } },
  { id: 'cc-school', text: 'Pay school fees of $50.', effect: { kind: 'pay', amount: 50 } },
  { id: 'cc-consultancy', text: 'Receive $25 consultancy fee.', effect: { kind: 'collect', amount: 25 } },
  { id: 'cc-streets', text: 'Street repairs: $40 per house, $115 per hotel.', effect: { kind: 'pay-per-building', perHouse: 40, perHotel: 115 } },
  { id: 'cc-beauty', text: 'Second prize in a beauty contest. Collect $10.', effect: { kind: 'collect', amount: 10 } },
  { id: 'cc-inherit', text: 'You inherit $100.', effect: { kind: 'collect', amount: 100 } },
];
