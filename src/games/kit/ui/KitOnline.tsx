import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { playTimeWarning } from '../../../shared/sound';
import { useOnlineSession, type OnlineIntent } from '../../../online/useOnlineSession';
import { useMediaChat, type MediaChat } from '../../../online/useMediaChat';
import { nameForPlayer } from '../../../online/seatNames';
import { OnlineLobby, type DifficultyOption, type LobbyPiece } from '../../../online/ui/OnlineLobby';
import type { RulesFor } from '../../../online/ui/LobbyRules';
import { ActionToast } from '../../../online/ui/ActionToast';
import { LeaveConfirm } from '../../../online/ui/LeaveConfirm';
import { DisconnectBanner, OfflineBanner, ReturnBanner } from '../../../online/ui/DisconnectBanner';
import { PauseButton } from '../../../online/ui/Pause';
import { RoomError } from '../../../online/ui/RoomError';
import { TurnClock } from '../../../online/ui/TurnClock';
import { VideoTiles, type VideoSeat } from '../../../online/ui/VideoTiles';
import type { GameKit, KitCommonAction } from '../engine';
import { SideSection } from './GameShell';
import { TableProvider, useTableState } from '../../../online/TableContext';
import { OpeningCall, useGameStart } from '../../../shared/ui/OpeningCall';

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
    <SideSection title="At the table" className="kit-videos">
      <VideoTiles seats={seats} meId={meId} nameFor={nameFor} media={online.media} onSeatHover={onSeatHover} />
    </SideSection>
  );
}

/** The seat counts a game's online room may have (set by KitApp from the game's config), so the host can add or remove a seat in the lobby. */
export const OnlineSeatsContext = createContext<number[] | undefined>(undefined);

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
  /** How the lobby shows this game's options to guests, and lets the host change them. */
  rulesFor?: RulesFor;
  /** The pieces a player can pick in the lobby (a character, a colour, a pawn). */
  pieces?: LobbyPiece[];
}

/** An online kit game: the lobby, then the game screen with the clock, the
 *  disconnect banner and the video table wired in. */
export function KitOnline<S, A extends { type: string }>({ kit, gameId, title, intent, onExit, onCode, difficulties, colorFor, render, rulesFor, pieces }: Props<S, A>) {
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
  const paused = !!lobby?.paused;
  const setPaused = session.setPaused;
  const togglePause = useCallback(() => setPaused(!paused), [setPaused, paused]);
  const table = useTableState({ meId: myPlayerId ?? '', nameFor, players: state ? kit.players(state) : [], media, lobby, onPause: state ? togglePause : undefined });
  const seatCounts = useContext(OnlineSeatsContext);
  // Who goes first, said once as the game starts: only for players who were in the lobby when it did.
  const sawLobby = useRef(false);
  if (lobby && !lobby.started) sawLobby.current = true;
  const start = useGameStart(!!state, !!state && kit.isOver(state), sawLobby.current);
  const first = state && kit.players(state).length > 1 ? kit.players(state).find((p) => p.id === kit.actor(state)) : undefined;
  const [leaving, setLeaving] = useState(false);
  const leave = () => {
    session.leave();
    onExit();
  };
  const isHost = !!lobby && myPlayerId === `p${lobby.hostIndex}`;
  const others = lobby ? lobby.seats.filter((s) => !s.isAI && s.name !== null).length - 1 : 0;
  // Leaving a game under way (or closing a room people are waiting in) asks first.
  const askLeave = () => {
    const live = state ? !kit.isOver(state) : isHost && others > 0;
    if (live) setLeaving(true);
    else leave();
  };
  const extras = (
    <>
      <ActionToast message={error} onDone={session.clearError} />
      {leaving && <LeaveConfirm lobby={!state} onLeave={leave} onStay={() => setLeaving(false)} />}
    </>
  );

  // Never got into the room at all: there is nothing behind the message to return to.
  if (error && !state && !lobby) return <RoomError game={title} gameId={gameId} code={code} error={error} onBack={leave} />;

  if (state && myPlayerId) {
    const actor = kit.actor(state);
    const actorIsHuman = kit.players(state).some((p) => p.id === actor && !p.isAI);
    const live = !kit.isOver(state);
    const clock = (
      <>
        {live && actor && actorIsHuman && !lobby?.clocks && (
          <TurnClock
            deadline={lobby?.turnDeadline}
            label={actor === myPlayerId ? 'Your turn' : nameFor(actor)}
            onGift={actor !== myPlayerId ? session.extendTime : undefined}
            onUrgent={actor === myPlayerId ? playTimeWarning : undefined}
          />
        )}
        {live && <PauseButton />}
      </>
    );
    const banner = (
      <>
        <OfflineBanner connected={session.connected} />
        {lobby && session.connected && <ReturnBanner lobby={lobby} />}
        {lobby && session.connected && (
          <DisconnectBanner
            lobby={lobby}
            waitingOnId={actor}
            onReplace={difficulties.length > 0 ? (i) => session.replaceWithAi(i, 'normal') : undefined}
            onRemove={(i) => session.removeSeat(i)}
          />
        )}
      </>
    );
    return (
      <TableProvider value={table}>
        {render({
          view: state,
          meId: myPlayerId,
          nameFor,
          onAction: session.dispatch,
          onExit: askLeave,
          exitLabel: 'Leave game',
          online: { clock, banner, media, socket: session.socket, code: session.code },
        })}
        {extras}
        <OpeningCall start={start} name={first ? nameFor(first.id) : null} isMe={first?.id === myPlayerId} color={first ? colorFor(kit.players(state).indexOf(first), kit.players(state).length) : undefined} />
      </TableProvider>
    );
  }

  return (
    <>
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
      onLeave={askLeave}
      media={media}
      rules={lobby && rulesFor ? rulesFor(lobby.options, isHost ? session.setOptions : null) : undefined}
      pieces={pieces}
      onPickPiece={session.setAvatar}
      seatCounts={seatCounts}
      onSeatCount={session.setSeatCount}
    />
    {extras}
    </>
  );
}
