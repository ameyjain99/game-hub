/**
 * Catan bots. A bot sees only its own view (others' hands as counts), values
 * corners by the dice odds of their tiles (more for resources it lacks, a little
 * for harbours), and on its turn builds in order of worth: a city, a settlement,
 * a road toward the next good corner, a development card. It trades with the bank
 * only to finish a build, robs the leader, and answers offers on their merits.
 * Easy plays loosely (random picks among the good ones); Hard plays its knights
 * and development cards more sharply.
 */
import { PIPS, RESOURCES, YIELD, isLand, type Resource } from './board';
import { COMMODITIES, FIXED_TOKENS, AREAS, AREA_GOOD, BARBARIAN_TRACK, CITY_GOOD, KNIGHTS_PER_LEVEL, goodsSize, type Commodity, type ProgressCard, type Goods } from './citiesKnights';
import {
  COSTS,
  ARMY_MIN,
  LIMITS,
  canPay,
  emptyHand,
  handSize,
  catanActor,
  legalSettlementSpots,
  legalRoadSpots,
  legalShipSpots,
  legalCitySpots,
  legalKnightSpots,
  improveCost,
  chasers,
  cardsHeld,
  openRoads,
  pillageable,
  retreatSpots,
  knightsOf,
  KNIGHT_COSTS,
  redactCatan,
  bankRatio,
  victoryPoints,
  type Hand,
  type CatanAction,
  type CatanPlayer,
  type CatanState,
  type Piece,
  geoFor,
} from './engine';

type Level = 'easy' | 'normal' | 'hard';
const pick = <T>(items: T[], rand: () => number) => items[Math.floor(rand() * items.length)];
const count = (s: CatanState, id: string, kind: 'road' | 'settlement' | 'city' | 'ship') =>
  kind === 'road'
    ? s.roads.filter((r) => r === id).length
    : kind === 'ship'
      ? (s.ships ?? []).filter((r) => r === id).length
      : s.buildings.filter((b) => b?.player === id && b.city === (kind === 'city')).length;

/** What a corner is worth to `id`. */
function cornerValue(s: CatanState, v: number, id: string): number {
  const have = new Set<Resource>();
  s.buildings.forEach((b, i) => {
    if (b?.player !== id) return;
    for (const t of geoFor(s).vertices[i].tiles) {
      const r = YIELD[s.board.terrain[t]];
      if (r) have.add(r);
    }
  });
  let score = 0;
  const geo = geoFor(s);
  const islands = new Set<number>();
  for (const t of geo.vertices[v].tiles) {
    const n = s.board.numbers[t];
    if (geo.tiles[t].island > 0 && isLand(s.board.terrain[t])) islands.add(geo.tiles[t].island);
    // A gold field pays whatever is needed most.
    if (s.board.terrain[t] === 'gold' && n !== null) {
      score += PIPS[n] * 1.45;
      continue;
    }
    const r = YIELD[s.board.terrain[t]];
    if (!r || n === null) continue;
    score += PIPS[n] * (t === s.board.robber ? 0.3 : 1) * (have.has(r) ? 1 : 1.35);
  }
  // Seafarers: Island bonus on a new island is worth two points.
  for (const k of islands) if (!s.islandBonus?.[id]?.includes(k)) score += 6;
  geoFor(s).harborEdges.forEach((e, k) => {
    if (geoFor(s).edges[e].v.includes(v)) score += s.board.harbors[k] === 'any' ? 1 : 1.5;
  });
  return score;
}

/** A corner nobody can be stopped from settling yet: on land, empty, with empty neighbours. */
const open = (s: CatanState, v: number) =>
  !s.buildings[v] && geoFor(s).vertices[v].tiles.some((t) => isLand(s.board.terrain[t])) && geoFor(s).vertices[v].neighbours.every((n) => !s.buildings[n]);

/** Seafarers: the ship that sails best toward a settleable corner of an outer island
 *  (worth its value, Island bonus included, less for every step of sea), with that worth. */
function shipPlan(s: CatanState, id: string, rand: () => number): { e: number; score: number } | null {
  const spots = legalShipSpots(s, id);
  if (spots.length === 0) return null;
  const geo = geoFor(s);
  const sea = (e: number) => geo.edges[e].tiles.some((t) => s.board.terrain[t] === 'sea');
  const goal = (v: number) => open(s, v) && geo.vertices[v].tiles.some((t) => geo.tiles[t].island > 0 && isLand(s.board.terrain[t]));
  let best: { e: number; score: number } | null = null;
  for (const e of spots) {
    // Steps along the sea from the ship's far end to each goal corner.
    const mine = (v: number) => s.buildings[v]?.player === id || geo.vertices[v].edges.some((x) => x !== e && s.ships[x] === id);
    const from = geo.edges[e].v.find((v) => !mine(v)) ?? geo.edges[e].v[1];
    const dist = new Map<number, number>([[from, 0]]);
    const queue = [from];
    let score = 0;
    while (queue.length) {
      const v = queue.shift()!;
      const d = dist.get(v)!;
      if (goal(v)) score = Math.max(score, cornerValue(s, v, id) * Math.pow(0.8, d));
      if (d >= 8) continue;
      for (const x of geo.vertices[v].edges) {
        if (!sea(x) || (s.ships[x] && s.ships[x] !== id)) continue;
        const w = geo.edges[x].v[0] === v ? geo.edges[x].v[1] : geo.edges[x].v[0];
        if (!dist.has(w)) {
          dist.set(w, d + 1);
          queue.push(w);
        }
      }
    }
    score += rand() * 0.3;
    if (score > 0.5 && (!best || score > best.score)) best = { e, score };
  }
  return best;
}

