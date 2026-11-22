/** Cities & Knights' parts of the Catan screen: commodities, the barbarian ship, areas and progress cards. */
import { useState, type CSSProperties } from 'react';
import { SideSection } from '../../kit/ui/GameShell';
import { Cards, GOOD_COLOR, GOOD_NAME, GoodsPicker, Picker } from './cards';
import { RESOURCES, type Resource } from '../board';
import { emptyHand, handSize, improveCost, victoryPoints, knightsOf, type Ask, type Hand, type CatanAction, type CatanState } from '../engine';
import {
  METROPOLIS_LEVEL,
  COMMODITIES,
  PROGRESS_LIMIT,
  PROGRESS_NAME,
  PROGRESS_NEEDS,
  PROGRESS_TEXT,
  AREAS,
  AREA_ABILITY,
  AREA_GOOD,
  AREA_NAME,
  BARBARIAN_TRACK,
  MAX_LEVEL,
  emptyGoods,
  goodsSize,
  type Card,
  type Commodity,
  type ProgressCard,
  type Goods,
  type Area,
} from '../citiesKnights';

export const AREA_COLOR: Record<Area, string> = { trade: '#d9a520', politics: '#3f7fd0', science: '#3faa6a' };

const label = (c: Card) => (COMMODITIES as string[]).includes(c) ? GOOD_NAME[c as Commodity] : c[0].toUpperCase() + c.slice(1);

/** Your commodity cards, beside your resources in the dock. */
export function GoodsCards({ goods }: { goods: Goods }) {
  return (
    <span className="catan-goods">
      {COMMODITIES.map((c) => (
        <span key={c} className={`catan-card is-good${goods[c] === 0 ? ' is-empty' : ''}`} style={{ '--rc': GOOD_COLOR[c] } as CSSProperties} title={GOOD_NAME[c]}>
          <b>{goods[c]}</b>
          <span>{GOOD_NAME[c]}</span>
        </span>
      ))}
    </span>
  );
}

