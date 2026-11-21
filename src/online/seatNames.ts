import { playerIdForSeat, type LobbyView } from '../net/protocol';

type Seat = LobbyView['seats'][number];

/** A seat's display name: the player's name, the bot's own name (the server
 *  gives each bot one; an unnamed bot is numbered), or "Open seat". */
export function seatName(lobby: LobbyView, seat: Seat): string {
  if (seat.name && !seat.isAI) return seat.name;
  if (seat.isAI) {
    if (seat.name) return seat.name; // the bot's own name, or the player it covers for
    const n = lobby.seats.filter((s) => s.isAI && !s.name && s.index <= seat.index).length;
    return `Bot ${n}`;
  }
  return 'Open seat';
}

/** Display name for an engine player id (`p0`...) in this room. */
export function nameForPlayer(lobby: LobbyView | null, playerId: string): string {
  const seat = lobby?.seats.find((s) => playerIdForSeat(s.index) === playerId);
  return lobby && seat ? seatName(lobby, seat) : 'Player';
}
