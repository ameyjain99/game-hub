import type { CardCombo } from './types';

export type Action =
  | { type: 'CONFIRM_SETUP_TICKETS'; playerId: string; keptIds: string[] }
  | { type: 'DRAW_TRAIN'; source: 'deck' }
  | { type: 'DRAW_TRAIN'; source: 'market'; index: number }
  | { type: 'CLAIM_ROUTE'; routeId: string; combo: CardCombo }
  | { type: 'RESOLVE_TUNNEL'; commit: boolean }
  | { type: 'PLACE_STATION'; city: string; combo: CardCombo }
  | { type: 'DRAW_TICKETS' }
  | { type: 'KEEP_TICKETS'; keptIds: string[] }
  // Forced forfeit of the current turn (server-issued when a turn timer runs out).
  | { type: 'SKIP_TURN' };

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
