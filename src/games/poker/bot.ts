/**
 * Poker bots. A bot sees only what its seat may see (its own view, redacted),
 * estimates how often its hand wins by dealing out the unseen cards many times
 * (Monte Carlo), and weighs that against the price of calling.
 *
 * Easy calls too much and seldom raises; Normal plays its odds; Hard sizes its
 * bets to the pot, bluffs now and then, and pushes all-in when short-stacked.
 */
import { deckFor, type Card } from './cards';
import { VARIANTS, handValue, optionsFor, redactPoker, stakes, type PokerAction, type PokerPlayer, type PokerState } from './engine';

type Level = 'easy' | 'normal' | 'hard';

const DEALS: Record<Level, number> = { easy: 60, normal: 150, hard: 280 };
const RAISE_AT: Record<Level, number> = { easy: 1.7, normal: 1.35, hard: 1.25 };
const BLUFF: Record<Level, number> = { easy: 0.02, normal: 0.05, hard: 0.09 };
/** How far below the price a bot still calls (Easy calls loosely). */
const CALL_SLACK: Record<Level, number> = { easy: 0.1, normal: 0.0, hard: -0.02 };

/** How often `me` ends with the best hand (a share of ties counts) against everyone still in. */
export function winChance(s: PokerState, me: PokerPlayer, deals: number, rand: () => number): number {
  const spec = VARIANTS[s.variant];
  const rivals = s.players.filter((p) => p !== me && !p.out && !p.folded);
  if (rivals.length === 0) return 1;
  const seen = new Set<Card>([...s.board, ...s.players.flatMap((p) => p.hole.filter((c): c is Card => c !== null))]);
  const pool = deckFor(s.variant).filter((c) => !seen.has(c));
  const mine = me.hole as Card[];
  let share = 0;
  for (let d = 0; d < deals; d++) {
    const deck = pool.slice();
    let left = deck.length;
    const draw = () => {
      if (left === 0) return null;
      const j = Math.floor(rand() * left);
      const c = deck[j];
      deck[j] = deck[left - 1];
      left -= 1;
      return c;
    };
    const fill = (have: Card[], to: number) => {
      const out = have.slice();
      while (out.length < to) {
        const c = draw();
        if (!c) break;
        out.push(c);
      }
      return out;
    };
    let board = s.board;
    let my: Card[];
    let theirs: Card[][];
    if (spec.stud) {
      const full = 7 - s.board.length;
      my = fill(mine, full);
      theirs = rivals.map((p) => fill(p.hole.filter((c): c is Card => c !== null), full));
    } else {
      my = mine;
      theirs = rivals.map(() => fill([], spec.hole));
      board = fill(s.board, 5);
    }
    const mineScore = handValue(s.variant, my, board)?.score ?? 0;
    let best = mineScore;
    let ties = 1;
    for (const hole of theirs) {
      const v = handValue(s.variant, hole, board)?.score ?? 0;
      if (v > best) {
        best = v;
        ties = 0;
      } else if (v === best && best === mineScore) ties += 1;
    }
    if (best === mineScore && ties > 0) share += 1 / ties;
  }
  return share / deals;
}

export function pokerBot(full: PokerState, rand: () => number): PokerAction {
  const seat = full.toAct!;
  const id = full.players[seat].id;
  const s = redactPoker(full, id);
  const me = s.players[seat];
  const o = optionsFor(s)!;
  const level = (['easy', 'normal', 'hard'].includes(me.difficulty ?? '') ? me.difficulty : 'normal') as Level;
  const spec = VARIANTS[s.variant];
  const rivals = s.players.filter((p) => p !== me && !p.out && !p.folded).length;
  // Omaha's showdowns cost more to score, so it deals fewer trials.
  const deals = Math.max(30, Math.round(DEALS[level] * (s.variant === 'omaha' ? 0.35 : 1)));
  const chance = winChance(s, me, deals, rand);
  /** Strength against a fair share of the pot: above 1 is better than average. */
  const strength = chance * (rivals + 1);
  const pot = s.pot + s.players.reduce((t, p) => t + p.bet, 0);
  const st = stakes(s);
  const r = rand();

  const raiseTo = (fraction: number): PokerAction => {
    if (spec.structure === 'fixed-limit') return { type: 'RAISE', to: o.minTo };
    // Round amounts (multiples of 5), as a player would bet.
    const target = Math.round((s.currentBet + fraction * (pot + o.toCall)) / 5) * 5;
    return { type: 'RAISE', to: Math.min(o.maxTo, Math.max(o.minTo, target)) };
  };

  // Stud's bring-in: complete with a strong start, otherwise post the minimum.
  if (o.bringIn !== null) return o.canRaise && strength > RAISE_AT[level] ? { type: 'RAISE', to: o.minTo } : { type: 'BRING_IN' };

  // Short-stacked in a big-bet game: all-in or fold, judged by strength.
  const short = !spec.stud && me.stack + me.bet <= 10 * st.bb;
  if (short && level !== 'easy' && spec.structure === 'no-limit') {
    if (strength > 1.1 && o.canRaise) return { type: 'RAISE', to: o.maxTo };
    if (o.canCheck) return { type: 'CHECK' };
    return strength > 1.0 || chance > o.toCall / (pot + o.toCall) ? { type: 'CALL' } : { type: 'FOLD' };
  }

  // Acting last this round: nobody after this seat still has to act.
  const last = !s.players.some((p, k) => k !== seat && !p.out && !p.folded && !p.allIn && !p.acted);

  if (o.canCheck) {
    if (o.canRaise && strength > RAISE_AT[level]) return raiseTo(strength > 2 ? 0.75 : 0.55);
    // Hard also bets thinner for value, and bluffs more when it acts last.
    if (level === 'hard' && o.canRaise && strength > 1.12 && r < 0.6) return raiseTo(0.5);
    if (o.canRaise && r < BLUFF[level] * (level === 'hard' && last ? 2 : 1)) return raiseTo(0.5);
    return { type: 'CHECK' };
  }

  const price = o.toCall / (pot + o.toCall);
  // A bettor holds better than random cards: Hard discounts its chance by the bet's size.
  const read = level === 'hard' ? chance * (1 - 0.3 * Math.min(1, o.toCall / Math.max(1, pot))) : chance;
  if (o.canRaise && strength > RAISE_AT[level] + 0.35 && read > price + 0.12) return raiseTo(strength > 2.2 ? 0.9 : 0.65);
  if (read + CALL_SLACK[level] >= price) return { type: 'CALL' };
  if (level === 'easy' && r < 0.12) return { type: 'CALL' };
  return { type: 'FOLD' };
}
