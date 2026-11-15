/** Hexstead's card pieces, shared by the table and its panels: names, colours, chips and pickers. */
import type { CSSProperties } from 'react';
import { RESOURCES, type Resource } from '../board';
import { COMMODITIES, type Commodity, type Goods } from '../wardens';
import { handSize, type Hand } from '../engine';
import { TERRAIN_COLOR } from './Island';

export const RES_NAME: Record<Resource, string> = { timber: 'Timber', clay: 'Clay', wool: 'Wool', grain: 'Grain', stone: 'Stone' };
export const RES_COLOR: Record<Resource, string> = {
  timber: TERRAIN_COLOR.forest,
  clay: TERRAIN_COLOR.hills,
  wool: TERRAIN_COLOR.pasture,
  grain: TERRAIN_COLOR.fields,
  stone: TERRAIN_COLOR.mountains,
};
export const GOOD_NAME: Record<Commodity, string> = { parchment: 'Parchment', linen: 'Linen', silver: 'Silver' };
export const GOOD_COLOR: Record<Commodity, string> = { parchment: '#c9a66b', linen: '#7fa7c9', silver: '#9aa3b5' };

/** A row of small card chips: "2 timber, 1 linen". */
export function Cards({ cards, goods, size = 'sm' }: { cards: Partial<Hand>; goods?: Partial<Goods>; size?: 'sm' | 'md' }) {
  return (
    <span className={`hx-cards is-${size}`}>
      {RESOURCES.filter((r) => (cards[r] ?? 0) > 0).map((r) => (
        <span key={r} className="hx-chip" style={{ '--rc': RES_COLOR[r] } as CSSProperties} title={RES_NAME[r]}>
          {cards[r]} <span className="hx-chip-name">{RES_NAME[r]}</span>
        </span>
      ))}
      {COMMODITIES.filter((c) => (goods?.[c] ?? 0) > 0).map((c) => (
        <span key={c} className="hx-chip is-good" style={{ '--rc': GOOD_COLOR[c] } as CSSProperties} title={GOOD_NAME[c]}>
          {goods![c]} <span className="hx-chip-name">{GOOD_NAME[c]}</span>
        </span>
      ))}
    </span>
  );
}

/** "2 timber, 1 linen". */
export const cardsText = (c?: Partial<Hand>, g?: Partial<Goods>) =>
  [...RESOURCES.filter((r) => (c?.[r] ?? 0) > 0).map((r) => `${c![r]} ${RES_NAME[r].toLowerCase()}`), ...COMMODITIES.filter((x) => (g?.[x] ?? 0) > 0).map((x) => `${g![x]} ${GOOD_NAME[x].toLowerCase()}`)].join(', ');

/** Pick cards by resource with + and - (discards, offers, Bounty, Market). */
export function Picker({ value, onChange, max, limit }: { value: Hand; onChange: (h: Hand) => void; max?: Partial<Hand>; limit?: number }) {
  const total = handSize(value);
  return (
    <div className="hx-picker">
      {RESOURCES.map((r) => (
        <div key={r} className="hx-pick-row" style={{ '--rc': RES_COLOR[r] } as CSSProperties}>
          <span className="hx-pick-name">{RES_NAME[r]}</span>
          <button type="button" aria-label={`One less ${RES_NAME[r]}`} disabled={value[r] === 0} onClick={() => onChange({ ...value, [r]: value[r] - 1 })}>
            &minus;
          </button>
          <b>{value[r]}</b>
          <button
            type="button"
            aria-label={`One more ${RES_NAME[r]}`}
            disabled={(max && value[r] >= (max[r] ?? 0)) || (limit !== undefined && total >= limit)}
            onClick={() => onChange({ ...value, [r]: value[r] + 1 })}
          >
            +
          </button>
        </div>
      ))}
    </div>
  );
}

/** Pick commodities with + and - (discards, offers). */
export function GoodsPicker({ value, onChange, max, room }: { value: Goods; onChange: (g: Goods) => void; max?: Goods; room: boolean }) {
  return (
    <div className="hx-picker">
      {COMMODITIES.map((c) => (
        <div key={c} className="hx-pick-row" style={{ '--rc': GOOD_COLOR[c] } as CSSProperties}>
          <span className="hx-pick-name">{GOOD_NAME[c]}</span>
          <button type="button" aria-label={`One less ${GOOD_NAME[c]}`} disabled={value[c] === 0} onClick={() => onChange({ ...value, [c]: value[c] - 1 })}>
            &minus;
          </button>
          <b>{value[c]}</b>
          <button type="button" aria-label={`One more ${GOOD_NAME[c]}`} disabled={(max && value[c] >= max[c]) || !room} onClick={() => onChange({ ...value, [c]: value[c] + 1 })}>
            +
          </button>
        </div>
      ))}
    </div>
  );
}
