import type { Route, RouteColor } from '../../types';

/**
 * Ticket to Ride EUROPE routes.
 *
 * NOTE: this is a best-effort reconstruction of the printed Europe map — the
 * topology, tunnels (`t`) and ferries (`f`, = required locomotives) are placed
 * on the well-known alpine/pyrenees/balkan crossings and sea routes, but the
 * exact per-route COLORS and LENGTHS should be verified against the physical
 * game and tuned here (and positions in the dev board editor, `/?editor=europe`).
 */
type Opts = { t?: boolean; f?: number; group?: string };
type Def = [a: string, b: string, color: RouteColor, length: number, opts?: Opts];

const SINGLES: Def[] = [
  ['lisboa', 'madrid', 'purple', 3],
  ['lisboa', 'cadiz', 'blue', 2],
  ['cadiz', 'madrid', 'orange', 3],
  ['madrid', 'barcelona', 'yellow', 2],
  ['pamplona', 'barcelona', 'grey', 2, { t: true }],
  ['barcelona', 'marseille', 'grey', 4],
  ['pamplona', 'marseille', 'red', 4],
  ['pamplona', 'brest', 'purple', 4],
  ['brest', 'paris', 'black', 3],
  ['dieppe', 'paris', 'purple', 1],
  ['dieppe', 'brest', 'orange', 2],
  ['dieppe', 'bruxelles', 'green', 2],
  ['london', 'amsterdam', 'grey', 2, { f: 2 }],
  ['bruxelles', 'amsterdam', 'black', 1],
  ['bruxelles', 'frankfurt', 'blue', 2],
  ['amsterdam', 'essen', 'yellow', 3],
  ['amsterdam', 'frankfurt', 'white', 2],
  ['essen', 'frankfurt', 'green', 2],
  ['essen', 'berlin', 'blue', 2],
  ['frankfurt', 'munchen', 'purple', 2],
  ['paris', 'marseille', 'grey', 4],
  ['paris', 'zurich', 'grey', 3, { t: true }],
  ['marseille', 'zurich', 'purple', 2, { t: true }],
  ['marseille', 'roma', 'grey', 4, { t: true }],
  ['munchen', 'zurich', 'yellow', 2, { t: true }],
  ['munchen', 'wien', 'orange', 3],
  ['berlin', 'danzig', 'grey', 4],
  ['berlin', 'wien', 'green', 3],
  ['danzig', 'riga', 'black', 3],
  ['danzig', 'warszawa', 'grey', 2],
  ['warszawa', 'wien', 'blue', 4],
  ['warszawa', 'wilno', 'red', 3],
  ['warszawa', 'kyiv', 'grey', 4],
  ['wilno', 'riga', 'green', 4],
  ['wilno', 'petersburg', 'blue', 4],
  ['wilno', 'smolensk', 'yellow', 3],
  ['wilno', 'kyiv', 'grey', 2],
  ['riga', 'petersburg', 'grey', 4],
  ['petersburg', 'stockholm', 'grey', 8, { t: true }],
  ['petersburg', 'moskva', 'white', 4],
  ['moskva', 'smolensk', 'orange', 2],
  ['moskva', 'kharkov', 'grey', 4],
  ['smolensk', 'kyiv', 'red', 3],
  ['kyiv', 'kharkov', 'grey', 4],
  ['kyiv', 'bucuresti', 'grey', 4, { t: true }],
  ['kyiv', 'budapest', 'grey', 6, { t: true }],
  ['kharkov', 'rostov', 'green', 2],
  ['rostov', 'sevastopol', 'grey', 4],
  ['rostov', 'sochi', 'grey', 2],
  ['sochi', 'sevastopol', 'grey', 2, { f: 1 }],
  ['sochi', 'erzurum', 'red', 3, { t: true, f: 2 }],
  ['sevastopol', 'constantinople', 'grey', 4, { f: 2 }],
  ['sevastopol', 'erzurum', 'grey', 4, { f: 2 }],
  ['bucuresti', 'sevastopol', 'white', 4],
  ['erzurum', 'angora', 'black', 3, { t: true }],
  ['angora', 'constantinople', 'grey', 2, { t: true }],
  ['angora', 'smyrna', 'orange', 3, { t: true }],
  ['constantinople', 'sofia', 'blue', 3, { t: true }],
  ['constantinople', 'bucuresti', 'yellow', 3],
  ['constantinople', 'smyrna', 'grey', 2, { f: 1 }],
  ['smyrna', 'athina', 'grey', 2, { f: 1 }],
  ['smyrna', 'palermo', 'grey', 6, { f: 2 }],
  ['athina', 'brindisi', 'grey', 4, { f: 1 }],
  ['athina', 'sarajevo', 'green', 4],
  ['athina', 'sofia', 'purple', 3],
  ['brindisi', 'palermo', 'grey', 3, { f: 1 }],
  ['brindisi', 'roma', 'white', 2],
  ['palermo', 'roma', 'grey', 4, { f: 1 }],
  ['roma', 'venezia', 'black', 2],
  ['venezia', 'munchen', 'blue', 2, { t: true }],
  ['venezia', 'zurich', 'green', 2, { t: true }],
  ['venezia', 'zagreb', 'grey', 2],
  ['zagreb', 'wien', 'grey', 2],
  ['zagreb', 'budapest', 'orange', 2],
  ['zagreb', 'sarajevo', 'red', 3],
  ['sarajevo', 'sofia', 'grey', 2, { t: true }],
  ['sofia', 'bucuresti', 'grey', 2],
  ['budapest', 'sarajevo', 'purple', 3],
  ['budapest', 'bucuresti', 'grey', 4, { t: true }],
];

