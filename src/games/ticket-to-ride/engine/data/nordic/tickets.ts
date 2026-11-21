import type { Ticket } from '../../types';

type Def = [a: string, b: string, points: number];

/**
 * The 43 destination tickets of the Nordic map. A ticket is
 * worth the number of trains on the shortest way between its two cities.
 */
const TICKETS: Def[] = [
  ['n-karlskrona', 'n-stockholm', 5],
  ['n-lillehammer', 'n-orebro', 5],
  ['n-narvik', 'n-alta', 5],
  ['n-oslo', 'n-alesund', 5],
  ['n-ostersund', 'n-umea', 5],
  ['n-tampere', 'n-kajaani', 5],
  ['n-aalborg', 'n-bergen', 6],
  ['n-kristiansand', 'n-trondheim', 6],
  ['n-helsinki', 'n-oulu', 7],
  ['n-lulea', 'n-lahti', 7],
  ['n-norrkoping', 'n-tallinn', 7],
  ['n-kristiansand', 'n-norrkoping', 8],
  ['n-lillehammer', 'n-bodo', 8],
  ['n-sundsvall', 'n-kiruna', 8],
  ['n-turku', 'n-oulu', 8],
  ['n-kobenhavn', 'n-stavanger', 9],
  ['n-tromso', 'n-rovaniemi', 9],
  ['n-aarhus', 'n-trondheim', 10],
  ['n-alesund', 'n-sundsvall', 10],
  ['n-karlskrona', 'n-ostersund', 10],
  ['n-kirkenes', 'n-vaasa', 10],
  ['n-kuopio', 'n-murmansk', 10],
  ['n-moirana', 'n-goteborg', 10],
  ['n-moirana', 'n-tampere', 11],
  ['n-orebro', 'n-lahti', 11],
  ['n-bergen', 'n-bodo', 12],
  ['n-kiruna', 'n-murmansk', 12],
  ['n-oslo', 'n-lulea', 12],
  ['n-tromso', 'n-kajaani', 12],
  ['n-aalborg', 'n-vaasa', 13],
  ['n-kirkenes', 'n-helsinki', 13],
  ['n-kobenhavn', 'n-tallinn', 13],
  ['n-narvik', 'n-stockholm', 13],
  ['n-aarhus', 'n-turku', 14],
  ['n-alta', 'n-orebro', 15],
  ['n-goteborg', 'n-rovaniemi', 15],
  ['n-kristiansand', 'n-tallinn', 15],
  ['n-stavanger', 'n-umea', 15],
  ['n-trondheim', 'n-kuopio', 16],
  ['n-aalborg', 'n-kuopio', 18],
  ['n-bergen', 'n-tampere', 18],
  ['n-kirkenes', 'n-norrkoping', 18],
  ['n-aarhus', 'n-tromso', 21],
];

export const NORDIC_TICKETS: Ticket[] = TICKETS.map(([a, b, points], i) => ({ id: `n-t${i + 1}`, a, b, points }));
