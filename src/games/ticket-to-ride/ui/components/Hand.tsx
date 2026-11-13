import type { Hand as HandType, TrainCard } from '../../engine/types';
import { CARD_COLORS } from '../../engine/types';
import { CardChip } from './CardChip';

interface Props {
  hand: HandType;
}

const ORDER: TrainCard[] = [...CARD_COLORS, 'locomotive'];

export function Hand({ hand }: Props) {
  const owned = ORDER.filter((c) => hand[c] > 0);
  return (
    <div className="hand" data-testid="hand">
      {owned.length === 0 && <span className="hand-empty">No cards yet</span>}
      {owned.map((c) => (
        <CardChip key={c} card={c} count={hand[c]} />
      ))}
    </div>
  );
}
