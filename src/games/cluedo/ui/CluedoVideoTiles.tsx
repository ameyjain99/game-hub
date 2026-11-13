import { useEffect, useRef } from 'react';
import { User, Mic, MicOff, Video, VideoOff } from '../../../shared/icons';
import type { MediaChat } from '../../../online/useMediaChat';
import type { RedactedPlayer } from '../engine/redact';

/** A <video> bound to a MediaStream (React has no srcObject prop). */
function VideoTile({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="cluedo-video" />;
}

/** A row of player video tiles. The self tile shows mic/cam toggles on hover;
 * a cam that's off (yours or a peer's) shows a silhouette. */
export function CluedoVideoTiles({
  players,
  meId,
  nameFor,
  media,
}: {
  players: RedactedPlayer[];
  meId: string;
  nameFor: (id: string) => string;
  media: MediaChat;
}) {
  return (
    <div className="cluedo-videos">
      {players.map((p) => {
        const isMe = p.id === meId;
        const stream = isMe ? media.localStream : media.remoteStreams.get(p.id) ?? null;
        const pm = media.peerMedia.get(p.id);
        const camOn = isMe ? !media.camOff : pm ? pm.camOn : !!stream;
        const micOn = isMe ? !media.micMuted : pm?.micOn ?? true;

        return (
          <div key={p.id} className={`cluedo-vtile${isMe ? ' is-me' : ''}${p.eliminated ? ' is-out' : ''}`}>
            {stream && camOn ? (
              <VideoTile stream={stream} />
            ) : (
              <div className="cluedo-silhouette" aria-label="camera off">
                <User size={40} strokeWidth={1.5} />
              </div>
            )}

            <div className="cluedo-vlabel">
              {!micOn && <MicOff size={13} aria-label="muted" />} {nameFor(p.id)}
              {isMe ? ' (you)' : ''}
            </div>

            {isMe && (
              <div className="cluedo-vcontrols">
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
          </div>
        );
      })}
    </div>
  );
}
