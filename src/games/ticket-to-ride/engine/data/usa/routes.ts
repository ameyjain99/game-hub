import type { Route, RouteColor } from '../../types';

/**
 * USA base-map routes. Double routes share a `parallelGroup`; the second
 * segment's id has a `-2` suffix. No ferries/tunnels on the USA map, so
 * `locomotivesRequired` is always 0.
 */
type Def = [a: string, b: string, color: RouteColor, length: number, group?: string];

const SINGLES: Def[] = [
  ['vancouver', 'calgary', 'grey', 3],
  ['seattle', 'calgary', 'grey', 4],
  ['seattle', 'helena', 'yellow', 6],
  ['portland', 'salt-lake-city', 'blue', 6],
  ['los-angeles', 'las-vegas', 'grey', 2],
  ['los-angeles', 'phoenix', 'grey', 3],
  ['los-angeles', 'el-paso', 'black', 6],
  ['las-vegas', 'salt-lake-city', 'orange', 3],
  ['salt-lake-city', 'helena', 'purple', 3],
  ['calgary', 'helena', 'grey', 4],
  ['calgary', 'winnipeg', 'white', 6],
  ['helena', 'winnipeg', 'blue', 4],
  ['helena', 'denver', 'green', 4],
  ['helena', 'duluth', 'orange', 6],
  ['helena', 'omaha', 'red', 5],
  ['phoenix', 'denver', 'white', 5],
  ['phoenix', 'santa-fe', 'grey', 3],
  ['phoenix', 'el-paso', 'grey', 3],
  ['denver', 'santa-fe', 'grey', 2],
  ['denver', 'omaha', 'purple', 4],
  ['denver', 'oklahoma-city', 'red', 4],
  ['santa-fe', 'el-paso', 'grey', 2],
  ['santa-fe', 'oklahoma-city', 'blue', 3],
  ['el-paso', 'oklahoma-city', 'yellow', 5],
  ['el-paso', 'dallas', 'red', 4],
  ['el-paso', 'houston', 'green', 6],
  ['winnipeg', 'duluth', 'black', 4],
  ['winnipeg', 'sault-ste-marie', 'grey', 6],
  ['duluth', 'sault-ste-marie', 'grey', 3],
  ['duluth', 'chicago', 'red', 3],
  ['duluth', 'toronto', 'purple', 6],
  ['omaha', 'chicago', 'blue', 4],
  ['oklahoma-city', 'little-rock', 'grey', 2],
  ['dallas', 'little-rock', 'grey', 2],
  ['houston', 'new-orleans', 'grey', 2],
  ['little-rock', 'saint-louis', 'grey', 2],
  ['little-rock', 'nashville', 'white', 3],
  ['little-rock', 'new-orleans', 'green', 3],
  ['new-orleans', 'miami', 'red', 6],
  ['saint-louis', 'pittsburgh', 'green', 5],
  ['saint-louis', 'nashville', 'grey', 2],
  ['chicago', 'toronto', 'white', 4],
  ['sault-ste-marie', 'toronto', 'grey', 2],
  ['sault-ste-marie', 'montreal', 'black', 5],
  ['toronto', 'montreal', 'grey', 3],
  ['toronto', 'pittsburgh', 'grey', 2],
  ['nashville', 'atlanta', 'grey', 1],
  ['nashville', 'raleigh', 'black', 3],
  ['nashville', 'pittsburgh', 'yellow', 4],
  ['atlanta', 'charleston', 'grey', 2],
  ['atlanta', 'miami', 'blue', 5],
  ['charleston', 'raleigh', 'grey', 2],
  ['charleston', 'miami', 'purple', 4],
  ['raleigh', 'pittsburgh', 'grey', 2],
  ['pittsburgh', 'washington', 'grey', 2],
  ['montreal', 'new-york', 'blue', 3],
];

