/** Cluedo's rule-book pictures: the cards and tokens as the game draws them. */
import { SUSPECTS } from '../engine/cards';
import { CardFace } from './CluedoHand';
import { SUSPECT_COLOR, inkOn, suspectInitial } from './palette';

export const CardKinds = () => (
  <div className="rf-row" style={{ width: '100%' }}>
    {(['Mrs Peacock', 'Rope', 'Library'] as const).map((c) => (
      <span key={c} style={{ width: 120 }}>
        <CardFace card={c} />
      </span>
    ))}
  </div>
);

export const Tokens = () => (
  <div className="rf-row">
    {SUSPECTS.map((x) => (
      <span key={x} className="rf-col">
        <span className="cl-nb-token" style={{ width: 30, height: 30, fontSize: 13, background: SUSPECT_COLOR[x], color: inkOn(x) }}>
          {suspectInitial(x)}
        </span>
        <span className="rf-label">{x}</span>
      </span>
    ))}
  </div>
);
