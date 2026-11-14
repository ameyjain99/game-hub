import { useEffect, type CSSProperties } from 'react';
import { BackIcon } from '../../../shared/icons';
import { useOnlineSession, type OnlineIntent } from '../../../online/useOnlineSession';
import { useMediaChat } from '../../../online/useMediaChat';
import { nameForPlayer } from '../../../online/seatNames';
import { OnlineLobby } from '../../../online/ui/OnlineLobby';
import { DisconnectBanner } from '../../../online/ui/DisconnectBanner';
import { TurnClock } from '../../../online/ui/TurnClock';
import { VideoTiles } from '../../../online/ui/VideoTiles';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { MonopolyGame } from './MonopolyGame';
import { tokenColor, tokenLabel } from './board-layout';
import { playTimeWarning } from './sound';

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];

/** Online Monopoly: lobby, then the shared game screen. The session is persisted
 *  (tagged gameId 'monopoly'), so a reload resumes it. */
export function MonopolyOnlineGame({
  intent,
  onExit,
  onCode,
}: {
  intent: OnlineIntent;
  onExit: () => void;
  onCode?: (code: string | null) => void;
}) {
  const session = useOnlineSession<MonopolyState, Action>(intent);
  const { lobby, state, myPlayerId, code, error } = session;

  useEffect(() => {
    onCode?.(code);
  }, [code, onCode]);

  // Voice + video among the human players: the table talk (bots have no tile).
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
          <p className="g-eyebrow">Monopoly</p>
          <h1>Can’t open this room</h1>
          <p className="tagline">{error}</p>
        </header>
      </div>
    );
  }

  if (state && myPlayerId) {
    const actor = monopolyActor(state);
    const actorIsHuman = state.players.some((p) => p.id === actor && !p.isAI);
    const humans = state.players.filter((p) => !p.isAI);
    const seatColor = (id: string) => tokenColor(state.players.findIndex((p) => p.id === id));
    return (
      <MonopolyGame
        view={state}
        meId={myPlayerId}
        nameFor={nameFor}
        onAction={session.dispatch}
        onExit={leave}
        exitLabel="Leave game"
        headerExtra={
          state.phase !== 'over' && actor ? (
            <TurnClock
              deadline={lobby?.turnDeadline}
              label={actor === myPlayerId ? 'Your turn' : nameFor(actor)}
              onGift={actor !== myPlayerId && actorIsHuman ? session.extendTime : undefined}
              onUrgent={actor === myPlayerId ? playTimeWarning : undefined}
            />
          ) : null
        }
        sideTop={(onSpotlight) =>
          humans.length > 1 ? (
            <section className="mono-side-section">
              <h2 className="mono-side-title">At the table</h2>
              <VideoTiles
                seats={humans.map((p) => ({
                  id: p.id,
                  out: p.bankrupt,
                  accent: seatColor(p.id),
                  active: p.id === actor,
                  badge: (
                    <span className="mono-token is-badge" style={{ '--tc': seatColor(p.id) } as CSSProperties}>
                      {tokenLabel(nameFor(p.id))}
                    </span>
                  ),
                }))}
                meId={myPlayerId}
                nameFor={nameFor}
                media={media}
                onSeatHover={onSpotlight}
              />
            </section>
          ) : null
        }
        banner={
          lobby ? (
            <DisconnectBanner
              lobby={lobby}
              waitingOnId={actor}
              onReplace={(i) => session.replaceWithAi(i, 'normal')}
              onRemove={(i) => session.removeSeat(i)}
            />
          ) : null
        }
      />
    );
  }

  return (
    <OnlineLobby
      gameId="monopoly"
      title="Monopoly"
      lobby={lobby}
      code={code}
      myPlayerId={myPlayerId}
      difficulties={DIFFICULTIES}
      colorFor={tokenColor}
      onSetSeatAi={session.setSeatAi}
      onStart={session.start}
      onLeave={leave}
    />
  );
}
