import { useEffect, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { BackIcon } from '../../../shared/icons';
import { playTimeWarning } from '../../../shared/sound';
import { useOnlineSession, type OnlineIntent } from '../../../online/useOnlineSession';
import { useMediaChat, type MediaChat } from '../../../online/useMediaChat';
import { nameForPlayer } from '../../../online/seatNames';
import { OnlineLobby, type DifficultyOption } from '../../../online/ui/OnlineLobby';
import { DisconnectBanner } from '../../../online/ui/DisconnectBanner';
import { TurnClock } from '../../../online/ui/TurnClock';
import { VideoTiles, type VideoSeat } from '../../../online/ui/VideoTiles';
import type { GameKit, KitCommonAction } from '../engine';
import { SideSection } from './GameShell';

/** What an online game adds to the shared screen. */
export interface KitOnlineExtras {
  /** The turn clock for the header. */
  clock: ReactNode;
  /** The disconnected-player banner. */
  banner: ReactNode;
  media: MediaChat;
  /** The live socket and room code (for real-time extras like presence). */
  socket: Socket | null;
  code: string | null;
}

/** The props every kit game's screen takes, local or online. */
export interface KitScreenProps<S, A> {
  view: S;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (action: A | KitCommonAction) => void;
  onExit: () => void;
  exitLabel: string;
  online?: KitOnlineExtras;
}

/** The video table at the top of a sidebar (online, with two or more humans). */
export function KitVideos({
  online,
  seats,
  meId,
  nameFor,
  onSeatHover,
}: {
  online?: KitOnlineExtras;
  seats: VideoSeat[];
  meId: string;
  nameFor: (id: string) => string;
  onSeatHover?: (id: string | null) => void;
}) {
  if (!online || seats.length < 2) return null;
  return (
    <SideSection title="At the table">
      <VideoTiles seats={seats} meId={meId} nameFor={nameFor} media={online.media} onSeatHover={onSeatHover} />
    </SideSection>
  );
}

interface Props<S, A extends { type: string }> {
  kit: GameKit<S, A>;
  gameId: string;
  title: string;
  intent: OnlineIntent;
  onExit: () => void;
  onCode?: (code: string | null) => void;
  /** Bot levels the host can seat; empty for a game without online bots. */
  difficulties: DifficultyOption[];
  colorFor: (seatIndex: number, seatCount: number) => string;
  render: (props: KitScreenProps<S, A>) => ReactNode;
}

/** An online kit game: the lobby, then the game screen with the clock, the
 *  disconnect banner and the video table wired in. */
export function KitOnline<S, A extends { type: string }>({ kit, gameId, title, intent, onExit, onCode, difficulties, colorFor, render }: Props<S, A>) {
  const session = useOnlineSession<S, A | KitCommonAction>(intent);
  const { lobby, state, myPlayerId, code, error } = session;

  useEffect(() => {
    onCode?.(code);
  }, [code, onCode]);

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
          <p className="g-eyebrow">{title}</p>
          <h1>Can't open this room</h1>
          <p className="tagline">{error}</p>
        </header>
      </div>
    );
  }

  if (state && myPlayerId) {
    const actor = kit.actor(state);
    const actorIsHuman = kit.players(state).some((p) => p.id === actor && !p.isAI);
    const clock =
      !kit.isOver(state) && actor && actorIsHuman ? (
        <TurnClock
          deadline={lobby?.turnDeadline}
          label={actor === myPlayerId ? 'Your turn' : nameFor(actor)}
          onGift={actor !== myPlayerId ? session.extendTime : undefined}
          onUrgent={actor === myPlayerId ? playTimeWarning : undefined}
        />
      ) : null;
    const banner = lobby ? (
      <DisconnectBanner
        lobby={lobby}
        waitingOnId={actor}
        onReplace={difficulties.length > 0 ? (i) => session.replaceWithAi(i, 'normal') : undefined}
        onRemove={(i) => session.removeSeat(i)}
      />
    ) : null;
    return render({
      view: state,
      meId: myPlayerId,
      nameFor,
      onAction: session.dispatch,
      onExit: leave,
      exitLabel: 'Leave game',
      online: { clock, banner, media, socket: session.socket, code: session.code },
    });
  }

  return (
    <OnlineLobby
      gameId={gameId}
      title={title}
      lobby={lobby}
      code={code}
      myPlayerId={myPlayerId}
      difficulties={difficulties}
      colorFor={colorFor}
      onSetSeatAi={session.setSeatAi}
      onStart={session.start}
      onLeave={leave}
    />
  );
}
