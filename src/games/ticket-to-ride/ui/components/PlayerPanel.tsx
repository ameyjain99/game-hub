import { useEffect, useRef, type CSSProperties } from 'react';
import type { PlayerState } from '../../engine/types';
import { cleanName } from '../displayName';
import { User, Mic, MicOff, Video, VideoOff } from '../../../../shared/icons';

/** Per-player media for the card's video frame (online games only). */
export interface PanelMedia {
  isMe: boolean;
  stream: MediaStream | null;
  camOn: boolean;
  micOn: boolean;
  micMuted: boolean;
  camOff: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

/** A <video> bound to a MediaStream (React has no srcObject prop). */
function VideoTile({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="player-video" />;
}

interface Props {
  player: PlayerState;
  color: string;
  isCurrent: boolean;
  cardCount: number;
  /** Hover to spotlight this player's trains on the board. */
  onHover?: (hovering: boolean) => void;
  /** Present in online games for human seats; drives the card's video frame. */
  media?: PanelMedia;
}

export function PlayerPanel({ player, color, isCurrent, cardCount, onHover, media }: Props) {
  const showVideo = !!media && !!media.stream && media.camOn;
  return (
    <div
      className={`player-panel${isCurrent ? ' current' : ''}${media?.isMe ? ' is-me' : ''}`}
      data-player-id={player.id}
      style={{ '--pc': color } as CSSProperties}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <div className="player-media">
        {showVideo ? (
          <VideoTile stream={media!.stream!} />
        ) : (
          <div className="player-silhouette" aria-hidden>
            {player.avatar ? (
              <span className="player-silhouette-avatar">{player.avatar}</span>
            ) : (
              <User size={30} strokeWidth={1.5} />
            )}
          </div>
        )}

        <div className="player-overlay">
          <span className="player-name">
            {media && !media.micOn && <MicOff size={12} aria-label="muted" />}
            {cleanName(player.name)}
            {player.isAI ? ` (${player.difficulty ?? 'AI'})` : ''}
            {media?.isMe ? ' (you)' : ''}
          </span>
          <span className="player-score">{player.score}</span>
        </div>

        {media?.isMe && (
          <div className="player-vcontrols">
            <button
              type="button"
              onClick={media.onToggleMic}
              aria-label={media.micMuted ? 'Turn microphone on' : 'Turn microphone off'}
            >
              {media.micMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              type="button"
              onClick={media.onToggleCam}
              aria-label={media.camOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {media.camOff ? <VideoOff size={14} /> : <Video size={14} />}
            </button>
          </div>
        )}
      </div>

      <div className="player-stats">
        <span className="stat trains" title="Train pieces left to play">
          <b>{player.trainsLeft}</b> trains
        </span>
        <span className="stat" title="Cards in hand">
          <b>{cardCount}</b> cards
        </span>
        <span className="stat" title="Destination tickets">
          <b>{player.tickets.length}</b> tickets
        </span>
      </div>
    </div>
  );
}