/** The barbarian ship's track: it attacks on the last space. */
export function BarbariansSection({ s }: { s: CatanState }) {
  const cities = s.buildings.filter((b) => b?.city).length;
  const defence = s.knights.reduce((t, w) => t + (w?.active ? w.level : 0), 0);
  return (
    <SideSection title="The barbarian ship" meta={s.attacked ? 'has attacked before' : 'has not attacked yet'}>
      <ol className="catan-barbarians" aria-label={`The barbarian ship is ${BARBARIAN_TRACK - s.barbarians} spaces from attacking`}>
        {Array.from({ length: BARBARIAN_TRACK + 1 }, (_, i) => (
          <li key={i} className={`${i === s.barbarians ? 'is-here' : ''}${i === BARBARIAN_TRACK ? ' is-shore' : ''}`}>
            {i === s.barbarians ? (
              <svg viewBox="-0.4 -0.4 0.8 0.6" aria-hidden="true">
                <path d="M-0.3 0.02H0.3L0.2 0.15H-0.2Z" fill="#1a1c22" stroke="#ffffffb3" strokeWidth={0.02} />
                <path d="M-0.03 0V-0.3L0.17 -0.02Z" fill="#c8343a" stroke="#ffffffb3" strokeWidth={0.02} />
              </svg>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="catan-barbarians-odds">
        Barbarians <b>{cities}</b> (one per city) · Activated knights <b>{defence}</b>
      </p>
    </SideSection>
  );
}

/** Your area levels, the next level's price, and the Metropolises. */
export function AreasSection({ s, meId, canAct, onAction }: { s: CatanState; meId: string; canAct: boolean; onAction: (a: CatanAction) => void }) {
  const me = s.players.find((p) => p.id === meId);
  if (!me) return null;
  return (
    <SideSection title="City improvements">
      <ul className="catan-areas">
        {AREAS.map((g) => {
          const level = me.areas[g];
          const cost = improveCost(s, meId, g);
          const affordable = cost !== null && me.goods[AREA_GOOD[g]] >= cost;
          const metropolis = s.metropolises[g];
          return (
            <li key={g} style={{ '--gc': AREA_COLOR[g] } as CSSProperties}>
              <div className="catan-area-head">
                <b>{AREA_NAME[g]}</b>
                <span className="catan-area-pips" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
                  {Array.from({ length: MAX_LEVEL }, (_, i) => (
                    <i key={i} className={`${i < level ? 'is-on' : ''}${i + 1 === METROPOLIS_LEVEL ? ' is-metropolis' : ''}`} />
                  ))}
                </span>
                <button type="button" className="g-btn g-btn-light g-btn-sm" disabled={!canAct || !affordable} onClick={() => onAction({ type: 'IMPROVE', area: g })}>
                  {cost === null ? (level >= MAX_LEVEL ? 'Top level' : 'Need a city') : `Level ${level + 1}: ${cost} ${GOOD_NAME[AREA_GOOD[g]].toLowerCase()}`}
                </button>
              </div>
              <p className="kit-muted">
                Level 3: {AREA_ABILITY[g]}
                {metropolis ? ` Metropolis: ${metropolis.player === meId ? 'yours' : s.players.find((p) => p.id === metropolis.player)?.name}.` : ` First to level ${METROPOLIS_LEVEL} takes the Metropolis.`}
              </p>
            </li>
          );
        })}
      </ul>
    </SideSection>
  );
}

/** Your progress cards, each with a Play button. */
export function ProgressCardsSection({ s, meId, canPlay, onPick }: { s: CatanState; meId: string; canPlay: (e: ProgressCard) => boolean; onPick: (e: ProgressCard) => void }) {
  const me = s.players.find((p) => p.id === meId);
  if (!me) return null;
  const over = me.progressCards.length > PROGRESS_LIMIT;
  return (
    <SideSection title="Your progress cards" meta={`${me.progressCardPoints ? `${me.progressCardPoints} point${me.progressCardPoints === 1 ? '' : 's'} shown · ` : ''}${me.progressCards.length} of ${PROGRESS_LIMIT}`}>
      {me.progressCards.length === 0 ? (
        <p className="kit-muted">ProgressCards are drawn when the event die shows an area&apos;s gate and the red die is no more than your level there plus one.</p>
      ) : (
        <>
          {over && <p className="catan-warn">You hold more than {PROGRESS_LIMIT}: play one, or put one back when you end your turn.</p>}
          <ul className="catan-dev-cards">
            {me.progressCards.map((e, i) => (
              <li key={`${e}${i}`}>
                <span>
                  <b>{PROGRESS_NAME[e]}</b>
                  <span className="kit-muted">{PROGRESS_TEXT[e]}</span>
                </span>
                <button type="button" className="g-btn g-btn-light g-btn-sm" disabled={!canPlay(e)} onClick={() => onPick(e)}>
                  Play
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </SideSection>
  );
}

/** Two dice to set by hand (the Alchemist): the red one, which also decides progress card draws, and the yellow. */
function DiceSetter({ onSet }: { onSet: (dice: [number, number]) => void }) {
  const [red, setRed] = useState(3);
  const [yellow, setYellow] = useState(4);
  const row = (name: string, tone: string, value: number, set: (n: number) => void) => (
    <div className={`catan-dice-set is-${tone}`} role="radiogroup" aria-label={name}>
      <span className="catan-pick-name">{name}</span>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${name}: ${n}`} className={value === n ? 'is-on' : ''} onClick={() => set(n)}>
          {n}
        </button>
      ))}
    </div>
  );
  return (
    <>
      {row('Red die', 'red', red, setRed)}
      {row('Yellow die', 'yellow', yellow, setYellow)}
      <button type="button" className="primary g-block" onClick={() => onSet([red, yellow])}>
        Set them: {red} + {yellow} = {red + yellow}, then roll the event die
      </button>
    </>
  );
}

/** The choice a progress card needs before it is played (a player, a card, a city or the dice). Board picks are made on the island. */
export function ProgressCardDialog({ s, meId, progressCard, onAction, onClose }: { s: CatanState; meId: string; progressCard: ProgressCard; onAction: (a: CatanAction) => void; onClose: () => void }) {
  const need = PROGRESS_NEEDS[progressCard];
  const [pickCity, setPickCity] = useState<number | null>(null);
  const play = (extra: Partial<Extract<CatanAction, { type: 'PLAY_PROGRESS' }>>) => {
    onAction({ type: 'PLAY_PROGRESS', progressCard, ...extra });
    onClose();
  };
  const others = s.players.filter((p) => p.id !== meId && !p.out);
  const mine = victoryPoints(s, meId, false);
  const cities = s.buildings.flatMap((b, v) => (b?.player === meId && b.city && !s.walls[v] ? [v] : []));
  const cards: Card[] = need === 'resource' ? RESOURCES : need === 'commodity' ? COMMODITIES : [...RESOURCES, ...COMMODITIES];
  const targets = others.filter((p) => (progressCard === 'spy' ? p.progressCardCount > 0 : progressCard === 'deserter' ? knightsOf(s, p.id).length > 0 : victoryPoints(s, p.id, false) > mine));
  return (
    <section className="catan-panel is-small" role="dialog" aria-label={PROGRESS_NAME[progressCard]}>
      <header className="catan-panel-head">
        <h3>{PROGRESS_NAME[progressCard]}</h3>
        <button type="button" className="catan-panel-close" onClick={onClose} aria-label="Cancel">
          ×
        </button>
      </header>
      <p className="kit-muted">{PROGRESS_TEXT[progressCard]}</p>
      {need === 'player' && (
        <div className="catan-choice">
          {targets.length === 0 && <p className="kit-muted">No player can be chosen right now.</p>}
          {targets.map((p) => (
            <button key={p.id} type="button" className="g-btn g-btn-light" onClick={() => play({ target: p.id })}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      {(need === 'resource' || need === 'commodity' || need === 'card') && (
        <div className="catan-choice is-grid">
          {cards.map((c) => (
            <button key={c} type="button" className="g-btn g-btn-light" onClick={() => play({ take: [c as Resource] })}>
              {label(c)}
            </button>
          ))}
        </div>
      )}
      {need === 'city' && (
        <>
          <div className="catan-choice">
            {cities.map((v, i) => (
              <button key={v} type="button" className={`g-btn g-btn-light${pickCity === v ? ' is-on' : ''}`} onClick={() => setPickCity(v)}>
                City {i + 1}
              </button>
            ))}
          </div>
          <button type="button" className="primary g-block" disabled={pickCity === null} onClick={() => play({ vertex: pickCity! })}>
            Build the wall
          </button>
        </>
      )}
      {need === 'dice' && <DiceSetter onSet={(dice) => play({ dice })} />}
      {!need && (
        <button type="button" className="primary g-block" onClick={() => play({})}>
          Play it
        </button>
      )}
    </section>
  );
}

/** Commercial Harbor, for the rest of the turn: hand each player a resource for a commodity of their choice. */
export function HarborSection({ s, meId, onAction }: { s: CatanState; meId: string; onAction: (a: CatanAction) => void }) {
  const me = s.players.find((p) => p.id === meId)!;
  const held = RESOURCES.filter((r) => me.hand[r] > 0);
  const [give, setGive] = useState<Resource | null>(null);
  const chosen = give && me.hand[give] > 0 ? give : (held[0] ?? null);
  return (
    <SideSection title="Commercial Harbor" meta="this turn">
      <p className="kit-muted">Hand a player one resource: they must give you a commodity of their choice. A player with no commodities keeps nothing, and you keep your card.</p>
      <div className="catan-choice is-grid" role="radiogroup" aria-label="Resource to hand over">
        {RESOURCES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={chosen === r} disabled={me.hand[r] === 0} className={`g-btn g-btn-light g-btn-sm${chosen === r ? ' is-on' : ''}`} onClick={() => setGive(r)}>
            {label(r)} ({me.hand[r]})
          </button>
        ))}
      </div>
      <div className="catan-choice">
        {(s.perks.harbor ?? []).map((id) => (
          <button key={id} type="button" className="g-btn g-btn-light" disabled={!chosen} onClick={() => chosen && onAction({ type: 'HARBOR', target: id, give: chosen })}>
            {chosen ? `${label(chosen)} to ${s.players.find((p) => p.id === id)?.name}` : s.players.find((p) => p.id === id)?.name}
          </button>
        ))}
      </div>
    </SideSection>
  );
}

const possessive = (id: string, meId: string, nameFor: (id: string) => string) => (id === meId ? 'your' : `${nameFor(id)}'s`);

/** The status line while a choice is owed: what you must choose, or whom the table is waiting for. */
export function askStatus(a: Ask, meId: string, nameFor: (id: string) => string): { mine: boolean; text: string } {
  const mine = a.player === meId;
  const name = nameFor(a.player);
  const poss = (id: string) => possessive(id, meId, nameFor);
  const them = (id: string) => (id === meId ? 'you' : nameFor(id));
  switch (a.kind) {
    case 'discard':
      return { mine, text: mine ? `Saboteur · discard ${a.count} of your cards` : `${name} is discarding ${a.count} cards` };
    case 'give':
      return { mine, text: mine ? `Wedding · give 2 cards of your choice to ${them(a.to)}` : `${name} is choosing 2 cards for ${them(a.to)}` };
    case 'harbor':
      return { mine, text: mine ? `Commercial Harbor · give ${them(a.to)} a commodity` : `${name} is choosing a commodity for ${them(a.to)}` };
    case 'take':
      return { mine, text: mine ? `Master Merchant · take ${a.count} cards from ${poss(a.from)} hand` : `${name} is looking through ${poss(a.from)} hand` };
    case 'spy':
      return { mine, text: mine ? `Spy · take one of ${poss(a.from)} progress cards` : `${name} is looking at ${poss(a.from)} progress cards` };
    case 'pillage':
      return { mine, text: mine ? 'The barbarians won · pick the city you lose' : `${name} is picking the city the barbarians take` };
    case 'draw':
      return { mine, text: mine ? 'A tie for the best defence · draw a progress card from any deck' : `${name} is choosing a progress card deck` };
    case 'progressCard-limit':
      return { mine, text: mine ? `More than ${PROGRESS_LIMIT} progress cards · put one back under its deck` : `${name} is putting a progress card back` };
    case 'retreat':
      return { mine, text: mine ? 'Your knight was pushed off · pick where it goes' : `${name} is moving a pushed knight` };
    case 'desert':
      return { mine, text: mine ? `Deserter · pick the knight you give up` : `${name} is choosing a knight to give up` };
    case 'hire':
      return { mine, text: mine ? `Deserter · place a strength-${a.level} knight on your road, or skip` : `${name} is placing a knight` };
    case 'road':
      return { mine, text: mine ? 'Diplomat · build your road again elsewhere, or keep it' : `${name} is rebuilding a road` };
  }
}

/** The panel for a choice you owe that is made with cards or buttons (choices on the island show only a hint and Skip). */
export function AskPanel({ s, meId, nameFor, onAction }: { s: CatanState; meId: string; nameFor: (id: string) => string; onAction: (a: CatanAction) => void }) {
  const a = s.asks![0];
  const me = s.players.find((p) => p.id === meId)!;
  const [cards, setCards] = useState<Hand>(emptyHand());
  const [goods, setGoods] = useState<Goods>(emptyGoods());
  const { text } = askStatus(a, meId, nameFor);
  const resolve = (r: Omit<Extract<CatanAction, { type: 'RESOLVE' }>, 'type'>) => onAction({ type: 'RESOLVE', ...r });
  const from = a.kind === 'take' || a.kind === 'spy' ? s.players.find((p) => p.id === a.from)! : null;
  const head = (title: string) => (
    <header className="catan-panel-head">
      <h3>{title}</h3>
    </header>
  );
  if (a.kind === 'discard' || a.kind === 'give' || a.kind === 'take') {
    const source = a.kind === 'take' ? from! : me;
    const need = Math.min(a.count, handSize(source.hand) + goodsSize(source.goods));
    const picked = handSize(cards) + goodsSize(goods);
    const verb = a.kind === 'discard' ? 'Discard' : a.kind === 'give' ? 'Give' : 'Take';
    return (
      <section className="catan-panel" role="dialog" aria-label={text}>
        {head(text)}
        {a.kind === 'take' && (
          <>
            <p className="catan-offer-line">
              {nameFor(a.from)} holds <Cards size="md" cards={from!.hand} goods={from!.goods} />
            </p>
            <p className="kit-muted">Only you can see {possessive(a.from, meId, nameFor)} cards while you choose.</p>
          </>
        )}
        <Picker value={cards} onChange={setCards} max={source.hand} limit={need - goodsSize(goods)} />
        <GoodsPicker value={goods} onChange={setGoods} max={source.goods} room={picked < need} />
        <button type="button" className="primary g-block" disabled={picked !== need} onClick={() => resolve({ cards, goods })}>
          {verb} {picked} / {need}
        </button>
      </section>
    );
  }
  if (a.kind === 'harbor') {
    return (
      <section className="catan-panel is-small" role="dialog" aria-label={text}>
        {head(text)}
        <div className="catan-choice">
          {COMMODITIES.filter((c) => me.goods[c] > 0).map((c) => (
            <button key={c} type="button" className="catan-res-btn" style={{ '--rc': GOOD_COLOR[c] } as CSSProperties} onClick={() => resolve({ goods: { [c]: 1 } })}>
              {GOOD_NAME[c]} ({me.goods[c]})
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (a.kind === 'spy' || a.kind === 'progressCard-limit') {
    const list = a.kind === 'spy' ? from!.progressCards : me.progressCards;
    return (
      <section className="catan-panel is-small" role="dialog" aria-label={text}>
        {head(text)}
        <ul className="catan-dev-cards">
          {list.map((e, i) => (
            <li key={`${e}${i}`}>
              <span>
                <b>{PROGRESS_NAME[e]}</b>
                <span className="kit-muted">{PROGRESS_TEXT[e]}</span>
              </span>
              <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => resolve({ progressCard: e })}>
                {a.kind === 'spy' ? 'Take' : 'Put back'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (a.kind === 'draw') {
    return (
      <section className="catan-panel is-small" role="dialog" aria-label={text}>
        {head(text)}
        <div className="catan-choice">
          {AREAS.map((g) => (
            <button key={g} type="button" className="catan-res-btn" style={{ '--rc': AREA_COLOR[g] } as CSSProperties} disabled={!s.progressCardDeckCount[g]} onClick={() => resolve({ area: g })}>
              {AREA_NAME[g]} ({s.progressCardDeckCount[g]})
            </button>
          ))}
        </div>
      </section>
    );
  }
  // Picked on the island: pillage, retreat, desert, hire, road.
  const skippable = a.kind === 'hire' || a.kind === 'road';
  return (
    <section className="catan-panel is-small is-hint" role="dialog" aria-label={text}>
      {head(text)}
      <p className="kit-muted">Pick it on the island{skippable ? ', or skip.' : '.'}</p>
      {skippable && (
        <button type="button" className="g-btn g-btn-ghost g-block" onClick={() => resolve({ skip: true })}>
          {a.kind === 'road' ? 'Keep the road off the board' : 'Skip'}
        </button>
      )}
    </section>
  );
}
