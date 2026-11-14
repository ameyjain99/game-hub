import type { PendingTunnel } from '../../engine/types';
import { getRoute } from '../../engine/selectors';
import { cityById } from '../../engine/maps';
import { isTunnelMatch } from '../../engine/tunnel';
import { CardChip } from './CardChip';

interface Props {
  pending: PendingTunnel;
  /** Whether the player can afford the extra cost right now. */
  canAfford: boolean;
  onResolve: (commit: boolean) => void;
}

export function TunnelDialog({ pending, canAfford, onResolve }: Props) {
  const { flipped, extra, combo } = pending;
  const unit = combo.colorCount > 0 && combo.color ? combo.color : 'locomotive';
  const route = getRoute(pending.routeId);
  const cityName = (id: string) => cityById.get(id)?.name ?? id;

  // Same shape as the claim and ticket panels: a fixed head on the left, the
  // flipped cards in a horizontal strip, and the actions pinned to the right –
  // so the top bar lays it out in one row instead of a vertical scroll.
  return (
    <div className="popover tunnel-dialog" data-testid="tunnel-dialog">
      <div className="popover-head">
        <h3>{route ? `Tunnel · ${cityName(route.a)} → ${cityName(route.b)}` : 'Tunnel!'}</h3>
        <span className="dialog-sub">
          {canAfford ? (
            <>
              Pay {extra} more <b>{unit}</b> card{extra === 1 ? '' : 's'}
            </>
          ) : (
            <>
              Needs {extra} more <b>{unit}</b> – you can't afford it
            </>
          )}
        </span>
      </div>
      <div className="tunnel-flipped" aria-label="Cards flipped from the deck">
        {/* Cards that don't match are dimmed, so the extra cost explains itself. */}
        {flipped.map((c, i) => {
          const match = isTunnelMatch(c, combo);
          return <CardChip key={i} card={c} dimmed={!match} title={`${c}: ${match ? 'matches' : 'no match'}`} />;
        })}
      </div>
      <div className="tunnel-actions">
        <button type="button" className="primary" disabled={!canAfford} onClick={() => onResolve(true)}>
          Pay &amp; claim
        </button>
        <button type="button" className="dialog-cancel" onClick={() => onResolve(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
