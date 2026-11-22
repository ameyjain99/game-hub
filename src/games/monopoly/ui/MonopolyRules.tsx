import { DEFAULT_SETTINGS, SETTING_CHOICES, type Settings } from '../engine/state';
import { formatMoney } from '../engine/board';
import { BOARDS, boardOf, isMega, type BoardId } from '../engine/board';
import { MEGA } from '../engine/mega';

/** House rules, in display order. Defaults follow the official rulebook. */
export const HOUSE_RULES: { key: keyof Settings; label: string; desc: string }[] = [
  { key: 'auctions', label: 'Auctions', desc: 'A declined property goes to the highest bidder' },
  { key: 'doubleRentFullSet', label: 'Double rent on a full set', desc: 'Unbuilt lots in a complete colour set' },
  { key: 'mortgaging', label: 'Mortgaging', desc: "Raise half a lot's price from the bank" },
  { key: 'evenBuild', label: 'Even building', desc: 'Houses go up evenly across a set' },
  { key: 'freeParkingJackpot', label: 'Free Parking jackpot', desc: 'Taxes collect there for whoever lands' },
  { key: 'doubleGoSalary', label: 'Double salary on Go', desc: 'Twice the salary for landing exactly on Go' },
  { key: 'noRentInJail', label: 'No rent from jail', desc: "Jailed owners can't collect" },
  { key: 'firstLapBuy', label: 'Buy only after a first lap', desc: 'No buying or auction until you have passed Go once' },
  { key: 'incomeTaxTenPercent', label: 'Income Tax: 10% if lower', desc: 'Pay 10% of your net worth when that is less than the printed tax' },
];

type NumberKey = keyof typeof SETTING_CHOICES;
/** Settings with a few amounts to choose from. `money` ones are shown in the board's currency. */
const NUMBER_RULES: { key: NumberKey; label: string; money?: boolean; text: (n: number, money: (n: number) => string) => string }[] = [
  { key: 'goSalary', label: 'Salary for passing Go', money: true, text: (n, money) => money(n) },
  { key: 'jailFine', label: 'Fine to leave Jail', money: true, text: (n, money) => money(n) },
  { key: 'jailTurns', label: 'Rolls for doubles in Jail', text: (n) => (n === 1 ? '1 turn, then you pay' : `${n} turns, then you pay`) },
  { key: 'freeParkingPrize', label: 'Free Parking prize', money: true, text: (n, money) => (n === 0 ? 'None' : `${money(n)} from the bank`) },
  { key: 'dealtProperties', label: 'Properties dealt at the start', text: (n) => (n === 0 ? 'None' : `${n} each, paid for (short game)`) },
  { key: 'turnSeconds', label: 'Turn clock (online)', text: (n) => `${n} seconds` },
];

/** A line for each amount that differs from the standard rules, for the lobby's summary. */
function numberRuleSummary(settings: Settings): string[] {
  const money = (n: number) => formatMoney(n, settings.board);
  return NUMBER_RULES.filter((r) => settings[r.key] !== DEFAULT_SETTINGS[r.key]).map((r) => `${r.label}: ${r.text(settings[r.key], money)}`);
}

/**
 * A game's settings, a line each: the board, the cash, when it ends, the house rules and any amount that differs from the standard rules.
 * The lobby lists only the house rules that are on; `everyRule` lists them all as on or off, for a game under way.
 */
export function settingsSummary(settings: Settings, everyRule = false): string[] {
  const board = boardOf(settings.board);
  return [
    `Board: ${BOARDS.find((b) => b.id === board)!.name}`,
    `Starting cash${everyRule ? ':' : ''} ${formatMoney(settings.startingCash, board)}`,
    `${everyRule ? 'Game ends: ' : ''}${settings.roundLimit > 0 ? `${everyRule ? 'After ' : ''}${settings.roundLimit} rounds` : `${everyRule ? 'When' : 'Until'} one player is left`}`,
    ...(everyRule ? HOUSE_RULES.map((r) => `${r.label}: ${settings[r.key] ? 'On' : 'Off'}`) : HOUSE_RULES.filter((r) => settings[r.key]).map((r) => r.label)),
    ...numberRuleSummary(settings),
  ];
}

const STARTING_CASH = [500, 1000, 1500, 2000, 2500, 3000];

/** What the rules give each player at the start on this board. */
const standardCash = (board: BoardId): number => (isMega(board) ? MEGA.startingCash : DEFAULT_SETTINGS.startingCash);

/** Starting cash after a change of board: the new board's standard amount, unless the host had picked their own. */
export const cashForBoard = (cash: number, from: BoardId, to: BoardId): number => (cash === standardCash(from) ? standardCash(to) : cash);

/** The starting-cash picker, as a `.g-field`. */
export function StartingCashField({ value, onChange, board = 'neo' }: { value: number; onChange: (cash: number) => void; board?: BoardId }) {
  return (
    <label className="g-field">
      <span className="g-field-label">Starting cash</span>
      <select aria-label="Starting cash" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {STARTING_CASH.map((c) => (
          <option key={c} value={c}>
            {formatMoney(c, board)}
            {c === standardCash(board) ? ' (standard)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The board the game is played on. */
export function BoardField({ value, onChange }: { value: BoardId; onChange: (board: BoardId) => void }) {
  return (
    <label className="g-field">
      <span className="g-field-label">Board</span>
      <select aria-label="Board" value={value} onChange={(e) => onChange(e.target.value as BoardId)}>
        {BOARDS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const ROUND_LIMITS = [0, 15, 25, 40];

/** How long the game runs: until one player is left, or a set number of rounds. */
export function RoundLimitField({ value, onChange }: { value: number; onChange: (rounds: number) => void }) {
  return (
    <label className="g-field">
      <span className="g-field-label">Game length</span>
      <select aria-label="Game length" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {ROUND_LIMITS.map((n) => (
          <option key={n} value={n}>
            {n === 0 ? 'Until one player is left (classic)' : `${n} rounds, then the highest net worth wins`}
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
      {NUMBER_RULES.map((r) => (
        <label key={r.key} className="g-field">
          <span className="g-field-label">{r.label}</span>
          <select aria-label={r.label} value={value[r.key]} onChange={(e) => onChange({ ...value, [r.key]: Number(e.target.value) })}>
            {SETTING_CHOICES[r.key].map((n) => (
              <option key={n} value={n}>
                {r.text(n, (amount) => formatMoney(amount, value.board))}
                {n === DEFAULT_SETTINGS[r.key] ? ' (standard)' : ''}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
