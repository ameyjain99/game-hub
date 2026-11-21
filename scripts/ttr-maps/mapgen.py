"""Builds a Ticket to Ride map's data files from city coordinates and a list of
links. Usage: python3 mapgen.py <nordic|india> <repo root> [--check]
Positions come from real latitude/longitude; a route's length from its
length on the board; colours are balanced; tickets are picked by distance."""
import json, math, sys, itertools, random

W, H = 1000, 700
PX_PER_CAR = 37.0

NORDIC = dict(
    id='nordic', prefix='n', const='NORDIC', title='Nordic', ywarp=0.7,
    margin=(60, 50, 60, 60),  # left, top, right, bottom
    cities=[
        ('kobenhavn', 'Kobenhavn', 55.68, 12.57), ('aarhus', 'Aarhus', 56.16, 10.20), ('aalborg', 'Aalborg', 57.05, 9.92),
        ('oslo', 'Oslo', 59.91, 10.75), ('kristiansand', 'Kristiansand', 58.15, 8.00), ('stavanger', 'Stavanger', 58.97, 5.73),
        ('bergen', 'Bergen', 60.39, 5.32), ('alesund', 'Alesund', 62.47, 6.15), ('trondheim', 'Trondheim', 63.43, 10.40),
        ('lillehammer', 'Lillehammer', 61.12, 10.47), ('moirana', 'Mo i Rana', 66.31, 14.14), ('bodo', 'Bodo', 67.28, 14.40),
        ('narvik', 'Narvik', 68.44, 17.43), ('tromso', 'Tromso', 69.65, 18.96), ('kirkenes', 'Kirkenes', 69.73, 30.05), ('alta', 'Alta', 69.97, 23.27),
        ('goteborg', 'Goteborg', 57.71, 11.97), ('karlskrona', 'Karlskrona', 56.16, 15.59), ('stockholm', 'Stockholm', 59.33, 18.07),
        ('orebro', 'Orebro', 59.27, 15.21), ('norrkoping', 'Norrkoping', 58.59, 16.19), ('sundsvall', 'Sundsvall', 62.39, 17.31),
        ('ostersund', 'Ostersund', 63.18, 14.64), ('umea', 'Umea', 63.83, 20.26), ('lulea', 'Lulea', 65.58, 22.15),
        ('kiruna', 'Kiruna', 67.86, 20.23), ('helsinki', 'Helsinki', 60.17, 24.94), ('turku', 'Turku', 60.45, 22.27),
        ('tampere', 'Tampere', 61.50, 23.76), ('vaasa', 'Vaasa', 63.10, 21.62), ('oulu', 'Oulu', 65.01, 25.47),
        ('kuopio', 'Kuopio', 62.89, 27.68), ('rovaniemi', 'Rovaniemi', 66.50, 25.73), ('kajaani', 'Kajaani', 64.22, 27.73),
        ('lahti', 'Lahti', 60.98, 25.66), ('tallinn', 'Tallinn', 59.44, 24.75), ('murmansk', 'Murmansk', 68.97, 33.07),
    ],
    # (a, b, kind) kind: '' land, 'F' ferry, 'T' tunnel, 'D' double, 'A' the Arctic line
    links=[
        ('kobenhavn', 'aarhus', 'F'), ('aarhus', 'aalborg', ''), ('aalborg', 'kristiansand', 'F'), ('aalborg', 'goteborg', 'F'),
        ('kobenhavn', 'goteborg', 'D'), ('kobenhavn', 'karlskrona', 'F'), ('karlskrona', 'norrkoping', ''), ('karlskrona', 'goteborg', ''),
        ('goteborg', 'oslo', 'D'), ('goteborg', 'orebro', ''), ('goteborg', 'norrkoping', ''),
        ('kristiansand', 'oslo', ''), ('kristiansand', 'stavanger', 'T'), ('stavanger', 'bergen', 'F'), ('bergen', 'oslo', 'T'),
        ('oslo', 'lillehammer', ''), ('bergen', 'alesund', 'F'), ('alesund', 'lillehammer', 'T'), ('alesund', 'trondheim', 'F'),
        ('lillehammer', 'trondheim', 'T'), ('oslo', 'orebro', ''), ('orebro', 'stockholm', 'D'), ('norrkoping', 'stockholm', 'D'),
        ('orebro', 'norrkoping', ''), ('orebro', 'sundsvall', ''), ('stockholm', 'sundsvall', ''), ('lillehammer', 'ostersund', 'T'),
        ('trondheim', 'ostersund', 'T'), ('ostersund', 'sundsvall', ''), ('sundsvall', 'umea', ''), ('ostersund', 'umea', ''),
        ('umea', 'lulea', ''), ('trondheim', 'moirana', 'T'), ('moirana', 'bodo', ''), ('bodo', 'narvik', 'F'), ('moirana', 'lulea', 'T'),
        ('narvik', 'tromso', ''), ('narvik', 'kiruna', 'T'), ('kiruna', 'lulea', ''), ('tromso', 'alta', 'F'), ('alta', 'kirkenes', ''), ('alta', 'kiruna', 'T'),
        ('kiruna', 'rovaniemi', ''), ('kirkenes', 'murmansk', ''), ('murmansk', 'kajaani', 'A'), ('rovaniemi', 'kirkenes', 'T'),
        ('lulea', 'oulu', ''), ('lulea', 'rovaniemi', ''), ('rovaniemi', 'oulu', ''), ('oulu', 'kajaani', ''), ('kajaani', 'kuopio', ''),
        ('kuopio', 'oulu', ''), ('kuopio', 'lahti', ''), ('lahti', 'helsinki', 'D'), ('lahti', 'tampere', ''), ('tampere', 'helsinki', ''),
        ('tampere', 'turku', ''), ('turku', 'helsinki', ''), ('tampere', 'vaasa', ''), ('vaasa', 'oulu', ''), ('vaasa', 'umea', 'F'),
        ('vaasa', 'sundsvall', 'F'), ('turku', 'stockholm', 'F'), ('helsinki', 'tallinn', 'F'), ('tallinn', 'stockholm', 'F'),
    ],
    tickets=44,
)

