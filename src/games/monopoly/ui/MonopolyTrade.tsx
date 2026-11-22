import { useState } from 'react';
import { isMega, ownableIds } from '../engine/board';
import { useMoney, useSpaceName, useSwatch } from './boardNames';
import type { MonopolyState, PendingTrade, TradeBundle } from '../engine/state';
import type { Action } from '../engine/actions';

/** Lots a player could put in a trade (no buildings on them). */
const tradableOf = (view: MonopolyState, ownerId: string): number[] =>
  ownableIds(view.settings.board).filter((id) => view.ownership[id].owner === ownerId && view.ownership[id].houses === 0 && !view.ownership[id].depot);

export function Bundle({ bundle }: { bundle: TradeBundle }) {
  const nameOf = useSpaceName();
  const money = useMoney();
  const swatch = useSwatch();
  const tickets = bundle.busTickets ?? 0;
  const empty = bundle.cash === 0 && bundle.properties.length === 0 && bundle.getOutCards === 0 && tickets === 0;
  return (
    <ul className="mono-chips">
      {empty && <li className="mono-chip is-empty">Nothing</li>}
      {bundle.cash > 0 && <li className="mono-chip is-cash">{money(bundle.cash)}</li>}
      {bundle.properties.map((id) => (
        <li key={id} className="mono-chip">
          <span className="mono-swatch" style={{ background: swatch(id) }} />
          {nameOf(id)}
        </li>
      ))}
      {bundle.getOutCards > 0 && <li className="mono-chip">Get Out of Jail Free ×{bundle.getOutCards}</li>}
      {tickets > 0 && <li className="mono-chip">Bus Ticket ×{tickets}</li>}
    </ul>
  );
}

/** An offer waiting on the viewer: what they get, what they give, accept/decline. */
export function TradeOffer({
  view,
  onAction,
  nameFor,
}: {
  view: MonopolyState;
  onAction: (a: Action) => void;
  nameFor: (id: string) => string;
}) {
  const t = view.pendingTrade!;
  return (
    <div className="mono-card" role="group" aria-label="Trade offer">
      <p className="mono-card-kicker">Trade offer</p>
      <h3 className="mono-card-title">{nameFor(t.from)} wants to trade</h3>
      <div className="mono-trade-cols">
        <section>
          <h4>You get</h4>
          <Bundle bundle={t.give} />
        </section>
        <section>
          <h4>You give</h4>
          <Bundle bundle={t.receive} />
        </section>
      </div>
      <div className="mono-card-actions">
        <button type="button" className="primary" onClick={() => onAction({ type: 'RESPOND_TRADE', accept: true })}>
          Accept
        </button>
        <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'RESPOND_TRADE', accept: false })}>
          Decline
        </button>
      </div>
    </div>
  );
}

