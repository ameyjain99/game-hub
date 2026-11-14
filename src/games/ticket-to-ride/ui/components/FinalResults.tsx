import { Crown } from '../../../../shared/icons';
import type { GameState, PlayerState, Ticket } from '../../engine/types';
import { finalScores, type ScoreBreakdown } from '../../engine/scoring';
import { bonusesFor } from '../../engine/bonuses';
import { areConnected, longestPath } from '../../engine/graph';
import { cityById, routeById } from '../../engine/maps';
import { playerColor } from '../colors';
import { cleanName } from '../displayName';
import { TicketCard } from './TicketCard';

export interface RankedPlayer {
  player: PlayerState;
  seat: number;
  score: ScoreBreakdown;
  /** Holds the Longest Path card (only when the mode uses it); the last tie-break. */
  longestPath: boolean;
}

/** Rulebook order: most points, then most completed tickets, then the Longest Path card. */
function compareRank(a: RankedPlayer, b: RankedPlayer): number {
  return (
    b.score.total - a.score.total ||
    b.score.ticketsCompleted - a.score.ticketsCompleted ||
    Number(b.longestPath) - Number(a.longestPath)
  );
}

/** Players ranked best first, ties broken per the rulebook (removed players are excluded). */
export function rankPlayers(state: GameState): RankedPlayer[] {
  const active = state.players.filter((p) => !p.removed);
  const bonuses = bonusesFor(state.mapId, state.modeId);
  const scores = finalScores(active, bonuses);
  const longest = bonuses.find((b) => b.id === 'longest-path')?.award(active) ?? new Set<string>();
  return active
    .map((player) => ({
      player,
      seat: state.players.indexOf(player),
      score: scores[player.id],
      longestPath: longest.has(player.id),
    }))
    .sort(compareRank);
}

/** The winner(s): everyone still level with the top player after every tie-break. */
export function winners(ranked: RankedPlayer[]): RankedPlayer[] {
  return ranked.filter((r) => compareRank(r, ranked[0]) === 0);
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Game-over top bar: the result line plus ranked, clickable score chips. */
export function FinalScores({
  ranked,
  selectedId,
  caption,
  onSelect,
}: {
  ranked: RankedPlayer[];
  selectedId: string;
  /** The "Game over — X wins!" line, shown beside the chips. */
  caption: string;
  onSelect: (playerId: string) => void;
}) {
  const won = new Set(winners(ranked).map((r) => r.player.id));
  return (
    <div className="final-scores" data-testid="final-scores">
      <span className="final-caption">{cleanName(caption)}</span>
      <div className="score-chip-list">
        {ranked.map(({ player, seat, score }) => {
          const isSelected = player.id === selectedId;
          return (
            <button
              key={player.id}
              type="button"
              className={`score-chip${isSelected ? ' selected' : ''}`}
              data-player-id={player.id}
              aria-pressed={isSelected}
              onClick={() => onSelect(player.id)}
            >
              <span className="seat-token" style={{ background: playerColor(seat) }} />
              <span className="score-name">
                {cleanName(player.name)}
                {won.has(player.id) && <Crown size={14} className="winner-crown" fill="currentColor" />}
              </span>
              <span className="score-total">{score.total}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Game-over bottom bar: the selected player's breakdown and their tickets. */
export function ResultDetail({
  state,
  selected,
  onHoverTicket,
  onPlayAgain,
}: {
  state: GameState;
  selected: RankedPlayer;
  onHoverTicket: (ticket: Ticket | null) => void;
  onPlayAgain?: () => void;
}) {
  const { player, score } = selected;
  // Bonus card points this player won, by card id.
  const won = new Map(
    bonusesFor(state.mapId, state.modeId)
      .filter((b) => b.award(state.players).has(player.id))
      .map((b) => [b.id, b.points]),
  );
  const done = score.ticketsCompleted;
  // Routes borrowed through stations count toward this player's tickets.
  const borrowed = score.stationRoutes.flatMap((s) => (s.routeId ? [s.routeId] : []));
  const network = [...player.claimedRouteIds, ...borrowed];
  const cityName = (id: string) => cityById.get(id)?.name ?? id;
  const ownerName = (routeId: string) => {
    const owner = state.players.find((p) => p.id === state.claimedBy[routeId]);
    return owner ? cleanName(owner.name) : 'another player';
  };

  return (
    <div className="final-detail" data-testid="final-detail">
      <div className="detail-stats">
        <div className="detail-stat">
          <span className="detail-k">Routes</span>
          <span className="detail-v">{score.routes}</span>
        </div>
        <div className="detail-stat">
          <span className="detail-k">Tickets</span>
          <span className={`detail-v${score.tickets < 0 ? ' neg' : ''}`}>{signed(score.tickets)}</span>
          <span className="detail-sub">
            {done}/{player.tickets.length} done
          </span>
          {won.has('globetrotter') && <span className="detail-sub">+{won.get('globetrotter')} bonus</span>}
        </div>
        <div className="detail-stat">
          <span className="detail-k">Longest</span>
          <span className="detail-v">{longestPath(player.claimedRouteIds)}</span>
          {won.has('longest-path') && <span className="detail-sub">+{won.get('longest-path')} bonus</span>}
        </div>
        {score.stations > 0 && (
          <div className="detail-stat">
            <span className="detail-k">Stations</span>
            <span className="detail-v">{score.stations}</span>
          </div>
        )}
        {score.stationRoutes.length > 0 && (
          // Which opponent route each station was counted as using (chosen for
          // the best ticket score), one short line per station.
          <div className="detail-stat detail-stations">
            <span className="detail-k">Station use</span>
            <ul aria-label="Stations">
              {score.stationRoutes.map(({ city, routeId }) => {
                const r = routeId ? routeById.get(routeId) : undefined;
                return (
                  <li key={city}>
                    <b>{cityName(city)}</b>{' '}
                    {r ? (
                      <>
                        borrowed {cityName(r.a)} → {cityName(r.b)}
                        <span className="detail-sub"> · {ownerName(r.id)}</span>
                      </>
                    ) : (
                      <span className="detail-sub">not needed</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <div className="detail-tickets">
        {player.tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            completed={areConnected(network, t.a, t.b)}
            onHover={(h) => onHoverTicket(h ? t : null)}
          />
        ))}
      </div>
      {onPlayAgain && (
        <button type="button" className="primary" onClick={onPlayAgain}>
          Play again
        </button>
      )}
    </div>
  );
}