/** Each entry becomes two parallel segments sharing `group`. */
const DOUBLES: Def[][] = [
  [
    ['vancouver', 'seattle', 'grey', 1, 'vancouver-seattle'],
    ['vancouver', 'seattle', 'grey', 1, 'vancouver-seattle'],
  ],
  [
    ['seattle', 'portland', 'grey', 1, 'seattle-portland'],
    ['seattle', 'portland', 'grey', 1, 'seattle-portland'],
  ],
  [
    ['portland', 'san-francisco', 'green', 5, 'portland-san-francisco'],
    ['portland', 'san-francisco', 'purple', 5, 'portland-san-francisco'],
  ],
  [
    ['san-francisco', 'salt-lake-city', 'orange', 5, 'san-francisco-salt-lake-city'],
    ['san-francisco', 'salt-lake-city', 'white', 5, 'san-francisco-salt-lake-city'],
  ],
  [
    ['san-francisco', 'los-angeles', 'purple', 3, 'san-francisco-los-angeles'],
    ['san-francisco', 'los-angeles', 'yellow', 3, 'san-francisco-los-angeles'],
  ],
  [
    ['salt-lake-city', 'denver', 'red', 3, 'salt-lake-city-denver'],
    ['salt-lake-city', 'denver', 'yellow', 3, 'salt-lake-city-denver'],
  ],
  [
    ['denver', 'kansas-city', 'black', 4, 'denver-kansas-city'],
    ['denver', 'kansas-city', 'orange', 4, 'denver-kansas-city'],
  ],
  [
    ['duluth', 'omaha', 'grey', 2, 'duluth-omaha'],
    ['duluth', 'omaha', 'grey', 2, 'duluth-omaha'],
  ],
  [
    ['omaha', 'kansas-city', 'grey', 1, 'omaha-kansas-city'],
    ['omaha', 'kansas-city', 'grey', 1, 'omaha-kansas-city'],
  ],
  [
    ['kansas-city', 'oklahoma-city', 'grey', 2, 'kansas-city-oklahoma-city'],
    ['kansas-city', 'oklahoma-city', 'grey', 2, 'kansas-city-oklahoma-city'],
  ],
  [
    ['kansas-city', 'saint-louis', 'blue', 2, 'kansas-city-saint-louis'],
    ['kansas-city', 'saint-louis', 'purple', 2, 'kansas-city-saint-louis'],
  ],
  [
    ['oklahoma-city', 'dallas', 'grey', 2, 'oklahoma-city-dallas'],
    ['oklahoma-city', 'dallas', 'grey', 2, 'oklahoma-city-dallas'],
  ],
  [
    ['dallas', 'houston', 'grey', 1, 'dallas-houston'],
    ['dallas', 'houston', 'grey', 1, 'dallas-houston'],
  ],
  [
    ['new-orleans', 'atlanta', 'yellow', 4, 'new-orleans-atlanta'],
    ['new-orleans', 'atlanta', 'orange', 4, 'new-orleans-atlanta'],
  ],
  [
    ['saint-louis', 'chicago', 'green', 2, 'saint-louis-chicago'],
    ['saint-louis', 'chicago', 'white', 2, 'saint-louis-chicago'],
  ],
  [
    ['chicago', 'pittsburgh', 'orange', 3, 'chicago-pittsburgh'],
    ['chicago', 'pittsburgh', 'black', 3, 'chicago-pittsburgh'],
  ],
  [
    ['atlanta', 'raleigh', 'grey', 2, 'atlanta-raleigh'],
    ['atlanta', 'raleigh', 'grey', 2, 'atlanta-raleigh'],
  ],
  [
    ['raleigh', 'washington', 'grey', 2, 'raleigh-washington'],
    ['raleigh', 'washington', 'grey', 2, 'raleigh-washington'],
  ],
  [
    ['pittsburgh', 'new-york', 'green', 2, 'pittsburgh-new-york'],
    ['pittsburgh', 'new-york', 'white', 2, 'pittsburgh-new-york'],
  ],
  [
    ['montreal', 'boston', 'grey', 2, 'montreal-boston'],
    ['montreal', 'boston', 'grey', 2, 'montreal-boston'],
  ],
  [
    ['boston', 'new-york', 'yellow', 2, 'boston-new-york'],
    ['boston', 'new-york', 'red', 2, 'boston-new-york'],
  ],
  [
    ['new-york', 'washington', 'orange', 2, 'new-york-washington'],
    ['new-york', 'washington', 'black', 2, 'new-york-washington'],
  ],
];

function build(): Route[] {
  const routes: Route[] = [];
  for (const [a, b, color, length] of SINGLES) {
    routes.push({ id: `${a}-${b}`, a, b, color, length, locomotivesRequired: 0 });
  }
  for (const pair of DOUBLES) {
    pair.forEach((def, i) => {
      const [a, b, color, length, group] = def;
      routes.push({
        id: i === 0 ? `${a}-${b}` : `${a}-${b}-2`,
        a,
        b,
        color,
        length,
        locomotivesRequired: 0,
        parallelGroup: group,
      });
    });
  }
  return routes;
}

export const ROUTES: Route[] = build();
