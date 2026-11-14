import { useEffect, useState } from 'react';
import type { MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { legalBid } from '../engine/selectors';
import { TitleDeed } from './TitleDeed';

/** The live auction: the lot, the standing bid, and (on your turn to bid)
 *  quick raises, a custom amount, or pass. */
export function MonopolyAuction({
  view,
  meId,
  onAction,
  nameFor,
}: {
  view: MonopolyState;
  meId: string;
  onAction: (a: Action) => void;
  nameFor: (id: string) => string;
}) {
  const a = view.pendingAuction!;
  const bidderId = view.players[a.turn]?.id;
  const myTurn = bidderId === meId;
  const { min, max } = legalBid(view, meId, a.highBid);
  const [amount, setAmount] = useState(min);
  useEffect(() => setAmount(min), [min]);
  const canBid = min <= max && amount >= min && amount <= max;

  return (
    <div className="mono-card" role="group" aria-label="Auction">
      <p className="mono-card-kicker">Auction</p>
      <TitleDeed spaceId={a.spaceId} compact />
      <p className="mono-auction-high">
        {a.highBidder === null ? (
          'No bids yet'
        ) : (
          <>
            High bid <strong>${a.highBid}</strong> · {nameFor(view.players[a.highBidder].id)}
          </>
        )}
      </p>
      {myTurn ? (
        <>
          <div className="mono-quick-bids">
            {[10, 50, 100].map((step) => (
              <button
                key={step}
                type="button"
                className="g-btn g-btn-sm g-btn-ghost"
                disabled={a.highBid + step > max}
                onClick={() => onAction({ type: 'BID', amount: a.highBid + step })}
              >
                +${step}
              </button>
            ))}
          </div>
          <div className="mono-bid-row">
            <span className="g-money">
              <input
                className="g-input"
                type="number"
                inputMode="numeric"
                aria-label="Bid amount"
                value={amount}
                min={min}
                max={max}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </span>
            <button type="button" className="primary" disabled={!canBid} onClick={() => onAction({ type: 'BID', amount })}>
              Place bid
            </button>
          </div>
          <button type="button" className="g-btn g-btn-ghost g-block" onClick={() => onAction({ type: 'PASS_BID' })}>
            Pass
          </button>
          {min > max && <p className="g-hint">You can't outbid ${a.highBid} with ${max}.</p>}
        </>
      ) : (
        <p className="mono-waiting">Waiting for {bidderId ? nameFor(bidderId) : 'the next bidder'}...</p>
      )}
    </div>
  );
}
