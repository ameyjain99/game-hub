import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { CloseIcon, BookOpen, Volume2, VolumeX } from '../../../shared/icons';
import type { MediaChat } from '../../../online/useMediaChat';
import type { CardCombo, GameState, Hand as HandType, TrainCard } from '../engine/types';
import type { Action } from '../engine/actions';
import { legalActions, getRoute } from '../engine/selectors';
import { getMap, modeFor } from '../engine/maps';
import { isMuted, setMuted, playClaim, playLastRound, playTurn, playTimeWarning } from './sound';
import { Board } from './components/Board';
import { Market } from './components/Market';
import { Hand } from './components/Hand';
import { PlayerPanel } from './components/PlayerPanel';
import { ClaimDialog } from './components/ClaimDialog';
import { TunnelDialog } from './components/TunnelDialog';
import { Commentary } from './components/Commentary';
import { TicketSelect } from './components/TicketSelect';
import { TicketCard } from './components/TicketCard';
import { FinalScores, ResultDetail, rankPlayers } from './components/FinalResults';
import { LongestPathOutline, TicketRings } from './components/ResultOverlays';
import { areConnected, longestPathThrough } from '../engine/graph';
import { playerColor } from './colors';
import { cleanName } from './displayName';

interface Props {
  state: GameState;
  lastError: string | null;
  dispatch: (action: Action) => void;
  /** Shown as "Play again" (top-right) once the game is over. */
  onPlayAgain?: () => void;
  /** Leave the game (top-right exit). */
  onExit?: () => void;
  /** Online play: render from this player's fixed perspective. Omit for local hotseat/AI. */
  viewerId?: string;
  /** Online A/V mesh — drives the per-player video frames in the right pane. */
  media?: MediaChat;
  /** Epoch ms the current player's turn must end by (online turn clock), or null. */
  turnDeadline?: number | null;
  /** Grant the current player +20s (used by the low-on-time popup). */
  onExtendTime?: () => void;
}

function handCount(hand: GameState['players'][number]['hand']): number {
  return Object.values(hand).reduce((a, b) => a + b, 0);
}

/** Natural-language list of drawn cards, e.g. "a red card" or "red and blue cards". */
function formatCards(cards: TrainCard[]): string {
  const labels = cards.map((c) => (c === 'locomotive' ? 'locomotive' : c));
  if (labels.length === 1) return `a ${labels[0]} card`;
  const last = labels[labels.length - 1];
  return `${labels.slice(0, -1).join(', ')} and ${last} cards`;
}

