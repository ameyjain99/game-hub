import { BOARD } from '../engine/board';
import { useCurrency, useSpaceFlag, useSpaceName } from './boardNames';
import { mortgageValue } from '../engine/selectors';
import { GROUP_COLOR } from './board-layout';

/** A title-deed card: the lot's colour band, price, and its full rent table. */
export function TitleDeed({ spaceId, compact = false }: { spaceId: number; compact?: boolean }) {
  const sp = BOARD[spaceId];
  const name = useSpaceName()(spaceId);
  const flag = useSpaceFlag()(spaceId);
  const cur = useCurrency();
  const band = sp.kind === 'property' && sp.group ? GROUP_COLOR[sp.group] : '#2b2f36';
  // Pale bands carry dark text so the deed name stays legible.
  const ink = sp.group === 'lightblue' || sp.group === 'yellow' ? '#1f241b' : '#ffffff';
  const rows: [string, string][] =
    sp.kind === 'property'
      ? [
          ['Rent', `${cur}${sp.rent![0]}`],
          ['With 1 house', `${cur}${sp.rent![1]}`],
          ['With 2 houses', `${cur}${sp.rent![2]}`],
          ['With 3 houses', `${cur}${sp.rent![3]}`],
          ['With 4 houses', `${cur}${sp.rent![4]}`],
          ['With a hotel', `${cur}${sp.rent![5]}`],
        ]
      : sp.kind === 'railroad'
        ? sp.rent!.map((r, i) => [`${i + 1} station${i ? 's' : ''} owned`, `${cur}${r}`] as [string, string])
        : [
            ['One utility owned', '4 × dice'],
            ['Both utilities owned', '10 × dice'],
          ];
  return (
    <article className={`mono-deed${compact ? ' is-compact' : ''}`} aria-label={`Title deed: ${name}`}>
      <header className="mono-deed-band" style={{ background: band, color: ink }}>
        <span className="mono-deed-kicker">Title deed</span>
        <span className="mono-deed-name">
          {flag && <span aria-hidden="true">{flag} </span>}
          {name}
        </span>
      </header>
      {!compact && (
        <dl className="mono-deed-rows">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <footer className="mono-deed-foot">
        <span>Price {cur}{sp.price}</span>
        {sp.houseCost != null && !compact && <span>Houses {cur}{sp.houseCost}</span>}
        <span>Mortgage {cur}{mortgageValue(spaceId)}</span>
      </footer>
    </article>
  );
}
