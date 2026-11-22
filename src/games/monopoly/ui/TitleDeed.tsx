import { useContext } from 'react';
import { BoardContext, useMoney, useSpaceFlag, useSpaceName, useSpaces } from './boardNames';
import { isMega, stationWord } from '../engine/board';
import { MEGA } from '../engine/mega';
import { GROUP_COLOR } from './board-layout';

/** A title-deed card: the lot's colour band, price, and its full rent table. */
export function TitleDeed({ spaceId, compact = false }: { spaceId: number; compact?: boolean }) {
  const sp = useSpaces()[spaceId];
  const name = useSpaceName()(spaceId);
  const flag = useSpaceFlag()(spaceId);
  const board = useContext(BoardContext);
  const mega = isMega(board);
  const transport = stationWord(board).toLowerCase();
  const money = useMoney();
  const band = sp.kind === 'property' && sp.group ? GROUP_COLOR[sp.group] : '#2b2f36';
  // Pale bands carry dark text so the deed name stays legible.
  const ink = sp.group === 'lightblue' || sp.group === 'yellow' ? '#1f241b' : '#ffffff';
  const rows: [string, string][] =
    sp.kind === 'property'
      ? [
          ['Rent', `${money(sp.rent![0])}`],
          ...(mega
            ? ([
                ['With all but one of the set', money(sp.rent![0] * 2)],
                ['With the whole set', money(sp.rent![0] * 3)],
              ] as [string, string][])
            : []),
          ['With 1 house', `${money(sp.rent![1])}`],
          ['With 2 houses', `${money(sp.rent![2])}`],
          ['With 3 houses', `${money(sp.rent![3])}`],
          ['With 4 houses', `${money(sp.rent![4])}`],
          ['With a hotel', `${money(sp.rent![5])}`],
          ...(mega && sp.skyscraper != null ? ([['With a skyscraper', money(sp.skyscraper)]] as [string, string][]) : []),
        ]
      : sp.kind === 'railroad'
        ? [
            ...sp.rent!.map((r, i) => [`${i + 1} ${transport}${i ? 's' : ''} owned`, money(r)] as [string, string]),
            ...(mega ? ([[`With a train depot (${money(MEGA.depotCost)})`, 'Rent doubles']] as [string, string][]) : []),
          ]
        : mega
          ? [
              ['One utility owned', '4 × dice'],
              ['Two utilities owned', '10 × dice'],
              ['All three owned', '20 × dice'],
            ]
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
        <span>Price {money(sp.price)}</span>
        {sp.houseCost != null && !compact && <span>Houses {money(sp.houseCost)}</span>}
        <span>Mortgage {money(Math.floor(sp.price! / 2))}</span>
      </footer>
    </article>
  );
}
