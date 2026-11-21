import { BackIcon } from '../../shared/icons';

/** What went wrong opening a room, in words a player can act on. */
export function roomErrorText(error: string): string {
  switch (error) {
    case 'game already started':
      return "This game has already started and every seat is taken, so it can't be joined now.";
    case 'removed from game':
      return 'The other players removed your seat from this game while you were away.';
    case 'unknown token':
      return "This browser's saved seat no longer works. If you were playing, you can take your seat back.";
    case 'no such room':
      return 'This room has closed.';
    case 'room is full':
      return 'This room is full.';
    default:
      return error;
  }
}

/** The screen shown when a room can't be opened. A lost seat offers the way back in. */
export function RoomError({
  game,
  gameId,
  code,
  error,
  onBack,
}: {
  game: string;
  gameId: string;
  code: string | null;
  error: string;
  onBack: () => void;
}) {
  return (
    <div className="setup-screen g-screen">
      <button type="button" className="back-link" onClick={onBack}>
        <BackIcon size={16} />
        Back to games
      </button>
      <header className="g-head">
        <p className="g-eyebrow">{game}</p>
        <h1>Can't open this room</h1>
        <p className="tagline">{roomErrorText(error)}</p>
      </header>
      {error === 'unknown token' && code && (
        <a className="g-btn primary" href={`/${gameId}/join?room=${code}`}>
          Rejoin room {code}
        </a>
      )}
    </div>
  );
}
