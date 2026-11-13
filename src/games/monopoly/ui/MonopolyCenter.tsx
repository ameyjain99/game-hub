import type { ReactNode } from 'react';
import { BOARD } from '../engine/board';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { netWorth } from '../engine/selectors';
import { ArrowLeftRight, CloseIcon, Crown } from '../../../shared/icons';
import { Dice } from './Dice';
import { MonopolyAuction } from './MonopolyAuction';
import { TitleDeed } from './TitleDeed';
import { TradeOffer } from './MonopolyTrade';
import { renderLogLine } from './logText';

interface Props {
  view: MonopolyState;
  meId: string;
  onAction: (a: Action) => void;
  nameFor: (id: string) => string;
  /** A lot the viewer opened from the board (its deed shows here). */
  inspected: number | null;
  onCloseInspect: () => void;
  onOpenTrade: () => void;
  onExit: () => void;
  /** Render everything (default), just the dice + status, or just the card + feed. */
  part?: 'all' | 'head' | 'body';
}

function Card({ kicker, title, children }: { kicker?: string; title?: string; children: ReactNode }) {
  return (
    <div className="mono-card">
      {kicker && <p className="mono-card-kicker">{kicker}</p>}
      {title && <h3 className="mono-card-title">{title}</h3>}
      {children}
    </div>
  );
}

/** The board's centre: dice, whose move it is, the one decision in front of the
 *  viewer, and the latest events. */