function Side({
  title,
  view,
  ownerId,
  cash,
  maxCash,
  setCash,
  picked,
  toggle,
  cashLabel,
  tickets,
  maxTickets,
  setTickets,
}: {
  title: string;
  view: MonopolyState;
  ownerId: string;
  cash: number;
  maxCash: number;
  setCash: (n: number) => void;
  picked: number[];
  toggle: (id: number) => void;
  cashLabel: string;
  /** Mega: Bus Tickets on this side of the trade. */
  tickets: number;
  maxTickets: number;
  setTickets: (n: number) => void;
}) {
  const nameOf = useSpaceName();
  const money = useMoney();
  const swatch = useSwatch();
  const lots = tradableOf(view, ownerId);
  return (
    <section className="mono-trade-side">
      <h4>{title}</h4>
      <label className="g-field">
        <span className="g-field-label">Cash · up to {money(maxCash)}</span>
        <span className="g-money">
          <input
            className="g-input"
            type="number"
            inputMode="numeric"
            aria-label={cashLabel}
            min={0}
            max={maxCash}
            value={cash}
            onChange={(e) => setCash(Math.max(0, Math.min(maxCash, Number(e.target.value) || 0)))}
          />
        </span>
      </label>
      {maxTickets > 0 && (
        <label className="g-field">
          <span className="g-field-label">Bus Tickets · up to {maxTickets}</span>
          <select aria-label={`${title}: Bus Tickets`} value={tickets} onChange={(e) => setTickets(Number(e.target.value))}>
            {Array.from({ length: maxTickets + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None' : n}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mono-pick-list">
        {lots.length === 0 && <p className="mono-muted">No tradable property.</p>}
        {lots.map((id) => (
          <label key={id} className={`mono-pick${picked.includes(id) ? ' is-on' : ''}`}>
            <input type="checkbox" className="g-check" checked={picked.includes(id)} onChange={() => toggle(id)} />
            <span className="mono-swatch" style={{ background: swatch(id) }} />
            <span className="mono-pick-name">{nameOf(id)}</span>
            {view.ownership[id].mortgaged && <span className="g-tag g-tag-dim">Mortgaged</span>}
          </label>
        ))}
      </div>
    </section>
  );
}

/** The trade builder dialog the current player uses to make an offer. */
export function TradeDialog({
  view,
  meId,
  onAction,
  onClose,
  nameFor,
  initialPartner,
}: {
  view: MonopolyState;
  meId: string;
  onAction: (a: Action) => void;
  onClose: () => void;
  nameFor: (id: string) => string;
  /** Start with this player chosen (opened from their row in the sidebar). */
  initialPartner?: string;
}) {
  const partners = view.players.filter((p) => p.id !== meId && !p.bankrupt);
  const me = view.players.find((p) => p.id === meId)!;
  const [to, setTo] = useState(
    partners.some((p) => p.id === initialPartner) ? initialPartner! : (partners[0]?.id ?? ''),
  );
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);
  const [giveTickets, setGiveTickets] = useState(0);
  const [getTickets, setGetTickets] = useState(0);
  const mega = isMega(view.settings.board);
  const partner = view.players.find((p) => p.id === to);
  const toggle = (list: number[], set: (x: number[]) => void) => (id: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const empty = give.length + get.length === 0 && giveCash === 0 && getCash === 0 && giveTickets === 0 && getTickets === 0;

  const send = () => {
    const trade: PendingTrade = {
      from: meId,
      to,
      give: { cash: giveCash, properties: give, getOutCards: 0, ...(giveTickets ? { busTickets: giveTickets } : {}) },
      receive: { cash: getCash, properties: get, getOutCards: 0, ...(getTickets ? { busTickets: getTickets } : {}) },
    };
    onAction({ type: 'PROPOSE_TRADE', trade });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card mono-trade-dialog" role="dialog" aria-label="Propose a trade" onClick={(e) => e.stopPropagation()}>
        <header className="mono-dialog-head">
          <h2>Propose a trade</h2>
          <label className="g-field mono-partner">
            <span className="g-field-label">With</span>
            <select
              aria-label="Trade partner"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setGet([]);
                setGetCash(0);
                setGetTickets(0);
              }}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameFor(p.id)}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="mono-trade-cols">
          <Side
            title="You give"
            view={view}
            ownerId={meId}
            cash={giveCash}
            maxCash={me.cash}
            setCash={setGiveCash}
            picked={give}
            toggle={toggle(give, setGive)}
            cashLabel="Cash you give"
            tickets={giveTickets}
            maxTickets={mega ? (me.busTickets ?? 0) : 0}
            setTickets={setGiveTickets}
          />
          <Side
            title={`You get from ${partner ? nameFor(partner.id) : '...'}`}
            view={view}
            ownerId={to}
            cash={getCash}
            maxCash={partner?.cash ?? 0}
            setCash={setGetCash}
            picked={get}
            toggle={toggle(get, setGet)}
            cashLabel="Cash you receive"
            tickets={getTickets}
            maxTickets={mega ? (partner?.busTickets ?? 0) : 0}
            setTickets={setGetTickets}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={empty || !to} onClick={send}>
            Send offer
          </button>
        </div>
      </div>
    </div>
  );
}
