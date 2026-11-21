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
import { COMMODITIES, EDICT_NAME, EDICT_NEEDS, FIXED_TOKENS, GUILDS, GUILD_NAME, WARDENS_PER_LEVEL, emptyGoods, goodsSize, type Card, type Edict } from '../wardens';
import { AskPanel, EdictDialog, EdictsSection, FleetSection, GUILD_COLOR, GoodsCards, GuildsSection, HarborSection, askStatus } from './WardensUI';
import { Cards, GOOD_NAME, GoodsPicker, Picker, RES_COLOR, RES_NAME, cardsText } from './cards';
import {
  COSTS,
  LIMITS,
  canPay,
  emptyHand,
  handSize,
  hexActor,
  legalHomesteadSpots,
  legalRoadSpots,
  legalShipSpots,
  legalTownSpots,
  legalWardenSpots,
  movableShips,
  wardenMoves,
  chasers,
  cardsHeld,
  bankRatio,
  openRoads,
  pillageable,
  retreatSpots,
  wardensOf,
  WARDEN_COSTS,
  winPoints,
  victoryPoints,
  type Ask,
  type Charter,
  type Hand,
  type HxAction,
  type HxEvent,
  type HxState,
  type Piece,
} from '../engine';
import { Island } from './Island';
import { HX_SOUNDS, hxCues } from './sound';

const SEAT_COLORS = ['#E5383B', '#2F6FDB', '#F28C28', '#8E5BD6', '#2E9E5B', '#9C6B3F'];

/** The seat whose turn comes next. */
const nextLive = (s: HxState) => {
  for (let k = 1; k <= s.players.length; k++) {
    const i = (s.turn + k) % s.players.length;
    if (!s.players[i].out) return i;
  }
  return s.turn;
};
export const hxSeatColor = (i: number) => SEAT_COLORS[i % SEAT_COLORS.length];

const CHARTER_NAME: Record<Charter, string> = { ranger: 'Ranger', monument: 'Monument', roadworks: 'Roadworks', bounty: 'Bounty', market: 'Market' };
const CHARTER_TEXT: Record<Charter, string> = {
  ranger: 'Move the raider and rob a neighbour. Counts toward the Biggest Guard.',
  monument: '1 point, kept hidden until the end.',
  roadworks: 'Build two roads for free.',
  bounty: 'Take any two cards from the bank.',
  market: 'Name a resource: every other player gives you all of it.',
};
const PIECE_NAME: Record<Piece, string> = { road: 'Road', homestead: 'Homestead', town: 'Town', charter: 'Charter card', ship: 'Ship' };

type EdictMode = 'inventor' | 'merchant' | 'diplomat' | 'intrigue';
type Mode = 'road' | 'homestead' | 'town' | 'ship' | 'move' | 'warden' | 'wall' | 'muster' | 'promote' | 'shift' | 'chase' | EdictMode | null;
const WARDEN_MODE_TEXT: Partial<Record<Exclude<Mode, null>, string>> = {
  warden: 'Pick a corner on your road for the warden',
  wall: 'Pick a town for the wall',
  muster: 'Pick a resting warden to muster',
  promote: 'Pick a warden to promote',
  shift: 'Pick a mustered warden, then where it goes',
  chase: 'Pick the warden that chases the raider',
  inventor: 'Inventor · pick two number tokens to swap',
  merchant: 'Merchant · pick a tile next to your homestead or town',
  diplomat: 'Diplomat · pick an open road to remove',
  intrigue: "Intrigue · pick a rival's warden on your road",
};
/** Edicts played by picking something on the island. */
const BOARD_EDICTS: Partial<Record<Edict, EdictMode>> = { inventor: 'inventor', merchant: 'merchant', diplomat: 'diplomat', intrigue: 'intrigue' };
/** What clicking a highlighted corner does while you owe a choice. */
const ASK_VERTEX: Partial<Record<Ask['kind'], string>> = {
  pillage: 'Lose this town',
  retreat: 'Move your warden here',
  desert: 'Give up this warden',
  enlist: 'Place your warden here',
};

