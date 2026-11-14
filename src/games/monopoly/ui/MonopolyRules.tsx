import type { Settings } from '../engine/state';

/** House rules, in display order. Defaults follow the official rulebook. */
export const HOUSE_RULES: { key: keyof Settings; label: string; desc: string }[] = [
  { key: 'auctions', label: 'Auctions', desc: 'A declined property goes to the highest bidder' },
  { key: 'doubleRentFullSet', label: 'Double rent on a full set', desc: 'Unbuilt lots in a complete colour set' },
  { key: 'mortgaging', label: 'Mortgaging', desc: "Raise half a lot's price from the bank" },
  { key: 'evenBuild', label: 'Even building', desc: 'Houses go up evenly across a set' },
  { key: 'freeParkingJackpot', label: 'Free Parking jackpot', desc: 'Taxes collect there for whoever lands' },
  { key: 'doubleGoSalary', label: 'Double salary on Go', desc: '$400 for landing exactly on Go' },
  { key: 'noRentInJail', label: 'No rent from jail', desc: "Jailed owners can't collect" },
];

const STARTING_CASH = [500, 1000, 1500, 2000, 2500, 3000];

/** The starting-cash picker, as a `.g-field`. */
export function StartingCashField({ value, onChange }: { value: number; onChange: (cash: number) => void }) {
  return (
    <label className="g-field">
      <span className="g-field-label">Starting cash</span>
      <select aria-label="Starting cash" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {STARTING_CASH.map((c) => (
          <option key={c} value={c}>
            ${c.toLocaleString()}
            {c === 1500 ? ' (standard)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The house-rule switches. */
export function HouseRuleSwitches({ value, onChange }: { value: Settings; onChange: (rules: Settings) => void }) {
  return (
    <div className="g-switches">
      {HOUSE_RULES.map((r) => (
        <label key={r.key} className="g-switch-row">
          <span className="g-switch-text">
            <span>{r.label}</span>
            <span className="g-switch-desc">{r.desc}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="g-switch"
            checked={value[r.key] as boolean}
            onChange={() => onChange({ ...value, [r.key]: !value[r.key] })}
          />
        </label>
      ))}
    </div>
  );
}
