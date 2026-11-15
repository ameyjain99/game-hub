// Poker cues: a card flicked across the felt, chips clicking into a bet, two
// knuckle raps for a check, a soft swish for a fold, a rising rush for an
// all-in, cards turned over at a showdown, and a cascade of chips for a win.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { PokerState } from '../engine';

export type PkCue = 'deal' | 'chip' | 'check' | 'fold' | 'allin' | 'reveal' | 'win' | 'champion' | 'lose' | 'turn';

export function pkCues(prev: PokerState, next: PokerState, meId: string): PkCue[] {
  const cues = new Set<PkCue>();
  if (next.hand !== prev.hand) cues.add('deal');
  for (const e of next.log.filter((e) => e.seq > prev.seq)) {
    if (e.kind === 'street') cues.add('deal');
    else if (e.kind === 'check') cues.add('check');
    else if (e.kind === 'fold') cues.add('fold');
    else if (['call', 'bet', 'raise', 'complete', 'bring-in', 'post'].includes(e.kind)) cues.add(e.allIn ? 'allin' : 'chip');
    else if (e.kind === 'win') cues.add(e.player === meId ? 'win' : 'chip');
  }
  if (next.result?.showdown && !prev.result) cues.add('reveal');
  if (next.over && !prev.over) cues.add(next.winner === meId ? 'champion' : 'lose');
  const actor = (s: PokerState) => (s.phase === 'betting' && s.toAct !== null ? s.players[s.toAct].id : null);
  if (actor(next) === meId && actor(prev) !== meId) cues.add('turn');
  return [...cues];
}

const click = (ac: AudioContext, t: number, peak = 0.06) => {
  noise(ac, t, { dur: 0.025, peak, band: 5200, q: 2.5 });
  tone(ac, t, { freq: 2400 + Math.random() * 500, type: 'triangle', peak: peak * 0.5, decay: 0.04 });
};

export const PK_SOUNDS: Record<PkCue, () => void> = {
  deal: () => withAudio((ac, t) => noise(ac, t, { dur: 0.07, peak: 0.07, band: 3800, q: 0.9 })),
  chip: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 3; i++) click(ac, t + i * 0.045);
    }),
  check: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 2; i++) tone(ac, t + i * 0.11, { freq: 170, to: 110, glide: 0.05, type: 'triangle', peak: 0.12, decay: 0.07 });
    }),
  fold: () => withAudio((ac, t) => noise(ac, t, { dur: 0.22, peak: 0.04, band: 1300, q: 0.6 })),
  allin: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 220, to: 660, glide: 0.35, type: 'sawtooth', peak: 0.035, decay: 0.4 });
      for (let i = 0; i < 6; i++) click(ac, t + 0.1 + i * 0.04, 0.07);
    }),
  reveal: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 3; i++) noise(ac, t + i * 0.09, { dur: 0.06, peak: 0.06, band: 3200, q: 0.9 });
    }),
  win: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 10; i++) click(ac, t + i * 0.035, 0.07);
      [784, 988, 1175].forEach((freq, i) => tone(ac, t + 0.25 + i * 0.08, { freq, peak: 0.06, decay: 0.4 }));
    }),
  champion: () =>
    withAudio((ac, t) => {
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((freq, i) => tone(ac, t + i * 0.1, { freq, peak: 0.1, attack: 0.02, decay: 0.6 }));
    }),
  lose: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 392, type: 'triangle', peak: 0.08, decay: 0.25 });
      tone(ac, t + 0.16, { freq: 293.7, type: 'triangle', peak: 0.07, decay: 0.45 });
    }),
  turn: playTurn,
};
