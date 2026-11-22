import { spacesOf } from '../engine/board';
import { monopolyActor } from '../engine/bot';
import { ticketTargets, unownedIds } from '../engine/selectors';
import type { MonopolyState } from '../engine/state';

/** A square the viewer has to name (Mega): where triples take them, what the bank auctions, or where a Bus Ticket goes. */
export interface MegaPick {
  kind: 'triples' | 'auction' | 'ticket';
  targets: number[];
}

/** The square the viewer is being asked for right now, if any. `ticketing`: they opened "ride a Bus Ticket". */
export function megaPick(view: MonopolyState, meId: string, ticketing: boolean): MegaPick | null {
  if (monopolyActor(view) !== meId || view.pendingAuction || view.pendingTrade || view.phase === 'over') return null;
  const me = view.players.find((p) => p.id === meId);
  if (!me || me.cash < 0) return null;
  if (view.choice?.kind === 'triples') {
    return { kind: 'triples', targets: spacesOf(view.settings.board).map((s) => s.id).filter((id) => id !== me.position) };
  }
  if (view.choice?.kind === 'auction') return { kind: 'auction', targets: unownedIds(view) };
  if (ticketing && view.phase === 'roll' && !me.inJail && (me.busTickets ?? 0) > 0) return { kind: 'ticket', targets: ticketTargets(view, me.position) };
  return null;
}
