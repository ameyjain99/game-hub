import type { CSSProperties } from 'react';
import { BOARD, OWNABLE_IDS } from '../engine/board';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { canBuild, canMortgage, canSellHouse, canUnmortgage, mortgageValue, unmortgageCost } from '../engine/selectors';
import { House, Hotel, Landmark, Minus, AddIcon } from '../../../shared/icons';
import { GROUP_COLOR, tokenColor, tokenLabel } from './board-layout';

const swatch = (id: number) => (BOARD[id].group ? GROUP_COLOR[BOARD[id].group!] : '#8a8f98');

interface Props {
  view: MonopolyState;
  meId: string;
  nameFor: (id: string) => string;
  onAction: (a: Action) => void;
  onInspect: (spaceId: number) => void;
}

/** The right column: every player's cash and holdings, then the viewer's own
 *  properties with build / sell / mortgage controls. */
export function MonopolySidebar({ view, meId, nameFor, onAction, onInspect }: Props) {
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

  return (
    <aside className="mono-side" aria-label="Players and properties">
      <section className="mono-side-section">
        <h2 className="mono-side-title">Players</h2>
        <ul className="mono-players">
          {order.map((p) => {
            const seat = view.players.indexOf(p);
            const lots = OWNABLE_IDS.filter((id) => view.ownership[id].owner === p.id);
            return (
              <li
                key={p.id}
                className={`mono-player${p.id === actor ? ' is-turn' : ''}${p.bankrupt ? ' is-out' : ''}`}
                style={{ '--tc': tokenColor(seat) } as CSSProperties}
              >
                <div className="mono-player-row">
                  <span className="mono-token is-static">{tokenLabel(nameFor(p.id))}</span>
                  <span className="mono-player-name">{nameFor(p.id)}</span>
                  {p.id === meId && nameFor(p.id) !== 'You' && <span className="g-tag">You</span>}
                  {p.inJail && !p.bankrupt && <span className="g-tag g-tag-warn">In jail</span>}
                  <span className="mono-player-cash">{p.bankrupt ? 'Bankrupt' : `$${p.cash.toLocaleString()}`}</span>
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
    </aside>
  );
}