const bestShip = (s: CatanState, id: string, rand: () => number) => shipPlan(s, id, rand)?.e ?? null;

/** The best corner within two steps of `v`, for aiming roads. */
function bestNear(s: CatanState, v: number, id: string): number {
  let best = open(s, v) ? cornerValue(s, v, id) : 0;
  for (const n of geoFor(s).vertices[v].neighbours) {
    if (s.buildings[n] && s.buildings[n]!.player !== id) continue;
    for (const m of geoFor(s).vertices[n].neighbours) if (open(s, m)) best = Math.max(best, cornerValue(s, m, id) * 0.8);
  }
  return best;
}

/** How good the best road is (the corner it heads for), or 0. */
function roadWorth(s: CatanState, id: string): number {
  const spots = legalRoadSpots(s, id);
  let best = 0;
  for (const e of spots) {
    const [a, b] = geoFor(s).edges[e].v;
    const far = s.buildings[a]?.player === id || geoFor(s).vertices[a].edges.some((x) => x !== e && s.roads[x] === id) ? b : a;
    best = Math.max(best, bestNear(s, far, id));
  }
  return best;
}

/** The road that heads for the best corner, or null if none leads anywhere useful. */
function bestRoad(s: CatanState, id: string, rand: () => number, level: Level): number | null {
  const spots = legalRoadSpots(s, id);
  if (spots.length === 0) return null;
  const scored = spots.map((e) => {
    const [a, b] = geoFor(s).edges[e].v;
    const far = s.buildings[a]?.player === id || geoFor(s).vertices[a].edges.some((x) => x !== e && s.roads[x] === id) ? b : a;
    return { e, score: bestNear(s, far, id) + rand() * 0.3 };
  });
  scored.sort((x, y) => y.score - x.score);
  if (scored[0].score <= 0.5) return null;
  return level === 'easy' ? pick(scored.slice(0, 3), rand).e : scored[0].e;
}

/** The build to save for next, and what it costs. */
function target(s: CatanState, id: string): { piece: Piece; cost: Partial<Hand> } | null {
  if (legalCitySpots(s, id).length && count(s, id, 'city') < LIMITS.city) return { piece: 'city', cost: COSTS.city };
  if (legalSettlementSpots(s, id).length && count(s, id, 'settlement') < LIMITS.settlement) return { piece: 'settlement', cost: COSTS.settlement };
  if (s.mode === 'seafarers' && count(s, id, 'ship') < LIMITS.ship && (shipPlan(s, id, () => 0)?.score ?? 0) > roadWorth(s, id)) return { piece: 'ship', cost: COSTS.ship };
  if (count(s, id, 'road') < LIMITS.road && legalRoadSpots(s, id).length && bestRoad(s, id, () => 0, 'normal') !== null) return { piece: 'road', cost: COSTS.road };
  if (count(s, id, 'road') < LIMITS.road && legalRoadSpots(s, id).length) return { piece: 'road', cost: COSTS.road };
  if (s.deckCount > 0) return { piece: 'devCard', cost: COSTS.devCard };
  return null;
}

const missing = (hand: Hand, cost: Partial<Hand>) => RESOURCES.filter((r) => hand[r] < (cost[r] ?? 0));

function bestTile(s: CatanState, id: string, rand: () => number, level: Level): number {
  // A chased robber must go to a numbered tile.
  const tiles = geoFor(s).tiles.map((_, i) => i).filter((i) => i !== s.board.robber && isLand(s.board.terrain[i]) && (!s.chasing || s.board.numbers[i] !== null));
  const mine = (t: number) => geoFor(s).tiles[t].corners.some((c) => s.buildings[c]?.player === id);
  if (level === 'easy') return pick(tiles.filter((t) => !mine(t)), rand) ?? tiles[0];
  const score = (t: number) => {
    if (mine(t)) return -1;
    const n = s.board.numbers[t];
    let v = 0;
    for (const c of geoFor(s).tiles[t].corners) {
      const b = s.buildings[c];
      if (!b) continue;
      v += (b.city ? 2 : 1) * (1 + victoryPoints(s, b.player, false) / 5);
    }
    return v * (n === null ? 0 : PIPS[n]) + rand() * 0.1;
  };
  return tiles.reduce((a, b) => (score(b) > score(a) ? b : a));
}

function discardFor(s: CatanState, id: string): { cards: Partial<Hand>; goods: Partial<Goods> } {
  const me = s.players.find((p) => p.id === id)!;
  return shed(s, id, Math.floor(cardsHeld(me) / 2));
}

