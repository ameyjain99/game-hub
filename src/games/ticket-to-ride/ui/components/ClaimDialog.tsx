import type { CardCombo, Hand, TrainCard } from '../../engine/types';
import { canPayFor, getRoute } from '../../engine/selectors';
import { cityById } from '../../engine/maps';
import { cardHex, cardBorder, cardText, LOCO_GRADIENT } from '../colors';

const NAME = new Map([...cityById].map(([id, c]) => [id, c.name]));

interface Props {
  routeId: string;
  hand: Hand;
  onConfirm: (combo: CardCombo) => void;
  onCancel: () => void;
}

/** Plain-text form of a combo, kept for the button's tooltip / accessible name. */
function describe(combo: CardCombo): string {
  const parts: string[] = [];
  if (combo.colorCount > 0 && combo.color) parts.push(`${combo.colorCount} ${combo.color}`);
  if (combo.locomotives > 0) parts.push(`${combo.locomotives} locomotive`);
  return parts.join(' + ');
}

/** A single mini card face showing how many of it to spend, drawn inside. */
function PayChip({ card, count, loco }: { card?: TrainCard; count: number; loco?: boolean }) {
  const style = loco
    ? { background: LOCO_GRADIENT, borderColor: '#4a4a4a', color: '#fff' }
    : { background: cardHex(card!), borderColor: cardBorder(card!), color: cardText(card!) };
  return (
    <span className={`combo-chip${loco ? ' loco' : ''}`} style={style}>
      {count}
    </span>
  );
}

/** The cards a combo spends, as mini chips instead of a text label. */
function ComboChips({ combo }: { combo: CardCombo }) {
  return (
    <span className="combo-chips">
      {combo.colorCount > 0 && combo.color && <PayChip card={combo.color} count={combo.colorCount} />}
      {combo.locomotives > 0 && <PayChip count={combo.locomotives} loco />}
    </span>
  );
}

export function ClaimDialog({ routeId, hand, onConfirm, onCancel }: Props) {
  const route = getRoute(routeId)!;
  const combos = canPayFor(hand, route);

  return (
    <div className="popover claim-popover" data-testid="claim-dialog">
      <div className="popover-head">
        <h3>
          Claim {NAME.get(route.a)} → {NAME.get(route.b)}
        </h3>
        <span className="dialog-sub">
          {route.length} {route.color === 'grey' ? 'any-color' : route.color} · pick cards to spend
        </span>
      </div>
      {combos.length === 0 ? (
        <p className="dialog-none">You can't pay for this route.</p>
      ) : (
        <ul className="combo-list">
          {combos.map((combo, i) => (
            <li key={i}>
              <button
                type="button"
                className="combo-btn"
                title={describe(combo)}
                aria-label={describe(combo)}
                onClick={() => onConfirm(combo)}
              >
                <ComboChips combo={combo} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="dialog-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
