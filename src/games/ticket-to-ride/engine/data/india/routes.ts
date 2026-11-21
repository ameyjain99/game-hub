import type { Route, RouteColor } from '../../types';

/**
 * Routes of the India map: our own network over real geography. A
 * route's length follows the distance between its cities on the board;
 * tunnels (`t`) cross the mountains, ferries (`f`, = locomotives needed) the
 * sea.
 */
type Opts = { t?: boolean; f?: number; wild?: boolean; group?: string };
type Def = [a: string, b: string, color: RouteColor, length: number, opts?: Opts];

const SINGLES: Def[] = [
  ['i-karachi', 'i-jodhpur', 'yellow', 5],
  ['i-karachi', 'i-ahmedabad', 'orange', 5],
  ['i-karachi', 'i-lahore', 'red', 6],
  ['i-karachi', 'i-mumbai', 'grey', 6, { f: 2 }],
  ['i-lahore', 'i-srinagar', 'black', 2, { t: true }],
  ['i-lahore', 'i-jodhpur', 'blue', 3],
  ['i-srinagar', 'i-shimla', 'green', 3, { t: true }],
  ['i-shimla', 'i-delhi', 'black', 1],
  ['i-shimla', 'i-lahore', 'orange', 2],
  ['i-delhi', 'i-lucknow', 'blue', 4],
  ['i-jaipur', 'i-jodhpur', 'green', 2],
  ['i-jaipur', 'i-agra', 'grey', 3],
  ['i-jaipur', 'i-ahmedabad', 'black', 3],
  ['i-jodhpur', 'i-ahmedabad', 'blue', 2],
  ['i-jaipur', 'i-indore', 'grey', 2],
  ['i-ahmedabad', 'i-indore', 'white', 3],
  ['i-agra', 'i-lucknow', 'purple', 2],
  ['i-agra', 'i-bhopal', 'grey', 2],
  ['i-lucknow', 'i-kathmandu', 'grey', 3, { t: true }],
  ['i-lucknow', 'i-varanasi', 'white', 2],
  ['i-varanasi', 'i-patna', 'grey', 2],
  ['i-kathmandu', 'i-patna', 'yellow', 1, { t: true }],
  ['i-kathmandu', 'i-siliguri', 'white', 3, { t: true }],
  ['i-patna', 'i-siliguri', 'red', 3],
  ['i-patna', 'i-ranchi', 'grey', 2],
  ['i-varanasi', 'i-raipur', 'blue', 3],
  ['i-varanasi', 'i-bhopal', 'green', 5],
  ['i-siliguri', 'i-guwahati', 'yellow', 3],
  ['i-siliguri', 'i-dhaka', 'purple', 2],
  ['i-siliguri', 'i-kolkata', 'grey', 3],
  ['i-guwahati', 'i-dibrugarh', 'orange', 3],
  ['i-guwahati', 'i-dhaka', 'grey', 2],
  ['i-guwahati', 'i-imphal', 'black', 2, { t: true }],
  ['i-dibrugarh', 'i-imphal', 'purple', 2, { t: true }],
  ['i-imphal', 'i-chittagong', 'yellow', 2, { t: true }],
  ['i-dhaka', 'i-chittagong', 'blue', 2],
  ['i-dhaka', 'i-kolkata', 'grey', 2],
  ['i-kolkata', 'i-chittagong', 'grey', 3, { f: 1 }],
  ['i-kolkata', 'i-ranchi', 'green', 3],
  ['i-ranchi', 'i-raipur', 'orange', 3],
  ['i-ranchi', 'i-bhubaneswar', 'blue', 2],
  ['i-ranchi', 'i-varanasi', 'grey', 2],
  ['i-bhopal', 'i-indore', 'orange', 2],
  ['i-bhopal', 'i-nagpur', 'grey', 2],
  ['i-indore', 'i-mumbai', 'green', 3],
  ['i-nagpur', 'i-raipur', 'black', 2],
  ['i-nagpur', 'i-hyderabad', 'green', 2],
  ['i-nagpur', 'i-pune', 'white', 4],
  ['i-raipur', 'i-bhubaneswar', 'purple', 4],
  ['i-raipur', 'i-vizag', 'grey', 3],
  ['i-bhubaneswar', 'i-vizag', 'black', 3],
  ['i-mumbai', 'i-goa', 'grey', 3, { f: 1 }],
  ['i-pune', 'i-hyderabad', 'black', 3],
  ['i-pune', 'i-goa', 'red', 2],
  ['i-hyderabad', 'i-vizag', 'purple', 4],
  ['i-hyderabad', 'i-bengaluru', 'yellow', 3],
  ['i-hyderabad', 'i-chennai', 'grey', 3],
  ['i-hyderabad', 'i-goa', 'grey', 4],
  ['i-vizag', 'i-chennai', 'grey', 4],
  ['i-vizag', 'i-kolkata', 'grey', 5, { f: 2 }],
  ['i-goa', 'i-mangaluru', 'white', 2],
  ['i-mangaluru', 'i-bengaluru', 'grey', 2],
  ['i-mangaluru', 'i-kochi', 'purple', 2],
  ['i-bengaluru', 'i-madurai', 'red', 2],
  ['i-bengaluru', 'i-kochi', 'grey', 2],
  ['i-chennai', 'i-madurai', 'grey', 3],
  ['i-kochi', 'i-madurai', 'grey', 2],
  ['i-madurai', 'i-colombo', 'grey', 2, { f: 1 }],
  ['i-kochi', 'i-colombo', 'grey', 4, { f: 2 }],
  ['i-chennai', 'i-colombo', 'grey', 4, { f: 2 }],
  ['i-indore', 'i-nagpur', 'red', 3],
];

