import { LocoIcon } from '../../../../shared/icons';
import type { TrainCard } from '../../engine/types';
import { cardHex, cardBorder, LOCO_GRADIENT } from '../colors';

interface Props {
  card: TrainCard;
  count?: number;
  onClick?: () => void;
  title?: string;
  dimmed?: boolean;
  /** Force the disabled state while keeping the chip visible (defaults to !onClick). */
  disabled?: boolean;
  testId?: string;
}

/** A single train-car card face. */
export function CardChip({ card, count, onClick, title, dimmed, disabled, testId }: Props) {
  const isLoco = card === 'locomotive';
  return (
    <button
      type="button"
      className={`card-chip${onClick ? ' clickable' : ''}${dimmed ? ' dimmed' : ''}`}
      onClick={onClick}
      disabled={disabled ?? !onClick}
      title={title ?? card}
      data-card={card}
      data-testid={testId}
      style={{
        background: isLoco ? LOCO_GRADIENT : cardHex(card),
        borderColor: isLoco ? '#4a4a4a' : cardBorder(card),
      }}
    >
      {isLoco && (
        <span className="loco-mark">
          <LocoIcon size={18} fill="currentColor" strokeWidth={0} />
        </span>
      )}
      {count !== undefined && <span className="card-count">{count}</span>}
    </button>
  );
}
