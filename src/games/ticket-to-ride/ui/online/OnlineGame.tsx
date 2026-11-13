import { useEffect } from 'react';
import { GameScreen } from '../GameScreen';
import { LobbyScreen } from '../LobbyScreen';
import { DisconnectOverlay } from './DisconnectOverlay';
import { Loader } from '../../../../shared/Loader';
import { useOnlineSession, type OnlineIntent } from '../../../../online/useOnlineSession';
import { useMediaChat } from '../../../../online/useMediaChat';
import type { GameState } from '../../engine/types';
import type { Action } from '../../engine/actions';

export type { OnlineIntent };

const seatIndexOf = (playerId: string | null): number =>
  playerId ? Number(playerId.slice(1)) : -1;

export function OnlineGame({
  intent,
  onExit,
  onCode,
}: {
  intent: OnlineIntent;
  onExit?: () => void;
  /** Reports the room code so the URL can show `/ticket-to-ride/<code>`. */
  onCode?: (code: string | null) => void;
}) {
  const session = useOnlineSession<GameState, Action>(intent);
  const { lobby, state, myPlayerId, code, socket, error } = session;
  const isHost = lobby ? lobby.hostIndex === seatIndexOf(myPlayerId) : false;

  useEffect(() => {
    onCode?.(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // A/V mesh among the human players — rendered as each seat's video frame in
  // the right pane (replaces the old single header mic button).
  const media = useMediaChat({
    socket,
    code,
    myId: myPlayerId,
    enabled: !!socket && !!code && !!myPlayerId,
    video: true,
  });

  const leave = () => {
    session.leave();
    onExit?.();
  };

  if (!lobby && !state) {
    if (!error) return <Loader full label="Connecting…" />;
    return (
      <div className="setup-screen">
        <h1>Could not join</h1>
        <p className="error">{error}</p>
        {onExit && (
          <button type="button" className="primary" onClick={onExit}>
            Back to home
          </button>
        )}
      </div>
    );
  }

  if (!state) {
    return (
      <LobbyScreen
        lobby={lobby!}
        isHost={isHost}
        mySeatIndex={seatIndexOf(myPlayerId)}
        onSetSeatAi={session.setSeatAi}
        onSetAvatar={session.setAvatar}
        onStart={session.start}
        onLeave={leave}
      />
    );
  }

  // No disconnect banner once the game is over — leaving is fine at that point.
  const currentId = state.phase === 'game-over' ? '' : (state.players[state.current]?.id ?? '');
  return (
    <>
      {lobby && (
        <DisconnectOverlay
          lobby={lobby}
          currentPlayerId={currentId}
          onReplace={(i) => session.replaceWithAi(i)}
          onRemove={(i) => session.removeSeat(i)}
        />
      )}
      <GameScreen
        state={state}
        lastError={error}
        dispatch={session.dispatch}
        viewerId={myPlayerId ?? undefined}
        onExit={leave}
        media={media}
        turnDeadline={lobby?.turnDeadline ?? null}
        onExtendTime={session.extendTime}
      />
    </>
  );
}
