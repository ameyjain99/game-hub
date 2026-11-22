import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useOnlineSession, type OnlineIntent } from '../../../online/useOnlineSession';
import { useMediaChat } from '../../../online/useMediaChat';
import { nameForPlayer } from '../../../online/seatNames';
import { OnlineLobby } from '../../../online/ui/OnlineLobby';
import { DisconnectBanner, OfflineBanner, ReturnBanner } from '../../../online/ui/DisconnectBanner';
import { PauseButton } from '../../../online/ui/Pause';
import { TableProvider, useTableState } from '../../../online/TableContext';
import { ActionToast } from '../../../online/ui/ActionToast';
import { LeaveConfirm } from '../../../online/ui/LeaveConfirm';
import { TOKEN_PIECES } from '../../../online/ui/tokenPieces';
import type { RulesFor } from '../../../online/ui/LobbyRules';
import { DEFAULT_SETTINGS, type Settings } from '../engine/state';
import { BoardField, HOUSE_RULES, HouseRuleSwitches, RoundLimitField, StartingCashField, cashForBoard, numberRuleSummary } from './MonopolyRules';
import { BOARDS, boardOf, formatMoney } from '../engine/board';
import { RoomError } from '../../../online/ui/RoomError';
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

/** The room's settings as the lobby shows them: a line each for guests, the same switches as the create screen for the host. */
const lobbyRules: RulesFor = (options, onChange) => {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...((options ?? {}) as Partial<Settings>) };
  const on = HOUSE_RULES.filter((r) => settings[r.key]);
  return {
    summary: [`Board: ${BOARDS.find((b) => b.id === boardOf(settings.board))!.name}`, `Starting cash ${formatMoney(settings.startingCash, boardOf(settings.board))}`, settings.roundLimit > 0 ? `${settings.roundLimit} rounds` : 'Until one player is left', ...on.map((r) => r.label), ...numberRuleSummary(settings)],
    editor: onChange ? (
      <>
        <BoardField value={boardOf(settings.board)} onChange={(board) => onChange({ ...settings, board, startingCash: cashForBoard(settings.startingCash, boardOf(settings.board), board) })} />
        <StartingCashField board={boardOf(settings.board)} value={settings.startingCash} onChange={(startingCash) => onChange({ ...settings, startingCash })} />
        <RoundLimitField value={settings.roundLimit} onChange={(roundLimit) => onChange({ ...settings, roundLimit })} />
        <div className="g-field">
          <span className="g-field-label">House rules</span>
          <HouseRuleSwitches value={settings} onChange={onChange} />
        </div>
      </>
    ) : undefined,
  };
};

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
  const paused = !!lobby?.paused;
  const setPaused = session.setPaused;
  const togglePause = useCallback(() => setPaused(!paused), [setPaused, paused]);
  const table = useTableState({ meId: myPlayerId ?? '', nameFor, players: state?.players ?? [], media, lobby, onPause: state ? togglePause : undefined });
  const [leaving, setLeaving] = useState(false);
  const leave = () => {
    session.leave();
    onExit();
  };
  const isHost = !!lobby && myPlayerId === `p${lobby.hostIndex}`;
  const others = lobby ? lobby.seats.filter((s) => !s.isAI && s.name !== null).length - 1 : 0;
  // Leaving a game under way (or closing a room people are waiting in) asks first.
  const askLeave = () => {
    const live = state ? state.phase !== 'over' : isHost && others > 0;
    if (live) setLeaving(true);
    else leave();
  };
  const extras = (
    <>
      <ActionToast message={error} onDone={session.clearError} />
      {leaving && <LeaveConfirm lobby={!state} onLeave={leave} onStay={() => setLeaving(false)} />}
    </>
  );

  if (error && !state && !lobby) return <RoomError game="Monopoly" gameId="monopoly" code={code} error={error} onBack={leave} />;

  if (state && myPlayerId) {
    const actor = monopolyActor(state);
    const actorIsHuman = state.players.some((p) => p.id === actor && !p.isAI);
    const humans = state.players.filter((p) => !p.isAI);
    const seatColor = (id: string) => tokenColor(state.players.findIndex((p) => p.id === id));
    return (
      <TableProvider value={table}>
      <MonopolyGame
        view={state}
        meId={myPlayerId}
        nameFor={nameFor}
        onAction={session.dispatch}
        onExit={askLeave}
        exitLabel="Leave game"
        headerExtra={
          state.phase !== 'over' ? (
            <>
              {actor && (
                <TurnClock
                  deadline={lobby?.turnDeadline}
                  label={actor === myPlayerId ? 'Your turn' : nameFor(actor)}
                  onGift={actor !== myPlayerId && actorIsHuman ? session.extendTime : undefined}
                  onUrgent={actor === myPlayerId ? playTimeWarning : undefined}
                />
              )}
              <PauseButton />
            </>
          ) : null
        }
        sideTop={(onSpotlight) =>
          humans.length > 1 ? (
            <section className="mono-side-section mono-videos">
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
          <>
            <OfflineBanner connected={session.connected} />
            {lobby && session.connected && <ReturnBanner lobby={lobby} />}
            {lobby && session.connected && (
              <DisconnectBanner
                lobby={lobby}
                waitingOnId={actor}
                onReplace={(i) => session.replaceWithAi(i, 'normal')}
                onRemove={(i) => session.removeSeat(i)}
              />
            )}
          </>
        }
      />
      {extras}
      </TableProvider>
    );
  }

  return (
    <>
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
      onLeave={askLeave}
      media={media}
      rules={lobby ? lobbyRules(lobby.options, isHost ? session.setOptions : null) : undefined}
      pieces={TOKEN_PIECES}
      onPickPiece={session.setAvatar}
      seatCounts={[2, 3, 4, 5, 6]}
      onSeatCount={session.setSeatCount}
    />
    {extras}
    </>
  );
}