/** Each entry becomes two parallel segments sharing `group`. */
const DOUBLES: Def[][] = [
  [
    ['london', 'edinburgh', 'black', 4, { group: 'london-edinburgh' }],
    ['london', 'edinburgh', 'orange', 4, { group: 'london-edinburgh' }],
  ],
  [
    ['london', 'dieppe', 'grey', 2, { f: 1, group: 'london-dieppe' }],
    ['london', 'dieppe', 'grey', 2, { f: 1, group: 'london-dieppe' }],
  ],
  [
    ['paris', 'pamplona', 'green', 4, { group: 'paris-pamplona' }],
    ['paris', 'pamplona', 'blue', 4, { group: 'paris-pamplona' }],
  ],
  [
    ['paris', 'bruxelles', 'yellow', 2, { group: 'paris-bruxelles' }],
    ['paris', 'bruxelles', 'red', 2, { group: 'paris-bruxelles' }],
  ],
  [
    ['paris', 'frankfurt', 'white', 3, { group: 'paris-frankfurt' }],
    ['paris', 'frankfurt', 'orange', 3, { group: 'paris-frankfurt' }],
  ],
  [
    ['frankfurt', 'berlin', 'black', 3, { group: 'frankfurt-berlin' }],
    ['frankfurt', 'berlin', 'red', 3, { group: 'frankfurt-berlin' }],
  ],
  [
    ['berlin', 'warszawa', 'yellow', 4, { group: 'berlin-warszawa' }],
    ['berlin', 'warszawa', 'purple', 4, { group: 'berlin-warszawa' }],
  ],
  [
    ['essen', 'kobenhavn', 'grey', 3, { f: 1, group: 'essen-kobenhavn' }],
    ['essen', 'kobenhavn', 'grey', 3, { f: 1, group: 'essen-kobenhavn' }],
  ],
  [
    ['kobenhavn', 'stockholm', 'yellow', 3, { f: 1, group: 'kobenhavn-stockholm' }],
    ['kobenhavn', 'stockholm', 'white', 3, { f: 1, group: 'kobenhavn-stockholm' }],
  ],
  [
    ['budapest', 'wien', 'red', 1, { group: 'budapest-wien' }],
    ['budapest', 'wien', 'white', 1, { group: 'budapest-wien' }],
  ],
  [
    ['madrid', 'pamplona', 'white', 3, { t: true, group: 'madrid-pamplona' }],
    ['madrid', 'pamplona', 'black', 3, { t: true, group: 'madrid-pamplona' }],
  ],
];

function toRoute(def: Def, idSuffix = ''): Route {
  const [a, b, color, length, opts] = def;
  return {
    id: `${a}-${b}${idSuffix}`,
    a,
    b,
    color,
    length,
    locomotivesRequired: opts?.f ?? 0,
    isTunnel: opts?.t ?? false,
    ...(opts?.group ? { parallelGroup: opts.group } : {}),
  };
}

function build(): Route[] {
  const routes: Route[] = SINGLES.map((d) => toRoute(d));
  for (const pair of DOUBLES) {
    pair.forEach((def, i) => routes.push(toRoute(def, i === 0 ? '' : '-2')));
  }
  return routes;
}

export const EUROPE_ROUTES: Route[] = build();
