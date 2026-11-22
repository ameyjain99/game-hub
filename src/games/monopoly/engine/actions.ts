import type { PendingTrade } from './state';

/** Every player action. Auction/trade actions are acted on by the sub-phase
 *  actor, not necessarily the current player. */
export type Action =
  | { type: 'ROLL' }
  | { type: 'BUY' }
  | { type: 'DECLINE' }
  | { type: 'BID'; amount: number }
  | { type: 'PASS_BID' }
  | { type: 'BUILD'; spaceId: number }
  | { type: 'SELL_HOUSE'; spaceId: number }
  | { type: 'MORTGAGE'; spaceId: number }
  | { type: 'UNMORTGAGE'; spaceId: number }
  | { type: 'PROPOSE_TRADE'; trade: PendingTrade }
  | { type: 'RESPOND_TRADE'; accept: boolean }
  | { type: 'PAY_JAIL' }
  | { type: 'USE_JAIL_CARD' }
  | { type: 'ROLL_JAIL' }
  | { type: 'END_TURN' }
  // ---- Mega Edition
  /** Build or sell back a train depot on a railroad. */
  | { type: 'BUILD_DEPOT'; spaceId: number }
  | { type: 'SELL_DEPOT'; spaceId: number }
  /** Instead of rolling: ride a Bus Ticket to a square further along this side of the board. */
  | { type: 'USE_TICKET'; space: number }
  /** Take the speed die's bonus: Mr. Monopoly's extra move, or for the Bus a ticket or a ride to the next card square. */
  | { type: 'BONUS'; take?: 'ticket' | 'move' }
  /** Answer a choice owed: the square to move to (triples), the property to auction, or the birthday gift. */
  | { type: 'CHOOSE'; space?: number; take?: 'cash' | 'ticket' }
  | { type: 'DECLARE_BANKRUPTCY' }
  /** Once the game is over: start another with the same players and rules. */
  | { type: 'REMATCH' };

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