INDIA = dict(
    id='india', prefix='i', const='INDIA', title='India',
    margin=(60, 45, 60, 55),
    cities=[
        ('karachi', 'Karachi', 24.86, 67.00), ('lahore', 'Lahore', 31.55, 74.34), ('srinagar', 'Srinagar', 34.08, 74.80),
        ('shimla', 'Shimla', 31.10, 77.17), ('delhi', 'Delhi', 28.61, 77.20), ('jaipur', 'Jaipur', 26.91, 75.79),
        ('jodhpur', 'Jodhpur', 26.24, 73.02), ('ahmedabad', 'Ahmedabad', 23.02, 72.57), ('agra', 'Agra', 27.18, 78.01),
        ('lucknow', 'Lucknow', 26.85, 80.95), ('kathmandu', 'Kathmandu', 27.72, 85.32), ('varanasi', 'Varanasi', 25.32, 82.97),
        ('patna', 'Patna', 25.59, 85.14), ('siliguri', 'Siliguri', 26.73, 88.40), ('guwahati', 'Guwahati', 26.14, 91.74),
        ('dibrugarh', 'Dibrugarh', 27.47, 94.91), ('imphal', 'Imphal', 24.82, 93.94), ('dhaka', 'Dhaka', 23.81, 90.41),
        ('chittagong', 'Chittagong', 22.36, 91.78), ('kolkata', 'Kolkata', 22.57, 88.36), ('ranchi', 'Ranchi', 23.34, 85.31),
        ('bhopal', 'Bhopal', 23.26, 77.41), ('indore', 'Indore', 22.72, 75.86), ('nagpur', 'Nagpur', 21.15, 79.09),
        ('raipur', 'Raipur', 21.25, 81.63), ('bhubaneswar', 'Bhubaneswar', 20.30, 85.82), ('mumbai', 'Mumbai', 19.08, 72.88),
        ('pune', 'Pune', 18.52, 73.86), ('hyderabad', 'Hyderabad', 17.39, 78.49), ('vizag', 'Visakhapatnam', 17.69, 83.22),
        ('goa', 'Goa', 15.30, 74.12), ('bengaluru', 'Bengaluru', 12.97, 77.59), ('mangaluru', 'Mangaluru', 12.91, 74.86),
        ('chennai', 'Chennai', 13.08, 80.27), ('kochi', 'Kochi', 9.93, 76.27), ('madurai', 'Madurai', 9.93, 78.12),
        ('colombo', 'Colombo', 6.93, 79.86),
    ],
    links=[
        ('karachi', 'jodhpur', ''), ('karachi', 'ahmedabad', ''), ('karachi', 'lahore', ''), ('karachi', 'mumbai', 'F'),
        ('lahore', 'srinagar', 'T'), ('lahore', 'delhi', 'D'), ('lahore', 'jodhpur', ''), ('srinagar', 'shimla', 'T'),
        ('shimla', 'delhi', ''), ('shimla', 'lahore', ''), ('delhi', 'jaipur', 'D'), ('delhi', 'agra', 'D'), ('delhi', 'lucknow', ''),
        ('jaipur', 'jodhpur', ''), ('jaipur', 'agra', ''), ('jaipur', 'ahmedabad', ''), ('jodhpur', 'ahmedabad', ''),
        ('jaipur', 'indore', ''), ('ahmedabad', 'indore', ''), ('ahmedabad', 'mumbai', 'D'), ('agra', 'lucknow', ''),
        ('agra', 'bhopal', ''), ('lucknow', 'kathmandu', 'T'), ('lucknow', 'varanasi', ''), ('varanasi', 'patna', ''),
        ('kathmandu', 'patna', 'T'), ('kathmandu', 'siliguri', 'T'), ('patna', 'siliguri', ''), ('patna', 'kolkata', 'D'),
        ('patna', 'ranchi', ''), ('varanasi', 'raipur', ''), ('varanasi', 'bhopal', ''), ('siliguri', 'guwahati', ''),
        ('siliguri', 'dhaka', ''), ('siliguri', 'kolkata', ''), ('guwahati', 'dibrugarh', ''), ('guwahati', 'dhaka', ''),
        ('guwahati', 'imphal', 'T'), ('dibrugarh', 'imphal', 'T'), ('imphal', 'chittagong', 'T'), ('dhaka', 'chittagong', ''),
        ('dhaka', 'kolkata', ''), ('kolkata', 'chittagong', 'F'), ('kolkata', 'ranchi', ''), ('kolkata', 'bhubaneswar', 'D'),
        ('ranchi', 'raipur', ''), ('ranchi', 'bhubaneswar', ''), ('ranchi', 'varanasi', ''), ('bhopal', 'indore', ''), ('bhopal', 'nagpur', ''),
        ('indore', 'mumbai', ''), ('nagpur', 'raipur', ''), ('nagpur', 'hyderabad', ''), ('nagpur', 'pune', ''),
        ('raipur', 'bhubaneswar', ''), ('raipur', 'vizag', ''), ('bhubaneswar', 'vizag', ''), ('mumbai', 'pune', 'D'),
        ('mumbai', 'goa', 'F'), ('pune', 'hyderabad', ''), ('pune', 'goa', ''), ('hyderabad', 'vizag', ''),
        ('hyderabad', 'bengaluru', ''), ('hyderabad', 'chennai', ''), ('hyderabad', 'goa', ''), ('vizag', 'chennai', ''),
        ('vizag', 'kolkata', 'F'), ('goa', 'mangaluru', ''), ('mangaluru', 'bengaluru', ''),
        ('mangaluru', 'kochi', ''), ('bengaluru', 'chennai', 'D'), ('bengaluru', 'madurai', ''), ('bengaluru', 'kochi', ''),
        ('chennai', 'madurai', ''), ('kochi', 'madurai', ''), ('madurai', 'colombo', 'F'), ('kochi', 'colombo', 'F'),
        ('chennai', 'colombo', 'F'), ('indore', 'nagpur', ''),
    ],
    tickets=52,
)

COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'white', 'black']


def project(spec, tweak):
    cs = spec['cities']
    lat0 = sum(c[2] for c in cs) / len(cs)
    k = math.cos(math.radians(lat0))
    xs = [c[3] * k for c in cs]
    lo, hi = min(c[2] for c in cs), max(c[2] for c in cs)
    warp = spec.get('ywarp', 1.0)  # below 1 gives the crowded south more of the board
    ys = [-(((c[2] - lo) / (hi - lo)) ** warp) for c in cs]
    l, t, r, b = spec['margin']
    sx = (W - l - r) / (max(xs) - min(xs))
    sy = (H - t - b) / (max(ys) - min(ys))
    pos = {}
    for c, x, y in zip(cs, xs, ys):
        px = l + (x - min(xs)) * sx
        py = t + (y - min(ys)) * sy
        dx, dy = tweak.get('cities', {}).get(c[0], (0, 0))
        pos[c[0]] = (round(px + dx), round(py + dy))
    return pos


def build(spec, tweak):
    pos = project(spec, tweak)
    rnd = random.Random(7)
    dist = lambda a, b: math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1])
    warn = []
    routes = []  # dict(a,b,len,kind,colors[])
    for a, b, kind in spec['links']:
        d = dist(a, b)
        n = max(1, min(6, round(d / PX_PER_CAR)))
        if d / n > 50 and n < 6:
            n += 1
        if kind == 'A':
            n = 9
        per = d / n
        if kind != 'A' and (per < 27 or per > 52):
            warn.append(f'{a}-{b}: {d:.0f}px for {n} cars ({per:.0f}px a car)')
        routes.append(dict(a=a, b=b, len=n, kind=kind, d=d))
    names = [c[0] for c in spec['cities']]
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if dist(a, b) < 36:
                warn.append(f'cities too close: {a} {b} {dist(a, b):.0f}px')
    # crossings
    def cross(p1, p2, p3, p4):
        def o(a, b, c):
            return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        return o(p1, p2, p3) * o(p1, p2, p4) < 0 and o(p3, p4, p1) * o(p3, p4, p2) < 0
    for r1, r2 in itertools.combinations(routes, 2):
        if len({r1['a'], r1['b'], r2['a'], r2['b']}) < 4:
            continue
        if cross(pos[r1['a']], pos[r1['b']], pos[r2['a']], pos[r2['b']]):
            warn.append(f"crossing: {r1['a']}-{r1['b']} x {r2['a']}-{r2['b']}")
    # a route passing too near a third city
    for r in routes:
        ax, ay = pos[r['a']]; bx, by = pos[r['b']]
        for c in names:
            if c in (r['a'], r['b']):
                continue
            px, py = pos[c]
            t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / max(1, (bx - ax) ** 2 + (by - ay) ** 2)
            if 0.08 < t < 0.92:
                dd = math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
                if dd < 16:
                    warn.append(f"route {r['a']}-{r['b']} runs over {c} ({dd:.0f}px)")
    # colours: ferries and the Arctic line are grey; about a third of the rest grey;
    # the others take the least-used colour not already at either city.
    total = {c: 0 for c in COLORS}
    at = {n: set() for n in names}
    order = sorted(range(len(routes)), key=lambda i: (-routes[i]['len'], routes[i]['a'], routes[i]['b']))
    grey_budget = 0
    for i in order:
        r = routes[i]
        want = 2 if r['kind'] == 'D' else 1
        cols = []
        if r['kind'] in ('F', 'A'):
            cols = ['grey']
        else:
            for k in range(want):
                grey_budget += 1
                if want == 1 and grey_budget % 3 == 0 and r['len'] <= 4:
                    cols.append('grey')
                    continue
                free = [c for c in COLORS if c not in at[r['a']] and c not in at[r['b']] and c not in cols]
                pool = free or [c for c in COLORS if c not in cols]
                c = min(pool, key=lambda c: (total[c], COLORS.index(c)))
                cols.append(c)
                total[c] += r['len']
                at[r['a']].add(c); at[r['b']].add(c)
        r['colors'] = cols
    # tickets: by shortest path in cars
    INF = 10 ** 9
    sp = {a: {b: (0 if a == b else INF) for b in names} for a in names}
    for r in routes:
        sp[r['a']][r['b']] = min(sp[r['a']][r['b']], r['len'])
        sp[r['b']][r['a']] = min(sp[r['b']][r['a']], r['len'])
    for k in names:
        for a in names:
            for b in names:
                if sp[a][k] + sp[k][b] < sp[a][b]:
                    sp[a][b] = sp[a][k] + sp[k][b]
    for a in names:
        for b in names:
            if sp[a][b] >= INF:
                warn.append(f'not connected: {a} {b}')
    pairs = [(a, b) for i, a in enumerate(names) for b in names[i + 1:] if 5 <= sp[a][b] <= 24]
    rnd.shuffle(pairs)
    # aim for a spread: many short, fewer long
    want = spec['tickets']
    bands = [(5, 7, 0.26), (8, 10, 0.28), (11, 13, 0.22), (14, 17, 0.14), (18, 24, 0.10)]
    used = {n: 0 for n in names}
    tickets = []
    for lo, hi, share in bands:
        need = round(want * share)
        cand = [p for p in pairs if lo <= sp[p[0]][p[1]] <= hi]
        while need > 0 and cand:
            cand.sort(key=lambda p: (used[p[0]] + used[p[1]], rnd.random()))
            a, b = cand.pop(0)
            tickets.append((a, b, sp[a][b]))
            used[a] += 1; used[b] += 1
            need -= 1
    for n in names:
        if used[n] == 0:
            warn.append(f'no ticket for {n}')
    tickets.sort(key=lambda t: (t[2], t[0], t[1]))
    return pos, routes, tickets, total, warn


