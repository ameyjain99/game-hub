import { useState } from 'react';
import { BOARD, OWNABLE_IDS } from '../engine/board';
import type { MonopolyState, PendingTrade, TradeBundle } from '../engine/state';
import type { Action } from '../engine/actions';
import { GROUP_COLOR } from './board-layout';

/** A lot's swatch colour: its group, or neutral for stations and utilities. */
const swatch = (id: number) => (BOARD[id].group ? GROUP_COLOR[BOARD[id].group!] : '#8a8f98');

/** Lots a player could put in a trade (no buildings on them). */
const tradableOf = (view: MonopolyState, ownerId: string): number[] =>
  OWNABLE_IDS.filter((id) => view.ownership[id].owner === ownerId && view.ownership[id].houses === 0);

function Bundle({ bundle }: { bundle: TradeBundle }) {
  const empty = bundle.cash === 0 && bundle.properties.length === 0 && bundle.getOutCards === 0;
  return (
    <ul className="mono-chips">
      {empty && <li className="mono-chip is-empty">Nothing</li>}
      {bundle.cash > 0 && <li className="mono-chip is-cash">${bundle.cash}</li>}
      {bundle.properties.map((id) => (
        <li key={id} className="mono-chip">
          <span className="mono-swatch" style={{ background: swatch(id) }} />
          {BOARD[id].name}
        </li>
      ))}
      {bundle.getOutCards > 0 && <li className="mono-chip">Get Out of Jail Free ×{bundle.getOutCards}</li>}
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
}) {
  const lots = tradableOf(view, ownerId);
  return (
    <section className="mono-trade-side">
      <h4>{title}</h4>
      <label className="g-field">
        <span className="g-field-label">Cash · up to ${maxCash.toLocaleString()}</span>
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
      <div className="mono-pick-list">
        {lots.length === 0 && <p className="mono-muted">No tradable property.</p>}
        {lots.map((id) => (
          <label key={id} className={`mono-pick${picked.includes(id) ? ' is-on' : ''}`}>
            <input type="checkbox" className="g-check" checked={picked.includes(id)} onChange={() => toggle(id)} />
            <span className="mono-swatch" style={{ background: swatch(id) }} />
            <span className="mono-pick-name">{BOARD[id].name}</span>
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
  const partner = view.players.find((p) => p.id === to);
  const toggle = (list: number[], set: (x: number[]) => void) => (id: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const empty = give.length + get.length === 0 && giveCash === 0 && getCash === 0;

  const send = () => {
    const trade: PendingTrade = {
      from: meId,
      to,
      give: { cash: giveCash, properties: give, getOutCards: 0 },
      receive: { cash: getCash, properties: get, getOutCards: 0 },
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
          />
          <Side
            title={`You get from ${partner ? nameFor(partner.id) : '…'}`}
            view={view}
            ownerId={to}
            cash={getCash}
            maxCash={partner?.cash ?? 0}
            setCash={setGetCash}
            picked={get}
            toggle={toggle(get, setGet)}
            cashLabel="Cash you receive"
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