export function GameScreen({ state, lastError, dispatch: rawDispatch, onPlayAgain, onExit, viewerId, media, turnDeadline, onExtendTime }: Props) {
  const [claimRouteId, setClaimRouteId] = useState<string | null>(null);
  const [hoverCities, setHoverCities] = useState<Set<string> | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [placingStation, setPlacingStation] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showLastRound, setShowLastRound] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  // Transient, per-viewer feedback shown in the bottom bar: what you just drew,
  // and a blink when your turn begins. Only ever rendered on this device's screen.
  const [drawFlash, setDrawFlash] = useState<string | null>(null);
  const [yourTurnFlash, setYourTurnFlash] = useState(false);
  const snapRef = useRef<{ id: string; hand: HandType; tickets: number } | null>(null);
  const drawAccumRef = useRef<TrainCard[]>([]);
  const drawTimerRef = useRef<number | null>(null);
  const turnTimerRef = useRef<number | null>(null);
  const prevActingRef = useRef(false);

  // Any action the player takes hides the "it's your turn" cue — and the
  // last-round banner, which clears the moment they play their final turn.
  const dispatch = (action: Action) => {
    setYourTurnFlash(false);
    setShowLastRound(false);
    rawDispatch(action);
  };

  // Sound: a "thunk" whenever a new route gets claimed (by anyone), and a siren
  // the moment the end-game trigger fires. Both are driven off broadcast state,
  // so every player's screen reacts, not just the mover's.
  const claimedCount = Object.keys(state.claimedBy).length;
  const prevClaimed = useRef(claimedCount);
  useEffect(() => {
    if (claimedCount > prevClaimed.current) playClaim();
    prevClaimed.current = claimedCount;
  }, [claimedCount]);

  const prevFinal = useRef(state.finalTurnsLeft);
  useEffect(() => {
    if (prevFinal.current === null && state.finalTurnsLeft !== null) {
      setShowLastRound(true);
      playLastRound();
    }
    prevFinal.current = state.finalTurnsLeft;
  }, [state.finalTurnsLeft]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // Hover a player's panel to spotlight all of their claimed routes.
  const [hoverPlayerId, setHoverPlayerId] = useState<string | null>(null);
  // Hover a claimed route for ≥200ms to trace its owner's longest path through it.
  const [hoverAnchor, setHoverAnchor] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  const handleRouteHover = (routeId: string | null) => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (!routeId || gameOver || !state.claimedBy[routeId]) {
      setHoverAnchor(null);
      return;
    }
    hoverTimer.current = window.setTimeout(() => setHoverAnchor(routeId), 200);
  };
  const hoverChain = useMemo(() => {
    if (!hoverAnchor) return null;
    const owner = state.claimedBy[hoverAnchor];
    if (!owner) return null;
    const ownerRoutes = Object.keys(state.claimedBy).filter((id) => state.claimedBy[id] === owner);
    const ids = longestPathThrough(ownerRoutes, hoverAnchor);
    if (ids.length === 0) return null;
    const length = ids.reduce((sum, id) => sum + (getRoute(id)?.length ?? 0), 0);
    return { ids: new Set(ids), length };
  }, [hoverAnchor, state.claimedBy]);

  // All routes owned by the hovered player (spotlighted when their panel is hovered).
  const playerHighlight = useMemo(() => {
    if (!hoverPlayerId) return null;
    const ids = Object.keys(state.claimedBy).filter((id) => state.claimedBy[id] === hoverPlayerId);
    return ids.length > 0 ? new Set(ids) : null;
  }, [hoverPlayerId, state.claimedBy]);

  const gameMap = getMap(state.mapId);
  const rulebook = modeFor(state.mapId).rulebook;
  const gameOver = state.phase === 'game-over';
  const current = state.players[state.current];
  const currentIsHuman = !gameOver && state.phase !== 'setup-tickets' && !current.isAI;

  const online = viewerId != null;
  const viewer = online ? state.players.find((p) => p.id === viewerId) : undefined;
  // Whether the player "at the device" may act now: the current human in local
  // play, or the viewer on their own turn in online play.
  const actingAllowed = online
    ? !gameOver && state.phase !== 'setup-tickets' && current.id === viewerId
    : currentIsHuman;

  // ---- Online turn clock ----
  // Tick a few times a second while a clock runs, so the countdown and the
  // 10s/5s thresholds stay live without a full-second lag.
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (turnDeadline == null) return;
    const id = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [turnDeadline]);

  const remainingMs = online && turnDeadline != null ? Math.max(0, turnDeadline - clockNow) : null;
  const remainingSec = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;
  const myClock = remainingSec != null && current.id === viewerId; // my turn is on the clock
  // Others see a popup to gift the current (human) player more time once they're low.
  const showExtendPopup =
    remainingSec != null && remainingSec <= 10 && current.id !== viewerId && !current.isAI;

  // A gentle alarm on my own clock at ≤5s — once per deadline value.
  const warnedDeadlineRef = useRef<number | null>(null);
  useEffect(() => {
    if (myClock && remainingSec != null && remainingSec <= 5) {
      if (warnedDeadlineRef.current !== turnDeadline) {
        warnedDeadlineRef.current = turnDeadline ?? null;
        playTimeWarning();
      }
    }
  }, [myClock, remainingSec, turnDeadline]);

  // Blink "IT'S YOUR TURN!!" the moment this device's player gains the turn.
  useEffect(() => {
    if (actingAllowed && !prevActingRef.current) {
      setYourTurnFlash(true);
      playTurn();
      // A new turn clears the previous turn's draw note, so "IT'S YOUR TURN"
      // never shows stacked under a stale "You drew …" message.
      setDrawFlash(null);
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
      drawAccumRef.current = []; // fresh turn → don't combine with last turn's draws
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      turnTimerRef.current = window.setTimeout(() => setYourTurnFlash(false), 5000);
    }
    if (!actingAllowed) setYourTurnFlash(false);
    prevActingRef.current = actingAllowed;
  }, [actingAllowed]);

  useEffect(
    () => () => {
      if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
    },
    [],
  );

  // Game over: players ranked by score; the one inspected on the board defaults to the winner.
  const ranked = gameOver ? rankPlayers(state) : [];
  const resultRanked = gameOver ? (ranked.find((r) => r.player.id === resultId) ?? ranked[0]) : undefined;
  const resultPlayer = resultRanked?.player;

  // Setup: the first human still choosing tickets.
  const setupHuman =
    state.phase === 'setup-tickets'
      ? state.players.find((p) => !p.isAI && p.pendingTickets.length > 0)
      : undefined;
  // Who the setup ticket-picker is for: the viewer's own pending tickets online,
  // whichever human is up locally.
  const activeSetup = online
    ? state.phase === 'setup-tickets' && viewer && viewer.pendingTickets.length > 0
      ? viewer
      : undefined
    : setupHuman;

  // The human "at the device": whose hand/tickets we may show. Never a bot, so a
  // bot's hand is never revealed. Solo game => always the one human; hotseat =>
  // the current human, falling back to the first human while a bot is playing.
  const firstHuman = state.players.find((p) => !p.isAI);
  const viewing = online
    ? (viewer ?? current)
    : (setupHuman ?? (currentIsHuman ? current : undefined) ?? firstHuman ?? current);

  const flashDraw = (msg: string) => {
    setDrawFlash(msg);
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    // Only hide the message on the timer; the accumulator is flushed per turn.
    drawTimerRef.current = window.setTimeout(() => setDrawFlash(null), 3000);
  };

  // Flash what the device's player just drew. The viewer's own hand/tickets only
  // rise when they draw, so a positive diff against the last snapshot is a pickup.
  useEffect(() => {
    const prev = snapRef.current;
    snapRef.current = { id: viewing.id, hand: viewing.hand, tickets: viewing.tickets.length };
    if (!prev || prev.id !== viewing.id) {
      drawAccumRef.current = []; // new viewer (hotseat) → fresh accumulation
      return;
    }
    const added: TrainCard[] = [];
    (Object.keys(viewing.hand) as TrainCard[]).forEach((c) => {
      const d = (viewing.hand[c] ?? 0) - (prev.hand[c] ?? 0);
      for (let k = 0; k < d; k++) added.push(c);
    });
    if (added.length > 0) {
      drawAccumRef.current.push(...added);
      flashDraw(`You drew ${formatCards(drawAccumRef.current)}.`);
      return;
    }
    const ticketsAdded = viewing.tickets.length - prev.tickets;
    if (ticketsAdded > 0) {
      drawAccumRef.current = [];
      flashDraw(`You drew ${ticketsAdded} destination ticket${ticketsAdded > 1 ? 's' : ''}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing.hand, viewing.tickets, viewing.id]);

  // Legal-action-derived affordances for the player who may act.
  const legal = actingAllowed ? legalActions(state, current.id) : [];
  const claimableRouteIds = useMemo(
    () =>
      new Set(
        legal
          .filter((a): a is Extract<Action, { type: 'CLAIM_ROUTE' }> => a.type === 'CLAIM_ROUTE')
          .map((a) => a.routeId),
      ),
    [legal],
  );
  const canDraw = legal.some((a) => a.type === 'DRAW_TRAIN');
  const canDrawTickets = legal.some((a) => a.type === 'DRAW_TICKETS');

  // Train stations (Europe): where the viewer can place, and who owns which.
  const stationActions = useMemo(
    () => legal.filter((a): a is Extract<Action, { type: 'PLACE_STATION' }> => a.type === 'PLACE_STATION'),
    [legal],
  );
  const canPlaceStation = stationActions.length > 0;
  const placing = placingStation && canPlaceStation;
  const stationColors = useMemo(() => {
    const m: Record<string, string> = {};
    state.players.forEach((p, i) => {
      for (const c of p.stations) m[c] = playerColor(i);
    });
    return m;
  }, [state.players]);

  // Persistent subtle highlight: endpoints of the viewing human's own tickets
  // (kept, plus the ones being chosen during setup). Never an AI's tickets.
  const subtleCityIds = useMemo(() => {
    const set = new Set<string>();
    if (viewing.isAI || gameOver) return set;
    const src =
      state.phase === 'setup-tickets'
        ? [...viewing.tickets, ...viewing.pendingTickets]
        : viewing.tickets;
    for (const t of src) {
      set.add(t.a);
      set.add(t.b);
    }
    return set;
  }, [viewing, state.phase, gameOver]);

  // At game over, fade everyone but the inspected player so their trains stand out.
  const playerColors = useMemo(() => {
    const m: Record<string, string> = {};
    state.players.forEach((p, i) => {
      const faded = resultPlayer && p.id !== resultPlayer.id;
      m[p.id] = faded ? `${playerColor(i)}59` : playerColor(i);
    });
    return m;
  }, [state.players, resultPlayer]);

  // Owner avatar per player, for a badge on their claimed routes.
  const playerAvatars = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of state.players) if (p.avatar) m[p.id] = p.avatar;
    return m;
  }, [state.players]);

  const onConfirmClaim = (combo: CardCombo) => {
    if (claimRouteId) dispatch({ type: 'CLAIM_ROUTE', routeId: claimRouteId, combo });
    setClaimRouteId(null);
  };

  // Possessive label, so "You" reads "Your …" not "You's …".
  const poss = viewing.name === 'You' ? 'Your' : `${cleanName(viewing.name)}'s`;

  // The right side pane holds an active choice (claim / ticket selection) or, once
  // the game is over, the final results; it collapses when idle so the board gets the space.
  const drawingTickets = state.phase === 'draw-tickets' && actingAllowed;
  const tunnelDecision =
    state.phase === 'tunnel-decision' && actingAllowed ? state.pendingTunnel : null;

  let status: string;
  if (gameOver) {
    const winners = ranked
      .filter((r) => r.score.total === ranked[0].score.total)
      .map((r) => r.player.name);
    const verb = winners.length > 1 ? 'tie' : winners[0] === 'You' ? 'win' : 'wins';
    status = `Game over — ${winners.join(' & ')} ${verb}!`;
  } else if (state.phase === 'setup-tickets') {
    status = 'Choose your destination tickets…';
  } else if (state.phase === 'tunnel-decision') {
    status = `${current.name} is going through a tunnel…`;
  } else if (current.isAI) {
    status = `${current.name} is playing…`;
  } else if (state.drawnThisTurn === 1) {
    status = 'Draw one more card.';
  } else {
    status = `${current.name}: draw cards, claim a route, or take tickets.`;
  }

  let sidePane: ReactElement | null = null;
  if (tunnelDecision) {
    sidePane = (
      <TunnelDialog
        pending={tunnelDecision}
        canAfford={legal.some((a) => a.type === 'RESOLVE_TUNNEL' && a.commit)}
        onResolve={(commit) => dispatch({ type: 'RESOLVE_TUNNEL', commit })}
      />
    );
  } else if (resultPlayer) {
    // Game over: the result line + ranked scores go in the top bar; detail in the bottom bar.
    sidePane = (
      <FinalScores ranked={ranked} selectedId={resultPlayer.id} caption={status} onSelect={setResultId} />
    );
  } else if (claimRouteId) {
    sidePane = (
      <ClaimDialog
        routeId={claimRouteId}
        hand={current.hand}
        onConfirm={onConfirmClaim}
        onCancel={() => setClaimRouteId(null)}
      />
    );
  } else if (activeSetup) {
    sidePane = (
      <TicketSelect
        key={activeSetup.id}
        player={activeSetup}
        minKeep={1}
        title="Keep your starting tickets"
        onConfirm={(keptIds) =>
          dispatch({ type: 'CONFIRM_SETUP_TICKETS', playerId: activeSetup.id, keptIds })
        }
        onHoverCities={setHoverCities}
      />
    );
  } else if (drawingTickets) {
    sidePane = (
      <TicketSelect
        player={current}
        minKeep={1}
        title="Keep at least one ticket"
        onConfirm={(keptIds) => dispatch({ type: 'KEEP_TICKETS', keptIds })}
        onHoverCities={setHoverCities}
      />
    );
  } else {
    // Idle right pane → running commentary (event feed + live prompt).
    sidePane = <Commentary log={state.log} status={status} />;
  }
  const showTickets = !gameOver && !viewing.isAI && viewing.tickets.length > 0;

  return (
    <div className="game-screen">
      {showExtendPopup && onExtendTime && (
        <div className="disconnect-overlay" role="alert">
          <span>
            {cleanName(current.name)} is low on time — {remainingSec}s left.
          </span>
          <button type="button" className="primary" onClick={onExtendTime}>
            Give +20s
          </button>
        </div>
      )}
      <header className="top-bar">
        <div className="top-content">{sidePane}</div>
        <div className="game-tools">
          {/* Mic/cam now live on each player's video frame in the right pane. */}
          {rulebook && (
            <a className="tool-btn" href={rulebook} target="_blank" rel="noopener noreferrer" title="Rules">
              <BookOpen size={16} />Rules
            </a>
          )}
          <div className="tools-row">
            <button
              type="button"
              className="tool-btn"
              onClick={toggleMute}
              title={muted ? 'Unmute sounds' : 'Mute sounds'}
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {onExit && (
              <button
                type="button"
                className="tool-btn leave"
                onClick={() => setConfirmLeave(true)}
                title="Leave game"
                aria-label="Leave game"
              >
                <CloseIcon size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      <aside className="decks-pane">
        <div className="pane-label">Draw</div>
        <Market
          state={state}
          canDraw={canDraw && actingAllowed}
          canDrawTickets={canDrawTickets && actingAllowed}
          onDrawMarket={(index) => dispatch({ type: 'DRAW_TRAIN', source: 'market', index })}
          onDrawDeck={() => dispatch({ type: 'DRAW_TRAIN', source: 'deck' })}
          onDrawTickets={() => dispatch({ type: 'DRAW_TICKETS' })}
        />
        {canPlaceStation && (
          <button
            type="button"
            className={`station-btn${placing ? ' active' : ''}`}
            onClick={() => setPlacingStation((v) => !v)}
          >
            {placing ? 'Click a city…' : `Place station (${viewing.stations.length + 1})`}
          </button>
        )}
      </aside>

      <main className="board-area">
        <Board
          cities={gameMap.cities}
          routes={gameMap.routes}
          bends={gameMap.layout.bends}
          claimedBy={state.claimedBy}
          playerColors={playerColors}
          playerAvatars={playerAvatars}
          claimableRouteIds={claimableRouteIds}
          highlightCityIds={hoverCities ?? undefined}
          subtleCityIds={subtleCityIds}
          onClaimRoute={(id) => setClaimRouteId(id)}
          highlightRouteIds={hoverChain?.ids ?? playerHighlight ?? undefined}
          hoverAnchorId={hoverAnchor}
          hoverLabel={hoverChain ? `${hoverChain.length} trains` : null}
          onRouteHover={handleRouteHover}
          stationColors={stationColors}
          placeableCityIds={placing ? new Set(stationActions.map((a) => a.city)) : undefined}
          onCityClick={(city) => {
            const a = stationActions.find((x) => x.city === city);
            if (a) {
              dispatch(a);
              setPlacingStation(false);
            }
          }}
          underlay={resultPlayer && <LongestPathOutline player={resultPlayer} />}
        >
          {resultPlayer && <TicketRings player={resultPlayer} />}
        </Board>
      </main>

      <aside className="players-strip">
        {state.players.map((p, i) => {
          if (p.removed) return null; // a removed player is gone from the board
          // Online human seats get a live video frame; AI/local seats don't.
          let panelMedia;
          if (media && !p.isAI) {
            const isMe = p.id === viewerId;
            const pm = media.peerMedia.get(p.id);
            const stream = isMe ? media.localStream : media.remoteStreams.get(p.id) ?? null;
            panelMedia = {
              isMe,
              stream,
              camOn: isMe ? !media.camOff : pm ? pm.camOn : false,
              micOn: isMe ? !media.micMuted : pm?.micOn ?? true,
              micMuted: media.micMuted,
              camOff: media.camOff,
              onToggleMic: media.toggleMic,
              onToggleCam: media.toggleCam,
            };
          }
          return (
            <PlayerPanel
              key={p.id}
              player={p}
              color={playerColor(i)}
              isCurrent={i === state.current && state.phase !== 'setup-tickets' && !gameOver}
              cardCount={handCount(p.hand)}
              onHover={(h) => setHoverPlayerId(h ? p.id : null)}
              media={panelMedia}
            />
          );
        })}
      </aside>

      <footer className="hand-pane">
        {!gameOver && (
          <>
          <div className="hand-block">
            <div className="pane-label">{poss} cards</div>
            <Hand hand={viewing.hand} />
          </div>

          {myClock && remainingSec != null && (
            <div
              className={`turn-clock${remainingSec <= 10 ? ' low' : ''}`}
              role="timer"
              aria-label={`${remainingSec} seconds left in your turn`}
            >
              {remainingSec}s
            </div>
          )}

          <div className="center-pane">
            {(yourTurnFlash || drawFlash) && (
              <div className="player-flash">
                {yourTurnFlash && <div className="turn-flash">IT&apos;S YOUR TURN!!</div>}
                {drawFlash && <div className="draw-flash">{drawFlash}</div>}
              </div>
            )}
            <div className="status-line" data-testid="status">
              {lastError && <span className="error">{lastError}</span>}
            </div>
          </div>

          {showTickets && (
            <div className="tickets-strip">
              <div className="pane-label">{poss} destinations</div>
              <div className="ticket-row">
                {viewing.tickets.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    completed={areConnected(viewing.claimedRouteIds, t.a, t.b)}
                    onHover={(h) => setHoverCities(h ? new Set([t.a, t.b]) : null)}
                  />
                ))}
              </div>
            </div>
          )}
          </>
        )}
        {gameOver && resultRanked && (
          <ResultDetail
            state={state}
            selected={resultRanked}
            onHoverTicket={(t) => setHoverCities(t ? new Set([t.a, t.b]) : null)}
            onPlayAgain={onPlayAgain}
          />
        )}
      </footer>

      {showLastRound && (
        <div
          className="last-round-banner dismissable"
          role="alert"
          onClick={() => setShowLastRound(false)}
        >
          Last round — everyone gets one final turn.
          <CloseIcon size={15} className="last-round-dismiss" />
        </div>
      )}

      {confirmLeave && (
        <div className="modal-backdrop" onClick={() => setConfirmLeave(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Leave the game?</h2>
            <p>
              Are you sure you want to leave?
              {online && ' You can rejoin with your room code while the game is still going.'}
            </p>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setConfirmLeave(false);
                  onExit?.();
                }}
              >
                Leave game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