function describe(e: HxEvent, who: (id: string) => string): string {
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
      return `${w} ${s('buys', 'buy')} a charter card`;
    case 'play':
      return `${w} ${s('plays', 'play')} ${CHARTER_NAME[e.card!]}`;
    case 'raider':
      return `${w} ${s('moves', 'move')} the raider`;
    case 'pirate':
      return `${w} ${s('moves', 'move')} the corsair`;
    case 'move-ship':
      return `${w} ${s('moves', 'move')} a ship`;
    case 'landfall':
      return `${w} ${s('makes', 'make')} landfall on a new island (+2)`;
    case 'omen':
      return e.omen === 'ship' ? 'The omen die shows a ship: the marauders sail closer' : `The omen die shows the ${GUILD_NAME[e.omen!]} gate`;
    case 'attack':
      return e.text === 'pillaged'
        ? `The marauders pillage one of ${poss(e.player!)} towns`
        : e.text === 'defended' && w
          ? `The marauders are beaten off: ${w} ${s('takes', 'take')} a Defender point`
          : e.text === 'defended-tie'
            ? 'The marauders are beaten off: a tie for the best defence, so the tied players draw edicts'
            : 'The marauders are beaten off';
    case 'improve':
      return `${w} ${s('improves', 'improve')} the ${GUILD_NAME[e.guild!]} guild`;
    case 'capital':
      return `${w} ${s('takes', 'take')} the ${GUILD_NAME[e.guild!]} Capital (+2)`;
    case 'warden':
      switch (e.text) {
        case 'recruit':
          return `${w} ${s('recruits', 'recruit')} a warden`;
        case 'muster':
          return `${w} ${s('musters', 'muster')} a warden`;
        case 'promote':
          return `${w} ${s('promotes', 'promote')} a warden`;
        case 'displace':
          return `${w} ${s('pushes', 'push')} off ${poss(e.target!)} warden`;
        case 'chase':
          return `${w} ${s('chases', 'chase')} the raider`;
        case 'desert':
          return `${w} ${s('gives', 'give')} up a warden to the Deserter`;
        case 'enlist':
          return `${w} ${s('places', 'place')} a warden (Deserter)`;
        case 'retreat':
          return `${w} ${s('moves', 'move')} a pushed warden along ${w === 'You' ? 'your' : 'their'} roads`;
        case 'lost':
          return `${w === 'You' ? 'Your' : `${w}'s`} pushed warden has nowhere to go and leaves the board`;
        default:
          return `${w} ${s('moves', 'move')} a warden`;
      }
    case 'edict':
      if (e.text === 'play') return `${w} ${s('plays', 'play')} ${EDICT_NAME[e.edict!]}`;
      if (e.text === 'point') return `${w} ${s('draws', 'draw')} ${EDICT_NAME[e.edict!]} (+1)`;
      if (e.text === 'spy') return `${w} ${s('takes', 'take')} an edict from ${obj(e.target!)}`;
      if (e.text === 'discard') return `${w} ${s('puts', 'put')} a ${GUILD_NAME[e.guild!]} edict back under its deck`;
      return `${w} ${s('draws', 'draw')} a ${GUILD_NAME[e.guild!]} edict`;
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
        ? `${who(e.target!)} ${who(e.target!) === 'You' ? 'have' : 'has'} no commodities: no Commercial Harbour trade`
        : `${who(e.target!)} ${who(e.target!) === 'You' ? 'give' : 'gives'} ${obj(e.player!)} ${cardsText(undefined, e.goods)} for a resource (Commercial Harbour)`;
    case 'swap':
      return `${w} ${s('swaps', 'swap')} the ${e.text} number tokens`;
    case 'unroad':
      return `${w} ${s('removes', 'remove')} ${e.target === e.player ? (w === 'You' ? 'your own' : 'their own') : poss(e.target!)} road`;
    case 'award':
      return `${w} ${s('takes', 'take')} ${e.award === 'longest' ? 'the Longest Road' : 'the Biggest Guard'}`;
    case 'win':
      return `${w} ${s('wins', 'win')}!`;
    case 'out':
      return `${w} left the game`;
  }
}