/** Double routes: two tracks between the same cities, in different colours. */
const DOUBLES: [Def, Def][] = [
  [
    ['i-lahore', 'i-delhi', 'purple', 3, { group: 'i-lahore-delhi' }],
    ['i-lahore', 'i-delhi', 'white', 3, { group: 'i-lahore-delhi' }],
  ],
  [
    ['i-delhi', 'i-jaipur', 'red', 2, { group: 'i-delhi-jaipur' }],
    ['i-delhi', 'i-jaipur', 'orange', 2, { group: 'i-delhi-jaipur' }],
  ],
  [
    ['i-delhi', 'i-agra', 'yellow', 2, { group: 'i-delhi-agra' }],
    ['i-delhi', 'i-agra', 'green', 2, { group: 'i-delhi-agra' }],
  ],
  [
    ['i-ahmedabad', 'i-mumbai', 'red', 2, { group: 'i-ahmedabad-mumbai' }],
    ['i-ahmedabad', 'i-mumbai', 'purple', 2, { group: 'i-ahmedabad-mumbai' }],
  ],
  [
    ['i-patna', 'i-kolkata', 'black', 4, { group: 'i-patna-kolkata' }],
    ['i-patna', 'i-kolkata', 'blue', 4, { group: 'i-patna-kolkata' }],
  ],
  [
    ['i-kolkata', 'i-bhubaneswar', 'orange', 3, { group: 'i-kolkata-bhubaneswar' }],
    ['i-kolkata', 'i-bhubaneswar', 'yellow', 3, { group: 'i-kolkata-bhubaneswar' }],
  ],
  [
    ['i-mumbai', 'i-pune', 'orange', 2, { group: 'i-mumbai-pune' }],
    ['i-mumbai', 'i-pune', 'yellow', 2, { group: 'i-mumbai-pune' }],
  ],
  [
    ['i-bengaluru', 'i-chennai', 'white', 2, { group: 'i-bengaluru-chennai' }],
    ['i-bengaluru', 'i-chennai', 'black', 2, { group: 'i-bengaluru-chennai' }],
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

export const INDIA_ROUTES: Route[] = [
  ...SINGLES.map((d) => toRoute(d)),
  ...DOUBLES.flatMap((pair) => pair.map((def, i) => toRoute(def, i === 0 ? '' : '-2'))),
];