export function MonopolyCenter({ view, meId, onAction, nameFor, inspected, onCloseInspect, onOpenTrade, onExit, part = 'all' }: Props) {
  const actor = monopolyActor(view);
  const me = view.players.find((p) => p.id === meId);
  const myMove = actor === meId;
  const current = view.players[view.turnOrder[view.current]];
  const partners = view.players.filter((p) => p.id !== meId && !p.bankrupt);

  let status: string;
  if (view.phase === 'over') status = 'Game over';
  else if (view.pendingAuction) status = myMove ? 'Your bid' : `${nameFor(actor!)} is bidding`;
  else if (view.pendingTrade) status = myMove ? 'A trade offer for you' : `${nameFor(view.pendingTrade.to)} is considering a trade`;
  else status = myMove ? 'Your turn' : `${nameFor(current.id)}’s turn`;

  let card: ReactNode;
  if (inspected !== null) {
    card = (
      <div className="mono-card mono-inspect">
        <button type="button" className="g-icon-btn mono-inspect-close" aria-label="Close deed" onClick={onCloseInspect}>
          <CloseIcon size={15} />
        </button>
        <TitleDeed spaceId={inspected} />
        <p className="mono-muted">
          {view.ownership[inspected]?.owner ? `Owned by ${nameFor(view.ownership[inspected].owner!)}` : 'Unowned'}
          {view.ownership[inspected]?.mortgaged ? ' · mortgaged' : ''}
        </p>
      </div>
    );
  } else if (view.phase === 'over') {
    const ranked = view.players
      .filter((p) => !p.bankrupt)
      .sort((a, b) => netWorth(view, b.id) - netWorth(view, a.id));
    card = (
      <Card kicker="Game over">
        <p className="mono-winner">
          <Crown size={22} /> {view.winner ? `${nameFor(view.winner)} wins` : 'No winner'}
        </p>
        <ol className="mono-ranking">
          {ranked.map((p) => (
            <li key={p.id}>
              <span>{nameFor(p.id)}</span>
              <span>${netWorth(view, p.id).toLocaleString()}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="primary g-block" onClick={onExit}>
          Back to games
        </button>
      </Card>
    );
  } else if (view.pendingTrade) {
    card =
      view.pendingTrade.to === meId ? (
        <TradeOffer view={view} onAction={onAction} nameFor={nameFor} />
      ) : (
        <Card kicker="Trade">
          <p className="mono-waiting">
            {view.pendingTrade.from === meId
              ? `Waiting for ${nameFor(view.pendingTrade.to)} to answer your offer…`
              : `${nameFor(view.pendingTrade.from)} offered ${nameFor(view.pendingTrade.to)} a trade.`}
          </p>
        </Card>
      );
  } else if (view.pendingAuction) {
    card = <MonopolyAuction view={view} meId={meId} onAction={onAction} nameFor={nameFor} />;
  } else if (!myMove || !me) {
    card = null; // the status line already says whose turn it is
  } else if (view.phase === 'jail') {
    card = (
      <Card kicker={`In jail · attempt ${me.jailRolls + 1} of 3`} title="Get out of jail">
        <p className="mono-muted">Roll doubles to walk out free, or pay the $50 fine and roll.</p>
        <div className="mono-card-actions is-stack">
          <button type="button" className="primary" onClick={() => onAction({ type: 'ROLL_JAIL' })}>
            Roll for doubles
          </button>
          <button type="button" className="g-btn g-btn-ghost" disabled={me.cash < 50} onClick={() => onAction({ type: 'PAY_JAIL' })}>
            Pay $50
          </button>
          {me.getOutCards > 0 && (
            <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'USE_JAIL_CARD' })}>
              Use Get Out of Jail Free
            </button>
          )}
        </div>
      </Card>
    );
  } else if (view.phase === 'roll') {
    card = (
      <Card kicker={view.doubles > 0 ? 'Doubles — roll again' : undefined}>
        <button type="button" className="primary mono-roll" onClick={() => onAction({ type: 'ROLL' })}>
          Roll dice
        </button>
      </Card>
    );
  } else if (view.pendingDebt && me.cash < 0) {
    card = (
      <Card kicker="Short on cash" title={`You owe $${-me.cash} more`}>
        <p className="mono-muted">Sell buildings or mortgage property from Your properties to cover it.</p>
        <button type="button" className="g-btn g-btn-ghost mono-danger g-block" onClick={() => onAction({ type: 'DECLARE_BANKRUPTCY' })}>
          Declare bankruptcy
        </button>
      </Card>
    );
  } else if (view.pendingPurchase !== null) {
    const price = BOARD[view.pendingPurchase].price!;
    const affordable = me.cash >= price;
    card = (
      <Card kicker="For sale">
        <TitleDeed spaceId={view.pendingPurchase} />
        <div className="mono-card-actions">
          <button type="button" className="primary" disabled={!affordable} onClick={() => onAction({ type: 'BUY' })}>
            Buy for ${price}
          </button>
          <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'DECLINE' })}>
            Decline
          </button>
        </div>
        <p className="g-hint">
          {!affordable ? 'You can’t afford it. ' : ''}
          {view.settings.auctions ? 'A declined lot goes to auction.' : 'A declined lot stays with the bank.'}
        </p>
      </Card>
    );
  } else {
    card = (
      <Card>
        <div className="mono-card-actions is-stack">
          <button type="button" className="primary" onClick={() => onAction({ type: 'END_TURN' })}>
            {view.dice && view.dice[0] === view.dice[1] && view.doubles > 0 && !me.inJail ? 'Roll again' : 'End turn'}
          </button>
          {partners.length > 0 && (
            <button type="button" className="g-btn g-btn-ghost" onClick={onOpenTrade}>
              <ArrowLeftRight size={16} />
              Propose a trade
            </button>
          )}
        </div>
        <p className="g-hint">Build or mortgage from Your properties.</p>
      </Card>
    );
  }

  const lines = view.log.slice(-4).reverse();
  const head = (
    <div className="mono-play-head">
      <Dice values={view.dice} />
      <p className="mono-status" aria-live="polite">
        {status}
      </p>
    </div>
  );
  const feed =
    lines.length > 0 ? (
      <ol className="mono-feed" aria-label="Recent events">
        {lines.map((line, i) => (
          <li key={view.log.length - i}>{renderLogLine(line, nameFor)}</li>
        ))}
      </ol>
    ) : null;

  // On narrow screens the board centre only fits the dice + status; the
  // decision card and feed render below the board instead.
  if (part === 'head') return <div className="mono-play">{head}</div>;
  if (part === 'body')
    return (
      <div className="mono-play is-panel">
        {card}
        {feed}
      </div>
    );
  return (
    <div className="mono-play">
      {head}
      {card}
      {feed}
    </div>
  );
}
