import { useEffect } from 'react';
import { BackIcon } from '../../../shared/icons';
import { useOnlineSession, type OnlineIntent } from '../../../online/useOnlineSession';
import { useMediaChat } from '../../../online/useMediaChat';
import { nameForPlayer } from '../../../online/seatNames';
import { OnlineLobby } from '../../../online/ui/OnlineLobby';
import { DisconnectBanner } from '../../../online/ui/DisconnectBanner';
import { TurnClock } from '../../../online/ui/TurnClock';
import type { RedactedCluedoState } from '../engine/redact';
import type { CluedoAction } from '../engine/reducer';
import { SUSPECTS } from '../engine/cards';
import { CluedoGame } from './CluedoGame';
import { VideoTiles } from '../../../online/ui/VideoTiles';
import { SUSPECT_COLOR } from './palette';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
];

/** Online Cluedo: lobby, then the shared game screen with video tiles. The
 *  session is persisted (tagged gameId 'cluedo'), so a reload resumes it. */
export function CluedoOnlineGame({
  intent,
  onExit,
  onCode,
}: {
  intent: OnlineIntent;
  onExit: () => void;
  onCode?: (code: string | null) => void;
}) {
  const session = useOnlineSession<RedactedCluedoState, CluedoAction>(intent);
  const { lobby, state, myPlayerId, code, error } = session;

  useEffect(() => {
    onCode?.(code);
  }, [code, onCode]);

  // Audio + video mesh among the human players (bots have no tile).
  const media = useMediaChat({
    socket: session.socket,
    code: session.code,
    myId: session.myPlayerId,
    enabled: !!session.socket && !!session.code && !!session.myPlayerId,
    video: true,
  });

  const nameFor = (id: string) => nameForPlayer(lobby, id);
  const leave = () => {
    session.leave();
    onExit();
  };

  if (error && !state) {
    return (
      <div className="setup-screen g-screen">
        <button type="button" className="back-link" onClick={leave}>
          <BackIcon size={16} />
          Back to games
        </button>
        <header className="g-head">
          <p className="g-eyebrow">Cluedo</p>
          <h1>Can't open this room</h1>
          <p className="tagline">{error}</p>
        </header>
      </div>
    );
  }

  if (state && myPlayerId) {
    const actorId = state.phase === 'disprove' ? state.pendingDisprover : state.players[state.current]?.id;
    const humans = state.players.filter((p) => !p.isAI);
    return (
      <CluedoGame
        view={state}
        meId={myPlayerId}
        nameFor={nameFor}
        onAction={session.dispatch}
        onExit={leave}
        exitLabel="Leave game"
        headerExtra={
          state.phase !== 'over' && actorId ? (
            <TurnClock deadline={lobby?.turnDeadline} label={actorId === myPlayerId ? 'Your turn' : nameFor(actorId)} />
          ) : null
        }
        banner={
          lobby ? (
            // Cluedo can't take a seat out mid-game (its cards must stay in play),
            // so a dropped player is handed to a bot.
            <DisconnectBanner lobby={lobby} waitingOnId={actorId} onReplace={(i) => session.replaceWithAi(i, 'normal')} />
          ) : null
        }
        sideTop={
          humans.length > 1 ? (
            <section className="cl-side-section">
              <h2 className="cl-side-title">At the table</h2>
              <VideoTiles
                seats={humans.map((p) => ({ id: p.id, out: p.eliminated }))}
                meId={myPlayerId}
                nameFor={nameFor}
                media={media}
              />
            </section>
          ) : null
        }
      />
    );
  }

  return (
    <OnlineLobby
      gameId="cluedo"
      title="Cluedo"
      lobby={lobby}
      code={code}
      myPlayerId={myPlayerId}
      difficulties={DIFFICULTIES}
      colorFor={(i) => SUSPECT_COLOR[SUSPECTS[i]]}
      onSetSeatAi={session.setSeatAi}
      onStart={session.start}
      onLeave={leave}
    />
  );
}