/** The `n` cards a bot can best spare: surplus resources first, then commodities its areas need least. */
function shed(s: CatanState, id: string, n: number): { cards: Partial<Hand>; goods: Partial<Goods> } {
  const me = s.players.find((p) => p.id === id)!;
  const hand = { ...me.hand };
  const goal = target(s, id)?.cost ?? {};
  const out = emptyHand();
  const goods: Partial<Goods> = {};
  let need = Math.min(n, cardsHeld(me));
  // Resources first (the most surplus first); commodities only when no resource is left.
  while (need > 0 && RESOURCES.some((x) => hand[x] > 0)) {
    const r = RESOURCES.filter((x) => hand[x] > 0).reduce((a, b) => (hand[b] - (goal[b] ?? 0) > hand[a] - (goal[a] ?? 0) ? b : a));
    hand[r] -= 1;
    out[r] += 1;
    need -= 1;
  }
  const keep = s.mode === 'cities-knights' ? wantedGood(me) : null;
  for (const c of [...COMMODITIES].sort((a, b) => (a === keep ? 1 : 0) - (b === keep ? 1 : 0))) {
    const k = Math.min(need, me.goods[c]);
    if (k > 0) goods[c] = k;
    need -= k;
  }
  return { cards: out, goods };
}

/** Cities & Knights: the commodity a bot is saving for (its most advanced area's). */
const wantedGood = (me: CatanPlayer): Commodity => AREA_GOOD[AREAS.reduce((a, b) => (me.areas[b] > me.areas[a] ? b : a))];

/** How much a bot values a progress card (for which to take, and which to put back). */
const PROGRESS_WORTH: Record<ProgressCard, number> = {
  printer: 9,
  constitution: 9,
  alchemist: 6,
  medicine: 6,
  merchant: 6,
  'master-merchant': 6,
  'resource-monopoly': 6,
  inventor: 5,
  irrigation: 5,
  mining: 5,
  roadbuilding: 5,
  wedding: 5,
  'trade-monopoly': 5,
  smith: 4,
  crane: 4,
  deserter: 4,
  saboteur: 4,
  spy: 4,
  'commercial-harbor': 4,
  engineer: 3,
  warlord: 3,
  bishop: 3,
  diplomat: 3,
  intrigue: 3,
  'merchant-fleet': 3,
};

/** Cities & Knights: the commodity a city on corner `v` would make, by the dice odds of its tiles. */
const commodityWorth = (s: CatanState, v: number) =>
  geoFor(s).vertices[v].tiles.reduce((t, x) => t + (CITY_GOOD[s.board.terrain[x]] && s.board.numbers[x] ? PIPS[s.board.numbers[x]!] * 0.6 : 0), 0);

/** Cities & Knights: how much each player gains from a tile's number (1 per settlement, 2 per city). */
const tileWeight = (s: CatanState, t: number, id: string) =>
  t === s.board.robber ? 0 : geoFor(s).tiles[t].corners.reduce((w, c) => w + (s.buildings[c]?.player === id ? (s.buildings[c]!.city ? 2 : 1) : 0), 0);

/** Cities & Knights: the Alchemist's dice, if the best total pays the bot well enough to spend it. */
function alchemistDice(s: CatanState, id: string, level: Level, rand: () => number): [number, number] | null {
  let best = 0;
  let total = 0;
  for (let t = 2; t <= 12; t++) {
    if (t === 7) continue;
    const pay = s.board.numbers.reduce<number>((sum, n, i) => sum + (n === t ? tileWeight(s, i, id) : 0), 0);
    if (pay > best) [best, total] = [pay, t];
  }
  const enough = level === 'hard' ? 3 : level === 'normal' ? 3 : rand() < 0.3 ? 3 : 99;
  if (best < enough) return null;
  // The red die as low as the total allows: every area then draws progress cards on a gate.
  const red = Math.max(1, total - 6);
  return [red, total - red];
}

/** Cities & Knights: the Inventor's best swap for the bot (its gain less half the best rival's), if worth it. */
function inventorSwap(s: CatanState, id: string): [number, number] | null {
  const tiles = s.board.numbers.flatMap((n, t) => (n !== null && !FIXED_TOKENS.includes(n) ? [t] : []));
  const rivals = s.players.filter((p) => p.id !== id && !p.out);
  const gain = (a: number, b: number, pid: string) => (PIPS[s.board.numbers[b]!] - PIPS[s.board.numbers[a]!]) * (tileWeight(s, a, pid) - tileWeight(s, b, pid));
  let best: [number, number] | null = null;
  let score = 1.5;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const [a, b] = [tiles[i], tiles[j]];
      const v = gain(a, b, id) - 0.5 * Math.max(0, ...rivals.map((p) => gain(a, b, p.id)));
      if (v > score) [best, score] = [[a, b], v];
    }
  }
  return best;
}

/** The cards a bot takes from a hand it is shown: what its next build lacks, then its area's commodity, then the most plentiful. */
function bestCards(s: CatanState, id: string, from: CatanPlayer, n: number): { cards: Partial<Hand>; goods: Partial<Goods> } {
  const me = s.players.find((p) => p.id === id)!;
  const goal = target(s, id)?.cost ?? {};
  const hand = { ...from.hand };
  const stock = { ...from.goods };
  const cards = emptyHand();
  const goods: Partial<Goods> = {};
  const want = s.mode === 'cities-knights' ? wantedGood(me) : null;
  for (let k = 0; k < n; k++) {
    const lack = RESOURCES.find((r) => hand[r] > 0 && me.hand[r] + cards[r] < (goal[r] ?? 0));
    if (lack) {
      hand[lack] -= 1;
      cards[lack] += 1;
    } else if (want && stock[want] > 0) {
      stock[want] -= 1;
      goods[want] = (goods[want] ?? 0) + 1;
    } else {
      const r = RESOURCES.filter((x) => hand[x] > 0).sort((a, b) => hand[b] - hand[a])[0];
      const c = COMMODITIES.filter((x) => stock[x] > 0)[0];
      if (r) {
        hand[r] -= 1;
        cards[r] += 1;
      } else if (c) {
        stock[c] -= 1;
        goods[c] = (goods[c] ?? 0) + 1;
      }
    }
  }
  return { cards, goods };
}