function TradePanel({ s, meId, onAction, onClose }: { s: HxState; meId: string; onAction: (a: HxAction) => void; onClose: () => void }) {
  const me = s.players.find((p) => p.id === meId)!;
  const [give, setGive] = useState(emptyHand());
  const [get, setGet] = useState(emptyHand());
  const [giveGoods, setGiveGoods] = useState(emptyGoods());
  const [getGoods, setGetGoods] = useState(emptyGoods());
  const wardens = s.mode === 'wardens';
  const cards: Card[] = wardens ? [...RESOURCES, ...COMMODITIES] : RESOURCES;
  const have = (c: Card) => ((COMMODITIES as string[]).includes(c) ? me.goods[c as keyof typeof me.goods] : me.hand[c as Resource]);
  const cardName = (c: Card) => ((COMMODITIES as string[]).includes(c) ? GOOD_NAME[c as keyof typeof GOOD_NAME] : RES_NAME[c as Resource]);
  const [bankGive, setBankGive] = useState<Card>(cards.find((c) => have(c) >= bankRatio(s, meId, c)) ?? 'timber');
  const [bankGet, setBankGet] = useState<Card>('stone');
  const ratio = bankRatio(s, meId, bankGive);
  const clash = RESOURCES.some((r) => give[r] > 0 && get[r] > 0) || COMMODITIES.some((c) => giveGoods[c] > 0 && getGoods[c] > 0);
  const giving = handSize(give) + goodsSize(giveGoods);
  const getting = handSize(get) + goodsSize(getGoods);
  return (
    <section className="hx-panel hx-trade" role="dialog" aria-label="Trade">
      <header className="hx-panel-head">
        <h3>Trade</h3>
        <button type="button" className="hx-panel-close" onClick={onClose} aria-label="Close trade">
          ×
        </button>
      </header>
      <div className="hx-trade-bank">
        <h4>With the bank</h4>
        <p className="kit-muted">Your rates: {cards.map((c) => `${cardName(c)} ${bankRatio(s, meId, c)}:1`).join(' · ')}</p>
        <div className="hx-bank-row">
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
      <div className="hx-trade-offer">
        <h4>With the players</h4>
        <div className="hx-offer-sides">
          <div>
            <p className="hx-side-label">You give</p>
            <Picker value={give} onChange={setGive} max={me.hand} />
            {wardens && <GoodsPicker value={giveGoods} onChange={setGiveGoods} max={me.goods} room />}
          </div>
          <div>
            <p className="hx-side-label">You want</p>
            <Picker value={get} onChange={setGet} />
            {wardens && <GoodsPicker value={getGoods} onChange={setGetGoods} room />}
          </div>
        </div>
        <button
          type="button"
          className="primary g-block"
          disabled={!giving || !getting || clash}
          onClick={() => {
            onAction(wardens ? { type: 'OFFER', give, get, giveGoods, getGoods } : { type: 'OFFER', give, get });
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
function CounterPanel({ me, onSend, onCancel }: { me: HxState['players'][number]; onSend: (give: Hand, get: Hand) => void; onCancel: () => void }) {
  const [give, setGive] = useState(emptyHand());
  const [get, setGet] = useState(emptyHand());
  const giving = RESOURCES.some((r) => give[r] > 0);
  const getting = RESOURCES.some((r) => get[r] > 0);
  const clash = RESOURCES.some((r) => give[r] > 0 && get[r] > 0);
  return (
    <div className="hx-counter-form">
      <div className="hx-offer-sides">
        <div>
          <p className="hx-side-label">You give</p>
          <Picker value={give} onChange={setGive} max={me.hand} />
        </div>
        <div>
          <p className="hx-side-label">You want</p>
          <Picker value={get} onChange={setGet} />
        </div>
      </div>
      <div className="hx-choice">
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

/** The Hexstead table: the island, your hand and actions below it, the players and log alongside. */
export function HexsteadGame({ view, meId, nameFor, onAction, onExit, exitLabel, online }: KitScreenProps<HxState, HxAction>) {
  const s = view;
  const [mode, setMode] = useState<Mode>(null);
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  // Open Sea setup and Roadworks: whether the next free piece is a road or a ship.
  const [freePiece, setFreePiece] = useState<'road' | 'ship'>('road');
  const [wardenFrom, setWardenFrom] = useState<number | null>(null);
  // Inventor: the first token picked.
  const [inventFirst, setInventFirst] = useState<number | null>(null);
  const [edictPick, setEdictPick] = useState<Edict | null>(null);
  const [goodsPick, setGoodsPick] = useState(emptyGoods());
  const [trading, setTrading] = useState(false);
  const [pick, setPick] = useState<Hand>(emptyHand());
  const [choosing, setChoosing] = useState<'bounty' | 'market' | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  // Production you can see: a card for each resource flies from a tile that
  // paid to the player who got it.
  const seenLog = useRef(view.log);
  useEffect(() => {
    const fresh = freshEvents(seenLog.current, view.log);
    seenLog.current = view.log;
    const tiles = [...document.querySelectorAll('.hx-tile.is-producing .hx-hex')];
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
              el.className = 'hx-flyer';
              el.style.background = color;
              return el;
            },
          });
        }
      }
    }
  }, [view.log]);
  useCues(view, (a, b) => hxCues(a, b, meId, hexActor), HX_SOUNDS);
  // The swings of the game: an award changing hands, the raider moved, a raid, a landfall.
  const moment = useTableMoments(view, (a, b): TableMoment[] =>
    freshEvents(a.log, b.log).flatMap((e): TableMoment[] => {
      if (e.kind === 'roll' && e.dice && e.dice[0] + e.dice[1] === 7) {
        const owing = b.discards.map((id) => (id === meId ? 'You' : nameFor(id)));
        return [
          {
            kicker: e.player === meId ? 'You' : nameFor(e.player!),
            title: 'rolled a 7!',
            detail: owing.length ? `${owing.join(', ')} must discard half ${owing.length === 1 && owing[0] !== 'You' ? 'their' : owing.length === 1 ? 'your' : 'their'} cards. Then the raider moves.` : 'Nobody has to discard. The raider moves.',
            color: '#e2483b',
          },
        ];
      }
      if (!['award', 'raider', 'pirate', 'landfall', 'attack', 'capital', 'out'].includes(e.kind)) return [];
      const name = (id: string) => (id === meId ? 'You' : nameFor(id));
      const text = describe(e, name);
      const w = e.player ? name(e.player) : '';
      const title = w && text.startsWith(`${w} `) ? text.slice(w.length + 1) : text;
      return [{ kicker: w && title !== text ? w : undefined, title, color: e.player ? hxSeatColor(b.players.findIndex((p) => p.id === e.player)) : '#f2c548', feels: e.player ? { [e.player]: e.kind === 'out' || e.text === 'pillaged' ? 'bad' : 'good' } : undefined }];
    }),
  );

  const seat = s.players.findIndex((p) => p.id === meId);
  const me = s.players[seat];
  const actor = hexActor(s);
  const myMove = actor === meId;
  const myTurn = s.players[s.turn]?.id === meId && s.phase !== 'setup';
  // Your own main phase, or your go in a 5-6 player special build phase.
  const special = s.phase === 'special' && myMove;
  const buildTime = (myTurn && s.phase === 'main') || special;
  const who = (id: string) => (id === meId ? 'You' : nameFor(id));
  const colorOf = (id: string) => hxSeatColor(s.players.findIndex((p) => p.id === id));
  // Wardens: a choice owed by someone holds the table until it is made.
  const ask = s.asks?.[0] ?? null;
  const myAsk = ask && ask.player === meId ? ask : null;

  // Leave a placement mode once the moment has passed.
  useEffect(() => {
    if (!buildTime) setMode(null);
    if (s.phase !== 'main') setTrading(false);
    setPick(emptyHand());
    setGoodsPick(emptyGoods());
    setMoveFrom(null);
    setWardenFrom(null);
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

  const promotable = s.mode === 'wardens' && me
    ? s.wardens.flatMap((w, v) => {
        if (w?.player !== meId) return [];
        const cap = me.guilds.council >= 3 ? 3 : 2;
        return w.level < cap && w.promoted !== s.round && s.wardens.filter((x) => x?.player === meId && x.level === w.level + 1).length < WARDENS_PER_LEVEL ? [v] : [];
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
    else if (myAsk.kind === 'desert') vertices = wardensOf(s, meId);
    else if (myAsk.kind === 'enlist') vertices = legalWardenSpots(s, meId);
    else if (myAsk.kind === 'road') edges = legalRoadSpots(s, meId).filter((e) => e !== myAsk.skip);
  } else if (myMove && me) {
    const freeChoice = (s.phase === 'setup' && s.setup!.needRoad) || s.phase === 'roadworks';
    if (freeChoice) {
      // At sea a coast side takes either piece: show the one picked in the dock.
      const roads = legalRoadSpots(s, meId);
      const ships = legalShipSpots(s, meId);
      const which = s.mode === 'sea' ? (freePiece === 'ship' && ships.length ? 'ship' : roads.length ? 'road' : 'ship') : 'road';
      if (which === 'road') edges = roads;
      else shipEdges = ships;
    } else if (s.phase === 'setup') vertices = legalHomesteadSpots(s, meId);
    else if (s.phase === 'raider')
      tiles = geoOf(s.board)
        .tiles.map((_, i) => i)
        .filter((i) => (s.board.terrain[i] === 'sea' ? s.mode === 'sea' && i !== s.board.pirate : i !== s.board.raider && (!s.chasing || s.board.numbers[i] !== null)));
    else if (buildTime && mode === 'ship') shipEdges = legalShipSpots(s, meId);
    else if (buildTime && mode === 'warden') vertices = legalWardenSpots(s, meId);
    else if (buildTime && mode === 'wall') vertices = s.buildings.flatMap((b, v) => (b?.player === meId && b.town && !s.walls[v] ? [v] : []));
    else if (buildTime && mode === 'muster') vertices = s.wardens.flatMap((w, v) => (w?.player === meId && !w.active ? [v] : []));
    else if (buildTime && mode === 'promote') vertices = promotable;
    else if (myTurn && s.phase === 'main' && mode === 'shift') vertices = wardenFrom === null ? s.wardens.flatMap((w, v) => (w?.player === meId && wardenMoves(s, meId, v).length ? [v] : [])) : wardenMoves(s, meId, wardenFrom);
    else if (myTurn && s.phase === 'main' && mode === 'chase') vertices = chasers(s, meId);
    else if (myTurn && s.phase === 'main' && mode === 'inventor')
      tiles = s.board.numbers.flatMap((n, t) => (n !== null && !FIXED_TOKENS.includes(n) && t !== inventFirst ? [t] : []));
    else if (myTurn && s.phase === 'main' && mode === 'merchant')
      tiles = geo.tiles.flatMap((t, i) => (isLand(s.board.terrain[i]) && t.corners.some((c) => s.buildings[c]?.player === meId) ? [i] : []));
    else if (myTurn && s.phase === 'main' && mode === 'diplomat') edges = openRoads(s);
    else if (myTurn && s.phase === 'main' && mode === 'intrigue')
      vertices = s.wardens.flatMap((w, v) => (w && w.player !== meId && geo.vertices[v].edges.some((e) => s.roads[e] === meId) ? [v] : []));
    else if (buildTime && mode === 'move') {
      if (moveFrom === null) movable = movableShips(s, meId);
      else shipEdges = legalShipSpots(s, meId, moveFrom);
    } else if (buildTime && mode === 'road') edges = legalRoadSpots(s, meId);
    else if (buildTime && mode === 'homestead') vertices = legalHomesteadSpots(s, meId);
    else if (buildTime && mode === 'town') vertices = legalTownSpots(s, meId);
  }

  const place = (a: HxAction) => {
    onAction(a);
    setMode(null);
  };
  const total = s.dice ? s.dice[0] + s.dice[1] : null;
  const producing = total && total !== 7 && s.phase !== 'roll' ? s.board.numbers.flatMap((n, i) => (n === total && i !== s.board.raider ? [i] : [])) : [];
  const rollCount = s.rolls.reduce((a, b) => a + b, 0);

  type Built = 'road' | 'homestead' | 'town' | 'ship';
  const pieceLeft: Record<Built, number> = me
    ? {
        road: LIMITS.road - s.roads.filter((r) => r === meId).length,
        homestead: LIMITS.homestead - s.buildings.filter((b) => b?.player === meId && !b.town).length,
        town: LIMITS.town - s.buildings.filter((b) => b?.player === meId && b.town).length,
        ship: LIMITS.ship - (s.ships ?? []).filter((r) => r === meId).length,
      }
    : { road: 0, homestead: 0, town: 0, ship: 0 };
  const spotsFor = (p: Built) => (p === 'road' ? legalRoadSpots(s, meId) : p === 'homestead' ? legalHomesteadSpots(s, meId) : p === 'ship' ? legalShipSpots(s, meId) : legalTownSpots(s, meId));
  const canBuild = (p: Built) => buildTime && !!me && canPay(me.hand, COSTS[p]) && pieceLeft[p] > 0 && spotsFor(p).length > 0;
  const builds: Built[] = s.mode === 'sea' ? ['road', 'ship', 'homestead', 'town'] : ['road', 'homestead', 'town'];
  const goldDue = s.phase === 'gold' && s.gold[0]?.player === meId ? s.gold[0].count : 0;

  const discardNeed = me ? Math.floor(cardsHeld(me) / 2) : 0;
  const discardPicked = handSize(pick) + goodsSize(goodsPick);
  const offer = s.offer;
  const offerPending = s.phase === 'offer' && offer;

  const board = (
    <div className={`kit-board hx-board${mode ? ` is-placing-${mode}` : ''}`}>
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
        vertexLabel={myAsk ? (ASK_VERTEX[myAsk.kind] ?? 'Pick this') : mode === 'intrigue' ? "Push off this warden" : mode && WARDEN_MODE_TEXT[mode] ? WARDEN_MODE_TEXT[mode] : 'Build here'}
        edgeLabel={myAsk?.kind === 'road' ? 'Build your road here' : mode === 'diplomat' ? 'Remove this road' : 'Build a road here'}
        tileLabel={mode === 'inventor' ? (inventFirst === null ? 'Swap this token' : 'Swap with this token') : mode === 'merchant' ? 'Put the merchant here' : undefined}
        onVertex={(v) => {
          if (myAsk) onAction({ type: 'RESOLVE', vertex: v });
          else if (mode === 'intrigue') place({ type: 'PLAY_EDICT', edict: 'intrigue', vertex: v });
          else if (mode === 'warden') place({ type: 'BUILD_WARDEN', vertex: v });
          else if (mode === 'wall') place({ type: 'BUILD_WALL', vertex: v });
          else if (mode === 'muster') place({ type: 'MUSTER', vertex: v });
          else if (mode === 'promote') place({ type: 'PROMOTE', vertex: v });
          else if (mode === 'chase') place({ type: 'CHASE', vertex: v });
          else if (mode === 'shift') {
            if (wardenFrom === null) setWardenFrom(v);
            else {
              place({ type: 'MOVE_WARDEN', from: wardenFrom, to: v });
              setWardenFrom(null);
            }
          } else if (s.phase === 'setup' || mode === 'homestead') place({ type: 'BUILD_HOMESTEAD', vertex: v });
          else place({ type: 'BUILD_TOWN', vertex: v });
        }}
        onEdge={(e) => {
          if (myAsk) onAction({ type: 'RESOLVE', edge: e });
          else if (mode === 'diplomat') place({ type: 'PLAY_EDICT', edict: 'diplomat', edge: e });
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
              place({ type: 'PLAY_EDICT', edict: 'inventor', tiles: [inventFirst, t] });
              setInventFirst(null);
            }
          } else if (mode === 'merchant') place({ type: 'PLAY_EDICT', edict: 'merchant', tile: t });
          else onAction({ type: 'MOVE_RAIDER', tile: t });
        }}
      />

      {/* Prompts that need you, over the board. */}
      {myAsk && <AskPanel key={`${s.seq}-${myAsk.kind}`} s={s} meId={meId} nameFor={who} onAction={onAction} />}
      {myMove && s.phase === 'discard' && me && (
        <section className="hx-panel" role="dialog" aria-label="Discard">
          <header className="hx-panel-head">
            <h3>Discard {discardNeed} cards</h3>
          </header>
          <p className="kit-muted">A 7 was rolled and you hold more cards than your limit. Choose half of them (rounded down) to give back.</p>
          <Picker value={pick} onChange={setPick} max={me.hand} limit={discardNeed - goodsSize(goodsPick)} />
          {s.mode === 'wardens' && <GoodsPicker value={goodsPick} onChange={setGoodsPick} max={me.goods} room={discardPicked < discardNeed} />}
          <button type="button" className="primary g-block" disabled={discardPicked !== discardNeed} onClick={() => onAction({ type: 'DISCARD', cards: pick, goods: goodsPick })}>
            Discard {discardPicked} / {discardNeed}
          </button>
        </section>
      )}
      {goldDue > 0 && me && (
        <section className="hx-panel" role="dialog" aria-label="Goldfield">
          <header className="hx-panel-head">
            <h3>Goldfield: pick {goldDue}</h3>
          </header>
          <p className="kit-muted">A goldfield paid you. Take any {goldDue === 1 ? 'resource' : `${goldDue} resources`} from the bank.</p>
          <Picker value={pick} onChange={setPick} max={s.bank} limit={goldDue} />
          <button type="button" className="primary g-block" disabled={handSize(pick) !== Math.min(goldDue, handSize(s.bank))} onClick={() => onAction({ type: 'PICK_GOLD', cards: pick })}>
            Take {handSize(pick)} / {goldDue}
          </button>
        </section>
      )}
      {myMove && s.phase === 'steal' && (
        <section className="hx-panel is-small" role="dialog" aria-label="Rob a player">
          <header className="hx-panel-head">
            <h3>Rob a player</h3>
          </header>
          <div className="hx-choice">
            {s.stealFrom.map((id) => (
              <button key={id} type="button" className="g-btn g-btn-light" onClick={() => onAction({ type: 'STEAL', from: id })}>
                {who(id)} · {s.players.find((p) => p.id === id)?.handCount} cards
              </button>
            ))}
          </div>
        </section>
      )}
      {offerPending && offer.from !== meId && me && !me.out && (
        <section className="hx-panel is-small" role="dialog" aria-label="Trade offer">
          <header className="hx-panel-head">
            <h3>{who(offer.from)} offers a trade</h3>
          </header>
          <p className="hx-offer-line">
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
            <div className="hx-choice">
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
        <section className="hx-panel is-small" role="dialog" aria-label="Your offer">
          <header className="hx-panel-head">
            <h3>Your offer</h3>
          </header>
          <p className="hx-offer-line">
            <Cards size="md" cards={offer.give} goods={offer.giveGoods} /> for <Cards size="md" cards={offer.get} goods={offer.getGoods} />
          </p>
          <ul className="hx-answers">
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
              <li key={id} className="hx-counter">
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
      {edictPick && myTurn && !ask && (s.phase === 'main' || (edictPick === 'alchemist' && s.phase === 'roll')) && (
        <EdictDialog s={s} meId={meId} edict={edictPick} onAction={onAction} onClose={() => setEdictPick(null)} />
      )}
      {choosing && myTurn && me && (
        <section className="hx-panel is-small" role="dialog" aria-label={CHARTER_NAME[choosing]}>
          <header className="hx-panel-head">
            <h3>{CHARTER_NAME[choosing]}</h3>
            <button type="button" className="hx-panel-close" onClick={() => setChoosing(null)} aria-label="Cancel">
              ×
            </button>
          </header>
          <p className="kit-muted">{choosing === 'bounty' ? 'Choose two cards from the bank.' : 'Name one resource. Every other player gives you all they hold of it.'}</p>
          {choosing === 'bounty' ? (
            <>
              <Picker value={pick} onChange={setPick} max={s.bank} limit={2} />
              <button
                type="button"
                className="primary g-block"
                disabled={handSize(pick) !== 2}
                onClick={() => {
                  onAction({ type: 'PLAY_CHARTER', card: 'bounty', take: RESOURCES.flatMap((r) => Array<Resource>(pick[r]).fill(r)) });
                  setChoosing(null);
                }}
              >
                Take them
              </button>
            </>
          ) : (
            <div className="hx-choice is-grid">
              {RESOURCES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="hx-res-btn"
                  style={{ '--rc': RES_COLOR[r] } as CSSProperties}
                  onClick={() => {
                    onAction({ type: 'PLAY_CHARTER', card: 'market', take: [r] });
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
    <div className="hx-dock">
      <div className="hx-dice">
        <Die value={s.dice?.[0] ?? null} rollKey={rollCount} size={40} label={s.mode === 'wardens' ? 'Red die' : 'First die'} />
        <Die value={s.dice?.[1] ?? null} rollKey={rollCount} size={40} label={s.mode === 'wardens' ? 'Yellow die' : 'Second die'} />
        {s.mode === 'wardens' && (
          <span className="hx-omen" title="The omen die" style={{ '--oc': s.omen && s.omen !== 'ship' ? GUILD_COLOR[s.omen] : '#1a557b' } as CSSProperties}>
            {s.omen ? (s.omen === 'ship' ? 'Ship' : GUILD_NAME[s.omen]) : 'Omen'}
          </span>
        )}
        {myMove && !ask && s.phase === 'roll' && (
          <button type="button" className="primary hx-roll" onClick={() => onAction({ type: 'ROLL' })}>
            Roll
          </button>
        )}
      </div>
      <div className="hx-hand" aria-label="Your cards">
        {RESOURCES.map((r) => (
          <span key={r} className={`hx-card${me.hand[r] === 0 ? ' is-empty' : ''}`} style={{ '--rc': RES_COLOR[r] } as CSSProperties} title={RES_NAME[r]}>
            <b>{me.hand[r]}</b>
            <span>{RES_NAME[r]}</span>
          </span>
        ))}
        {s.mode === 'wardens' && <GoodsCards goods={me.goods} />}
      </div>
      <div className="hx-actions">
        {s.mode === 'sea' && myMove && ((s.phase === 'setup' && s.setup!.needRoad) || s.phase === 'roadworks') && (
          <div className="hx-free-pick" role="radiogroup" aria-label="Free piece">
            {(['road', 'ship'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={freePiece === k} className={`hx-build${freePiece === k ? ' is-on' : ''}`} onClick={() => setFreePiece(k)}>
                <span>Place a {k}</span>
              </button>
            ))}
          </div>
        )}
        {s.phase === 'setup' ? (
          <p className="hx-setup-hint">
            {s.mode === 'wardens'
              ? 'Setup: a homestead and a road each, then a town and a road in reverse order. The town pays your first cards.'
              : `Setup: a homestead and a ${s.mode === 'sea' ? 'road or ship' : 'road'} each, then again in reverse order. The second homestead pays your first cards.`}{' '}
            Building opens once everyone is placed.
          </p>
        ) : (
          <>
          {builds.map((p) => (
            <button
              key={p}
              type="button"
              className={`hx-build${mode === p ? ' is-on' : ''}`}
              disabled={!canBuild(p)}
              aria-pressed={mode === p}
              onClick={() => setMode(mode === p ? null : p)}
              title={`${PIECE_NAME[p]}: ${cardsText(COSTS[p])} · ${pieceLeft[p]} left`}
            >
              <span>{PIECE_NAME[p]}</span>
              <Cards cards={COSTS[p]} />
            </button>
          ))}
          {s.mode === 'sea' && (
            <button
              type="button"
              className={`hx-build${mode === 'move' ? ' is-on' : ''}`}
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
          {s.mode === 'wardens' ? (
            <>
              {(
                [
                  ['warden', 'Warden', WARDEN_COSTS.recruit, legalWardenSpots(s, meId).length > 0 && s.wardens.filter((w) => w?.player === meId && w.level === 1).length < WARDENS_PER_LEVEL, 'Recruit a warden on your road'],
                  ['muster', 'Muster', WARDEN_COSTS.muster, s.wardens.some((w) => w?.player === meId && !w.active), 'Muster a resting warden'],
                  ['promote', 'Promote', s.perks.smith > 0 ? {} : WARDEN_COSTS.promote, promotable.length > 0, s.perks.smith > 0 ? `Promote for free (${s.perks.smith} left)` : 'Promote a warden'],
                  ['wall', 'Wall', WARDEN_COSTS.wall, s.buildings.some((b, v) => b?.player === meId && b.town && !s.walls[v]) && me.walls < 3, 'A wall raises your hand limit by 2'],
                ] as const
              ).map(([k, name, cost, possible, title]) => (
                <button
                  key={k}
                  type="button"
                  className={`hx-build${mode === k ? ' is-on' : ''}`}
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
                className={`hx-build${mode === 'shift' ? ' is-on' : ''}`}
                disabled={!(myTurn && s.phase === 'main' && s.wardens.some((w, v) => w?.player === meId && wardenMoves(s, meId, v).length > 0))}
                aria-pressed={mode === 'shift'}
                onClick={() => {
                  setWardenFrom(null);
                  setMode(mode === 'shift' ? null : 'shift');
                }}
                title="Move a mustered warden along your roads, or push off a weaker rival warden"
              >
                <span>Move warden</span>
                <span className="kit-muted">rests after</span>
              </button>
              <button
                type="button"
                className={`hx-build${mode === 'chase' ? ' is-on' : ''}`}
                disabled={!(myTurn && s.phase === 'main' && chasers(s, meId).length > 0)}
                aria-pressed={mode === 'chase'}
                onClick={() => setMode(mode === 'chase' ? null : 'chase')}
                title="A mustered warden beside the raider chases it off (after the fleet's first landing)"
              >
                <span>Chase raider</span>
                <span className="kit-muted">rests after</span>
              </button>
          </>
        ) : (
          <button
            type="button"
            className="hx-build"
            disabled={!(buildTime && canPay(me.hand, COSTS.charter) && s.deckCount > 0)}
            onClick={() => onAction({ type: 'BUY_CHARTER' })}
            title={`Charter card: ${cardsText(COSTS.charter)} · ${s.deckCount} left`}
          >
            <span>Charter</span>
            <Cards cards={COSTS.charter} />
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

  const mine = me?.charters ?? [];
  const charterCounts = mine.reduce<Partial<Record<Charter, number>>>((m, c) => ({ ...m, [c.card]: (m[c.card] ?? 0) + 1 }), {});
  const canPlay = (card: Charter) =>
    myTurn && !s.playedCharter && card !== 'monument' && mine.some((c) => c.card === card && c.bought < s.round) && (s.phase === 'main' || (s.phase === 'roll' && card === 'ranger'));
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
          color: hxSeatColor(i),
          detail: [
            `${p.handCount} ${p.handCount === 1 ? 'card' : 'cards'}`,
            p.charterCount ? `${p.charterCount} ${p.charterCount === 1 ? 'charter' : 'charters'}` : null,
            p.rangers ? `${p.rangers} ${p.rangers === 1 ? 'ranger' : 'rangers'}` : null,
            s.longestRoad.player === p.id ? (s.mode === 'sea' ? 'Longest Route' : 'Longest Road') : null,
            s.landfall?.[p.id]?.length ? `${s.landfall[p.id].length} landfall` : null,
            s.mode === 'wardens' ? GUILDS.filter((g) => p.guilds[g] > 0).map((g) => `${GUILD_NAME[g]} ${p.guilds[g]}`).join(' · ') || null : null,
            s.mode === 'wardens' && p.edictCount ? `${p.edictCount} ${p.edictCount === 1 ? 'edict' : 'edicts'}` : null,
            s.mode === 'wardens' && p.defender ? `${p.defender} defender` : null,
            s.merchant?.player === p.id ? 'Merchant' : null,
            s.biggestGuard.player === p.id ? 'Biggest Guard' : null,
          ]
            .filter(Boolean)
            .join(' · '),
          trailing: victoryPoints(s, p.id, p.id === meId || s.over),
          active: actor === p.id,
          out: p.out,
        }))}
      />
      {s.mode === 'wardens' && (
        <>
          <FleetSection s={s} />
          <GuildsSection s={s} meId={meId} canAct={myTurn && s.phase === 'main'} onAction={onAction} />
          <EdictsSection
            s={s}
            meId={meId}
            canPlay={(e) => !ask && myTurn && (e === 'alchemist' ? s.phase === 'roll' : s.phase === 'main')}
            onPick={(e) => {
              const board = BOARD_EDICTS[e];
              if (board) {
                setInventFirst(null);
                setMode(board);
              } else if (!EDICT_NEEDS[e]) onAction({ type: 'PLAY_EDICT', edict: e });
              else setEdictPick(e);
            }}
          />
          {myTurn && s.phase === 'main' && !ask && (s.perks.harbor?.length ?? 0) > 0 && <HarborSection s={s} meId={meId} onAction={onAction} />}
        </>
      )}
      {me && s.mode !== 'wardens' && (
        <SideSection title="Your charter cards" meta={`${s.deckCount} in the deck`}>
          {mine.length === 0 ? (
            <p className="kit-muted">Buy one for wool, grain and stone. Rangers move the raider; Monuments are hidden points.</p>
          ) : (
            <ul className="hx-charters">
              {(Object.keys(charterCounts) as Charter[]).map((card) => (
                <li key={card}>
                  <span>
                    <b>
                      {CHARTER_NAME[card]}
                      {charterCounts[card]! > 1 ? ` ×${charterCounts[card]}` : ''}
                    </b>
                    <span className="kit-muted">{CHARTER_TEXT[card]}</span>
                  </span>
                  {card !== 'monument' && (
                    <button
                      type="button"
                      className="g-btn g-btn-light g-btn-sm"
                      disabled={!canPlay(card)}
                      onClick={() => {
                        if (card === 'bounty' || card === 'market') {
                          setPick(emptyHand());
                          setChoosing(card);
                        } else onAction({ type: 'PLAY_CHARTER', card });
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
        <div className="hx-dice-stats" aria-label="How often each total has been rolled">
          {Array.from({ length: 11 }, (_, k) => k + 2).map((n) => (
            <div key={n} className={`hx-stat${total === n ? ' is-last' : ''}`}>
              <span className="hx-stat-bar" style={{ height: `${(s.rolls[n] / maxRoll) * 100}%` }} />
              <span className="hx-stat-n">{n}</span>
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
    const piece = s.setup!.needRoad ? (s.mode === 'sea' ? 'road or ship next to it' : 'road next to it') : s.mode === 'wardens' && s.setup!.step >= s.players.length ? 'town' : 'homestead';
    status = myMove ? <><strong>Your setup</strong> · place a {piece}</> : <><strong>{actorName}</strong> is settling...</>;
  }
  else if (s.phase === 'roll') status = myMove ? <><strong>Your turn</strong> · roll the dice</> : <><strong>{actorName}</strong> to roll</>;
  else if (s.phase === 'discard') status = myMove ? <><strong>Discard {discardNeed}</strong> cards</> : <>Waiting for <strong>{actorName}</strong> to discard</>;
  else if (s.phase === 'raider')
    status = myMove ? (
      s.bishop ? (
        <><strong>Bishop</strong> · move the raider; you rob a card from everyone beside its new tile</>
      ) : s.chasing ? (
        <><strong>Chase the raider</strong> to another numbered tile</>
      ) : (
        <><strong>Move the raider</strong> to another tile{s.mode === 'sea' ? ', or the corsair to another sea tile' : ''}</>
      )
    ) : (
      <><strong>{actorName}</strong> moves the {s.mode === 'sea' ? 'raider or the corsair' : 'raider'}</>
    );
  else if (s.phase === 'gold') status = goldDue ? <><strong>Goldfield</strong> · pick {goldDue} from the bank</> : <><strong>{actorName}</strong> is picking goldfield pay</>;
  else if (s.phase === 'steal') status = myMove ? <><strong>Choose</strong> whom to rob</> : <><strong>{actorName}</strong> is robbing...</>;
  else if (s.phase === 'roadworks') status = myMove ? <><strong>Roadworks</strong> · place {s.freeRoads} free {s.freeRoads === 1 ? 'road' : 'roads'}</> : <><strong>{actorName}</strong> is building roads</>;
  else if (s.phase === 'offer') status = offer!.from === meId ? <><strong>Your offer</strong> · waiting for answers</> : <><strong>{who(offer!.from)}</strong> is trading</>;
  else if (s.phase === 'special') status = special ? (mode ? (mode === 'move' ? (moveFrom === null ? <><strong>Pick a ship</strong> to move · Esc to cancel</> : <><strong>Pick where it sails</strong> · Esc to cancel</>) : (WARDEN_MODE_TEXT[mode] ? <><strong>{mode === 'shift' && wardenFrom !== null ? 'Pick where the warden goes' : WARDEN_MODE_TEXT[mode]}</strong> · Esc to cancel</> : <><strong>Place your {PIECE_NAME[mode as Piece].toLowerCase()}</strong> · Esc to cancel</>)) : <><strong>Special build</strong> · build or buy before {who(s.players[nextLive(s)].id)}&apos;s turn, or press Done</>) : <><strong>{actorName}</strong> may build out of turn</>;
  else status = myTurn ? (mode ? (mode === 'move' ? (moveFrom === null ? <><strong>Pick a ship</strong> to move · Esc to cancel</> : <><strong>Pick where it sails</strong> · Esc to cancel</>) : (WARDEN_MODE_TEXT[mode] ? <><strong>{mode === 'shift' && wardenFrom !== null ? 'Pick where the warden goes' : WARDEN_MODE_TEXT[mode]}</strong> · Esc to cancel</> : <><strong>Place your {PIECE_NAME[mode as Piece].toLowerCase()}</strong> · Esc to cancel</>)) : <><strong>Your turn</strong> · build, trade or end it</>) : <><strong>{actorName}</strong> is building...</>;

  const overlay = s.over && s.winner ? (
    <ResultCard
      title={s.winner === meId ? 'You win Hexstead' : `${nameFor(s.winner)} wins`}
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
      rulesVariant={s.mode === 'sea' ? 'sea' : s.mode === 'wardens' ? 'wardens' : s.board.layout === 'large' ? 'large' : 'standard'}
      className={`hx-game is-${s.mode ?? 'base'}`}
      title="Hexstead"
      exitLabel={exitLabel}
      onExit={onExit}
      status={status}
      headerExtra={online?.clock}
      banner={online?.banner}
      board={
        <div className="hx-stage">
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
