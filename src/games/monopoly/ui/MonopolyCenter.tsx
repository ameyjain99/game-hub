import { useEffect, useState, type ReactNode } from 'react';
import { isMega, layoutOf, ownableIds, spacesOf } from '../engine/board';
import { MEGA } from '../engine/mega';
import { useMoney, useMoneyText, useSpaceName } from './boardNames';
import type { MegaPick } from './megaPick';
import type { DrawnCard, MonopolyState } from '../engine/state';
import type { Action } from '../engine/actions';
import { monopolyActor } from '../engine/bot';
import { canProposeTrade, netWorth, rentFor, utilityMultiplier } from '../engine/selectors';
import { SetMomentNote, type SetMoment } from './SetMoment';
import { ArrowLeftRight, CloseIcon, Crown, Gift } from '../../../shared/icons';
import { Bus } from 'lucide-react';
import { Dice } from './Dice';
import { MonopolyAuction } from './MonopolyAuction';
import { TitleDeed } from './TitleDeed';
import { Bundle, TradeOffer } from './MonopolyTrade';
import { useTable } from '../../../online/TableContext';
import { LogLine } from './LogLine';
import { tokenColor } from './board-layout';

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
  /** Colour sets just completed, announced above everything else. */
  moments?: SetMoment[];
  onDismissMoments?: () => void;
  /** Mega: the square the viewer is naming, the one picked so far, and how to pick, confirm and open or close a Bus Ticket ride. */
  pick?: MegaPick | null;
  picked?: number | null;
  onPicked?: (spaceId: number) => void;
  onConfirmPick?: () => void;
  onTicketing?: (on: boolean) => void;
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

/** Under an open deed: who owns the lot, what's built, and the rent it charges
 *  right now (utilities depend on the roll, so say how). */
function ownershipLine(view: MonopolyState, id: number, nameFor: (id: string) => string, money: (n?: number) => string): string {
  const BOARD = spacesOf(view.settings.board);
  const own = view.ownership[id];
  if (!own?.owner) return `Unowned · for sale at ${money(BOARD[id].price)}`;
  const parts = [`Owned by ${nameFor(own.owner)}`];
  if (own.houses === 6) parts.push('a skyscraper');
  else if (own.houses === 5) parts.push('a hotel');
  else if (own.houses > 0) parts.push(`${own.houses} house${own.houses > 1 ? 's' : ''}`);
  if (own.depot) parts.push('a train depot');
  if (own.mortgaged) parts.push('mortgaged, no rent');
  else if (BOARD[id].kind === 'utility') {
    const held = ownableIds(view.settings.board).filter((x) => BOARD[x].kind === 'utility' && view.ownership[x].owner === own.owner).length;
    parts.push(`Rent now ${utilityMultiplier(held)} × dice`);
  } else parts.push(`Rent now ${money(rentFor(view, id, 0))}`);
  return parts.join(' · ');
}

/** A Chance / Community Chest card as it's drawn: the deck, its text, and who drew
 *  it. It flips in (keyed per draw) and stays for that roll's turn. */
function DrawnCardView({ card, by, onClose }: { card: DrawnCard; by: string; onClose: () => void }) {
  const chance = card.deck === 'chance';
  const asMoney = useMoneyText();
  const deck = chance ? 'Chance' : 'Community Chest';
  return (
    <div className={`mono-drawn is-${card.deck}`} role="note" aria-label={`${deck} card`}>
      <div className="mono-drawn-head">
        <span className="mono-drawn-icon">{chance ? <span className="mono-chance-mark is-small">?</span> : <Gift size={16} />}</span>
        <span className="mono-drawn-deck">{deck}</span>
        <button type="button" className="mono-drawn-close" aria-label="Put the card away" onClick={onClose}>
          <CloseIcon size={14} />
        </button>
      </div>
      <p className="mono-drawn-text">{asMoney(card.text)}</p>
      <p className="mono-drawn-by">Drawn by {by}</p>
    </div>
  );
}

/** The board's centre: dice, whose move it is, the card just drawn, the one
 *  decision in front of the viewer, and the latest events. */
