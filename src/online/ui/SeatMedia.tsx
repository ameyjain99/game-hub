import { useEffect, useRef, type ReactNode } from 'react';
import { User, Mic, MicOff, Video, VideoOff } from '../../shared/icons';
import type { MediaChat } from '../useMediaChat';

/** One seat's live media, derived from the media mesh. */
export interface SeatMediaState {
  isMe: boolean;
  stream: MediaStream | null;
  camOn: boolean;
  micOn: boolean;
}

/**
 * A seat's media state. A peer's camera counts as on only once they announce
 * it: before that their stream may carry an empty video track, which would
 * render as a black frame.
 */
export function seatMediaState(media: MediaChat, id: string, meId: string): SeatMediaState {
  const isMe = id === meId;
  const announced = media.peerMedia.get(id);
  return {
    isMe,
    stream: isMe ? media.localStream : media.remoteStreams.get(id) ?? null,
    camOn: isMe ? !media.camOff : announced?.camOn ?? false,
    micOn: isMe ? !media.micMuted : announced?.micOn ?? true,
  };
}

/** A <video> bound to a MediaStream (React has no srcObject prop). Your own
 *  camera is mirrored, like a selfie view; everyone else's reads true. */
function LiveVideo({ stream, isMe }: { stream: MediaStream; isMe: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={`g-video${isMe ? ' is-self' : ''}`} />;
}

/**
 * The media for one seat, shared by every game's video layout: the live video
 * (or `fallback` while the camera is off, or with no media at all), and on your
 * own seat the mic / camera toggles. Each game places this inside its own frame
 * and draws its own label around it.
 */
export function SeatMedia({
  seat,
  media,
  fallback,
}: {
  /** null when the game has no media for this seat (local play, a bot). */
  seat: SeatMediaState | null;
  media: MediaChat | null;
  fallback?: ReactNode;
}) {
  return (
    <>
      {seat?.stream && seat.camOn ? (
        <LiveVideo stream={seat.stream} isMe={seat.isMe} />
      ) : (
        <div className="g-silhouette" aria-label="camera off">
          {fallback ?? <User size={40} strokeWidth={1.5} />}
        </div>
      )}
      {seat?.isMe && media && (
        <div className="g-vcontrols">
          <button
            type="button"
            aria-label={media.micMuted ? 'Turn microphone on' : 'Turn microphone off'}
            onClick={media.toggleMic}
          >
            {media.micMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button
            type="button"
            aria-label={media.camOff ? 'Turn camera on' : 'Turn camera off'}
            onClick={media.toggleCam}
          >
            {media.camOff ? <VideoOff size={15} /> : <Video size={15} />}
          </button>
        </div>
      )}
    </>
  );
}
