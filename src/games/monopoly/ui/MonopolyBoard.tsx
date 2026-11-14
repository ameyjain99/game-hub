import type { CSSProperties, ReactNode } from 'react';
import { BOARD, type Space } from '../engine/board';
import type { MonopolyState } from '../engine/state';
import {
  ArrowLeft,
  Car,
  CircleHelp,
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
function spaceIcon(sp: Space): ReactNode {
  switch (sp.kind) {
    case 'railroad':
      return <TrainFront size={16} strokeWidth={1.75} />;
    case 'utility':
      return sp.name.startsWith('Water') ? <Droplets size={16} strokeWidth={1.75} /> : <Lightbulb size={16} strokeWidth={1.75} />;
    case 'tax':
      return sp.taxAmount && sp.taxAmount >= 200 ? <Receipt size={16} strokeWidth={1.75} /> : <Gem size={16} strokeWidth={1.75} />;
    case 'chance':
      return <CircleHelp size={18} strokeWidth={1.75} />;
    case 'chest':
      return <Gift size={18} strokeWidth={1.75} />;
    default:
      return null;
  }
}

function Corner({ sp, pot }: { sp: Space; pot: number }) {
  switch (sp.kind) {
    case 'go':
      return (
        <>
          <span className="mono-corner-sub">Collect $200</span>
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
          {pot > 0 && <span className="mono-corner-pot">${pot}</span>}
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
  /** The board's centre: the play area. */
  children: ReactNode;
}

/** The 40-space ring: colour strips on the inner edge, owned lots tinted with
 *  a band in the owner's colour on the outer edge, buildings on the strip, and
 *  the tokens on a layer above (they travel). */
export function MonopolyBoard({
  view,
  nameFor,
  actorId,
  onInspect,
  inspected = null,
  spotlight = null,
  onSpotlight,
  flashIds,
  children,
}: Props) {
  return (
    <div className={`mono-board${spotlight ? ' is-spotlit' : ''}`} role="group" aria-label="Monopoly board">
      {BOARD.map((sp) => {
        const { row, col } = cellPos(sp.id);
        const side = sideOf(sp.id);
        const own = view.ownership[sp.id];
        const ownerSeat = own?.owner ? seatOfId(view, own.owner) : -1;
        const owner = own?.owner ?? null;
        const ownable = !!own;
        const label = [
          sp.name,
          own?.owner ? `owned by ${nameFor(own.owner)}` : ownable ? `$${sp.price}` : '',
          own && own.houses === 5 ? 'hotel' : own && own.houses > 0 ? `${own.houses} house${own.houses > 1 ? 's' : ''}` : '',
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

        if (side === 'corner') {
          return (
            <div key={sp.id} className={className} style={style} aria-label={label}>
              <span className="mono-corner">
                <Corner sp={sp} pot={view.settings.freeParkingJackpot ? view.freeParkingPot : 0} />
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
              </span>
            )}
            <span className="mono-cell-body">
              {sp.kind !== 'property' && <span className="mono-cell-icon">{spaceIcon(sp)}</span>}
              <span className="mono-cell-name">{sp.name}</span>
              {sp.price != null && !own?.owner && <span className="mono-cell-price">${sp.price}</span>}
              {sp.kind === 'tax' && <span className="mono-cell-price">Pay ${sp.taxAmount}</span>}
            </span>
            {ownerSeat >= 0 && <span className="mono-owner" style={{ background: tokenColor(ownerSeat) }} />}
          </>
        );

        return ownable ? (
          <button
            key={sp.id}
            type="button"
            className={className}
            style={style}
            aria-label={label}
            aria-pressed={inspected === sp.id}
            onClick={() => onInspect(sp.id)}
            {...spot}
          >
            {body}
          </button>
        ) : (
          <div key={sp.id} className={className} style={style} aria-label={label}>
            {body}
          </div>
        );
      })}
      <div className="mono-center">{children}</div>
      <MonopolyTokens view={view} nameFor={nameFor} actorId={actorId} spotlight={spotlight} />
    </div>
  );
}