/** Cities & Knights: a bot's answer to the choice it owes. */
function answerAsk(s: CatanState, id: string, level: Level, rand: () => number): CatanAction {
  const a = s.asks![0];
  const me = s.players.find((p) => p.id === id)!;
  const who = (pid: string) => s.players.find((p) => p.id === pid)!;
  switch (a.kind) {
    case 'discard':
    case 'give':
      return { type: 'RESOLVE', ...shed(s, id, a.count) };
    case 'harbor': {
      const c = COMMODITIES.filter((x) => me.goods[x] > 0).sort((x, y) => (x === wantedGood(me) ? 1 : 0) - (y === wantedGood(me) ? 1 : 0) || me.goods[y] - me.goods[x])[0];
      return { type: 'RESOLVE', goods: { [c]: 1 } };
    }
    case 'take':
      return { type: 'RESOLVE', ...bestCards(s, id, who(a.from), Math.min(a.count, cardsHeld(who(a.from)))) };
    case 'spy':
      return { type: 'RESOLVE', progressCard: [...who(a.from).progressCards].sort((x, y) => PROGRESS_WORTH[y] - PROGRESS_WORTH[x])[0] };
    case 'pillage':
      return { type: 'RESOLVE', vertex: pillageable(s, id).reduce((x, y) => (cornerValue(s, y, id) < cornerValue(s, x, id) ? y : x)) };
    case 'draw': {
      // The deck of its most advanced area that still has cards (it sees only the counts).
      const decks = [...AREAS].filter((g) => (s.progressCardDeckCount?.[g] ?? 0) > 0).sort((x, y) => me.areas[y] - me.areas[x]);
      return { type: 'RESOLVE', area: decks[0] };
    }
    case 'progressCard-limit':
      return { type: 'RESOLVE', progressCard: [...me.progressCards].sort((x, y) => PROGRESS_WORTH[x] - PROGRESS_WORTH[y])[0] };
    case 'retreat': {
      const spots = retreatSpots(s, id, a.from);
      return { type: 'RESOLVE', vertex: spots.reduce((x, y) => (cornerValue(s, y, id) > cornerValue(s, x, id) ? y : x)) };
    }
    case 'desert': {
      // Give up the weakest, an inactive one first.
      const mine = knightsOf(s, id).sort((x, y) => s.knights[x]!.level - s.knights[y]!.level || Number(s.knights[x]!.active) - Number(s.knights[y]!.active));
      return { type: 'RESOLVE', vertex: mine[0] };
    }
    case 'hire': {
      const spots = legalKnightSpots(s, id);
      return spots.length ? { type: 'RESOLVE', vertex: pick(spots, rand) } : { type: 'RESOLVE', skip: true };
    }
    case 'road': {
      const spots = legalRoadSpots(s, id).filter((e) => e !== a.skip);
      const road = bestRoad({ ...s, roads: s.roads }, id, rand, level);
      return road !== null && road !== a.skip ? { type: 'RESOLVE', edge: road } : spots.length ? { type: 'RESOLVE', edge: spots[0] } : { type: 'RESOLVE', skip: true };
    }
  }
}

