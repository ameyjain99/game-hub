import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fly } from '../../../shared/fly';
import { GameShell, SideSection } from '../../kit/ui/GameShell';
import { PlayersPanel, tokenLabel } from '../../kit/ui/PlayersPanel';
import { ResultCard } from '../../kit/ui/ResultCard';
import { KitVideos, type KitScreenProps } from '../../kit/ui/KitOnline';
import { Die } from '../../kit/ui/Die';
import { TableMomentBanner, freshEvents, useTableMoments, type TableMoment } from '../../../shared/ui/TableMoment';
import { useCues } from '../../kit/ui/useCues';
import { RESOURCES, geoOf, isLand, type Resource } from '../board';
import { COMMODITIES, PROGRESS_NAME, PROGRESS_NEEDS, FIXED_TOKENS, AREAS, AREA_NAME, KNIGHTS_PER_LEVEL, emptyGoods, goodsSize, type Card, type ProgressCard } from '../citiesKnights';
import { AskPanel, ProgressCardDialog, ProgressCardsSection, BarbariansSection, AREA_COLOR, GoodsCards, AreasSection, HarborSection, askStatus } from './CitiesKnightsUI';
import { Cards, GOOD_NAME, GoodsPicker, Picker, RES_COLOR, RES_NAME, cardsText } from './cards';
import {
  COSTS,
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
  movableShips,
  knightMoves,
  chasers,
  cardsHeld,
  bankRatio,
  openRoads,
  pillageable,
  retreatSpots,
  knightsOf,
  KNIGHT_COSTS,
  winPoints,
  victoryPoints,
  type Ask,
  type DevCard,
  type Hand,
  type CatanAction,
  type CatanEvent,
  type CatanState,
  type Piece,
} from '../engine';
import { Island } from './Island';
import { CATAN_SOUNDS, catanCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2F6FDB', '#F28C28', '#8E5BD6', '#2E9E5B', '#9C6B3F'];

/** The seat whose turn comes next. */
const nextLive = (s: CatanState) => {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (s.turn + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return s.turn;
};
export const catanSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

const DEV_CARD_NAME: Record<DevCard, string> = { knight: 'Knight', victoryPoint: 'Victory Point', roadBuilding: 'Road Building', yearOfPlenty: 'Year of Plenty', monopoly: 'Monopoly' };
const DEV_CARD_TEXT: Record<DevCard, string> = {
  knight: 'Move the robber and rob a neighbour. Counts toward the Largest Army.',
  victoryPoint: '1 point, kept hidden until the end.',
  roadBuilding: 'Build two roads for free.',
  yearOfPlenty: 'Take any two cards from the bank.',
  monopoly: 'Name a resource: every other player gives you all of it.',
};
const PIECE_NAME: Record<Piece, string> = { road: 'Road', settlement: 'Settlement', city: 'City', devCard: 'Development card', ship: 'Ship' };

type ProgressCardMode = 'inventor' | 'merchant' | 'diplomat' | 'intrigue';
type Mode = 'road' | 'settlement' | 'city' | 'ship' | 'move' | 'knight' | 'wall' | 'activate' | 'promote' | 'shift' | 'chase' | ProgressCardMode | null;
const KNIGHT_MODE_TEXT: Partial<Record<Exclude<Mode, null>, string>> = {
  knight: 'Pick a corner on your road for the knight',
  wall: 'Pick a city for the wall',
  activate: 'Pick an inactive knight to activate',
  promote: 'Pick a knight to promote',
  shift: 'Pick an active knight, then where it goes',
  chase: 'Pick the knight that chases the robber',
  inventor: 'Inventor · pick two number tokens to swap',
  merchant: 'Merchant · pick a tile next to your settlement or city',
  diplomat: 'Diplomat · pick an open road to remove',
  intrigue: "Intrigue · pick a rival's knight on your road",
};
/** Progress cards played by picking something on the island. */
const BOARD_PROGRESS_CARDS: Partial<Record<ProgressCard, ProgressCardMode>> = { inventor: 'inventor', merchant: 'merchant', diplomat: 'diplomat', intrigue: 'intrigue' };
/** What clicking a highlighted corner does while you owe a choice. */
const ASK_VERTEX: Partial<Record<Ask['kind'], string>> = {
  pillage: 'Lose this city',
  retreat: 'Move your knight here',
  desert: 'Give up this knight',
  hire: 'Place your knight here',
};

function describe(e: CatanEvent, who: (id: string) => string): string {
  const w = e.player ? who(e.player) : '';
  const s = (verb: string, base = verb) => (w === 'You' ? base : verb);
  // Another player as the object of a sentence, and possessives.
  const obj = (id: string) => (who(id) === 'You' ? 'you' : who(id));
  const poss = (id: string) => (who(id) === 'You' ? 'your' : `${who(id)}'s`);
  const held = (n?: number) => `${n ?? 'some'} ${n === 1 ? 'card' : 'cards'}`;
  switch (e.kind) {
    case 'roll':
      return `${w} ${s('rolled', 'rolled')} ${e.dice![0]} + ${e.dice![1]}`;
    case 'produce':
      return `${w} ${s('gets', 'get')} ${cardsText(e.cards, e.goods)}`;
    case 'build':
      return `${w} ${s('builds', 'build')} a ${e.text === 'wall' ? 'wall' : PIECE_NAME[e.piece!].toLowerCase()}`;
    case 'buy':
      return `${w} ${s('buys', 'buy')} a development card`;
    case 'play':
      return `${w} ${s('plays', 'play')} ${DEV_CARD_NAME[e.card!]}`;
    case 'robber':
      return `${w} ${s('moves', 'move')} the robber`;
    case 'pirate':
      return `${w} ${s('moves', 'move')} the pirate`;
    case 'move-ship':
      return `${w} ${s('moves', 'move')} a ship`;
    case 'islandBonus':
      return `${w} ${s('settles', 'settle')} a new island (+2)`;
    case 'eventDie':
      return e.eventDie === 'ship' ? 'The event die shows a ship: the barbarians sail closer' : `The event die shows the ${AREA_NAME[e.eventDie!]} gate`;
    case 'attack':
      return e.text === 'pillaged'
        ? `The barbarians pillage one of ${poss(e.player!)} cities`
        : e.text === 'defended' && w
          ? `The barbarians are beaten off: ${w} ${s('takes', 'take')} a Defender of Catan point`
          : e.text === 'defended-tie'
            ? 'The barbarians are beaten off: a tie for the best defence, so the tied players draw progress cards'
            : 'The barbarians are beaten off';
    case 'improve':
      return `${w} ${s('improves', 'improve')} the ${AREA_NAME[e.area!]} area`;
    case 'metropolis':
      return `${w} ${s('takes', 'take')} the ${AREA_NAME[e.area!]} Metropolis (+2)`;
    case 'knight':
      switch (e.text) {
        case 'hire':
          return `${w} ${s('hires', 'hire')} a knight`;
        case 'activate':
          return `${w} ${s('activates', 'activate')} a knight`;
        case 'promote':
          return `${w} ${s('promotes', 'promote')} a knight`;
        case 'displace':
          return `${w} ${s('pushes', 'push')} off ${poss(e.target!)} knight`;
        case 'chase':
          return `${w} ${s('chases', 'chase')} the robber`;
        case 'desert':
          return `${w} ${s('gives', 'give')} up a knight to the Deserter`;
        case 'hire':
          return `${w} ${s('places', 'place')} a knight (Deserter)`;
        case 'retreat':
          return `${w} ${s('moves', 'move')} a pushed knight along ${w === 'You' ? 'your' : 'their'} roads`;
        case 'lost':
          return `${w === 'You' ? 'Your' : `${w}'s`} pushed knight has nowhere to go and leaves the board`;
        default:
          return `${w} ${s('moves', 'move')} a knight`;
      }
    case 'progressCard':
      if (e.text === 'play') return `${w} ${s('plays', 'play')} ${PROGRESS_NAME[e.progressCard!]}`;
      if (e.text === 'point') return `${w} ${s('draws', 'draw')} ${PROGRESS_NAME[e.progressCard!]} (+1)`;
      if (e.text === 'spy') return `${w} ${s('takes', 'take')} a progress card from ${obj(e.target!)}`;
      if (e.text === 'discard') return `${w} ${s('puts', 'put')} a ${AREA_NAME[e.area!]} progress card back under its deck`;
      return `${w} ${s('draws', 'draw')} a ${AREA_NAME[e.area!]} progress card`;
    case 'steal': {
      const what = e.cards || e.goods ? cardsText(e.cards, e.goods) : held(e.n);
      if (e.text === 'given') return `${who(e.target!)} ${who(e.target!) === 'You' ? 'give' : 'gives'} ${obj(e.player!)} ${what}`;
      if (e.text === 'taken') return `${w} ${s('takes', 'take')} ${what} from ${poss(e.target!)} hand`;
      return `${w} ${s('robs', 'rob')} ${obj(e.target!)}${e.cards || e.goods ? ` of ${what}` : ''}`;
    }
    case 'discard': {
      const n = handSize(e.cards ?? {}) + goodsSize(e.goods ?? {});
      return `${w} ${s('discards', 'discard')} ${held(n)}`;
    }
    case 'trade':
      return e.target
        ? `${w} ${s('trades', 'trade')} ${cardsText(e.paid, e.paidGoods)} to ${obj(e.target)} for ${cardsText(e.cards, e.goods)}`
        : `${w} ${s('takes', 'take')} ${cardsText(e.cards) || 'nothing'} from the market`;
    case 'bank':
      return `${w} ${s('trades', 'trade')} ${cardsText(e.paid, e.paidGoods)} with the bank for ${cardsText(e.cards, e.goods)}`;
    case 'offer':
      return `${w} ${s('offers', 'offer')} ${cardsText(e.paid, e.paidGoods)} for ${cardsText(e.cards, e.goods)}`;
    case 'harbor':
      return e.text === 'none'
        ? `${who(e.target!)} ${who(e.target!) === 'You' ? 'have' : 'has'} no commodities: no Commercial Harbor trade`
        : `${who(e.target!)} ${who(e.target!) === 'You' ? 'give' : 'gives'} ${obj(e.player!)} ${cardsText(undefined, e.goods)} for a resource (Commercial Harbor)`;
    case 'swap':
      return `${w} ${s('swaps', 'swap')} the ${e.text} number tokens`;
    case 'unroad':
      return `${w} ${s('removes', 'remove')} ${e.target === e.player ? (w === 'You' ? 'your own' : 'their own') : poss(e.target!)} road`;
    case 'award':
      return `${w} ${s('takes', 'take')} ${e.award === 'longest' ? 'the Longest Road' : 'the Largest Army'}`;
    case 'win':
      return `${w} ${s('wins', 'win')}!`;
    case 'out':
      return `${w} left the game`;
  }
}

function TradePanel({ s, meId, onAction, onClose }: { s: CatanState; meId: string; onAction: (a: CatanAction) => void; onClose: () => void }) {
  const me = s.players.find((p) => p.id === meId)!;
  const [give, setGive] = useState(emptyHand());
  const [get, setGet] = useState(emptyHand());
  const [giveGoods, setGiveGoods] = useState(emptyGoods());
  const [getGoods, setGetGoods] = useState(emptyGoods());
  const knights = s.mode === 'cities-knights';
  const cards: Card[] = knights ? [...RESOURCES, ...COMMODITIES] : RESOURCES;
  const have = (c: Card) => ((COMMODITIES as string[]).includes(c) ? me.goods[c as keyof typeof me.goods] : me.hand[c as Resource]);
  const cardName = (c: Card) => ((COMMODITIES as string[]).includes(c) ? GOOD_NAME[c as keyof typeof GOOD_NAME] : RES_NAME[c as Resource]);
  const [bankGive, setBankGive] = useState<Card>(cards.find((c) => have(c) >= bankRatio(s, meId, c)) ?? 'lumber');
  const [bankGet, setBankGet] = useState<Card>('ore');
  const ratio = bankRatio(s, meId, bankGive);
  const clash = RESOURCES.some((r) => give[r] > 0 && get[r] > 0) || COMMODITIES.some((c) => giveGoods[c] > 0 && getGoods[c] > 0);
  const giving = handSize(give) + goodsSize(giveGoods);
  const getting = handSize(get) + goodsSize(getGoods);
  return (
    <section className="catan-panel catan-trade" role="dialog" aria-label="Trade">
      <header className="catan-panel-head">
        <h3>Trade</h3>
        <button type="button" className="catan-panel-close" onClick={onClose} aria-label="Close trade">
          ×
        </button>
      </header>
      <div className="catan-trade-bank">
        <h4>With the bank</h4>
        <p className="kit-muted">Your rates: {cards.map((c) => `${cardName(c)} ${bankRatio(s, meId, c)}:1`).join(' · ')}</p>
        <div className="catan-bank-row">
          <label>
            Give {ratio}
            <select aria-label="Give the bank" value={bankGive} onChange={(e) => setBankGive(e.target.value as Card)}>
              {cards.map((c) => (
                <option key={c} value={c}>
                  {cardName(c)} (you have {have(c)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Get 1
            <select aria-label="Get from the bank" value={bankGet} onChange={(e) => setBankGet(e.target.value as Card)}>
              {cards
                .filter((c) => c !== bankGive)
                .map((c) => (
                  <option key={c} value={c}>
                    {cardName(c)}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="g-btn g-btn-light g-btn-sm"
            disabled={have(bankGive) < ratio || bankGet === bankGive || ((COMMODITIES as string[]).includes(bankGet) ? s.goodsBank[bankGet as keyof typeof s.goodsBank] : s.bank[bankGet as Resource]) < 1}
            onClick={() => onAction({ type: 'BANK_TRADE', give: bankGive, get: bankGet })}
          >
            Trade
          </button>
        </div>
      </div>
      <div className="catan-trade-offer">
        <h4>With the players</h4>
        <div className="catan-offer-sides">
          <div>
            <p className="catan-side-label">You give</p>
            <Picker value={give} onChange={setGive} max={me.hand} />
            {knights && <GoodsPicker value={giveGoods} onChange={setGiveGoods} max={me.goods} room />}
          </div>
          <div>
            <p className="catan-side-label">You want</p>
            <Picker value={get} onChange={setGet} />
            {knights && <GoodsPicker value={getGoods} onChange={setGetGoods} room />}
          </div>
        </div>
        <button
          type="button"
          className="primary g-block"
          disabled={!giving || !getting || clash}
          onClick={() => {
            onAction(knights ? { type: 'OFFER', give, get, giveGoods, getGoods } : { type: 'OFFER', give, get });
            onClose();
          }}
        >
          {clash ? "Don't ask for what you're giving" : 'Offer to the table'}
        </button>
      </div>
    </section>
  );
}

/** Other terms for a trade on the table: what you would give, and what you want for it. */
function CounterPanel({ me, onSend, onCancel }: { me: CatanState['players'][number]; onSend: (give: Hand, get: Hand) => void; onCancel: () => void }) {
  const [give, setGive] = useState(emptyHand());
  const [get, setGet] = useState(emptyHand());
  const giving = RESOURCES.some((r) => give[r] > 0);
  const getting = RESOURCES.some((r) => get[r] > 0);
  const clash = RESOURCES.some((r) => give[r] > 0 && get[r] > 0);
  return (
    <div className="catan-counter-form">
      <div className="catan-offer-sides">
        <div>
          <p className="catan-side-label">You give</p>
          <Picker value={give} onChange={setGive} max={me.hand} />
        </div>
        <div>
          <p className="catan-side-label">You want</p>
          <Picker value={get} onChange={setGet} />
        </div>
      </div>
      <div className="catan-choice">
        <button type="button" className="primary" disabled={!giving || !getting || clash} onClick={() => onSend(give, get)}>
          Send counter-offer
        </button>
        <button type="button" className="g-btn g-btn-ghost" onClick={onCancel}>
          Back
        </button>
      </div>
    </div>
  );
}

/** The Catan table: the island, your hand and actions below it, the players and log alongside. */
export function CatanGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<CatanState, CatanAction>) {
  const s = view;
  const [mode, setMode] = useState<Mode>(null);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  // Seafarers setup and Road Building: whether the next free piece is a road or a ship.
  const [freePiece, setFreePiece] = useState<'road' | 'ship'>('road');
  const [knightFrom, setKnightFrom] = useState<number | null>(null);
  // Inventor: the first token picked.
  const [inventFirst, setInventFirst] = useState<number | null>(null);
  const [progressCardPick, setProgressCardPick] = useState<ProgressCard | null>(null);
  const [goodsPick, setGoodsPick] = useState(emptyGoods());
  const [trading, setTrading] = useState(false);
  const [pick, setPick] = useState<Hand>(emptyHand());
  const [choosing, setChoosing] = useState<'yearOfPlenty' | 'monopoly' | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  // Production you can see: a card for each resource flies from a tile that
  // paid to the player who got it.
  const seenLog = useRef(view.log);
  useEffect(() => {
    const fresh = freshEvents(seenLog.current, view.log);
    seenLog.current = view.log;
    const tiles = [...document.querySelectorAll('.catan-tile.is-producing .catan-hex')];
    if (tiles.length === 0) return;
    let n = 0;
    for (const e of fresh) {
      if (e.kind !== 'produce' || !e.player) continue;
      const to = document.querySelector(`[data-player="${e.player}"]`);
      for (const r of RESOURCES) {
        for (let i = 0; i < Math.min(e.cards?.[r] ?? 0, 3); i++) {
          const color = RES_COLOR[r];
          fly({
            from: tiles[n % tiles.length],
            to,
            delay: 250 + 70 * n++,
            ms: 640,
            scaleTo: 0.7,
            make: () => {
              const el = document.createElement('span');
              el.className = 'catan-flyer';
              el.style.background = color;
              return el;
            },
          });
        }
      }
    }
  }, [view.log]);
  useCues(view, (a, b) => catanCues(a, b, meId, catanActor), CATAN_SOUNDS);
  // The swings of the game: an award changing hands, the robber moved, a raid, an island bonus.
  const moment = useTableMoments(view, (a, b): TableMoment[] =>
    freshEvents(a.log, b.log).flatMap((e): TableMoment[] => {
      if (e.kind === 'roll' && e.dice && e.dice[0] + e.dice[1] === 7) {
        const owing = b.discards.map((id) => (id === meId ? 'You' : nameFor(id)));
        return [
          {
            kicker: e.player === meId ? 'You' : nameFor(e.player!),
            title: 'rolled a 7!',
            detail: owing.length ? `${owing.join(', ')} must discard half ${owing.length === 1 && owing[0] !== 'You' ? 'their' : owing.length === 1 ? 'your' : 'their'} cards. Then the robber moves.` : 'Nobody has to discard. The robber moves.',
            color: '#e2483b',
          },
        ];
      }
      if (!['award', 'robber', 'pirate', 'islandBonus', 'attack', 'metropolis', 'out'].includes(e.kind)) return [];
      const name = (id: string) => (id === meId ? 'You' : nameFor(id));
      const text = describe(e, name);
      const w = e.player ? name(e.player) : '';
      const title = w && text.startsWith(`${w} `) ? text.slice(w.length + 1) : text;
      return [{ kicker: w && title !== text ? w : undefined, title, color: e.player ? catanSeatColor(b.players.findIndex((p) => p.id === e.player)) : '#f2c548', feels: e.player ? { [e.player]: e.kind === 'out' || e.text === 'pillaged' ? 'bad' : 'good' } : undefined }];
    }),
  );

  const seat = s.players.findIndex((p) => p.id === meId);
  const me = s.players[seat];
  const actor = catanActor(s);
  const myMove = actor === meId;
  const myTurn = s.players[s.turn]?.id === meId && s.phase !== 'setup';
  // Your own main phase, or your go in a 5-6 player special build phase.
  const special = s.phase === 'special' && myMove;
  const buildTime = (myTurn && s.phase === 'main') || special;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const colorOf = (id: string) => catanSeatColor(s.players.findIndex((p) => p.id === id));
  // Cities & Knights: a choice owed by someone holds the table until it is made.
  const ask = s.asks?.[0] ?? null;
  const myAsk = ask && ask.player === meId ? ask : null;

  // Leave a placement mode once the moment has passed.
  useEffect(() => {
    if (!buildTime) setMode(null);
    if (s.phase !== 'main') setTrading(false);
    setPick(emptyHand());
    setGoodsPick(emptyGoods());
    setMoveFrom(null);
    setKnightFrom(null);
    setInventFirst(null);
  }, [s.phase, s.seq, buildTime]);

  // Esc leaves a placement or a panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMode(null);
      setTrading(false);
      setChoosing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const promotable = s.mode === 'cities-knights' && me
    ? s.knights.flatMap((w, v) => {
        if (w?.player !== meId) return [];
        const cap = me.areas.politics >= 3 ? 3 : 2;
        return w.level < cap && w.promoted !== s.round && s.knights.filter((x) => x?.player === meId && x.level === w.level + 1).length < KNIGHTS_PER_LEVEL ? [v] : [];
      })
    : [];
  let vertices: number[] = [];
  let edges: number[] = [];
  let tiles: number[] = [];
  let shipEdges: number[] = [];
  let movable: number[] = [];
  const geo = geoOf(s.board);
  if (myAsk && me) {
    // A choice you owe that is made on the island.
    if (myAsk.kind === 'pillage') vertices = pillageable(s, meId);
    else if (myAsk.kind === 'retreat') vertices = retreatSpots(s, meId, myAsk.from);
    else if (myAsk.kind === 'desert') vertices = knightsOf(s, meId);
    else if (myAsk.kind === 'hire') vertices = legalKnightSpots(s, meId);
    else if (myAsk.kind === 'road') edges = legalRoadSpots(s, meId).filter((e) => e !== myAsk.skip);
  } else if (myMove && me) {
    const freeChoice = (s.phase === 'setup' && s.setup!.needRoad) || s.phase === 'roadBuilding';
    if (freeChoice) {
      // At sea a coast side takes either piece: show the one picked in the dock.
      const roads = legalRoadSpots(s, meId);
      const ships = legalShipSpots(s, meId);
      const which = s.mode === 'seafarers' ? (freePiece === 'ship' && ships.length ? 'ship' : roads.length ? 'road' : 'ship') : 'road';
      if (which === 'road') edges = roads;
      else shipEdges = ships;
    } else if (s.phase === 'setup') vertices = legalSettlementSpots(s, meId);
    else if (s.phase === 'robber')
      tiles = geoOf(s.board)
        .tiles.map((_, i) => i)
        .filter((i) => (s.board.terrain[i] === 'sea' ? s.mode === 'seafarers' && i !== s.board.pirate : i !== s.board.robber && (!s.chasing || s.board.numbers[i] !== null)));
    else if (buildTime && mode === 'ship') shipEdges = legalShipSpots(s, meId);
    else if (buildTime && mode === 'knight') vertices = legalKnightSpots(s, meId);
    else if (buildTime && mode === 'wall') vertices = s.buildings.flatMap((b, v) => (b?.player === meId && b.city && !s.walls[v] ? [v] : []));
    else if (buildTime && mode === 'activate') vertices = s.knights.flatMap((w, v) => (w?.player === meId && !w.active ? [v] : []));
    else if (buildTime && mode === 'promote') vertices = promotable;
    else if (myTurn && s.phase === 'main' && mode === 'shift') vertices = knightFrom === null ? s.knights.flatMap((w, v) => (w?.player === meId && knightMoves(s, meId, v).length ? [v] : [])) : knightMoves(s, meId, knightFrom);
    else if (myTurn && s.phase === 'main' && mode === 'chase') vertices = chasers(s, meId);
    else if (myTurn && s.phase === 'main' && mode === 'inventor')
      tiles = s.board.numbers.flatMap((n, t) => (n !== null && !FIXED_TOKENS.includes(n) && t !== inventFirst ? [t] : []));
    else if (myTurn && s.phase === 'main' && mode === 'merchant')
      tiles = geo.tiles.flatMap((t, i) => (isLand(s.board.terrain[i]) && t.corners.some((c) => s.buildings[c]?.player === meId) ? [i] : []));
    else if (myTurn && s.phase === 'main' && mode === 'diplomat') edges = openRoads(s);
    else if (myTurn && s.phase === 'main' && mode === 'intrigue')
      vertices = s.knights.flatMap((w, v) => (w && w.player !== meId && geo.vertices[v].edges.some((e) => s.roads[e] === meId) ? [v] : []));
    else if (buildTime && mode === 'move') {
      if (moveFrom === null) movable = movableShips(s, meId);
      else shipEdges = legalShipSpots(s, meId, moveFrom);
    } else if (buildTime && mode === 'road') edges = legalRoadSpots(s, meId);
    else if (buildTime && mode === 'settlement') vertices = legalSettlementSpots(s, meId);
    else if (buildTime && mode === 'city') vertices = legalCitySpots(s, meId);
  }

  const place = (a: CatanAction) => {
    onAction(a);
    setMode(null);
  };
  const total = s.dice ? s.dice[0] + s.dice[1] : null;
  const producing = total && total !== 7 && s.phase !== 'roll' ? s.board.numbers.flatMap((n, i) => (n === total && i !== s.board.robber ? [i] : [])) : [];
  const rollCount = s.rolls.reduce((a, b) => a + b, 0);

  type Built = 'road' | 'settlement' | 'city' | 'ship';
  const pieceLeft: Record<Built, number> = me
    ? {
        road: LIMITS.road - s.roads.filter((r) => r === meId).length,
        settlement: LIMITS.settlement - s.buildings.filter((b) => b?.player === meId && !b.city).length,
        city: LIMITS.city - s.buildings.filter((b) => b?.player === meId && b.city).length,
        ship: LIMITS.ship - (s.ships ?? []).filter((r) => r === meId).length,
      }
    : { road: 0, settlement: 0, city: 0, ship: 0 };
  const spotsFor = (p: Built) => (p === 'road' ? legalRoadSpots(s, meId) : p === 'settlement' ? legalSettlementSpots(s, meId) : p === 'ship' ? legalShipSpots(s, meId) : legalCitySpots(s, meId));
  const canBuild = (p: Built) => buildTime && !!me && canPay(me.hand, COSTS[p]) && pieceLeft[p] > 0 && spotsFor(p).length > 0;
  const builds: Built[] = s.mode === 'seafarers' ? ['road', 'ship', 'settlement', 'city'] : ['road', 'settlement', 'city'];
  const goldDue = s.phase === 'gold' && s.gold[0]?.player === meId ? s.gold[0].count : 0;

  const discardNeed = me ? Math.floor(cardsHeld(me) / 2) : 0;
  const discardPicked = handSize(pick) + goodsSize(goodsPick);
  const offer = s.offer;
  const offerPending = s.phase === 'offer' && offer;

  const board = (
    <div className={`kit-board catan-board${mode ? ` is-placing-${mode}` : ''}`}>
      <Island
        s={s}
        colorOf={colorOf}
        vertices={vertices}
        edges={edges}
        tiles={tiles}
        shipEdges={shipEdges}
        movable={movable}
        producing={producing}
        spotlight={spotlight}
        marked={mode === 'inventor' && inventFirst !== null ? [inventFirst] : []}
        vertexLabel={myAsk ? (ASK_VERTEX[myAsk.kind] ?? 'Pick this') : mode === 'intrigue' ? "Push off this knight" : mode && KNIGHT_MODE_TEXT[mode] ? KNIGHT_MODE_TEXT[mode] : 'Build here'}
        edgeLabel={myAsk?.kind === 'road' ? 'Build your road here' : mode === 'diplomat' ? 'Remove this road' : 'Build a road here'}
        tileLabel={mode === 'inventor' ? (inventFirst === null ? 'Swap this token' : 'Swap with this token') : mode === 'merchant' ? 'Put the merchant here' : undefined}
        onVertex={(v) => {
          if (myAsk) onAction({ type: 'RESOLVE', vertex: v });
          else if (mode === 'intrigue') place({ type: 'PLAY_PROGRESS', progressCard: 'intrigue', vertex: v });
          else if (mode === 'knight') place({ type: 'BUILD_KNIGHT', vertex: v });
          else if (mode === 'wall') place({ type: 'BUILD_WALL', vertex: v });
          else if (mode === 'activate') place({ type: 'ACTIVATE', vertex: v });
          else if (mode === 'promote') place({ type: 'PROMOTE', vertex: v });
          else if (mode === 'chase') place({ type: 'CHASE', vertex: v });
          else if (mode === 'shift') {
            if (knightFrom === null) setKnightFrom(v);
            else {
              place({ type: 'MOVE_KNIGHT', from: knightFrom, to: v });
              setKnightFrom(null);
            }
          } else if (s.phase === 'setup' || mode === 'settlement') place({ type: 'BUILD_SETTLEMENT', vertex: v });
          else place({ type: 'BUILD_CITY', vertex: v });
        }}
        onEdge={(e) => {
          if (myAsk) onAction({ type: 'RESOLVE', edge: e });
          else if (mode === 'diplomat') place({ type: 'PLAY_PROGRESS', progressCard: 'diplomat', edge: e });
          else place({ type: 'BUILD_ROAD', edge: e });
        }}
        onShipEdge={(e) => {
          if (mode === 'move' && moveFrom !== null) {
            place({ type: 'MOVE_SHIP', from: moveFrom, to: e });
            setMoveFrom(null);
          } else place({ type: 'BUILD_SHIP', edge: e });
        }}
        onShip={(e) => setMoveFrom(e)}
        onTile={(t) => {
          if (mode === 'inventor') {
            if (inventFirst === null) setInventFirst(t);
            else {
              place({ type: 'PLAY_PROGRESS', progressCard: 'inventor', tiles: [inventFirst, t] });
              setInventFirst(null);
            }
          } else if (mode === 'merchant') place({ type: 'PLAY_PROGRESS', progressCard: 'merchant', tile: t });
          else onAction({ type: 'MOVE_ROBBER', tile: t });
        }}
      />

      {/* Prompts that need you, over the board. */}
      {myAsk && <AskPanel key={`${s.seq}-${myAsk.kind}`} s={s} meId={meId} nameFor={who} onAction={onAction} />}
      {myMove && s.phase === 'discard' && me && (
        <section className="catan-panel" role="dialog" aria-label="Discard">
          <header className="catan-panel-head">
            <h3>Discard {discardNeed} cards</h3>
          </header>
          <p className="kit-muted">A 7 was rolled and you hold more cards than your limit. Choose half of them (rounded down) to give back.</p>
          <Picker value={pick} onChange={setPick} max={me.hand} limit={discardNeed - goodsSize(goodsPick)} />
          {s.mode === 'cities-knights' && <GoodsPicker value={goodsPick} onChange={setGoodsPick} max={me.goods} room={discardPicked < discardNeed} />}
          <button type="button" className="primary g-block" disabled={discardPicked !== discardNeed} onClick={() => onAction({ type: 'DISCARD', cards: pick, goods: goodsPick })}>
            Discard {discardPicked} / {discardNeed}
          </button>
        </section>
      )}
      {goldDue > 0 && me && (
        <section className="catan-panel" role="dialog" aria-label="Gold field">
          <header className="catan-panel-head">
            <h3>Gold field: pick {goldDue}</h3>
          </header>
          <p className="kit-muted">A gold field paid you. Take any {goldDue === 1 ? 'resource' : `${goldDue} resources`} from the bank.</p>
          <Picker value={pick} onChange={setPick} max={s.bank} limit={goldDue} />
          <button type="button" className="primary g-block" disabled={handSize(pick) !== Math.min(goldDue, handSize(s.bank))} onClick={() => onAction({ type: 'PICK_GOLD', cards: pick })}>
            Take {handSize(pick)} / {goldDue}
          </button>
        </section>
      )}
      {myMove && s.phase === 'steal' && (
        <section className="catan-panel is-small" role="dialog" aria-label="Rob a player">
          <header className="catan-panel-head">
            <h3>Rob a player</h3>
          </header>
          <div className="catan-choice">
            {s.stealFrom.map((id) => (
              <button key={id} type="button" className="g-btn g-btn-light" onClick={() => onAction({ type: 'STEAL', from: id })}>
                {who(id)} · {s.players.find((p) => p.id === id)?.handCount} cards
              </button>
            ))}
          </div>
        </section>
      )}
      {offerPending && offer.from !== meId && me && !me.out && (
        <section className="catan-panel is-small" role="dialog" aria-label="Trade offer">
          <header className="catan-panel-head">
            <h3>{who(offer.from)} offers a trade</h3>
          </header>
          <p className="catan-offer-line">
            You get <Cards size="md" cards={offer.give} goods={offer.giveGoods} /> for <Cards size="md" cards={offer.get} goods={offer.getGoods} />
          </p>
          {offer.counters?.[meId] ? (
            <p className="kit-muted">
              Your counter-offer is with {who(offer.from)}: <Cards size="md" cards={offer.counters[meId].give} /> for <Cards size="md" cards={offer.counters[meId].get} />
            </p>
          ) : meId in offer.answers ? (
            <p className="kit-muted">{offer.answers[meId] ? `You said yes. It is ${who(offer.from)}'s choice now.` : 'You said no.'}</p>
          ) : countering ? (
            <CounterPanel me={me} onSend={(give, get) => { onAction({ type: 'COUNTER', give, get }); setCountering(false); }} onCancel={() => setCountering(false)} />
          ) : (
            <div className="catan-choice">
              {offer.asked.includes(meId) ? (
                <>
                  <button type="button" className="primary" onClick={() => onAction({ type: 'ANSWER', accept: true })}>
                    Accept
                  </button>
                  <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'ANSWER', accept: false })}>
                    Decline
                  </button>
                </>
              ) : (
                <span className="kit-muted">You don't hold what they want.</span>
              )}
              <button type="button" className="g-btn g-btn-ghost" onClick={() => setCountering(true)}>
                Counter
              </button>
            </div>
          )}
        </section>
      )}
      {offerPending && offer.from === meId && (
        <section className="catan-panel is-small" role="dialog" aria-label="Your offer">
          <header className="catan-panel-head">
            <h3>Your offer</h3>
          </header>
          <p className="catan-offer-line">
            <Cards size="md" cards={offer.give} goods={offer.giveGoods} /> for <Cards size="md" cards={offer.get} goods={offer.getGoods} />
          </p>
          <ul className="catan-answers">
            {Object.entries(offer.answers)
              .filter(([id]) => !offer.counters?.[id])
              .map(([id, yes]) => (
                <li key={id}>
                  {who(id)}: {yes ? 'accepts' : 'declines'}
                  {yes && (
                    <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => onAction({ type: 'CLOSE_OFFER', with: id })}>
                      Trade with {who(id)}
                    </button>
                  )}
                </li>
              ))}
            {Object.entries(offer.counters ?? {}).map(([id, c]) => (
              <li key={id} className="catan-counter">
                <span>
                  {who(id)} counters: gives <Cards size="md" cards={c.give} /> for <Cards size="md" cards={c.get} />
                </span>
                <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => onAction({ type: 'CLOSE_OFFER', with: id, counter: true })}>
                  Take it
                </button>
              </li>
            ))}
            {offer.asked.map((id) => (
              <li key={id} className="kit-muted">
                {who(id)}: thinking...
              </li>
            ))}
          </ul>
          <button type="button" className="g-btn g-btn-ghost g-block" onClick={() => onAction({ type: 'CLOSE_OFFER', with: null })}>
            Withdraw the offer
          </button>
        </section>
      )}
      {trading && myTurn && s.phase === 'main' && <TradePanel s={s} meId={meId} onAction={onAction} onClose={() => setTrading(false)} />}
      {progressCardPick && myTurn && !ask && (s.phase === 'main' || (progressCardPick === 'alchemist' && s.phase === 'roll')) && (
        <ProgressCardDialog s={s} meId={meId} progressCard={progressCardPick} onAction={onAction} onClose={() => setProgressCardPick(null)} />
      )}
      {choosing && myTurn && me && (
        <section className="catan-panel is-small" role="dialog" aria-label={DEV_CARD_NAME[choosing]}>
          <header className="catan-panel-head">
            <h3>{DEV_CARD_NAME[choosing]}</h3>
            <button type="button" className="catan-panel-close" onClick={() => setChoosing(null)} aria-label="Cancel">
              ×
            </button>
          </header>
          <p className="kit-muted">{choosing === 'yearOfPlenty' ? 'Choose two cards from the bank.' : 'Name one resource. Every other player gives you all they hold of it.'}</p>
          {choosing === 'yearOfPlenty' ? (
            <>
              <Picker value={pick} onChange={setPick} max={s.bank} limit={2} />
              <button
                type="button"
                className="primary g-block"
                disabled={handSize(pick) !== 2}
                onClick={() => {
                  onAction({ type: 'PLAY_DEVELOPMENT', card: 'yearOfPlenty', take: RESOURCES.flatMap((r) => Array<Resource>(pick[r]).fill(r)) });
                  setChoosing(null);
                }}
              >
                Take them
              </button>
            </>
          ) : (
            <div className="catan-choice is-grid">
              {RESOURCES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="catan-res-btn"
                  style={{ '--rc': RES_COLOR[r] } as CSSProperties}
                  onClick={() => {
                    onAction({ type: 'PLAY_DEVELOPMENT', card: 'monopoly', take: [r] });
                    setChoosing(null);
                  }}
                >
                  {RES_NAME[r]}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );

  const dock = me && !s.over && (
    <div className="catan-dock">
      <div className="catan-dice">
        <Die value={s.dice?.[0] ?? null} rollKey={rollCount} size={40} label={s.mode === 'cities-knights' ? 'Red die' : 'First die'} />
        <Die value={s.dice?.[1] ?? null} rollKey={rollCount} size={40} label={s.mode === 'cities-knights' ? 'Yellow die' : 'Second die'} />
        {s.mode === 'cities-knights' && (
          <span className="catan-event-die" title="The event die" style={{ '--oc': s.eventDie && s.eventDie !== 'ship' ? AREA_COLOR[s.eventDie] : '#1a557b' } as CSSProperties}>
            {s.eventDie ? (s.eventDie === 'ship' ? 'Ship' : AREA_NAME[s.eventDie]) : 'EventDie'}
          </span>
        )}
        {myMove && !ask && s.phase === 'roll' && (
          <button type="button" className="primary catan-roll" onClick={() => onAction({ type: 'ROLL' })}>
            Roll
          </button>
        )}
      </div>
      <div className="catan-hand" aria-label="Your cards">
        {RESOURCES.map((r) => (
          <span key={r} className={`catan-card${me.hand[r] === 0 ? ' is-empty' : ''}`} style={{ '--rc': RES_COLOR[r] } as CSSProperties} title={RES_NAME[r]}>
            <b>{me.hand[r]}</b>
            <span>{RES_NAME[r]}</span>
          </span>
        ))}
        {s.mode === 'cities-knights' && <GoodsCards goods={me.goods} />}
      </div>
      <div className="catan-actions">
        {s.mode === 'seafarers' && myMove && ((s.phase === 'setup' && s.setup!.needRoad) || s.phase === 'roadBuilding') && (
          <div className="catan-free-pick" role="radiogroup" aria-label="Free piece">
            {(['road', 'ship'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={freePiece === k} className={`catan-build${freePiece === k ? ' is-on' : ''}`} onClick={() => setFreePiece(k)}>
                <span>Place a {k}</span>
              </button>
            ))}
          </div>
        )}
        {s.phase === 'setup' ? (
          <p className="catan-setup-hint">
            {s.mode === 'cities-knights'
              ? 'Setup: a settlement and a road each, then a city and a road in reverse order. The city pays your first cards.'
              : `Setup: a settlement and a ${s.mode === 'seafarers' ? 'road or ship' : 'road'} each, then again in reverse order. The second settlement pays your first cards.`}{' '}
            Building opens once everyone is placed.
          </p>
        ) : (
          <>
          {builds.map((p) => (
            <button
              key={p}
              type="button"
              className={`catan-build${mode === p ? ' is-on' : ''}`}
              disabled={!canBuild(p)}
              aria-pressed={mode === p}
              onClick={() => setMode(mode === p ? null : p)}
              title={`${PIECE_NAME[p]}: ${cardsText(COSTS[p])} · ${pieceLeft[p]} left`}
            >
              <span>{PIECE_NAME[p]}</span>
              <Cards cards={COSTS[p]} />
            </button>
          ))}
          {s.mode === 'seafarers' && (
            <button
              type="button"
              className={`catan-build${mode === 'move' ? ' is-on' : ''}`}
              disabled={!(myTurn && s.phase === 'main' && movableShips(s, meId).length > 0)}
              aria-pressed={mode === 'move'}
              onClick={() => {
                setMoveFrom(null);
                setMode(mode === 'move' ? null : 'move');
              }}
              title="Move one ship at the open end of a line, once a turn"
            >
              <span>Move ship</span>
              <span className="kit-muted">{s.shipMoved ? 'moved' : 'once a turn'}</span>
            </button>
          )}
          {s.mode === 'cities-knights' ? (
            <>
              {(
                [
                  ['knight', 'Knight', KNIGHT_COSTS.hire, legalKnightSpots(s, meId).length > 0 && s.knights.filter((w) => w?.player === meId && w.level === 1).length < KNIGHTS_PER_LEVEL, 'Hire a knight on your road'],
                  ['activate', 'Activate', KNIGHT_COSTS.activate, s.knights.some((w) => w?.player === meId && !w.active), 'Activate an inactive knight'],
                  ['promote', 'Promote', s.perks.smith > 0 ? {} : KNIGHT_COSTS.promote, promotable.length > 0, s.perks.smith > 0 ? `Promote for free (${s.perks.smith} left)` : 'Promote a knight'],
                  ['wall', 'Wall', KNIGHT_COSTS.wall, s.buildings.some((b, v) => b?.player === meId && b.city && !s.walls[v]) && me.walls < 3, 'A wall raises your hand limit by 2'],
                ] as const
              ).map(([k, name, cost, possible, title]) => (
                <button
                  key={k}
                  type="button"
                  className={`catan-build${mode === k ? ' is-on' : ''}`}
                  disabled={!(buildTime && possible && canPay(me.hand, cost))}
                  aria-pressed={mode === k}
                  onClick={() => setMode(mode === k ? null : k)}
                  title={`${title}: ${cardsText(cost) || 'free'}`}
                >
                  <span>{name}</span>
                  <Cards cards={cost} />
                </button>
              ))}
              <button
                type="button"
                className={`catan-build${mode === 'shift' ? ' is-on' : ''}`}
                disabled={!(myTurn && s.phase === 'main' && s.knights.some((w, v) => w?.player === meId && knightMoves(s, meId, v).length > 0))}
                aria-pressed={mode === 'shift'}
                onClick={() => {
                  setKnightFrom(null);
                  setMode(mode === 'shift' ? null : 'shift');
                }}
                title="Move an active knight along your roads, or push off a weaker rival knight"
              >
                <span>Move knight</span>
                <span className="kit-muted">inactive after</span>
              </button>
              <button
                type="button"
                className={`catan-build${mode === 'chase' ? ' is-on' : ''}`}
                disabled={!(myTurn && s.phase === 'main' && chasers(s, meId).length > 0)}
                aria-pressed={mode === 'chase'}
                onClick={() => setMode(mode === 'chase' ? null : 'chase')}
                title="An active knight beside the robber chases it off (after the barbarian ship's first attack)"
              >
                <span>Chase robber</span>
                <span className="kit-muted">inactive after</span>
              </button>
          </>
        ) : (
          <button
            type="button"
            className="catan-build"
            disabled={!(buildTime && canPay(me.hand, COSTS.devCard) && s.deckCount > 0)}
            onClick={() => onAction({ type: 'BUY_DEVELOPMENT' })}
            title={`Development card: ${cardsText(COSTS.devCard)} · ${s.deckCount} left`}
          >
            <span>DevCard</span>
            <Cards cards={COSTS.devCard} />
          </button>
        )}
        <button type="button" className="g-btn g-btn-light" disabled={!(myTurn && s.phase === 'main')} onClick={() => setTrading((t) => !t)}>
          Trade
        </button>
        <button type="button" className="primary" disabled={!buildTime} onClick={() => onAction({ type: 'END_TURN' })}>
          {special ? 'Done building' : 'End turn'}
        </button>
          </>
        )}
      </div>
    </div>
  );

  const mine = me?.devCards ?? [];
  const devCardCounts = mine.reduce<Partial<Record<DevCard, number>>>((m, c) => ({ ...m, [c.card]: (m[c.card] ?? 0) + 1 }), {});
  const canPlay = (card: DevCard) =>
    myTurn && !s.playedDevCard && card !== 'victoryPoint' && mine.some((c) => c.card === card && c.bought < s.round) && (s.phase === 'main' || (s.phase === 'roll' && card === 'knight'));
  const maxRoll = Math.max(1, ...s.rolls);

  const side = (
    <>
      <KitVideos
        online={online}
        meId={meId}
        nameFor={nameFor}
        onSeatHover={setSpotlight}
        seats={s.players
          .filter((p) => !p.isAI && !p.out)
          .map((p) => ({ id: p.id, accent: colorOf(p.id), active: actor === p.id, badge: <span className="kit-badge" style={{ '--tc': colorOf(p.id) } as CSSProperties}>{tokenLabel(nameFor(p.id))}</span> }))}
      />
      <PlayersPanel
        title={s.phase === 'setup' ? `Setting up · ${winPoints(s)} points wins` : `Turn ${s.round} · ${winPoints(s)} points wins`}
        spotlight={spotlight}
        onSpotlight={setSpotlight}
        players={s.players.map((p, i) => ({
          id: p.id,
          name: nameFor(p.id),
          you: p.id === meId,
          color: catanSeatColor(i),
          detail: [
            `${p.handCount} ${p.handCount === 1 ? 'card' : 'cards'}`,
            p.devCardCount ? `${p.devCardCount} ${p.devCardCount === 1 ? 'devCard' : 'devCards'}` : null,
            p.knightsPlayed ? `${p.knightsPlayed} ${p.knightsPlayed === 1 ? 'knight' : 'knights'}` : null,
            s.longestRoad.player === p.id ? (s.mode === 'seafarers' ? 'Longest Trade Route' : 'Longest Road') : null,
            s.islandBonus?.[p.id]?.length ? `${s.islandBonus[p.id].length} island bonus` : null,
            s.mode === 'cities-knights' ? AREAS.filter((g) => p.areas[g] > 0).map((g) => `${AREA_NAME[g]} ${p.areas[g]}`).join(' · ') || null : null,
            s.mode === 'cities-knights' && p.progressCardCount ? `${p.progressCardCount} ${p.progressCardCount === 1 ? 'progressCard' : 'progressCards'}` : null,
            s.mode === 'cities-knights' && p.defender ? `${p.defender} defender` : null,
            s.merchant?.player === p.id ? 'Merchant' : null,
            s.largestArmy.player === p.id ? 'Largest Army' : null,
          ]
            .filter(Boolean)
            .join(' · '),
          trailing: victoryPoints(s, p.id, p.id === meId || s.over),
          active: actor === p.id,
          out: p.out,
        }))}
      />
      {s.mode === 'cities-knights' && (
        <>
          <BarbariansSection s={s} />
          <AreasSection s={s} meId={meId} canAct={myTurn && s.phase === 'main'} onAction={onAction} />
          <ProgressCardsSection
            s={s}
            meId={meId}
            canPlay={(e) => !ask && myTurn && (e === 'alchemist' ? s.phase === 'roll' : s.phase === 'main')}
            onPick={(e) => {
              const board = BOARD_PROGRESS_CARDS[e];
              if (board) {
                setInventFirst(null);
                setMode(board);
              } else if (!PROGRESS_NEEDS[e]) onAction({ type: 'PLAY_PROGRESS', progressCard: e });
              else setProgressCardPick(e);
            }}
          />
          {myTurn && s.phase === 'main' && !ask && (s.perks.harbor?.length ?? 0) > 0 && <HarborSection s={s} meId={meId} onAction={onAction} />}
        </>
      )}
      {me && s.mode !== 'cities-knights' && (
        <SideSection title="Your development cards" meta={`${s.deckCount} in the deck`}>
          {mine.length === 0 ? (
            <p className="kit-muted">Buy one for wool, grain and ore. Knights move the robber; Victory Point cards are hidden points.</p>
          ) : (
            <ul className="catan-dev-cards">
              {(Object.keys(devCardCounts) as DevCard[]).map((card) => (
                <li key={card}>
                  <span>
                    <b>
                      {DEV_CARD_NAME[card]}
                      {devCardCounts[card]! > 1 ? ` ×${devCardCounts[card]}` : ''}
                    </b>
                    <span className="kit-muted">{DEV_CARD_TEXT[card]}</span>
                  </span>
                  {card !== 'victoryPoint' && (
                    <button
                      type="button"
                      className="g-btn g-btn-light g-btn-sm"
                      disabled={!canPlay(card)}
                      onClick={() => {
                        if (card === 'yearOfPlenty' || card === 'monopoly') {
                          setPick(emptyHand());
                          setChoosing(card);
                        } else onAction({ type: 'PLAY_DEVELOPMENT', card });
                      }}
                    >
                      Play
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SideSection>
      )}
      <SideSection title="Dice so far" meta={`${rollCount} ${rollCount === 1 ? 'roll' : 'rolls'}`}>
        <div className="catan-dice-stats" aria-label="How often each total has been rolled">
          {Array.from({ length: 11 }, (_, k) => k + 2).map((n) => (
            <div key={n} className={`catan-stat${total === n ? ' is-last' : ''}`}>
              <span className="catan-stat-bar" style={{ height: `${(s.rolls[n] / maxRoll) * 100}%` }} />
              <span className="catan-stat-n">{n}</span>
            </div>
          ))}
        </div>
      </SideSection>
    </>
  );

  let status;
  const actorName = actor ? who(actor) : '';
  if (s.over && s.winner) status = <><strong>{who(s.winner)}</strong> {s.winner === meId ? 'win' : 'wins'} with {victoryPoints(s, s.winner)} points</>;
  else if (ask) {
    const { mine, text } = askStatus(ask, meId, who);
    status = mine ? <strong>{text}</strong> : <>{text}...</>;
  }
  else if (s.phase === 'setup') {
    const piece = s.setup!.needRoad ? (s.mode === 'seafarers' ? 'road or ship next to it' : 'road next to it') : s.mode === 'cities-knights' && s.setup!.step >= s.players.length ? 'city' : 'settlement';
    status = myMove ? <><strong>Your setup</strong> · place a {piece}</> : <><strong>{actorName}</strong> is settling...</>;
  }
  else if (s.phase === 'roll') status = myMove ? <><strong>Your turn</strong> · roll the dice</> : <><strong>{actorName}</strong> to roll</>;
  else if (s.phase === 'discard') status = myMove ? <><strong>Discard {discardNeed}</strong> cards</> : <>Waiting for <strong>{actorName}</strong> to discard</>;
  else if (s.phase === 'robber')
    status = myMove ? (
      s.bishop ? (
        <><strong>Bishop</strong> · move the robber; you rob a card from everyone beside its new tile</>
      ) : s.chasing ? (
        <><strong>Chase the robber</strong> to another numbered tile</>
      ) : (
        <><strong>Move the robber</strong> to another tile{s.mode === 'seafarers' ? ', or the pirate to another sea tile' : ''}</>
      )
    ) : (
      <><strong>{actorName}</strong> moves the {s.mode === 'seafarers' ? 'robber or the pirate' : 'robber'}</>
    );
  else if (s.phase === 'gold') status = goldDue ? <><strong>Gold field</strong> · pick {goldDue} from the bank</> : <><strong>{actorName}</strong> is picking gold field pay</>;
  else if (s.phase === 'steal') status = myMove ? <><strong>Choose</strong> whom to rob</> : <><strong>{actorName}</strong> is robbing...</>;
  else if (s.phase === 'roadBuilding') status = myMove ? <><strong>Road Building</strong> · place {s.freeRoads} free {s.freeRoads === 1 ? 'road' : 'roads'}</> : <><strong>{actorName}</strong> is building roads</>;
  else if (s.phase === 'offer') status = offer!.from === meId ? <><strong>Your offer</strong> · waiting for answers</> : <><strong>{who(offer!.from)}</strong> is trading</>;
  else if (s.phase === 'special') status = special ? (mode ? (mode === 'move' ? (moveFrom === null ? <><strong>Pick a ship</strong> to move · Esc to cancel</> : <><strong>Pick where it sails</strong> · Esc to cancel</>) : (KNIGHT_MODE_TEXT[mode] ? <><strong>{mode === 'shift' && knightFrom !== null ? 'Pick where the knight goes' : KNIGHT_MODE_TEXT[mode]}</strong> · Esc to cancel</> : <><strong>Place your {PIECE_NAME[mode as Piece].toLowerCase()}</strong> · Esc to cancel</>)) : <><strong>Special build</strong> · build or buy before {who(s.players[nextLive(s)].id)}&apos;s turn, or press Done</>) : <><strong>{actorName}</strong> may build out of turn</>;
  else status = myTurn ? (mode ? (mode === 'move' ? (moveFrom === null ? <><strong>Pick a ship</strong> to move · Esc to cancel</> : <><strong>Pick where it sails</strong> · Esc to cancel</>) : (KNIGHT_MODE_TEXT[mode] ? <><strong>{mode === 'shift' && knightFrom !== null ? 'Pick where the knight goes' : KNIGHT_MODE_TEXT[mode]}</strong> · Esc to cancel</> : <><strong>Place your {PIECE_NAME[mode as Piece].toLowerCase()}</strong> · Esc to cancel</>)) : <><strong>Your turn</strong> · build, trade or end it</>) : <><strong>{actorName}</strong> is building...</>;

  const overlay = s.over && s.winner ? (
    <ResultCard
      title={s.winner === meId ? 'You win Catan' : `${nameFor(s.winner)} wins`}
      won={s.winner === meId}
      onRematch={() => onAction({ type: 'REMATCH' })}
      rematchLabel="New island"
      onExit={onExit}
      exitLabel={exitLabel}
      delayMs={1000}
    >
      <ol className="pk-standings">
        {[...s.players]
          .sort((a, b) => victoryPoints(s, b.id) - victoryPoints(s, a.id))
          .map((p) => (
            <li key={p.id}>
              <span>{victoryPoints(s, p.id)} pts</span> {nameFor(p.id)}
            </li>
          ))}
      </ol>
    </ResultCard>
  ) : null;

  return (
    <GameShell
      rulesVariant={s.mode === 'seafarers' ? 'sea' : s.mode === 'cities-knights' ? 'cities-knights' : s.board.layout === 'large' ? 'large' : 'standard'}
      className={`catan-game is-${s.mode ?? 'base'}`}
      title="Catan"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={
        <div className="catan-stage">
          {board}
          {dock}
        </div>
      }
      overlay={
        <>
          <TableMomentBanner moment={moment} place="top" />
          {overlay}
        </>
      }
      side={side}
      log={
        <SideSection title="Game log">
          {s.log.length === 0 ? (
            <p className="kit-muted">Every roll, build, trade and raid is listed here as it happens.</p>
          ) : (
            <ul className="kit-log">
              {s.log.map((e) => (
                <li key={e.seq}>{describe(e, who)}</li>
              ))}
            </ul>
          )}
        </SideSection>
      }
    />
  );
}
