// Cluedo cues: dice rattling, soft footsteps down a corridor, a door creaking
// open onto a room, a low sting for a suggestion, a card slid across the
// table, a hush when nobody can show one, a drum roll for an accusation, and
// the verdict.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { ClState } from '../engine';

export type ClCue = 'dice' | 'step' | 'door' | 'suggest' | 'show' | 'hush' | 'accuse' | 'wrong' | 'win' | 'lose' | 'turn';

export function clCues(prev: ClState, next: ClState, meId: string, actor: (s: ClState) => string | null): ClCue[] {
  const cues = new Set<ClCue>();
  if (next.phase === 'disprove' && prev.phase !== 'disprove') cues.add('suggest');
  for (const e of next.log.filter((x) => x.seq > prev.seq)) {
    if (e.kind === 'roll') cues.add('dice');
    else if (e.kind === 'move') cues.add(e.to ? 'door' : 'step');
    else if (e.kind === 'suggest') cues.add(e.s.disprover ? 'show' : 'hush');
    else if (e.kind === 'accuse') cues.add(e.correct ? 'accuse' : 'wrong');
  }
  if (next.over && !prev.over) cues.add(next.winner === meId ? 'win' : 'lose');
  else if (actor(next) === meId && actor(prev) !== meId) cues.add('turn');
  return [...cues];
}

export const CL_SOUNDS: Record<ClCue, () => void> = {
  dice: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 6; i++) noise(ac, t + i * 0.05 + Math.random() * 0.02, { dur: 0.03, peak: 0.07, band: 2600 + i * 200, q: 3 });
    }),
  step: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 3; i++) noise(ac, t + i * 0.16, { dur: 0.05, peak: 0.05, band: 500, q: 1.2 });
    }),
  door: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 180, to: 260, glide: 0.35, type: 'sawtooth', peak: 0.02, decay: 0.4 });
      noise(ac, t + 0.3, { dur: 0.06, peak: 0.06, band: 700, q: 1 });
    }),
  suggest: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 146.8, type: 'triangle', peak: 0.1, decay: 0.5 });
      tone(ac, t + 0.12, { freq: 155.6, type: 'triangle', peak: 0.08, decay: 0.6 });
    }),
  show: () => withAudio((ac, t) => noise(ac, t, { dur: 0.12, peak: 0.06, band: 3400, q: 0.8 })),
  hush: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.5, peak: 0.03, band: 900, q: 0.5 });
      tone(ac, t + 0.1, { freq: 440, to: 392, glide: 0.4, type: 'sine', peak: 0.05, decay: 0.5 });
    }),
  accuse: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 12; i++) noise(ac, t + i * 0.045, { dur: 0.035, peak: 0.03 + i * 0.005, band: 800, q: 0.8 });
    }),
  wrong: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 311.1, type: 'triangle', peak: 0.09, decay: 0.3 });
      tone(ac, t + 0.2, { freq: 233.1, type: 'triangle', peak: 0.09, decay: 0.6 });
    }),
  win: () =>
    withAudio((ac, t) => {
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((freq, i) => tone(ac, t + 0.5 + i * 0.1, { freq, peak: 0.1, attack: 0.02, decay: 0.6 }));
    }),
  lose: () =>
    withAudio((ac, t) => {
      tone(ac, t + 0.5, { freq: 392, type: 'triangle', peak: 0.08, decay: 0.25 });
      tone(ac, t + 0.66, { freq: 293.7, type: 'triangle', peak: 0.07, decay: 0.45 });
    }),
  turn: playTurn,
};