/** Cities & Knights: progress cards, defence against the barbarian ship, areas and walls, before ordinary building. */
function citiesKnightsTurn(s: CatanState, id: string, level: Level, rand: () => number): CatanAction | null {
  const me = s.players.find((p) => p.id === id)!;
  const others = s.players.filter((p) => p.id !== id && !p.out);
  const pts = (pid: string) => victoryPoints(s, pid, false);
  const has = (e: string) => me.progressCards.includes(e as never);
  const mineAt = (v: number) => s.knights[v]?.player === id;
  const myKnights = s.knights.flatMap((w, v) => (w?.player === id ? [v] : []));
  const cities = s.buildings.flatMap((b, v) => (b?.player === id && b.city ? [v] : []));
  // Progress cards that simply pay.
  const tiles = (t: string) => geoFor(s).tiles.some((x, i) => s.board.terrain[i] === t && x.corners.some((c) => s.buildings[c]?.player === id));
  if (has('irrigation') && tiles('fields')) return { type: 'PLAY_PROGRESS', progressCard: 'irrigation' };
  if (has('mining') && tiles('mountains')) return { type: 'PLAY_PROGRESS', progressCard: 'mining' };
  if (has('wedding') && others.some((p) => pts(p.id) > pts(id))) return { type: 'PLAY_PROGRESS', progressCard: 'wedding' };
  if (has('master-merchant')) {
    const rich = others.filter((p) => pts(p.id) > pts(id) && p.handCount > 0);
    if (rich.length) return { type: 'PLAY_PROGRESS', progressCard: 'master-merchant', target: rich[0].id };
  }
  if (has('saboteur') && others.some((p) => pts(p.id) >= pts(id) && p.handCount >= 6)) return { type: 'PLAY_PROGRESS', progressCard: 'saboteur' };
  if (has('spy')) {
    const holder = others.find((p) => p.progressCardCount > 0);
    if (holder) return { type: 'PLAY_PROGRESS', progressCard: 'spy', target: holder.id };
  }
  if (has('resource-monopoly')) {
    const lack = RESOURCES.reduce((a, b) => (me.hand[b] < me.hand[a] ? b : a));
    return { type: 'PLAY_PROGRESS', progressCard: 'resource-monopoly', take: [lack] };
  }
  if (has('trade-monopoly')) return { type: 'PLAY_PROGRESS', progressCard: 'trade-monopoly', take: [AREA_GOOD[AREAS.reduce((a, b) => (me.areas[b] > me.areas[a] ? b : a))]] };
  if (has('engineer') && cities.some((v) => !s.walls[v]) && me.walls < 3) return { type: 'PLAY_PROGRESS', progressCard: 'engineer', vertex: cities.find((v) => !s.walls[v])! };
  if (has('bishop') && s.attacked) return { type: 'PLAY_PROGRESS', progressCard: 'bishop' };
  if (has('roadbuilding') && bestRoad(s, id, rand, level) !== null) return { type: 'PLAY_PROGRESS', progressCard: 'roadbuilding' };
  // The merchant: a point, and a 2:1 rate for the resource it holds most of.
  if (has('merchant') && s.merchant?.player !== id) {
    const near = geoFor(s).tiles.flatMap((t, i) => (YIELD[s.board.terrain[i]] && t.corners.some((c) => s.buildings[c]?.player === id) ? [i] : []));
    if (near.length) {
      const worth = (t: number) => me.hand[YIELD[s.board.terrain[t]]!] + (s.board.numbers[t] ? PIPS[s.board.numbers[t]!] * 0.3 : 0);
      return { type: 'PLAY_PROGRESS', progressCard: 'merchant', tile: near.reduce((x, y) => (worth(y) > worth(x) ? y : x)) };
    }
  }
  if (has('inventor')) {
    const swap = inventorSwap(s, id);
    if (swap) return { type: 'PLAY_PROGRESS', progressCard: 'inventor', tiles: swap };
  }
  // Commercial Harbor: once played, hand each player its most plentiful resource for a commodity.
  if (s.perks.harbor?.length && handSize(me.hand) > 0) {
    const give = RESOURCES.reduce((x, y) => (me.hand[y] > me.hand[x] ? y : x));
    return { type: 'HARBOR', target: s.perks.harbor[0], give };
  }
  if (has('commercial-harbor') && handSize(me.hand) >= 2 && others.some((p) => p.handCount > 0)) return { type: 'PLAY_PROGRESS', progressCard: 'commercial-harbor' };
  if (has('deserter') && legalKnightSpots(s, id).length) {
    const armed = others.filter((p) => knightsOf(s, p.id).length > 0);
    const strength = (pid: string) => knightsOf(s, pid).reduce((t, v) => t + s.knights[v]!.level, 0);
    if (armed.length) return { type: 'PLAY_PROGRESS', progressCard: 'deserter', target: armed.reduce((x, y) => (strength(y.id) > strength(x.id) ? y : x)).id };
  }
  if (has('intrigue')) {
    const rivals = s.knights.flatMap((w, v) => (w && w.player !== id && geoFor(s).vertices[v].edges.some((e) => s.roads[e] === id) ? [v] : []));
    if (rivals.length) return { type: 'PLAY_PROGRESS', progressCard: 'intrigue', vertex: rivals.reduce((x, y) => (s.knights[y]!.level > s.knights[x]!.level ? y : x)) };
  }
  if (has('diplomat') && (level !== 'easy' || rand() < 0.5)) {
    // The open road of the rival furthest ahead.
    const theirs = openRoads(s).filter((e) => s.roads[e] !== id);
    if (theirs.length) return { type: 'PLAY_PROGRESS', progressCard: 'diplomat', edge: theirs.reduce((x, y) => (pts(s.roads[y]!) > pts(s.roads[x]!) ? y : x)) };
  }
  // Chase the robber off your own tile.
  const chase = chasers(s, id);
  if (chase.length && geoFor(s).tiles[s.board.robber].corners.some((c) => s.buildings[c]?.player === id)) return { type: 'CHASE', vertex: chase[0] };
  // Defence: as the barbarian ship nears, field enough strength for your share of the cities.
  const nearing = s.barbarians >= (level === 'easy' ? 6 : 4);
  const strengthOf = (pid: string) => s.knights.reduce((t, w) => t + (w && w.player === pid && w.active ? w.level : 0), 0);
  const strength = strengthOf(id);
  const share = Math.ceil(s.buildings.filter((b) => b?.city).length / Math.max(1, s.players.filter((p) => !p.out).length));
  // Hard reads the other players' (public) knights: if the defence would fall short and it would be among
  // the weakest of those with a city to lose, it strengthens, however far off the barbarian ship still is.
  const barbarians = s.buildings.filter((b) => b?.city).length;
  const defence = s.players.reduce((t, p) => t + strengthOf(p.id), 0);
  const exposed = others.filter((p) => pillageable(s, p.id).length > 0);
  const atRisk = level === 'hard' && s.barbarians >= 3 && pillageable(s, id).length > 0 && defence < barbarians && strength <= Math.min(Infinity, ...exposed.map((p) => strengthOf(p.id)));
  if ((nearing && strength < share) || atRisk) {
    if (has('warlord') && myKnights.some((v) => !s.knights[v]!.active)) return { type: 'PLAY_PROGRESS', progressCard: 'warlord' };
    const inactive = myKnights.find((v) => !s.knights[v]!.active);
    if (inactive !== undefined && canPay(me.hand, KNIGHT_COSTS.activate)) return { type: 'ACTIVATE', vertex: inactive };
    const spots = legalKnightSpots(s, id);
    const ones = s.knights.filter((w) => w?.player === id && w.level === 1).length;
    if (spots.length && ones < KNIGHTS_PER_LEVEL && canPay(me.hand, KNIGHT_COSTS.hire)) return { type: 'BUILD_KNIGHT', vertex: pick(spots, rand) };
  }
  // Promote: free after a Smith, or to stiffen the defence.
  const promotable = myKnights.filter((v) => {
    const w = s.knights[v]!;
    const cap = me.areas.politics >= 3 ? 3 : 2;
    return w.level < cap && w.promoted !== s.round && s.knights.filter((x) => x?.player === id && x.level === w.level + 1).length < KNIGHTS_PER_LEVEL;
  });
  if (promotable.length && (s.perks.smith > 0 || (((nearing && strength < share) || atRisk) && canPay(me.hand, KNIGHT_COSTS.promote)))) return { type: 'PROMOTE', vertex: promotable[0] };
  // Areas: the cheapest level we can pay for, preferring the area furthest along.
  if (has('crane') && AREAS.some((g) => improveCost(s, id, g) !== null)) return { type: 'PLAY_PROGRESS', progressCard: 'crane' };
  const area = [...AREAS]
    .sort((a, b) => me.areas[b] - me.areas[a])
    .find((g) => {
      const cost = improveCost(s, id, g);
      return cost !== null && me.goods[AREA_GOOD[g]] >= cost;
    });
  if (area && (level !== 'easy' || rand() < 0.5)) return { type: 'IMPROVE', area };
  // Hard: one commodity short of its leading area's next level, it buys the commodity from the bank with spare cards.
  if (level === 'hard') {
    const lead = [...AREAS].sort((a, b) => me.areas[b] - me.areas[a]).find((g) => improveCost(s, id, g) !== null);
    if (lead) {
      const good = AREA_GOOD[lead];
      const short = improveCost(s, id, lead)! - me.goods[good];
      const goal = target(s, id)?.cost ?? {};
      if (short === 1 && s.goodsBank[good] > 0) {
        // Spare commodities only: four resources for one commodity costs more than it brings.
        const spareGood = COMMODITIES.find((c) => c !== good && me.goods[c] >= bankRatio(s, id, c));
        const spareRes = RESOURCES.find((r) => bankRatio(s, id, r) <= 2 && me.hand[r] - (goal[r] ?? 0) >= 2);
        const give = spareGood ?? spareRes;
        if (give) return { type: 'BANK_TRADE', give, get: good };
      }
    }
  }
  if (has('smith') && myKnights.some((v) => s.knights[v]!.level < 2 && s.knights[v]!.promoted !== s.round)) return { type: 'PLAY_PROGRESS', progressCard: 'smith' };
  if (has('medicine') && legalCitySpots(s, id).length && canPay(me.hand, KNIGHT_COSTS.medicine)) return { type: 'PLAY_PROGRESS', progressCard: 'medicine' };
  if (has('warlord') && s.barbarians >= BARBARIAN_TRACK - 2) return { type: 'PLAY_PROGRESS', progressCard: 'warlord' };
  // A wall when cards pile up.
  if (cardsHeld(me) >= 8 && cities.some((v) => !s.walls[v]) && me.walls < 3 && canPay(me.hand, KNIGHT_COSTS.wall)) return { type: 'BUILD_WALL', vertex: cities.find((v) => !s.walls[v])! };
  void mineAt;
  return null;
}

