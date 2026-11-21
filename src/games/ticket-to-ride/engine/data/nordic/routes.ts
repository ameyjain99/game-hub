import type { Route, RouteColor } from '../../types';

/**
 * Routes of the Nordic map: our own network over real geography. A
 * route's length follows the distance between its cities on the board;
 * tunnels (`t`) cross the mountains, ferries (`f`, = locomotives needed) the
 * sea, and `wild` marks the one long line that takes locomotives.
 */
type Opts = { t?: boolean; f?: number; wild?: boolean; group?: string };
type Def = [a: string, b: string, color: RouteColor, length: number, opts?: Opts];

const SINGLES: Def[] = [
  ['n-kobenhavn', 'n-aarhus', 'grey', 3, { f: 1 }],
  ['n-aarhus', 'n-aalborg', 'grey', 2],
  ['n-aalborg', 'n-kristiansand', 'grey', 2, { f: 1 }],
  ['n-aalborg', 'n-goteborg', 'grey', 2, { f: 1 }],
  ['n-kobenhavn', 'n-karlskrona', 'grey', 3, { f: 1 }],
  ['n-karlskrona', 'n-norrkoping', 'white', 3],
  ['n-karlskrona', 'n-goteborg', 'grey', 4],
  ['n-goteborg', 'n-orebro', 'red', 3],
  ['n-goteborg', 'n-norrkoping', 'black', 4],
  ['n-kristiansand', 'n-oslo', 'red', 3],
  ['n-kristiansand', 'n-stavanger', 'black', 2, { t: true }],
  ['n-stavanger', 'n-bergen', 'grey', 2, { f: 1 }],
  ['n-bergen', 'n-oslo', 'yellow', 5, { t: true }],
  ['n-oslo', 'n-lillehammer', 'grey', 1],
  ['n-bergen', 'n-alesund', 'grey', 2, { f: 1 }],
  ['n-alesund', 'n-lillehammer', 'white', 4, { t: true }],
  ['n-alesund', 'n-trondheim', 'grey', 4, { f: 2 }],
  ['n-lillehammer', 'n-trondheim', 'grey', 2, { t: true }],
  ['n-oslo', 'n-orebro', 'green', 4],
  ['n-orebro', 'n-norrkoping', 'grey', 2],
  ['n-orebro', 'n-sundsvall', 'black', 4],
  ['n-stockholm', 'n-sundsvall', 'green', 3],
  ['n-lillehammer', 'n-ostersund', 'grey', 4, { t: true }],
  ['n-trondheim', 'n-ostersund', 'purple', 4, { t: true }],
  ['n-ostersund', 'n-sundsvall', 'white', 2],
  ['n-sundsvall', 'n-umea', 'red', 3],
  ['n-ostersund', 'n-umea', 'blue', 5],
  ['n-umea', 'n-lulea', 'black', 2],
  ['n-trondheim', 'n-moirana', 'grey', 4, { t: true }],
  ['n-moirana', 'n-bodo', 'purple', 2],
  ['n-bodo', 'n-narvik', 'grey', 3, { f: 1 }],
  ['n-moirana', 'n-lulea', 'orange', 6, { t: true }],
  ['n-narvik', 'n-tromso', 'grey', 2],
  ['n-narvik', 'n-kiruna', 'black', 2, { t: true }],
  ['n-kiruna', 'n-lulea', 'grey', 3],
  ['n-tromso', 'n-alta', 'grey', 4, { f: 2 }],
  ['n-alta', 'n-kirkenes', 'red', 6],
  ['n-alta', 'n-kiruna', 'grey', 3, { t: true }],
  ['n-kiruna', 'n-rovaniemi', 'green', 5],
  ['n-kirkenes', 'n-murmansk', 'black', 3],
  ['n-murmansk', 'n-kajaani', 'grey', 9, { wild: true }],
  ['n-rovaniemi', 'n-kirkenes', 'purple', 5, { t: true }],
  ['n-lulea', 'n-oulu', 'grey', 3],
  ['n-lulea', 'n-rovaniemi', 'yellow', 3],
  ['n-rovaniemi', 'n-oulu', 'white', 1],
  ['n-oulu', 'n-kajaani', 'green', 2],
  ['n-kajaani', 'n-kuopio', 'blue', 1],
  ['n-kuopio', 'n-oulu', 'orange', 3],
  ['n-kuopio', 'n-lahti', 'yellow', 2],
  ['n-lahti', 'n-tampere', 'blue', 2],
  ['n-tampere', 'n-helsinki', 'grey', 2],
  ['n-tampere', 'n-turku', 'purple', 2],
  ['n-turku', 'n-helsinki', 'grey', 2],
  ['n-tampere', 'n-vaasa', 'red', 2],
  ['n-vaasa', 'n-oulu', 'blue', 4],
  ['n-vaasa', 'n-umea', 'grey', 1, { f: 1 }],
  ['n-vaasa', 'n-sundsvall', 'grey', 4, { f: 2 }],
  ['n-turku', 'n-stockholm', 'grey', 4, { f: 2 }],
  ['n-helsinki', 'n-tallinn', 'grey', 1, { f: 1 }],
  ['n-tallinn', 'n-stockholm', 'grey', 5, { f: 2 }],
];

/** Double routes: two tracks between the same cities, in different colours. */
const DOUBLES: [Def, Def][] = [
  [
    ['n-kobenhavn', 'n-goteborg', 'white', 4, { group: 'n-kobenhavn-goteborg' }],
    ['n-kobenhavn', 'n-goteborg', 'yellow', 4, { group: 'n-kobenhavn-goteborg' }],
  ],
  [
    ['n-goteborg', 'n-oslo', 'orange', 3, { group: 'n-goteborg-oslo' }],
    ['n-goteborg', 'n-oslo', 'blue', 3, { group: 'n-goteborg-oslo' }],
  ],
  [
    ['n-orebro', 'n-stockholm', 'purple', 3, { group: 'n-orebro-stockholm' }],
    ['n-orebro', 'n-stockholm', 'white', 3, { group: 'n-orebro-stockholm' }],
  ],
  [
    ['n-norrkoping', 'n-stockholm', 'orange', 2, { group: 'n-norrkoping-stockholm' }],
    ['n-norrkoping', 'n-stockholm', 'yellow', 2, { group: 'n-norrkoping-stockholm' }],
  ],
  [
    ['n-lahti', 'n-helsinki', 'orange', 2, { group: 'n-lahti-helsinki' }],
    ['n-lahti', 'n-helsinki', 'green', 2, { group: 'n-lahti-helsinki' }],
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
    ...(opts?.wild ? { locomotivesOk: true } : {}),
    ...(opts?.group ? { parallelGroup: opts.group } : {}),
  };
}

export const NORDIC_ROUTES: Route[] = [
  ...SINGLES.map((d) => toRoute(d)),
  ...DOUBLES.flatMap((pair) => pair.map((def, i) => toRoute(def, i === 0 ? '' : '-2'))),
];
