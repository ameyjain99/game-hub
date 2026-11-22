// Catan cues: dice rattling in a cup, a soft chime for cards coming in, a
// hammer knock for building, a low drum for the robber, a pickpocket's swish,
// two notes for a trade, a fanfare for an award, and the result.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { CatanState } from '../engine';

export type CatanCue = 'dice' | 'gain' | 'build' | 'robber' | 'steal' | 'trade' | 'award' | 'win' | 'lose' | 'turn';

export function catanCues(prev: CatanState, next: CatanState, meId: string, actor: (s: CatanState) => string | null): CatanCue[] {
  const cues = new Set<CatanCue>();
  for (const e of next.log.filter((x) => x.seq > prev.seq)) {
    if (e.kind === 'roll') cues.add('dice');
    else if (e.kind === 'produce' && e.player === meId) cues.add('gain');
    else if (e.kind === 'build' || e.kind === 'buy') cues.add('build');
    else if (e.kind === 'robber') cues.add('robber');
    else if (e.kind === 'steal' || e.kind === 'unroad' || (e.kind === 'knight' && (e.text === 'displace' || e.text === 'desert'))) cues.add('steal');
    else if (e.kind === 'trade' || e.kind === 'bank' || e.kind === 'harbor') cues.add('trade');
    else if (e.kind === 'swap') cues.add('build');
    else if (e.kind === 'award') cues.add('award');
  }
  if (next.over && !prev.over) cues.add(next.winner === meId ? 'win' : 'lose');
  else if (actor(next) === meId && actor(prev) !== meId) cues.add('turn');
  return [...cues];
}

export const CATAN_SOUNDS: Record<CatanCue, () => void> = {
  dice: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 6; i++) noise(ac, t + i * 0.05 + Math.random() * 0.02, { dur: 0.03, peak: 0.07, band: 2600 + i * 200, q: 3 });
    }),
  gain: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 880, peak: 0.05, decay: 0.25 });
      tone(ac, t + 0.07, { freq: 1318.5, peak: 0.04, decay: 0.3 });
    }),
  build: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 2; i++) {
        noise(ac, t + i * 0.12, { dur: 0.04, peak: 0.09, band: 900, q: 1.5 });
        tone(ac, t + i * 0.12, { freq: 220, to: 160, glide: 0.04, type: 'triangle', peak: 0.08, decay: 0.08 });
      }
    }),
  robber: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 110, to: 70, glide: 0.3, type: 'triangle', peak: 0.16, decay: 0.45 });
    }),
  steal: () => withAudio((ac, t) => noise(ac, t, { dur: 0.25, peak: 0.05, band: 4200, q: 0.8 })),
  trade: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 587.3, peak: 0.06, decay: 0.2 });
      tone(ac, t + 0.1, { freq: 784, peak: 0.06, decay: 0.3 });
    }),
  award: () =>
    withAudio((ac, t) => {
      [523.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.09, { freq, peak: 0.08, decay: 0.4 }));
    }),
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