/** Development cards worth playing now. */
function devCardPlay(s: CatanState, id: string, level: Level, rand: () => number): CatanAction | null {
  const me = s.players.find((p) => p.id === id)!;
  if (s.playedDevCard) return null;
  const can = (card: string) => me.devCards.some((c) => c.card === card && c.bought < s.round);
  const blocked = geoFor(s).tiles[s.board.robber].corners.some((c) => s.buildings[c]?.player === id);
  // Hard plays a knight when the robber blocks it, or when it takes the Largest Army; Normal also at random.
  const takesArmy = me.knightsPlayed + 1 >= ARMY_MIN && me.knightsPlayed + 1 > s.largestArmy.size && s.largestArmy.player !== id;
  if (can('knight') && (blocked || (level === 'hard' ? takesArmy : level === 'normal' && rand() < 0.4))) return { type: 'PLAY_DEVELOPMENT', card: 'knight' };
  if (s.phase === 'roll') return null;
  const goal = target(s, id);
  if (can('yearOfPlenty') && goal) {
    const lack = missing(me.hand, goal.cost);
    const want: Resource[] = [];
    for (const r of lack) for (let k = me.hand[r]; k < (goal.cost[r] ?? 0) && want.length < 2; k++) want.push(r);
    while (want.length < 2) want.push(lack[0] ?? 'ore');
    const counts = emptyHand();
    for (const r of want) counts[r] += 1;
    if (lack.length && RESOURCES.every((r) => s.bank[r] >= counts[r])) return { type: 'PLAY_DEVELOPMENT', card: 'yearOfPlenty', take: want };
  }
  if (can('roadBuilding') && LIMITS.road - count(s, id, 'road') >= 2 && bestRoad(s, id, rand, level) !== null) return { type: 'PLAY_DEVELOPMENT', card: 'roadBuilding' };
  const othersCards = s.players.filter((p) => p.id !== id && !p.out).reduce((t, p) => t + p.handCount, 0);
  if (can('monopoly') && goal && othersCards >= 8) {
    const lack = missing(me.hand, goal.cost);
    if (lack.length) return { type: 'PLAY_DEVELOPMENT', card: 'monopoly', take: [lack[0]] };
  }
  // Hard: with nothing better to play this turn, a knight sends the robber to the leader.
  if (level === 'hard' && can('knight')) return { type: 'PLAY_DEVELOPMENT', card: 'knight' };
  return null;
}