export function MonopolyCenter({
  view,
  meId,
  onAction,
  nameFor,
  inspected,
  onCloseInspect,
  onOpenTrade,
  onExit,
  moments = [],
  onDismissMoments = () => {},
  pick = null,
  picked = null,
  onPicked = () => {},
  onConfirmPick = () => {},
  onTicketing = () => {},
  part = 'all',
}: Props) {
  const money = useMoney();
  const nameOf = useSpaceName();
  const BOARD = spacesOf(view.settings.board);
  const mega = isMega(view.settings.board);
  const table = useTable();
  const votes = table?.rematch ?? null;
  const askedRematch = !!votes && votes.votes.includes(meId);
  const actor = monopolyActor(view);
  const me = view.players.find((p) => p.id === meId);
  const myMove = actor === meId;
  const current = view.players[view.turnOrder[view.current]];
  const colorFor = (id: string) => tokenColor(view.players.findIndex((p) => p.id === id));

  // The card drawn on the current roll, until the viewer puts it away.
  const [putAway, setPutAway] = useState<string | null>(null);
  const last = view.lastCard;
  const lastKey = last ? `${last.atRoll}:${last.deck}:${last.text}` : null;
  const drawn =
    last && last.atRoll === view.rollSeq && lastKey !== putAway ? (
      <DrawnCardView key={lastKey} card={last} by={nameFor(last.playerId)} onClose={() => setPutAway(lastKey)} />
    ) : null;

  // The dice start turning the moment you roll, before the server answers.
  const [rolling, setRolling] = useState(false);
  useEffect(() => setRolling(false), [view.rollSeq, view.phase]);
  useEffect(() => {
    if (!rolling) return;
    const t = setTimeout(() => setRolling(false), 3000);
    return () => clearTimeout(t);
  }, [rolling]);
  const roll = () => {
    setRolling(true);
    onAction({ type: 'ROLL' });
  };

  // Space rolls when it's your roll.
  const rollReady = actor === meId && view.phase === 'roll' && !view.pendingAuction && !view.pendingTrade;
  useEffect(() => {
    if (!rollReady) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target instanceof Element && e.target.closest('input, textarea, select, button'))) return;
      e.preventDefault();
      roll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rollReady, onAction]);

  let status: string;
  if (view.phase === 'over') status = 'Game over';
  else if (view.pendingAuction) status = myMove ? 'Your bid' : `${nameFor(actor!)} is bidding`;
  else if (view.pendingTrade) status = myMove ? 'A trade offer for you' : `${nameFor(view.pendingTrade.to)} is considering a trade`;
  else status = myMove ? 'Your turn' : `${nameFor(current.id)}'s turn`;

  let card: ReactNode;
  if (inspected !== null) {
    card = (
      <div className="mono-card mono-inspect">
        <button type="button" className="g-icon-btn mono-inspect-close" aria-label="Close deed" onClick={onCloseInspect}>
          <CloseIcon size={15} />
        </button>
        <TitleDeed spaceId={inspected} />
        <p className="mono-muted">{ownershipLine(view, inspected, nameFor, money)}</p>
      </div>
    );
  } else if (view.phase === 'over') {
    const ranked = [...view.players].sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || netWorth(view, b.id) - netWorth(view, a.id));
    const byRounds = view.settings.roundLimit > 0 && view.round > view.settings.roundLimit;
    card = (
      <Card kicker="Game over">
        <p className="mono-winner">
          <Crown size={22} /> {view.winner ? `${nameFor(view.winner)} ${nameFor(view.winner) === 'You' ? 'win' : 'wins'}` : 'No winner'}
        </p>
        <ol className="mono-ranking">
          {ranked.map((p) => (
            <li key={p.id}>
              <span>{nameFor(p.id)}</span>
              <span>{p.bankrupt ? 'Bankrupt' : `${money(netWorth(view, p.id))}`}</span>
            </li>
          ))}
        </ol>
        {byRounds && <p className="mono-muted">All {view.settings.roundLimit} rounds were played: the highest net worth wins.</p>}
        <button type="button" className="primary g-block" disabled={askedRematch} onClick={() => onAction({ type: 'REMATCH' })}>
          {askedRematch ? `Waiting for ${votes!.needed - votes!.votes.length} more` : 'Play again'}
        </button>
        {votes && votes.needed > 1 && (
          <p className="g-hint">{votes.votes.length > 0 && !askedRematch ? `${votes.votes.map(nameFor).join(' and ')} asked to play again.` : 'A new game starts when everyone here asks for one.'}</p>
        )}
        <button type="button" className="g-btn g-btn-ghost g-block" onClick={onExit}>
          Back to games
        </button>
      </Card>
    );
  } else if (view.pendingTrade) {
    card =
      view.pendingTrade.to === meId ? (
        <TradeOffer view={view} onAction={onAction} nameFor={nameFor} />
      ) : (
        <Card kicker="Trade on the table" title={`${nameFor(view.pendingTrade.from)} offers ${nameFor(view.pendingTrade.to)}`}>
          <div className="mono-trade-cols">
            <section>
              <h4>{nameFor(view.pendingTrade.from)} gives</h4>
              <Bundle bundle={view.pendingTrade.give} />
            </section>
            <section>
              <h4>{nameFor(view.pendingTrade.to)} gives</h4>
              <Bundle bundle={view.pendingTrade.receive} />
            </section>
          </div>
          <p className="mono-waiting">
            {view.pendingTrade.from === meId ? `Waiting for ${nameFor(view.pendingTrade.to)} to answer...` : `${nameFor(view.pendingTrade.to)} is deciding...`}
          </p>
        </Card>
      );
  } else if (view.pendingAuction) {
    card = <MonopolyAuction view={view} meId={meId} onAction={onAction} nameFor={nameFor} />;
  } else if (!myMove || !me) {
    // What the player to move is weighing, shown to the rest of the table.
    const them = nameFor(current.id);
    if (view.pendingPurchase !== null) {
      card = (
        <Card kicker={`${them} is deciding`}>
          <TitleDeed spaceId={view.pendingPurchase} compact />
          <p className="mono-muted">
            For sale at {money(BOARD[view.pendingPurchase].price)}. {view.settings.auctions ? 'If they pass, it goes to auction.' : 'If they pass, it stays with the bank.'}
          </p>
        </Card>
      );
    } else if (view.phase === 'jail') {
      card = (
        <Card kicker={`${them} is in jail`}>
          <p className="mono-muted">Rolling for doubles, paying the {money(view.settings.jailFine)} fine, or playing a card.</p>
        </Card>
      );
    } else if (view.pendingDebt && current.cash < 0) {
      card = (
        <Card kicker={`${them} is short on cash`}>
          <p className="mono-muted">{money(-current.cash)} to find by selling buildings or mortgaging, or it is bankruptcy.</p>
        </Card>
      );
    } else if (view.choice) {
      const doing = { triples: 'rolled triples and is choosing where to move', auction: 'is choosing a property for the bank to auction', birthday: 'is choosing a birthday gift' }[view.choice.kind];
      card = (
        <Card kicker={`${them} ${doing}`}>
          <p className="mono-muted">{view.choice.kind === 'triples' ? 'Triples move to any square on the board.' : view.choice.kind === 'auction' ? 'Everyone may bid, the chooser included.' : `${money(MEGA.birthdayGift)} from the bank, or a Bus Ticket.`}</p>
        </Card>
      );
    } else if (view.bonus) {
      card = (
        <Card kicker={`${them} has a bonus move`}>
          <p className="mono-muted">{view.bonus === 'mr' ? 'Mr. Monopoly: on to the next unowned property.' : 'The Bus: a Bus Ticket, or a ride to the next Chance or Community Chest.'}</p>
        </Card>
      );
    } else card = null;
  } else if (view.phase === 'jail') {
    card = (
      <Card kicker={`In jail · attempt ${me.jailRolls + 1} of ${view.settings.jailTurns}`} title="Get out of jail">
        <p className="mono-muted">Roll doubles to walk out free, or pay the {money(view.settings.jailFine)} fine and roll.</p>
        <div className="mono-card-actions is-stack">
          <button type="button" className="primary" onClick={() => onAction({ type: 'ROLL_JAIL' })}>
            Roll for doubles
          </button>
          <button type="button" className="g-btn g-btn-ghost" disabled={me.cash < view.settings.jailFine} onClick={() => onAction({ type: 'PAY_JAIL' })}>
            Pay {money(view.settings.jailFine)}
          </button>
          {me.getOutCards > 0 && (
            <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'USE_JAIL_CARD' })}>
              Use Get Out of Jail Free
            </button>
          )}
        </div>
      </Card>
    );
  } else if (pick) {
    // Mega: a square to name. It can be picked on the board or from this list.
    const size = layoutOf(view.settings.board).size;
    const ahead = (id: number) => (id - me.position + size) % size;
    const copy = {
      triples: { kicker: 'Triples', title: 'Move to any square', text: 'Pick a square on the board or from the list. You do not roll again.', go: 'Move there' },
      auction: { kicker: 'Auction', title: 'Put a property up for auction', text: 'Pick any unowned property. The bank auctions it to the highest bidder, you included.', go: 'Auction it' },
      ticket: { kicker: 'Bus Ticket', title: 'Ride along this side of the board', text: 'In place of rolling: pick any square ahead of you on this side, up to the corner. The ticket is used up.', go: 'Ride there' },
    }[pick.kind];
    card = (
      <Card kicker={copy.kicker} title={copy.title}>
        <p className="mono-muted">{copy.text}</p>
        <label className="g-field">
          <span className="g-field-label">Square</span>
          <select aria-label={copy.title} value={picked ?? ''} onChange={(e) => onPicked(Number(e.target.value))}>
            <option value="" disabled>
              Choose a square
            </option>
            {[...pick.targets]
              .sort((a, b) => ahead(a) - ahead(b))
              .map((id) => (
                <option key={id} value={id}>
                  {nameOf(id)}
                  {pick.kind === 'auction' ? ` · ${money(BOARD[id].price)}` : ` · ${ahead(id)} ahead`}
                </option>
              ))}
          </select>
        </label>
        <div className="mono-card-actions">
          <button type="button" className="primary" disabled={picked === null} onClick={onConfirmPick}>
            {copy.go}
          </button>
          {pick.kind === 'ticket' && (
            <button type="button" className="g-btn g-btn-ghost" onClick={() => onTicketing(false)}>
              Roll instead
            </button>
          )}
        </div>
      </Card>
    );
  } else if (view.phase === 'roll') {
    // A small Roll button sits beside the dice; a Bus Ticket can be ridden in its place.
    const tickets = me.busTickets ?? 0;
    card =
      mega && tickets > 0 ? (
        <Card>
          <button type="button" className="g-btn g-btn-ghost g-block" onClick={() => onTicketing(true)}>
            <Bus size={16} />
            Ride a Bus Ticket instead{tickets > 1 ? ` (${tickets})` : ''}
          </button>
        </Card>
      ) : null;
  } else if (view.pendingDebt && me.cash < 0) {
    card = (
      <Card kicker="Short on cash" title={`You owe ${money(-me.cash)} more`}>
        <p className="mono-muted">Sell buildings or mortgage property from Your properties to cover it.</p>
        <button type="button" className="g-btn g-btn-ghost mono-danger g-block" onClick={() => onAction({ type: 'DECLARE_BANKRUPTCY' })}>
          Declare bankruptcy
        </button>
      </Card>
    );
  } else if (view.choice?.kind === 'birthday') {
    const none = (view.busLeft ?? 0) < 1;
    card = (
      <Card kicker="Birthday Gift" title="Choose your present">
        <div className="mono-card-actions is-stack">
          <button type="button" className="primary" onClick={() => onAction({ type: 'CHOOSE', take: 'cash' })}>
            Collect {money(MEGA.birthdayGift)}
          </button>
          <button type="button" className="g-btn g-btn-ghost" disabled={none} onClick={() => onAction({ type: 'CHOOSE', take: 'ticket' })}>
            <Bus size={16} />
            Take a Bus Ticket
          </button>
        </div>
        {none && <p className="g-hint">No Bus Tickets are left.</p>}
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
            Buy for {money(price)}
          </button>
          <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'DECLINE' })}>
            Decline
          </button>
        </div>
        <p className="g-hint">
          {!affordable ? "You can't afford it. " : ''}
          {view.settings.auctions ? 'A declined lot goes to auction.' : 'A declined lot stays with the bank.'}
        </p>
      </Card>
    );
  } else if (view.bonus === 'mr') {
    card = (
      <Card kicker="Speed die" title="Mr. Monopoly">
        <p className="mono-muted">A bonus move: on to the next unowned property, which you may buy. If every property is owned, on to the next one where you owe rent.</p>
        <button type="button" className="primary g-block" onClick={() => onAction({ type: 'BONUS' })}>
          Take the bonus move
        </button>
      </Card>
    );
  } else if (view.bonus === 'bus') {
    const none = (view.busLeft ?? 0) < 1;
    card = (
      <Card kicker="Speed die" title="The Bus">
        <div className="mono-card-actions is-stack">
          <button type="button" className="primary" disabled={none} onClick={() => onAction({ type: 'BONUS', take: 'ticket' })}>
            <Bus size={16} />
            Take a Bus Ticket
          </button>
          <button type="button" className="g-btn g-btn-ghost" onClick={() => onAction({ type: 'BONUS', take: 'move' })}>
            Ride to the next Chance or Community Chest
          </button>
        </div>
        <p className="g-hint">{none ? 'No Bus Tickets are left.' : `${view.busLeft} of ${MEGA.busTickets} Bus Tickets are left. A ticket is kept for a later turn.`}</p>
      </Card>
    );
  } else {
    card = (
      <Card>
        <div className="mono-card-actions is-stack">
          <button type="button" className="primary" onClick={() => onAction({ type: 'END_TURN' })}>
            {view.dice && view.dice[0] === view.dice[1] && view.doubles > 0 && !me.inJail ? 'Roll again' : 'End turn'}
          </button>
          {canProposeTrade(view, meId) && (
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
  const canRoll = myMove && !!me && view.phase === 'roll' && !view.pendingAuction && !view.pendingTrade && inspected === null;
  const head = (
    <div className="mono-play-head">
      <Dice values={view.dice} rollKey={view.rollSeq} rolling={rolling} speed={mega ? (view.dice ? (view.speedDie ?? null) : null) : undefined} />
      <p className="mono-status" aria-live="polite">
        {canRoll && view.doubles > 0 ? 'Doubles - roll again' : status}
      </p>
      {canRoll && (
        <button type="button" className="mono-roll" aria-label="Roll dice" title="Roll (Space)" onClick={roll}>
          Roll
        </button>
      )}
    </div>
  );
  const feed =
    lines.length > 0 ? (
      <ol className="mono-feed" aria-label="Recent events">
        {lines.map((line, i) => (
          <li key={view.log.length - i}>
            <LogLine line={line} nameFor={nameFor} colorFor={colorFor} />
          </li>
        ))}
      </ol>
    ) : null;

  const notes = moments.map((m) => (
    <SetMomentNote
      key={`${m.group}:${m.owner}`}
      moment={m}
      view={view}
      meId={meId}
      nameFor={nameFor}
      onClose={onDismissMoments}
    />
  ));

  // On narrow screens the board centre only fits the dice + status; the
  // notes, decision card and feed render below the board instead.
  if (part === 'head') return <div className="mono-play">{head}</div>;
  if (part === 'body')
    return (
      <div className="mono-play is-panel">
        {notes}
        {drawn}
        {card}
        {feed}
      </div>
    );
  return (
    <div className="mono-play">
      {head}
      {notes}
      {drawn}
      {card}
      {feed}
    </div>
  );
}
