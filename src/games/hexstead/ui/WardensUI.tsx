/** Wardens' parts of the Hexstead screen: commodities, the marauder fleet, guilds and edicts. */
import { useState, type CSSProperties } from 'react';
import { SideSection } from '../../kit/ui/GameShell';
import { Cards, GOOD_COLOR, GOOD_NAME, GoodsPicker, Picker } from './cards';
import { RESOURCES, type Resource } from '../board';
import { emptyHand, handSize, improveCost, victoryPoints, wardensOf, type Ask, type Hand, type HxAction, type HxState } from '../engine';
import {
  CAPITAL_LEVEL,
  COMMODITIES,
  EDICT_LIMIT,
  EDICT_NAME,
  EDICT_NEEDS,
  EDICT_TEXT,
  GUILDS,
  GUILD_ABILITY,
  GUILD_GOOD,
  GUILD_NAME,
  MARAUDER_TRACK,
  MAX_LEVEL,
  emptyGoods,
  goodsSize,
  type Card,
  type Commodity,
  type Edict,
  type Goods,
  type Guild,
} from '../wardens';

export const GUILD_COLOR: Record<Guild, string> = { trade: '#d9a520', council: '#3f7fd0', academy: '#3faa6a' };

const label = (c: Card) => (COMMODITIES as string[]).includes(c) ? GOOD_NAME[c as Commodity] : c[0].toUpperCase() + c.slice(1);

/** Your commodity cards, beside your resources in the dock. */
export function GoodsCards({ goods }: { goods: Goods }) {
  return (
    <span className="hx-goods">
      {COMMODITIES.map((c) => (
        <span key={c} className={`hx-card is-good${goods[c] === 0 ? ' is-empty' : ''}`} style={{ '--rc': GOOD_COLOR[c] } as CSSProperties} title={GOOD_NAME[c]}>
          <b>{goods[c]}</b>
          <span>{GOOD_NAME[c]}</span>
        </span>
      ))}
    </span>
  );
}