/** Out of turn at a table of 5 or 6: build what it can afford, else pass. */
function specialBuild(s: CatanState, id: string, level: Level, rand: () => number): CatanAction {
  const build = mainTurn(s, id, level, rand, true);
  return build.type.startsWith('BUILD_') || build.type === 'BUY_DEVELOPMENT' ? build : { type: 'END_TURN' };
}

function mainTurn(s: CatanState, id: string, level: Level, rand: () => number, buildOnly = false): CatanAction {
  const me = s.players.find((p) => p.id === id)!;
  const play = buildOnly ? null : s.mode === 'cities-knights' ? citiesKnightsTurn(s, id, level, rand) : devCardPlay(s, id, level, rand);
  if (play) return play;

  // Hard, in Cities & Knights: a corner on forest, pasture or mountains is worth more, since a city there makes commodities.
  const worth = (v: number) => cornerValue(s, v, id) + (level === 'hard' && s.mode === 'cities-knights' ? commodityWorth(s, v) : 0);
  const cities = legalCitySpots(s, id);
  if (cities.length && count(s, id, 'city') < LIMITS.city && canPay(me.hand, COSTS.city)) {
    return { type: 'BUILD_CITY', vertex: cities.reduce((a, b) => (worth(b) > worth(a) ? b : a)) };
  }
  const spots = legalSettlementSpots(s, id);
  if (spots.length && count(s, id, 'settlement') < LIMITS.settlement && canPay(me.hand, COSTS.settlement)) {
    const ranked = [...spots].sort((a, b) => worth(b) - worth(a));
    return { type: 'BUILD_SETTLEMENT', vertex: level === 'easy' ? pick(ranked.slice(0, 3), rand) : ranked[0] };
  }
  // Seafarers: sail for the outer islands when that beats the best road.
  const voyage = s.mode === 'seafarers' && spots.length === 0 && count(s, id, 'ship') < LIMITS.ship ? shipPlan(s, id, rand) : null;
  const sail = !!voyage && voyage.score > roadWorth(s, id);
  if (sail && canPay(me.hand, COSTS.ship)) return { type: 'BUILD_SHIP', edge: voyage!.e };
  if (!sail && spots.length === 0 && count(s, id, 'road') < LIMITS.road && canPay(me.hand, COSTS.road)) {
    const road = bestRoad(s, id, rand, level);
    if (road !== null) return { type: 'BUILD_ROAD', edge: road };
  }
  const goal = target(s, id);
  if (s.deckCount > 0 && canPay(me.hand, COSTS.devCard) && (!goal || goal.piece === 'devCard' || goal.piece === 'road' || handSize(me.hand) > 7)) {
    return { type: 'BUY_DEVELOPMENT' };
  }
  // Hard: one card short of its next build, it offers the table a spare card for it (once a turn).
  if (level === 'hard' && goal && !offeredThisTurn(s, id)) {
    const lack = missing(me.hand, goal.cost);
    if (lack.length === 1 && (goal.cost[lack[0]] ?? 0) - me.hand[lack[0]] === 1) {
      // The spare card the other players' next builds call for most (their builds are public; their hands are not).
      const wanted = (r: Resource) => s.players.filter((p) => p.id !== id && !p.out && (target(s, p.id)?.cost[r] ?? 0) > 0).length;
      const spare = RESOURCES.filter((r) => r !== lack[0] && me.hand[r] - (goal.cost[r] ?? 0) >= 2).sort((a, b) => wanted(b) - wanted(a) || me.hand[b] - me.hand[a]);
      if (spare.length) return { type: 'OFFER', give: { [spare[0]]: 1 }, get: { [lack[0]]: 1 } };
    }
  }
  // Trade surplus with the bank to finish the next build.
  if (goal) {
    const lack = missing(me.hand, goal.cost);
    if (lack.length) {
      for (const r of RESOURCES) {
        const spare = me.hand[r] - (goal.cost[r] ?? 0);
        const ratio = bankRatio(s, id, r);
        if (spare >= ratio && s.bank[lack[0]] > 0) return { type: 'BANK_TRADE', give: r, get: lack[0] };
      }
    }
  }
  return { type: 'END_TURN' };
}

