/** Ludo's rule-book pictures: the four colours, a safe square, and a 6. */
import { Die } from '../../kit/ui/Die';
import { SafeSquareIcon } from '../../../shared/icons';
import { LUDO_COLOR } from './LudoGame';

export const Tokens = () => (
  <div className="rf-row">
    {(Object.keys(LUDO_COLOR) as (keyof typeof LUDO_COLOR)[]).map((c) => (
      <span key={c} className="rf-col">
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: LUDO_COLOR[c], boxShadow: 'inset 0 -3px 0 #0004, 0 2px 4px #0006' }} />
        <span className="rf-label">{c[0].toUpperCase() + c.slice(1)}</span>
      </span>
    ))}
    <span className="rf-col">
      <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, background: '#f4f1e8', borderRadius: 4, color: '#8a6a35' }}>
        <SafeSquareIcon size={18} />
      </span>
      <span className="rf-label">Safe square</span>
    </span>
    <span className="rf-col">
      <Die value={6} rollKey={0} size={34} />
      <span className="rf-label">A 6: out, and roll again</span>
    </span>
  </div>
);