/** The marauder fleet's track: it lands on the last space. */
export function FleetSection({ s }: { s: HxState }) {
  const towns = s.buildings.filter((b) => b?.town).length;
  const defence = s.wardens.reduce((t, w) => t + (w?.active ? w.level : 0), 0);
  return (
    <SideSection title="The marauder fleet" meta={s.attacked ? 'has landed before' : 'not landed yet'}>
      <ol className="hx-fleet" aria-label={`The fleet is ${MARAUDER_TRACK - s.marauders} spaces from landing`}>
        {Array.from({ length: MARAUDER_TRACK + 1 }, (_, i) => (
          <li key={i} className={`${i === s.marauders ? 'is-here' : ''}${i === MARAUDER_TRACK ? ' is-shore' : ''}`}>
            {i === s.marauders ? (
              <svg viewBox="-0.4 -0.4 0.8 0.6" aria-hidden="true">
                <path d="M-0.3 0.02H0.3L0.2 0.15H-0.2Z" fill="#1a1c22" stroke="#ffffffb3" strokeWidth={0.02} />
                <path d="M-0.03 0V-0.3L0.17 -0.02Z" fill="#c8343a" stroke="#ffffffb3" strokeWidth={0.02} />
              </svg>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="hx-fleet-odds">
        Marauders <b>{towns}</b> (one per town) · Mustered wardens <b>{defence}</b>
      </p>
    </SideSection>
  );
}

/** Your guild levels, the next level's price, and the Capitals. */
export function GuildsSection({ s, meId, canAct, onAction }: { s: HxState; meId: string; canAct: boolean; onAction: (a: HxAction) => void }) {
  const me = s.players.find((p) => p.id === meId);
  if (!me) return null;
  return (
    <SideSection title="Guilds">
      <ul className="hx-guilds">
        {GUILDS.map((g) => {
          const level = me.guilds[g];
          const cost = improveCost(s, meId, g);
          const affordable = cost !== null && me.goods[GUILD_GOOD[g]] >= cost;
          const capital = s.capitals[g];
          return (
            <li key={g} style={{ '--gc': GUILD_COLOR[g] } as CSSProperties}>
              <div className="hx-guild-head">
                <b>{GUILD_NAME[g]}</b>
                <span className="hx-guild-pips" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
                  {Array.from({ length: MAX_LEVEL }, (_, i) => (
                    <i key={i} className={`${i < level ? 'is-on' : ''}${i + 1 === CAPITAL_LEVEL ? ' is-capital' : ''}`} />
                  ))}
                </span>
                <button type="button" className="g-btn g-btn-light g-btn-sm" disabled={!canAct || !affordable} onClick={() => onAction({ type: 'IMPROVE', guild: g })}>
                  {cost === null ? (level >= MAX_LEVEL ? 'Top level' : 'Need a town') : `Level ${level + 1}: ${cost} ${GOOD_NAME[GUILD_GOOD[g]].toLowerCase()}`}
                </button>
              </div>
              <p className="kit-muted">
                Level 3: {GUILD_ABILITY[g]}
                {capital ? ` Capital: ${capital.player === meId ? 'yours' : s.players.find((p) => p.id === capital.player)?.name}.` : ` First to level ${CAPITAL_LEVEL} takes the Capital.`}
              </p>
            </li>
          );
        })}
      </ul>
    </SideSection>
  );
}

/** Your edicts, each with a Play button. */
export function EdictsSection({ s, meId, canPlay, onPick }: { s: HxState; meId: string; canPlay: (e: Edict) => boolean; onPick: (e: Edict) => void }) {
  const me = s.players.find((p) => p.id === meId);
  if (!me) return null;
  const over = me.edicts.length > EDICT_LIMIT;
  return (
    <SideSection title="Your edicts" meta={`${me.edictPoints ? `${me.edictPoints} point${me.edictPoints === 1 ? '' : 's'} shown · ` : ''}${me.edicts.length} of ${EDICT_LIMIT}`}>
      {me.edicts.length === 0 ? (
        <p className="kit-muted">Edicts are drawn when the omen die shows a guild&apos;s gate and the red die is no more than your level there plus one.</p>
      ) : (
        <>
          {over && <p className="hx-warn">You hold more than {EDICT_LIMIT}: play one, or put one back when you end your turn.</p>}
          <ul className="hx-charters">
            {me.edicts.map((e, i) => (
              <li key={`${e}${i}`}>
                <span>
                  <b>{EDICT_NAME[e]}</b>
                  <span className="kit-muted">{EDICT_TEXT[e]}</span>
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

/** Two dice to set by hand (the Alchemist): the red one, which also decides edict draws, and the yellow. */
function DiceSetter({ onSet }: { onSet: (dice: [number, number]) => void }) {
  const [red, setRed] = useState(3);
  const [yellow, setYellow] = useState(4);
  const row = (name: string, tone: string, value: number, set: (n: number) => void) => (
    <div className={`hx-dice-set is-${tone}`} role="radiogroup" aria-label={name}>
      <span className="hx-pick-name">{name}</span>
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
        Set them: {red} + {yellow} = {red + yellow}, then roll the omen die
      </button>
    </>
  );
}

/** The choice an edict needs before it is played (a player, a card, a town or the dice). Board picks are made on the island. */
export function EdictDialog({ s, meId, edict, onAction, onClose }: { s: HxState; meId: string; edict: Edict; onAction: (a: HxAction) => void; onClose: () => void }) {
  const need = EDICT_NEEDS[edict];
  const [pickTown, setPickTown] = useState<number | null>(null);
  const play = (extra: Partial<Extract<HxAction, { type: 'PLAY_EDICT' }>>) => {
    onAction({ type: 'PLAY_EDICT', edict, ...extra });
    onClose();
  };
  const others = s.players.filter((p) => p.id !== meId && !p.out);
  const mine = victoryPoints(s, meId, false);
  const towns = s.buildings.flatMap((b, v) => (b?.player === meId && b.town && !s.walls[v] ? [v] : []));
  const cards: Card[] = need === 'resource' ? RESOURCES : need === 'commodity' ? COMMODITIES : [...RESOURCES, ...COMMODITIES];
  const targets = others.filter((p) => (edict === 'spy' ? p.edictCount > 0 : edict === 'deserter' ? wardensOf(s, p.id).length > 0 : victoryPoints(s, p.id, false) > mine));
  return (
    <section className="hx-panel is-small" role="dialog" aria-label={EDICT_NAME[edict]}>
      <header className="hx-panel-head">
        <h3>{EDICT_NAME[edict]}</h3>
        <button type="button" className="hx-panel-close" onClick={onClose} aria-label="Cancel">
          ×
        </button>
      </header>
      <p className="kit-muted">{EDICT_TEXT[edict]}</p>
      {need === 'player' && (
        <div className="hx-choice">
          {targets.length === 0 && <p className="kit-muted">No player can be chosen right now.</p>}
          {targets.map((p) => (
            <button key={p.id} type="button" className="g-btn g-btn-light" onClick={() => play({ target: p.id })}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      {(need === 'resource' || need === 'commodity' || need === 'card') && (
        <div className="hx-choice is-grid">
          {cards.map((c) => (
            <button key={c} type="button" className="g-btn g-btn-light" onClick={() => play({ take: [c as Resource] })}>
              {label(c)}
            </button>
          ))}
        </div>
      )}
      {need === 'town' && (
        <>
          <div className="hx-choice">
            {towns.map((v, i) => (
              <button key={v} type="button" className={`g-btn g-btn-light${pickTown === v ? ' is-on' : ''}`} onClick={() => setPickTown(v)}>
                Town {i + 1}
              </button>
            ))}
          </div>
          <button type="button" className="primary g-block" disabled={pickTown === null} onClick={() => play({ vertex: pickTown! })}>
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

/** Commercial Harbour, for the rest of the turn: hand each player a resource for a commodity of their choice. */
export function HarborSection({ s, meId, onAction }: { s: HxState; meId: string; onAction: (a: HxAction) => void }) {
  const me = s.players.find((p) => p.id === meId)!;
  const held = RESOURCES.filter((r) => me.hand[r] > 0);
  const [give, setGive] = useState<Resource | null>(null);
  const chosen = give && me.hand[give] > 0 ? give : (held[0] ?? null);
  return (
    <SideSection title="Commercial Harbour" meta="this turn">
      <p className="kit-muted">Hand a player one resource: they must give you a commodity of their choice. A player with no commodities keeps nothing, and you keep your card.</p>
      <div className="hx-choice is-grid" role="radiogroup" aria-label="Resource to hand over">
        {RESOURCES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={chosen === r} disabled={me.hand[r] === 0} className={`g-btn g-btn-light g-btn-sm${chosen === r ? ' is-on' : ''}`} onClick={() => setGive(r)}>
            {label(r)} ({me.hand[r]})
          </button>
        ))}
      </div>
      <div className="hx-choice">
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
      return { mine, text: mine ? `Commercial Harbour · give ${them(a.to)} a commodity` : `${name} is choosing a commodity for ${them(a.to)}` };
    case 'take':
      return { mine, text: mine ? `Master Merchant · take ${a.count} cards from ${poss(a.from)} hand` : `${name} is looking through ${poss(a.from)} hand` };
    case 'spy':
      return { mine, text: mine ? `Spy · take one of ${poss(a.from)} edicts` : `${name} is looking at ${poss(a.from)} edicts` };
    case 'pillage':
      return { mine, text: mine ? 'The marauders won · pick the town you lose' : `${name} is picking the town the marauders take` };
    case 'draw':
      return { mine, text: mine ? 'A tie for the best defence · draw an edict from any deck' : `${name} is choosing an edict deck` };
    case 'edict-limit':
      return { mine, text: mine ? `More than ${EDICT_LIMIT} edicts · put one back under its deck` : `${name} is putting an edict back` };
    case 'retreat':
      return { mine, text: mine ? 'Your warden was pushed off · pick where it goes' : `${name} is moving a pushed warden` };
    case 'desert':
      return { mine, text: mine ? `Deserter · pick the warden you give up` : `${name} is choosing a warden to give up` };
    case 'enlist':
      return { mine, text: mine ? `Deserter · place a strength-${a.level} warden on your road, or skip` : `${name} is placing a warden` };
    case 'road':
      return { mine, text: mine ? 'Diplomat · build your road again elsewhere, or keep it' : `${name} is rebuilding a road` };
  }
}

/** The panel for a choice you owe that is made with cards or buttons (choices on the island show only a hint and Skip). */
export function AskPanel({ s, meId, nameFor, onAction }: { s: HxState; meId: string; nameFor: (id: string) => string; onAction: (a: HxAction) => void }) {
  const a = s.asks![0];
  const me = s.players.find((p) => p.id === meId)!;
  const [cards, setCards] = useState<Hand>(emptyHand());
  const [goods, setGoods] = useState<Goods>(emptyGoods());
  const { text } = askStatus(a, meId, nameFor);
  const resolve = (r: Omit<Extract<HxAction, { type: 'RESOLVE' }>, 'type'>) => onAction({ type: 'RESOLVE', ...r });
  const from = a.kind === 'take' || a.kind === 'spy' ? s.players.find((p) => p.id === a.from)! : null;
  const head = (title: string) => (
    <header className="hx-panel-head">
      <h3>{title}</h3>
    </header>
  );
  if (a.kind === 'discard' || a.kind === 'give' || a.kind === 'take') {
    const source = a.kind === 'take' ? from! : me;
    const need = Math.min(a.count, handSize(source.hand) + goodsSize(source.goods));
    const picked = handSize(cards) + goodsSize(goods);
    const verb = a.kind === 'discard' ? 'Discard' : a.kind === 'give' ? 'Give' : 'Take';
    return (
      <section className="hx-panel" role="dialog" aria-label={text}>
        {head(text)}
        {a.kind === 'take' && (
          <>
            <p className="hx-offer-line">
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
      <section className="hx-panel is-small" role="dialog" aria-label={text}>
        {head(text)}
        <div className="hx-choice">
          {COMMODITIES.filter((c) => me.goods[c] > 0).map((c) => (
            <button key={c} type="button" className="hx-res-btn" style={{ '--rc': GOOD_COLOR[c] } as CSSProperties} onClick={() => resolve({ goods: { [c]: 1 } })}>
              {GOOD_NAME[c]} ({me.goods[c]})
            </button>
          ))}
        </div>
      </section>
    );
  }
  if (a.kind === 'spy' || a.kind === 'edict-limit') {
    const list = a.kind === 'spy' ? from!.edicts : me.edicts;
    return (
      <section className="hx-panel is-small" role="dialog" aria-label={text}>
        {head(text)}
        <ul className="hx-charters">
          {list.map((e, i) => (
            <li key={`${e}${i}`}>
              <span>
                <b>{EDICT_NAME[e]}</b>
                <span className="kit-muted">{EDICT_TEXT[e]}</span>
              </span>
              <button type="button" className="g-btn g-btn-light g-btn-sm" onClick={() => resolve({ edict: e })}>
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
      <section className="hx-panel is-small" role="dialog" aria-label={text}>
        {head(text)}
        <div className="hx-choice">
          {GUILDS.map((g) => (
            <button key={g} type="button" className="hx-res-btn" style={{ '--rc': GUILD_COLOR[g] } as CSSProperties} disabled={!s.edictDeckCount[g]} onClick={() => resolve({ guild: g })}>
              {GUILD_NAME[g]} ({s.edictDeckCount[g]})
            </button>
          ))}
        </div>
      </section>
    );
  }
  // Picked on the island: pillage, retreat, desert, enlist, road.
  const skippable = a.kind === 'enlist' || a.kind === 'road';
  return (
    <section className="hx-panel is-small is-hint" role="dialog" aria-label={text}>
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