def emit(spec, root, pos, routes, tickets, tweak):
    P = spec['prefix'] + '-'
    C = spec['const']
    d = f"{root}/src/games/ticket-to-ride/engine/data/{spec['id']}"
    import os
    os.makedirs(d, exist_ok=True)
    rows = ',\n'.join(f'    "{P}{c[0]}": [{pos[c[0]][0]}, {pos[c[0]][1]}]' for c in spec['cities'])
    open(f'{d}/layout.json', 'w').write('{\n  "cities": {\n' + rows + '\n  },\n  "bends": ' + ('{\n' + ',\n'.join(f'    "{P}{k}": [{v[0]}, {v[1]}]' for k, v in tweak.get('bends', {}).items()) + '\n  }' if tweak.get('bends') else '{}') + '\n}\n')
    names = '\n'.join(f"  ['{P}{c[0]}', '{c[1]}']," for c in spec['cities'])
    open(f'{d}/cities.ts', 'w').write(f"""import type {{ City }} from '../../types';
import layoutJson from './layout.json';
import {{ asLayout }} from '../layout';

/**
 * Cities of the {spec['title']} map. Positions (0-1000 x 0-700) live in
 * `layout.json`: placed from real latitude and longitude, stretched to fill
 * the board, and tunable in the dev board editor (`/?editor={spec['id']}`).
 * Ids carry the map's prefix so they never clash with another map's cities.
 */
const NAMES: [id: string, name: string][] = [
{names}
];

/** {spec['title']} board layout (city positions + route bends), validated at load. */
export const {C}_LAYOUT = asLayout(layoutJson);

export const {C}_CITIES: City[] = NAMES.map(([id, name]) => {{
  const pos = {C}_LAYOUT.cities[id];
  if (!pos) throw new Error(`{spec['id']}/layout.json has no position for city "${{id}}"`);
  return {{ id, name, x: pos[0], y: pos[1] }};
}});
""")
    def opts(r, group=None):
        o = []
        if r['kind'] == 'T': o.append('t: true')
        if r['kind'] == 'F': o.append(f"f: {1 if r['len'] <= 3 else 2}")
        if r['kind'] == 'A': o.append('wild: true')
        if group: o.append(f"group: '{group}'")
        return (', { ' + ', '.join(o) + ' }') if o else ''
    singles = '\n'.join(f"  ['{P}{r['a']}', '{P}{r['b']}', '{r['colors'][0]}', {r['len']}{opts(r)}]," for r in routes if r['kind'] != 'D')
    doubles = '\n'.join(
        "  [\n" + '\n'.join(f"    ['{P}{r['a']}', '{P}{r['b']}', '{c}', {r['len']}, {{ group: '{P}{r['a']}-{r['b']}' }}]," for c in r['colors']) + "\n  ],"
        for r in routes if r['kind'] == 'D')
    open(f'{d}/routes.ts', 'w').write(f"""import type {{ Route, RouteColor }} from '../../types';

/**
 * Routes of the {spec['title']} map: our own network over real geography. A
 * route's length follows the distance between its cities on the board;
 * tunnels (`t`) cross the mountains, ferries (`f`, = locomotives needed) the
 * sea{', and `wild` marks the one long line that takes locomotives' if any(r['kind'] == 'A' for r in routes) else ''}.
 */
type Opts = {{ t?: boolean; f?: number; wild?: boolean; group?: string }};
type Def = [a: string, b: string, color: RouteColor, length: number, opts?: Opts];

const SINGLES: Def[] = [
{singles}
];

/** Double routes: two tracks between the same cities, in different colours. */
const DOUBLES: [Def, Def][] = [
{doubles}
];

function toRoute(def: Def, idSuffix = ''): Route {{
  const [a, b, color, length, opts] = def;
  return {{
    id: `${{a}}-${{b}}${{idSuffix}}`,
    a,
    b,
    color,
    length,
    locomotivesRequired: opts?.f ?? 0,
    isTunnel: opts?.t ?? false,
    ...(opts?.wild ? {{ locomotivesOk: true }} : {{}}),
    ...(opts?.group ? {{ parallelGroup: opts.group }} : {{}}),
  }};
}}

export const {C}_ROUTES: Route[] = [
  ...SINGLES.map((d) => toRoute(d)),
  ...DOUBLES.flatMap((pair) => pair.map((def, i) => toRoute(def, i === 0 ? '' : '-2'))),
];
""")
    trows = '\n'.join(f"  ['{P}{a}', '{P}{b}', {p}]," for a, b, p in tickets)
    open(f'{d}/tickets.ts', 'w').write(f"""import type {{ Ticket }} from '../../types';

type Def = [a: string, b: string, points: number];

/**
 * The {len(tickets)} destination tickets of the {spec['title']} map. A ticket is
 * worth the number of trains on the shortest way between its two cities.
 */
const TICKETS: Def[] = [
{trows}
];

export const {C}_TICKETS: Ticket[] = TICKETS.map(([a, b, points], i) => ({{ id: `{P}t${{i + 1}}`, a, b, points }}));
""")


if __name__ == '__main__':
    which, root = sys.argv[1], sys.argv[2]
    spec = NORDIC if which == 'nordic' else INDIA
    tweak = json.load(open(sys.argv[0].replace('mapgen.py', f'tweak-{which}.json'))) if True else {}
    pos, routes, tickets, total, warn = build(spec, tweak)
    print(len(spec['cities']), 'cities', len(routes), 'links', sum(len(r['colors']) for r in routes), 'routes', len(tickets), 'tickets')
    print('colour totals', total, 'grey', sum(r['len'] for r in routes if r['colors'] == ['grey']))
    print('lengths', sorted(r['len'] for r in routes))
    print('ticket values', [t[2] for t in tickets])
    for w in warn:
        print('WARN', w)
    if '--check' not in sys.argv:
        emit(spec, root, pos, routes, tickets, tweak)
        print('written')