/** Whether `id` has already put an offer to the table this turn (the log back to this turn's roll). */
function offeredThisTurn(s: CatanState, id: string): boolean {
  for (const e of s.log) {
    if (e.kind === 'roll') return false;
    if (e.kind === 'offer' && e.player === id) return true;
  }
  return false;
}

function answer(s: CatanState, id: string, level: Level, rand: () => number): boolean {
  const o = s.offer!;
  if (level === 'easy') return rand() < 0.3;
  if (victoryPoints(s, o.from, false) >= 8) return false;
  const me = s.players.find((p) => p.id === id)!;
  const goal = target(s, id)?.cost ?? {};
  // Cities & Knights: the commodity it saves for is worth taking, and not worth giving.
  const want = s.mode === 'cities-knights' ? wantedGood(me) : null;
  const helps = RESOURCES.some((r) => (o.give[r] ?? 0) > 0 && me.hand[r] < (goal[r] ?? 0)) || (!!want && (o.giveGoods?.[want] ?? 0) > 0);
  const spare = RESOURCES.every((r) => me.hand[r] - (o.get[r] ?? 0) >= (goal[r] ?? 0)) && (!want || !(o.getGoods?.[want] ?? 0));
  return helps && spare && handSize(o.get) + goodsSize(o.getGoods ?? {}) <= handSize(o.give) + goodsSize(o.giveGoods ?? {}) + 1;
}

export function catanBot(full: CatanState, rand: () => number): CatanAction {
  const id = catanActor(full)!;
  const s = redactCatan(full, id);
  const me = s.players.find((p) => p.id === id)!;
  const level = (['easy', 'normal', 'hard'].includes(me.difficulty ?? '') ? me.difficulty : 'normal') as Level;
  // Cities & Knights: a choice owed comes first.
  if (s.asks?.length) return answerAsk(s, id, level, rand);
  if (s.phase === 'roll' && s.mode === 'cities-knights' && me.progressCards.includes('alchemist')) {
    const dice = alchemistDice(s, id, level, rand);
    if (dice) return { type: 'PLAY_PROGRESS', progressCard: 'alchemist', dice };
  }
  switch (s.phase) {
    case 'setup': {
      if (s.setup!.needRoad) {
        const road = bestRoad(s, id, rand, level);
        if (road === null && legalRoadSpots(s, id).length === 0) return { type: 'BUILD_SHIP', edge: legalShipSpots(s, id)[0] };
        return { type: 'BUILD_ROAD', edge: road ?? legalRoadSpots(s, id)[0] };
      }
      // Hard, in Cities & Knights: the second placement is a city, so it looks for commodity tiles.
      const city = level === 'hard' && s.mode === 'cities-knights' && s.setup!.step >= s.players.length;
      const value = (v: number) => cornerValue(s, v, id) + (city ? commodityWorth(s, v) : 0);
      const spots = legalSettlementSpots(s, id).sort((a, b) => value(b) - value(a));
      return { type: 'BUILD_SETTLEMENT', vertex: level === 'easy' ? pick(spots.slice(0, 6), rand) : spots[0] };
    }
    case 'roll':
      return devCardPlay(s, id, level, rand) ?? { type: 'ROLL' };
    case 'discard': {
      const d = discardFor(s, id);
      return { type: 'DISCARD', cards: d.cards, goods: d.goods };
    }
    case 'robber':
      return { type: 'MOVE_ROBBER', tile: bestTile(s, id, rand, level) };
    case 'steal': {
      const victim = s.stealFrom.reduce((a, b) => ((s.players.find((p) => p.id === b)?.handCount ?? 0) > (s.players.find((p) => p.id === a)?.handCount ?? 0) ? b : a));
      return { type: 'STEAL', from: victim };
    }
    case 'special':
      return specialBuild(s, id, level, rand);
    case 'roadBuilding': {
      const road = bestRoad(s, id, rand, level);
      if (road !== null || s.mode !== 'seafarers') return { type: 'BUILD_ROAD', edge: road ?? legalRoadSpots(s, id)[0] };
      const ship = bestShip(s, id, rand) ?? legalShipSpots(s, id)[0];
      return ship !== undefined ? { type: 'BUILD_SHIP', edge: ship } : { type: 'BUILD_ROAD', edge: legalRoadSpots(s, id)[0] };
    }
    case 'gold': {
      // Take what the next build lacks, else what the hand has least of.
      const due = s.gold[0].count;
      const want = target(s, id)?.cost ?? {};
      const hand = { ...me.hand };
      const cards = emptyHand();
      for (let k = 0; k < due; k++) {
        const r =
          RESOURCES.find((x) => hand[x] < (want[x] ?? 0) && s.bank[x] - cards[x] > 0) ??
          RESOURCES.filter((x) => s.bank[x] - cards[x] > 0).reduce((a, b) => (hand[b] < hand[a] ? b : a), RESOURCES.find((x) => s.bank[x] - cards[x] > 0) ?? 'lumber');
        cards[r] += 1;
        hand[r] += 1;
      }
      return { type: 'PICK_GOLD', cards };
    }
    case 'offer': {
      const o = s.offer!;
      if (o.asked[0] === id) return { type: 'ANSWER', accept: answer(s, id, level, rand) };
      const yes = Object.keys(o.answers).find((k) => o.answers[k]);
      return { type: 'CLOSE_OFFER', with: yes ?? null };
    }
    default:
      return mainTurn(s, id, level, rand);
  }
}
