import type { PendingTunnel } from '../../engine/types';
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

  // Same shape as the claim and ticket panels: a fixed head on the left, the
  // flipped cards in a horizontal strip, and the actions pinned to the right —
  // so the top bar lays it out in one row instead of a vertical scroll.
  return (
    <div className="popover tunnel-dialog" data-testid="tunnel-dialog">
      <div className="popover-head">
        <h3>Tunnel!</h3>
        <span className="dialog-sub">
          {canAfford ? (
            <>
              Pay {extra} more <b>{unit}</b> card{extra === 1 ? '' : 's'}
            </>
          ) : (
            <>
              Needs {extra} more <b>{unit}</b> — you can't afford it
            </>
          )}
        </span>
      </div>
      <div className="tunnel-flipped" aria-label="Cards flipped from the deck">
        {flipped.map((c, i) => (
          <CardChip key={i} card={c} />
        ))}
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
