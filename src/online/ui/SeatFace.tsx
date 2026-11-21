import type { CSSProperties, ReactNode } from 'react';
import { Mic, MicOff, Video, VideoOff } from '../../shared/icons';
import { useTable } from '../TableContext';
import { LiveVideo, seatMediaState } from './SeatMedia';

/**
 * A player's face where they sit: their live camera in a round frame. With the
 * camera off, for a bot, or in a local game it shows `fallback` (the seat's
 * usual token), or nothing when there is none, so a seat looks as it always did.
 */
export function SeatFace({
  id,
  fallback = null,
  className,
  color,
  shape = 'round',
}: {
  id: string;
  fallback?: ReactNode;
  className?: string;
  /** The seat's colour, ringed round the face. */
  color?: string;
  /** Round (a seat on a board) or wide (a card that is mostly the face). */
  shape?: 'round' | 'wide';
}) {
  const table = useTable();
  const seat = table?.media && !table.isBot(id) ? seatMediaState(table.media, id, table.meId) : null;
  if (!seat?.stream || !seat.camOn) return <>{fallback}</>;
  return (
    <span
      className={`g-face${shape === 'wide' ? ' is-wide' : ''}${seat.reconnecting ? ' is-waiting' : ''}${className ? ` ${className}` : ''}`}
      style={color ? ({ '--tc': color } as CSSProperties) : undefined}
      role="img"
      aria-label={`${table!.nameFor(id)}'s camera`}
    >
      <LiveVideo stream={seat.stream} isMe={seat.isMe} />
      {!seat.micOn && (
        <span className="g-face-muted" aria-label="muted">
          <MicOff size={10} />
        </span>
      )}
    </span>
  );
}

/**
 * The people at the table as a strip of faces pinned over the board. On a
 * phone the sidebar (and its video tiles) sits below the board, so without
 * this nobody is in view while you play. Your own face comes first, with your
 * mic and camera switches.
 */
export function FacesStrip({ colorOf }: { colorOf?: (id: string) => string }) {
  const table = useTable();
  const media = table?.media;
  if (!table || !media || table.humans.length < 2) return null;
  const ids = [table.meId, ...table.humans.filter((id) => id !== table.meId)].filter((id) => table.humans.includes(id));
  return (
    <div className="g-faces" aria-label="At the table">
      {ids.map((id) => {
        const me = id === table.meId;
        const seat = table.seatOf(id);
        const letter = table.nameFor(id).trim().slice(0, 1).toUpperCase();
        return (
          <span key={id} className={`g-faces-seat${seat && !seat.connected ? ' is-away' : ''}`} style={colorOf ? ({ '--tc': colorOf(id) } as CSSProperties) : undefined}>
            <SeatFace id={id} color={colorOf?.(id)} fallback={<span className="g-face is-letter">{letter}</span>} />
            <span className="g-faces-name">{me ? 'You' : table.nameFor(id)}</span>
          </span>
        );
      })}
      <span className="g-faces-controls">
        <button type="button" aria-label={media.micMuted ? 'Turn microphone on' : 'Turn microphone off'} aria-pressed={!media.micMuted} onClick={media.toggleMic}>
          {media.micMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button type="button" aria-label={media.camOff ? 'Turn camera on' : 'Turn camera off'} aria-pressed={!media.camOff} onClick={media.toggleCam}>
          {media.camOff ? <VideoOff size={16} /> : <Video size={16} />}
        </button>
      </span>
    </div>
  );
}
