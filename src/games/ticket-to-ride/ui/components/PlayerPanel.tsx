import type { CSSProperties } from 'react';
import type { PlayerState } from '../../engine/types';
import type { MediaChat } from '../../../../online/useMediaChat';
import { SeatMedia, seatMediaState } from '../../../../online/ui/SeatMedia';
import { cleanName } from '../displayName';
import { User, MicOff } from '../../../../shared/icons';

interface Props {
  player: PlayerState;
  color: string;
  isCurrent: boolean;
  cardCount: number;
  /** Hover to spotlight this player's trains on the board. */
  onHover?: (hovering: boolean) => void;
  /** The media mesh, in online games for human seats; drives the video frame. */
  media?: MediaChat;
  /** Whose screen this is (marks your own frame and its controls). */
  viewerId?: string | null;
}

/** A player's card: a video frame (the shared SeatMedia) with their name and
 *  score over it, then their trains, cards and tickets. */
export function PlayerPanel({ player, color, isCurrent, cardCount, onHover, media, viewerId }: Props) {
  const seat = media ? seatMediaState(media, player.id, viewerId ?? '') : null;
  return (
    <div
      className={`player-panel${isCurrent ? ' current' : ''}${seat?.isMe ? ' is-me' : ''}`}
      data-player-id={player.id}
      style={{ '--pc': color } as CSSProperties}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <div className="player-media">
        <SeatMedia
          seat={seat}
          media={media ?? null}
          fallback={
            player.avatar ? (
              <span className="player-silhouette-avatar">{player.avatar}</span>
            ) : (
              <User size={30} strokeWidth={1.5} />
            )
          }
        />

        <div className="player-overlay">
          <span className="player-name">
            {seat && !seat.micOn && <MicOff size={12} aria-label="muted" />}
            {cleanName(player.name)}
            {player.isAI ? ` (${player.difficulty ?? 'AI'})` : ''}
            {seat?.isMe ? ' (you)' : ''}
          </span>
          <span className="player-score">{player.score}</span>
        </div>
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
