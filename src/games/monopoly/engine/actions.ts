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
  | { type: 'DECLARE_BANKRUPTCY' };

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
