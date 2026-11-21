import type { MediaChat } from '../useMediaChat';
import { playerIdForSeat, type LobbyView } from '../../net/protocol';
import { seatName } from '../seatNames';
import { VideoTiles } from './VideoTiles';

/**
 * The call, in the lobby: everyone who has joined can already hear and see
 * each other while they wait for the rest, each from their own tile (nothing
 * is switched on until a player turns it on).
 */
export function LobbyCall({
  lobby,
  myPlayerId,
  media,
  colorFor,
}: {
  lobby: LobbyView;
  myPlayerId: string | null;
  media: MediaChat | null | undefined;
  colorFor?: (index: number, seatCount: number) => string;
}) {
  const humans = lobby.seats.filter((s) => !s.isAI && s.name !== null);
  if (!media || !myPlayerId || humans.length === 0) return null;
  const alone = humans.length === 1;
  return (
    <section className="g-panel g-lobby-call" aria-label="Talk while you wait">
      <h2 className="g-panel-title">Talk while you wait</h2>
      <p className="g-hint">
        {alone
          ? 'Turn on your microphone or camera now, and friends will hear and see you as soon as they join.'
          : media.micMuted && media.camOff
            ? 'Turn on your microphone or camera from your own tile to say hello.'
            : 'Everyone in this room can hear and see whoever has switched on.'}
      </p>
      <VideoTiles
        seats={humans.map((s) => ({ id: playerIdForSeat(s.index), accent: colorFor?.(s.index, lobby.seatCount) }))}
        meId={myPlayerId}
        nameFor={(id) => {
          const seat = lobby.seats.find((s) => playerIdForSeat(s.index) === id);
          return seat ? seatName(lobby, seat) : 'Player';
        }}
        media={media}
      />
    </section>
  );
}
