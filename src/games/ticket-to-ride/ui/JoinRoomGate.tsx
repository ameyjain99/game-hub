import { JoinGate } from '../../../online/ui/JoinGate';
import { TicketToRideProfile } from './TicketToRideProfile';
import type { MapId } from '../engine/types';

interface Props {
  code: string;
  onBack: () => void;
  onSubmit: (name: string, avatar: string, seatCount?: number, modeId?: string, mapId?: MapId) => void;
  /** Take back a dropped seat in a game already under way. */
  onRejoin?: (seat: { index: number; name: string }) => void;
}

/**
 * Guards the join flow: before asking for a name, it checks the room actually
 * exists (and, for a game under way, offers a dropped player their seat back).
 */
export function JoinRoomGate({ code, onBack, onSubmit, onRejoin }: Props) {
  return (
    <JoinGate code={code} onBack={onBack} onRejoin={onRejoin}>
      <TicketToRideProfile action="join" onBack={onBack} onSubmit={onSubmit} />
    </JoinGate>
  );
}
