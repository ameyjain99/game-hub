// Monopoly Deal cues: a card dealt, a note banked, a deed laid, a till for rent,
// coins for a payment, a flat refusal for Just Say No, a swipe for a property
// taken, a fanfare for a whole set.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { MdState } from '../engine';

export type MdCue = 'draw' | 'bank' | 'lay' | 'action' | 'rent' | 'pay' | 'no' | 'take' | 'set' | 'build' | 'win' | 'lose' | 'turn';

export function mdCues(prev: MdState, next: MdState, meId: string): MdCue[] {
  if (next.game !== prev.game) return [];
  const cues: MdCue[] = [];
  for (const e of next.history.filter((x) => x.seq > (prev.last?.seq ?? 0))) {
    if (e.kind === 'draw') cues.push('draw');
    else if (e.kind === 'bank') cues.push('bank');
    else if (e.kind === 'property' || e.kind === 'move') cues.push('lay');
    else if (e.kind === 'action') cues.push('action');
    else if (e.kind === 'rent') cues.push('rent');
    else if (e.kind === 'pay') cues.push('pay');
    else if (e.kind === 'no') cues.push('no');
    else if (e.kind === 'steal' || e.kind === 'swap') cues.push('take');
    else if (e.kind === 'set') cues.push('set');
    else if (e.kind === 'build') cues.push('build');
  }
  const mine = (s: MdState) => !s.over && s.claims.length === 0 && s.players[s.turn].id === meId && s.phase === 'draw';
  if (next.over && !prev.over) cues.push(next.winner === meId ? 'win' : 'lose');
  else if (mine(next) && !mine(prev)) cues.push('turn');
  return cues;
}

const coin = (ac: AudioContext, t: number, freq = 1568) => tone(ac, t, { freq, peak: 0.05, decay: 0.18 });

export const MD_SOUNDS: Record<MdCue, () => void> = {
  draw: () => withAudio((ac, t) => noise(ac, t, { dur: 0.12, peak: 0.05, band: 4200, q: 0.7 })),
  bank: () => withAudio((ac, t) => coin(ac, t)),
  lay: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.07, peak: 0.08, band: 3000, q: 0.8 });
      tone(ac, t, { freq: 240, to: 150, glide: 0.05, type: 'triangle', peak: 0.06, decay: 0.08 });
    }),
  action: () => withAudio((ac, t) => tone(ac, t, { freq: 330, to: 520, glide: 0.12, type: 'triangle', peak: 0.07, decay: 0.2 })),
  rent: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 1318.5, peak: 0.07, decay: 0.12 });
      tone(ac, t + 0.09, { freq: 1760, peak: 0.07, decay: 0.3 });
    }),
  pay: () =>
    withAudio((ac, t) => {
      [1568, 1319, 1760].forEach((freq, i) => coin(ac, t + i * 0.07, freq));
    }),
  no: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 196, type: 'square', peak: 0.07, decay: 0.16 });
      tone(ac, t + 0.14, { freq: 147, type: 'square', peak: 0.07, decay: 0.3 });
    }),
  take: () => withAudio((ac, t) => tone(ac, t, { freq: 700, to: 360, glide: 0.16, peak: 0.06, decay: 0.22 })),
  set: () =>
    withAudio((ac, t) => {
      [392, 523.3, 659.3, 784].forEach((freq, i) => tone(ac, t + i * 0.08, { freq, type: 'triangle', peak: 0.09, decay: 0.35 }));
    }),
  build: () => withAudio((ac, t) => tone(ac, t, { freq: 180, to: 120, glide: 0.08, type: 'square', peak: 0.05, decay: 0.12 })),
  win: () =>
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
