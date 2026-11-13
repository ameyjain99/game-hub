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

  return (
    <div className="claim-dialog tunnel-dialog">
      <h3>Tunnel!</h3>
      <p className="tunnel-flip-label">Flipped from the deck:</p>
      <div className="tunnel-flipped">
        {flipped.map((c, i) => (
          <CardChip key={i} card={c} />
        ))}
      </div>
      <p className="tunnel-cost">
        {extra} extra <b>{unit}</b> card{extra === 1 ? '' : 's'} needed to complete this route.
      </p>
      <div className="tunnel-actions">
        <button type="button" className="primary" disabled={!canAfford} onClick={() => onResolve(true)}>
          Pay &amp; claim
        </button>
        <button type="button" onClick={() => onResolve(false)}>
          Cancel
        </button>
      </div>
      {!canAfford && <p className="tunnel-cost">You can't afford the extra cost.</p>}
    </div>
  );
}
