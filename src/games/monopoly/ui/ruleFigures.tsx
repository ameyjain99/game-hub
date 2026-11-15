/** Monopoly's rule-book pictures: a title deed and the dice, as the game draws them. */
import { Dice } from './Dice';
import { TitleDeed } from './TitleDeed';

export const Deed = () => (
  <div className="rf-row" style={{ alignItems: 'flex-start' }}>
    <div style={{ width: 200 }}>
      <TitleDeed spaceId={1} />
    </div>
    <div style={{ width: 200 }}>
      <TitleDeed spaceId={5} />
    </div>
  </div>
);

export const Doubles = () => (
  <div className="rf-row">
    <Dice values={[4, 4]} />
  </div>
);
