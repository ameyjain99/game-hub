/** Asked before a click on "Leave" takes a player out of a live game (or a host closes a room people are in). */
export function LeaveConfirm({ lobby = false, onLeave, onStay }: { lobby?: boolean; onLeave: () => void; onStay: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onStay}>
      <div className="modal-card" role="alertdialog" aria-label={lobby ? 'Close the room?' : 'Leave the game?'} onClick={(e) => e.stopPropagation()}>
        <h2>{lobby ? 'Close the room?' : 'Leave the game?'}</h2>
        <p>
          {lobby
            ? 'Everyone waiting here will be sent back, and the room code will stop working.'
            : 'The others carry on without you. While the game is still going you can come back with the invite link and take your seat again.'}
        </p>
        <div className="modal-actions">
          <button type="button" className="g-btn g-btn-ghost" onClick={onStay}>
            Stay
          </button>
          <button type="button" className="primary" onClick={onLeave}>
            {lobby ? 'Close the room' : 'Leave game'}
          </button>
        </div>
      </div>
    </div>
  );
}
