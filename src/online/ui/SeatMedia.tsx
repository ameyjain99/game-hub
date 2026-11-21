import { useEffect, useRef, type ReactNode } from 'react';
import { User, Mic, MicOff, Video, VideoOff } from '../../shared/icons';
import type { MediaChat } from '../useMediaChat';

/** One seat's live media, derived from the media mesh. */
export interface SeatMediaState {
  isMe: boolean;
  stream: MediaStream | null;
  camOn: boolean;
  micOn: boolean;
  /** A peer whose call is being re-established (never set for your own seat). */
  reconnecting?: boolean;
  /** Their camera is on but paused towards you, or yours towards someone: the
   *  link is too weak for video, and voices come first. */
  held?: boolean;
}

/**
 * A seat's media state. A peer's camera counts as on only once they announce
 * it: before that their stream may carry an empty video track (black frame).
 */
export function seatMediaState(media: MediaChat, id: string, meId: string): SeatMediaState {
  const isMe = id === meId;
  const announced = media.peerMedia.get(id);
  const held = isMe ? !media.camOff && (media.heldPeers?.length ?? 0) > 0 : !!announced?.camOn && !!announced.videoHeld;
  return {
    isMe,
    held,
    stream: isMe ? media.localStream : media.remoteStreams.get(id) ?? null,
    camOn: isMe ? !media.camOff : (announced?.camOn ?? false) && !announced?.videoHeld,
    micOn: isMe ? !media.micMuted : announced?.micOn ?? true,
    reconnecting: !isMe && media.peerStatus?.get(id) === 'reconnecting',
  };
}

/** A <video> bound to a MediaStream (React has no srcObject prop). Your own
 *  camera is mirrored, like a selfie view; everyone else's reads true. */
export function LiveVideo({ stream, isMe }: { stream: MediaStream; isMe: boolean }) {
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
      {seat?.held && (
        <div className={`g-vnote${seat.isMe ? ' is-mine' : ''}`} role="status">
          {seat.isMe ? 'Your video is paused for some: weak connection' : 'Video paused: weak connection'}
        </div>
      )}
      {seat?.reconnecting && (
        <div className="g-vstatus" role="status">
          Reconnecting...
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
