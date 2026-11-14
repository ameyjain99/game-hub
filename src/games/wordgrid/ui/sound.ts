// Wordgrid cues: a wooden tap as a tile goes down or comes back, a chime for a
// word (a longer run for a bigger score), a fanfare for all seven tiles, a buzz
// for a word that won't go, a rattle for a swap.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { WgState } from '../engine';

export function playTap(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.03, peak: 0.05, band: 2200, q: 1.3 });
      tone(ac, t, { freq: 420, to: 300, glide: 0.04, type: 'triangle', peak: 0.06, decay: 0.06 });
    },
    { queue: false },
  );
}

export function playNope(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 180, to: 130, glide: 0.1, type: 'triangle', peak: 0.08, decay: 0.16 }), { queue: false });
}

export type WgCue = 'word' | 'bigWord' | 'bingo' | 'swap' | 'pass' | 'win' | 'lose' | 'turn';

export function wgCues(prev: WgState, next: WgState, meId: string): WgCue[] {
  const cues: WgCue[] = [];
  const m = next.last;
  if (m && m.seq !== prev.last?.seq && next.game === prev.game) {
    if (m.kind === 'play') cues.push(m.bingo ? 'bingo' : m.score >= 30 ? 'bigWord' : 'word');
    else if (m.kind === 'exchange') cues.push('swap');
    else cues.push('pass');
  }
  if (next.over && !prev.over) cues.push(next.winner === meId ? 'win' : 'lose');
  else if (!next.over && next.players[next.turn]?.id === meId && (prev.players[prev.turn]?.id !== meId || prev.game !== next.game)) cues.push('turn');
  return cues;
}

const run = (notes: number[], gap = 0.07) =>
  withAudio((ac, t) => notes.forEach((freq, i) => tone(ac, t + i * gap, { freq, peak: 0.08, attack: 0.01, decay: 0.4 })));

export const WG_SOUNDS: Record<WgCue, () => void> = {
  word: () => run([659.3, 880]),
  bigWord: () => run([659.3, 784, 988, 1318.5]),
  bingo: () => run([523.3, 659.3, 784, 1046.5, 1318.5, 1568], 0.08),
  swap: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 6; i++) noise(ac, t + i * 0.04, { dur: 0.04, peak: 0.04, band: 1600, q: 1 });
    }),
  pass: () => withAudio((ac, t) => tone(ac, t, { freq: 440, peak: 0.05, decay: 0.2 })),
  win: () => run([523.3, 659.3, 784, 1046.5, 1318.5], 0.1),
  lose: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 392, type: 'triangle', peak: 0.08, decay: 0.25 });
      tone(ac, t + 0.16, { freq: 293.7, type: 'triangle', peak: 0.07, decay: 0.45 });
    }),
  turn: playTurn,
};
