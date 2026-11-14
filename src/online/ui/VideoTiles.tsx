import type { CSSProperties, ReactNode } from 'react';
import { MicOff } from '../../shared/icons';
import type { MediaChat } from '../useMediaChat';
import { SeatMedia, seatMediaState } from './SeatMedia';

/** One seat at the video table. */
export interface VideoSeat {
  id: string;
  /** Out of the game (eliminated, bankrupt): the tile dims. */
  out?: boolean;
  /** The seat's colour, ringed round its tile (e.g. a Monopoly token colour). */
  accent?: string;
  /** Whose move it is: the tile lights up in its accent. */
  active?: boolean;
  /** Shown while the camera is off; a silhouette by default. */
  badge?: ReactNode;
}

/**
 * The video table as a grid of tiles (Cluedo, Monopoly): a tile per human seat,
 * built on the shared SeatMedia. Your own tile's mic / camera toggles show on
 * hover (always on touch).
 */
export function VideoTiles({
  seats,
  meId,
  nameFor,
  media,
  onSeatHover,
}: {
  seats: VideoSeat[];
  meId: string;
  nameFor: (id: string) => string;
  media: MediaChat;
  /** Hovering (or focusing) a tile names its seat; leaving clears it. */
  onSeatHover?: (id: string | null) => void;
}) {
  return (
    <div className="g-videos">
      {seats.map((s) => {
        const seat = seatMediaState(media, s.id, meId);
        const name = nameFor(s.id);
        return (
          <div
            key={s.id}
            role="group"
            aria-label={`${name}${seat.isMe ? ' (you)' : ''}`}
            className={`g-vtile${seat.isMe ? ' is-me' : ''}${s.out ? ' is-out' : ''}${s.active ? ' is-turn' : ''}${
              s.accent ? ' has-accent' : ''
            }`}
            style={s.accent ? ({ '--vt': s.accent } as CSSProperties) : undefined}
            onMouseEnter={onSeatHover ? () => onSeatHover(s.id) : undefined}
            onMouseLeave={onSeatHover ? () => onSeatHover(null) : undefined}
          >
            <SeatMedia seat={seat} media={media} fallback={s.badge} />
            <div className="g-vlabel">
              {!seat.micOn && <MicOff size={13} aria-label="muted" />} {name}
              {seat.isMe ? ' (you)' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
