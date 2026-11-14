import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BOARD, OWNABLE_IDS } from '../engine/board';
import type { MonopolyPlayer, MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import {
  canBuild,
  canMortgage,
  canProposeTrade,
  canSellHouse,
  canUnmortgage,
  mortgageValue,
  netWorth,
  unmortgageCost,
} from '../engine/selectors';
import { ArrowLeftRight, House, Hotel, Landmark, Minus, AddIcon } from '../../../shared/icons';
import { GROUP_COLOR, tokenColor, tokenLabel } from './board-layout';
import { LogLine } from './LogLine';

const swatch = (id: number) => (BOARD[id].group ? GROUP_COLOR[BOARD[id].group!] : '#8a8f98');

interface Props {
  view: MonopolyState;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (a: Action) => void;
  onInspect: (spaceId: number) => void;
  /** Open the trade dialog with this player preselected. */
  onTradeWith: (playerId: string) => void;
  /** The player whose holdings are lit on the board (their row lights too). */
  spotlight?: string | null;
  /** Hovering a player's row spotlights their holdings; leaving clears it. */
  onSpotlight?: (playerId: string | null) => void;
  /** Shown first (the online video table). */
  top?: ReactNode;
}

/** How long a change in someone's cash floats beside their balance. */
const DELTA_MS = 1600;

interface CashDelta {
  key: number;
  amount: number;
}

/** Each player's recent cash changes, each kept for DELTA_MS, so a payment shows
 *  as money leaving one balance and arriving at another. */
function useCashDeltas(players: MonopolyPlayer[]): Record<string, CashDelta[]> {
  const before = useRef<Record<string, number>>(Object.fromEntries(players.map((p) => [p.id, p.cash])));
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [deltas, setDeltas] = useState<Record<string, CashDelta[]>>({});
  const signature = players.map((p) => `${p.id}:${p.cash}`).join('|');

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const added: (CashDelta & { id: string })[] = [];
    for (const p of players) {
      const was = before.current[p.id];
      if (was !== undefined && was !== p.cash) added.push({ id: p.id, key: ++seq.current, amount: p.cash - was });
      before.current[p.id] = p.cash;
    }
    if (added.length === 0) return;
    setDeltas((d) => {
      const next = { ...d };
      for (const a of added) next[a.id] = [...(next[a.id] ?? []), { key: a.key, amount: a.amount }];
      return next;
    });
    // Each batch removes itself; a later change never cancels an earlier removal.
    const keys = new Set(added.map((a) => a.key));
    const t = setTimeout(() => {
      timers.current.delete(t);
      setDeltas((d) =>
        Object.fromEntries(Object.entries(d).map(([id, list]) => [id, list.filter((x) => !keys.has(x.key))])),
      );
    }, DELTA_MS);
    timers.current.add(t);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  return deltas;
}

const money = (n: number) => `$${n.toLocaleString()}`;

/** The right column: the video table (online), every player's cash, worth and
 *  holdings, the viewer's own properties with build / sell / mortgage controls,
 *  and the full game log. */
export function MonopolySidebar({
  view,
  meId,
  nameFor,
  onAction,
  onInspect,
  onTradeWith,
  spotlight = null,
  onSpotlight,
  top,
}: Props) {
  const actor = monopolyActor(view);
  const me = view.players.find((p) => p.id === meId);
  const current = view.players[view.turnOrder[view.current]];
  // Building and mortgaging happen only on your own turn, outside auctions/trades.
  const canManage =
    !!me &&
    actor === meId &&
    current.id === meId &&
    (view.phase === 'roll' || view.phase === 'jail' || view.phase === 'action') &&
    !view.pendingAuction &&
    !view.pendingTrade;
  const mine = me ? OWNABLE_IDS.filter((id) => view.ownership[id].owner === meId) : [];
  const order = view.turnOrder.map((seat) => view.players[seat]);
  const deltas = useCashDeltas(view.players);
  const canTrade = canProposeTrade(view, meId);
  const colorFor = (id: string) => tokenColor(view.players.findIndex((p) => p.id === id));

  return (
    <aside className="mono-side" aria-label="Players and properties">
      {top}
      <section className="mono-side-section">
        <h2 className="mono-side-title">Players</h2>
        <ul className="mono-players">
          {order.map((p) => {
            const seat = view.players.indexOf(p);
            const lots = OWNABLE_IDS.filter((id) => view.ownership[id].owner === p.id);
            return (
              <li
                key={p.id}
                className={`mono-player${p.id === actor ? ' is-turn' : ''}${p.bankrupt ? ' is-out' : ''}${
                  spotlight === p.id ? ' is-spot' : ''
                }`}
                style={{ '--tc': tokenColor(seat) } as CSSProperties}
                onMouseEnter={onSpotlight ? () => onSpotlight(p.id) : undefined}
                onMouseLeave={onSpotlight ? () => onSpotlight(null) : undefined}
              >
                <div className="mono-player-row">
                  <span className="mono-token is-static">{tokenLabel(nameFor(p.id))}</span>
                  <span className="mono-player-name">{nameFor(p.id)}</span>
                  {p.id === meId && nameFor(p.id) !== 'You' && <span className="g-tag">You</span>}
                  {p.inJail && !p.bankrupt && <span className="g-tag g-tag-warn">In jail</span>}
                  {p.getOutCards > 0 && !p.bankrupt && (
                    <span className="g-tag" title="Get Out of Jail Free">
                      Jail-free{p.getOutCards > 1 ? ` ×${p.getOutCards}` : ''}
                    </span>
                  )}
                  <span className="mono-player-money">
                    <span className="mono-player-cash">
                      {p.bankrupt ? 'Bankrupt' : money(p.cash)}
                      {(deltas[p.id] ?? []).map((d) => (
                        <span key={d.key} className={`mono-cash-delta ${d.amount > 0 ? 'is-gain' : 'is-loss'}`} aria-hidden>
                          {`${d.amount > 0 ? '+' : '−'}${money(Math.abs(d.amount))}`}
                        </span>
                      ))}
                    </span>
                    {!p.bankrupt && <span className="mono-player-worth">{`Net ${money(netWorth(view, p.id))}`}</span>}
                  </span>
                  {canTrade && p.id !== meId && !p.bankrupt && (
                    <button
                      type="button"
                      className="mono-tool"
                      aria-label={`Trade with ${nameFor(p.id)}`}
                      title={`Trade with ${nameFor(p.id)}`}
                      onClick={() => onTradeWith(p.id)}
                    >
                      <ArrowLeftRight size={14} />
                    </button>
                  )}
                </div>
                {lots.length > 0 && (
                  <div className="mono-swatches">
                    {lots.map((id) => (
                      <span
                        key={id}
                        className={`mono-swatch${view.ownership[id].mortgaged ? ' is-mortgaged' : ''}`}
                        style={{ background: swatch(id) }}
                        title={BOARD[id].name}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {me && !me.bankrupt && (
        <section className="mono-side-section mono-mine">
          <h2 className="mono-side-title">
            Your properties
            <span className="mono-bank">
              <House size={13} /> {view.housesLeft} <Hotel size={13} /> {view.hotelsLeft} left
            </span>
          </h2>
          {mine.length === 0 ? (
            <p className="mono-muted">You don’t own anything yet. Land on an unowned lot to buy it.</p>
          ) : (
            <ul className="mono-props">
              {mine.map((id) => {
                const own = view.ownership[id];
                const sp = BOARD[id];
                const build = canManage && canBuild(view, meId, id);
                const sell = canManage && canSellHouse(view, meId, id);
                const mort = canManage && !own.mortgaged && canMortgage(view, id);
                const redeem = canManage && own.mortgaged && canUnmortgage(view, meId, id);
                // Houses and their controls only matter once the whole set is yours.
                const set = sp.kind === 'property' ? OWNABLE_IDS.filter((x) => BOARD[x].group === sp.group) : [];
                const setOwned = set.filter((x) => view.ownership[x].owner === meId).length;
                const fullSet = set.length > 0 && setOwned === set.length;
                return (
                  <li key={id} className={`mono-prop${own.mortgaged ? ' is-mortgaged' : ''}`}>
                    <button type="button" className="mono-prop-name" onClick={() => onInspect(id)}>
                      <span className="mono-swatch" style={{ background: swatch(id) }} />
                      <span>{sp.name}</span>
                    </button>
                    <span className="mono-prop-build">
                      {own.mortgaged ? (
                        <span className="g-tag g-tag-dim">Mortgaged</span>
                      ) : own.houses === 5 ? (
                        <span className="mono-pip is-hotel" aria-label="hotel" />
                      ) : fullSet ? (
                        <span className="mono-prop-build" aria-label={`${own.houses} houses`}>
                          {Array.from({ length: 4 }, (_, i) => (
                            <span key={i} className={`mono-pip${i < own.houses ? ' is-on' : ''}`} />
                          ))}
                        </span>
                      ) : set.length > 0 ? (
                        <span className="mono-set-progress" title="Lots of this colour you own">
                          {setOwned}/{set.length}
                        </span>
                      ) : null}
                    </span>
                    <span className="mono-prop-actions">
                      {fullSet && (
                        <>
                          <button
                            type="button"
                            className="mono-tool"
                            disabled={!sell}
                            aria-label={`Sell a building on ${sp.name}`}
                            title={`Sell a building (+$${Math.floor(sp.houseCost! / 2)})`}
                            onClick={() => onAction({ type: 'SELL_HOUSE', spaceId: id })}
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            type="button"
                            className="mono-tool"
                            disabled={!build}
                            aria-label={`Build on ${sp.name}`}
                            title={`Build (${own.houses === 4 ? 'hotel' : 'house'}, $${sp.houseCost})`}
                            onClick={() => onAction({ type: 'BUILD', spaceId: id })}
                          >
                            <AddIcon size={14} />
                          </button>
                        </>
                      )}
                      {own.mortgaged ? (
                        <button
                          type="button"
                          className="mono-tool is-wide"
                          disabled={!redeem}
                          aria-label={`Pay off the mortgage on ${sp.name}`}
                          title={`Pay off ($${unmortgageCost(id)})`}
                          onClick={() => onAction({ type: 'UNMORTGAGE', spaceId: id })}
                        >
                          Redeem
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mono-tool is-wide"
                          disabled={!mort}
                          aria-label={`Mortgage ${sp.name}`}
                          title={`Mortgage for $${mortgageValue(id)}`}
                          onClick={() => onAction({ type: 'MORTGAGE', spaceId: id })}
                        >
                          <Landmark size={13} />
                          Mortgage
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {view.log.length > 0 && (
        <details className="g-disclosure mono-side-log" aria-label="Game log">
          <summary>
            Game log
            <span className="g-disclosure-meta">
              {view.log.length} {view.log.length === 1 ? 'event' : 'events'}
            </span>
          </summary>
          <ol className="mono-log">
            {[...view.log].reverse().map((line, i) => (
              <li key={view.log.length - i}>
                <LogLine line={line} nameFor={nameFor} colorFor={colorFor} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </aside>
  );
}
