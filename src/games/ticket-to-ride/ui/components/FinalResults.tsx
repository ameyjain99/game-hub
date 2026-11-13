import { Crown } from '../../../../shared/icons';
import type { GameState, PlayerState, Ticket } from '../../engine/types';
import { finalScores, type ScoreBreakdown } from '../../engine/scoring';
import { DEFAULT_BONUSES, longestPathBonus } from '../../engine/bonuses';
import { areConnected, longestPath } from '../../engine/graph';
import { playerColor } from '../colors';
import { cleanName } from '../displayName';
import { TicketCard } from './TicketCard';

export interface RankedPlayer {
  player: PlayerState;
  seat: number;
  score: ScoreBreakdown;
}

/** Players ranked by final score, highest first (removed players are excluded). */
export function rankPlayers(state: GameState): RankedPlayer[] {
  const active = state.players.filter((p) => !p.removed);
  const scores = finalScores(active, DEFAULT_BONUSES);
  return active
    .map((player) => ({ player, seat: state.players.indexOf(player), score: scores[player.id] }))
    .sort((a, b) => b.score.total - a.score.total);
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
  const top = ranked[0].score.total;
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
                {score.total === top && <Crown size={14} className="winner-crown" fill="currentColor" />}
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
  const longestWinners = longestPathBonus.award(state.players);
  const done = player.tickets.filter((t) => areConnected(player.claimedRouteIds, t.a, t.b)).length;

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
        </div>
        <div className="detail-stat">
          <span className="detail-k">Longest</span>
          <span className="detail-v">{longestPath(player.claimedRouteIds)}</span>
          {longestWinners.has(player.id) && <span className="detail-sub">+10 bonus</span>}
        </div>
        {score.stations > 0 && (
          <div className="detail-stat">
            <span className="detail-k">Stations</span>
            <span className="detail-v">{score.stations}</span>
          </div>
        )}
      </div>
      <div className="detail-tickets">
        {player.tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            completed={areConnected(player.claimedRouteIds, t.a, t.b)}
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
