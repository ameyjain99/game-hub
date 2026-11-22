import type { CSSProperties, ReactNode } from 'react';
import { layoutOf, spacesOf, type Space } from '../engine/board';
import { useMoney, useSpaceFlag, useSpaceName } from './boardNames';
import { Bus, Cake, Fuel, Gavel, Plane } from 'lucide-react';
import type { MonopolyState } from '../engine/state';
import {
  ArrowLeft,
  Car,
  Droplets,
  Gem,
  Gift,
  Lightbulb,
  Lock,
  Receipt,
  Siren,
  TrainFront,
} from '../../../shared/icons';
import { cellPos, GROUP_COLOR, sideOf, tokenColor } from './board-layout';
import { MonopolyTokens } from './MonopolyTokens';

const seatOfId = (state: MonopolyState, id: string) => state.players.findIndex((p) => p.id === id);

/** The small pictogram a non-street space carries. */
function spaceIcon(sp: Space, name: string): ReactNode {
  switch (sp.kind) {
    case 'railroad':
      return name.endsWith('Airport') ? <Plane size={16} strokeWidth={1.75} /> : <TrainFront size={16} strokeWidth={1.75} />;
    case 'utility':
      if (sp.name.startsWith('Gas')) return <Fuel size={16} strokeWidth={1.75} />;
      return sp.name.startsWith('Water') ? <Droplets size={16} strokeWidth={1.75} /> : <Lightbulb size={16} strokeWidth={1.75} />;
    case 'auction':
      return <Gavel size={18} strokeWidth={1.75} />;
    case 'bus-ticket':
      return <Bus size={18} strokeWidth={1.75} />;
    case 'birthday':
      return <Cake size={18} strokeWidth={1.75} />;
    case 'tax':
      return sp.taxAmount && sp.taxAmount >= 200 ? <Receipt size={16} strokeWidth={1.75} /> : <Gem size={16} strokeWidth={1.75} />;
    case 'chance':
      // Chance: the question mark printed on the back of the card.
      return (
        <span className="mono-chance-mark" aria-hidden="true">
          ?
        </span>
      );
    case 'chest':
      return <Gift size={18} strokeWidth={1.75} />;
    default:
      return null;
  }
}

function Corner({ sp, pot, money, salary }: { sp: Space; pot: number; money: (n?: number) => string; salary: number }) {
  switch (sp.kind) {
    case 'go':
      return (
        <>
          <span className="mono-corner-sub">Collect {money(salary)}</span>
          <span className="mono-corner-title">GO</span>
          <ArrowLeft size={22} strokeWidth={2.25} className="mono-corner-icon" />
        </>
      );
    case 'jail':
      return (
        <>
          <Lock size={20} strokeWidth={2} className="mono-corner-icon" />
          <span className="mono-corner-title">Jail</span>
          <span className="mono-corner-sub">Just visiting</span>
        </>
      );
    case 'free-parking':
      return (
        <>
          <Car size={22} strokeWidth={1.75} className="mono-corner-icon" />
          <span className="mono-corner-title">Free Parking</span>
          {pot > 0 && <span className="mono-corner-pot">{money(pot)}</span>}
        </>
      );
    default:
      return (
        <>
          <Siren size={20} strokeWidth={1.75} className="mono-corner-icon" />
          <span className="mono-corner-title">Go to Jail</span>
        </>
      );
  }
}

/* Where a long street name may break on a narrow square: a soft hyphen, shown only if the break is used. */
const BREAKS = [
  'Mediter-ranean', 'Massa-chusetts', 'Connect-icut', 'Pennsyl-vania', 'Tennes-see', 'Northum-berland', 'Marl-borough', 'White-chapel',
  'Penton-ville', 'Shaftes-bury', 'Knights-bridge', 'Fen-church', 'Maryle-bone', 'Trafal-gar', 'Picca-dilly', 'Leices-ter', 'Liver-pool',
  'Board-walk', 'Cali-fornia', 'Isling-ton', 'Coven-try', 'Ele-phant', 'Atlan-tic', 'Caro-lina', 'Orien-tal', 'Elec-tric', 'Commu-nity',
];
const SOFT = new Map(BREAKS.map((w) => [w.replace('-', ''), w.replace('-', '\u00AD')]));
const soft = (name: string) => name.replace(/[A-Za-z]{8,}/g, (word) => SOFT.get(word) ?? word);

interface Props {
  view: MonopolyState;
  nameFor: (id: string) => string;
  /** The player whose move the game is waiting on (their token pulses). */
  actorId: string | undefined;
  /** Open (or, if it's already open, close) a lot's title deed. */
  onInspect: (spaceId: number) => void;
  /** The lot whose deed is open, marked on the board. */
  inspected?: number | null;
  /** A player whose holdings are lit up (the rest of the board dims). */
  spotlight?: string | null;
  /** Hovering an owned lot spotlights its owner; leaving clears it. */
  onSpotlight?: (playerId: string | null) => void;
  /** Lots of a just-completed colour set, flashing in their owner's colour. */
  flashIds?: ReadonlySet<number>;
  /** Mega: squares the viewer may pick right now (a triples move, an auction, a Bus Ticket ride). */
  targets?: ReadonlySet<number>;
  /** The target picked so far. */
  picked?: number | null;
  onPick?: (spaceId: number) => void;
  /** The board's centre: the play area. */
  children: ReactNode;
}

/** The 40-space ring: colour strips on the inner edge, owned lots tinted with
 *  a band in the owner's colour on the outer edge, buildings on the strip, and
 *  the tokens on a layer above. */
export function MonopolyBoard({
  view,
  nameFor,
  actorId,
  onInspect,
  inspected = null,
  spotlight = null,
  onSpotlight,
  flashIds,
  targets,
  picked = null,
  onPick,
  children,
}: Props) {
  const nameOf = useSpaceName();
  const flagOf = useSpaceFlag();
  const money = useMoney();
  const perSide = layoutOf(view.settings.board).side;
  return (
    <div
      className={`mono-board${spotlight ? ' is-spotlit' : ''}${perSide > 10 ? ' is-mega' : ''}`}
      style={{ '--per-side': perSide - 1 } as CSSProperties}
      role="group"
      aria-label="Monopoly board"
    >
      {spacesOf(view.settings.board).map((sp) => {
        const { row, col } = cellPos(sp.id, perSide);
        const side = sideOf(sp.id, perSide);
        const own = view.ownership[sp.id];
        const ownerSeat = own?.owner ? seatOfId(view, own.owner) : -1;
        const owner = own?.owner ?? null;
        const ownable = !!own;
        const label = [
          nameOf(sp.id),
          own?.owner ? `owned by ${nameFor(own.owner)}` : ownable ? `${money(sp.price)}` : '',
          own && own.houses === 6 ? 'skyscraper' : own && own.houses === 5 ? 'hotel' : own && own.houses > 0 ? `${own.houses} house${own.houses > 1 ? 's' : ''}` : '',
          own?.depot ? 'train depot' : '',
          own?.mortgaged ? 'mortgaged' : '',
        ]
          .filter(Boolean)
          .join(', ');

        const style = {
          gridRow: row,
          gridColumn: col,
          ...(owner ? { '--oc': tokenColor(ownerSeat) } : {}),
        } as CSSProperties;
        const className = [
          `mono-cell side-${side} kind-${sp.kind}`,
          owner ? 'is-owned' : '',
          own?.mortgaged ? 'is-mortgaged' : '',
          spotlight && owner === spotlight ? 'is-lit' : '',
          inspected === sp.id ? 'is-inspected' : '',
          flashIds?.has(sp.id) ? 'is-set-flash' : '',
          targets?.has(sp.id) ? 'is-target' : '',
          picked === sp.id ? 'is-picked' : '',
        ]
          .filter(Boolean)
          .join(' ');
        // Hovering (or focusing) an owned lot spotlights everything its owner holds.
        const spot =
          owner && onSpotlight
            ? {
                onMouseEnter: () => onSpotlight(owner),
                onMouseLeave: () => onSpotlight(null),
                onFocus: () => onSpotlight(owner),
                onBlur: () => onSpotlight(null),
              }
            : {};

        const target = !!targets?.has(sp.id) && !!onPick;
        if (side === 'corner') {
          if (target)
            return (
              <button key={sp.id} type="button" className={className} data-space={sp.id} style={style} aria-label={`Pick ${label}`} aria-pressed={picked === sp.id} onClick={() => onPick(sp.id)}>
                <span className="mono-corner">
                  <Corner sp={sp} pot={view.settings.freeParkingJackpot ? view.freeParkingPot : 0} money={money} salary={view.settings.goSalary} />
                </span>
              </button>
            );
          return (
            <div key={sp.id} className={className}
              data-space={sp.id} style={style} aria-label={label}>
              <span className="mono-corner">
                <Corner sp={sp} pot={view.settings.freeParkingJackpot ? view.freeParkingPot : 0} money={money} salary={view.settings.goSalary} />
              </span>
            </div>
          );
        }

        const body = (
          <>
            {sp.kind === 'property' && sp.group && (
              <span className="mono-strip" style={{ background: GROUP_COLOR[sp.group] }}>
                {own && own.houses > 0 && own.houses < 5 && (
                  <span className="mono-houses">
                    {Array.from({ length: own.houses }, (_, i) => (
                      <span key={i} className="mono-house" />
                    ))}
                  </span>
                )}
                {own?.houses === 5 && <span className="mono-hotel" />}
                {own?.houses === 6 && <span className="mono-skyscraper" />}
              </span>
            )}
            <span className="mono-cell-body">
              {sp.kind !== 'property' && <span className="mono-cell-icon">{spaceIcon(sp, nameOf(sp.id))}</span>}
              {own?.depot && <span className="mono-depot" title="Train depot" />}
              {flagOf(sp.id) && (
                <span className="mono-cell-flag" aria-hidden="true">
                  {flagOf(sp.id)}
                </span>
              )}
              <span className="mono-cell-name">{soft(nameOf(sp.id))}</span>
              {sp.price != null && !own?.owner && <span className="mono-cell-price">{money(sp.price)}</span>}
              {sp.kind === 'tax' && <span className="mono-cell-price">Pay {money(sp.taxAmount)}</span>}
            </span>
            {ownerSeat >= 0 && <span className="mono-owner" style={{ background: tokenColor(ownerSeat) }} />}
          </>
        );

        return ownable || target ? (
          <button
            key={sp.id}
            type="button"
            className={className}
              data-space={sp.id}
            style={style}
            aria-label={target ? `Pick ${label}` : label}
            aria-pressed={target ? picked === sp.id : inspected === sp.id}
            onClick={() => (target ? onPick(sp.id) : onInspect(sp.id))}
            {...spot}
          >
            {body}
          </button>
        ) : (
          <div key={sp.id} className={className}
              data-space={sp.id} style={style} aria-label={label}>
            {body}
          </div>
        );
      })}
      <div className="mono-center">{children}</div>
      <MonopolyTokens view={view} nameFor={nameFor} actorId={actorId} spotlight={spotlight} />
    </div>
  );
}
