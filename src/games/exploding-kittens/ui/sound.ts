// Exploding Kittens cues: a card slapped down, a card drawn, a flat buzz for a
// Nope, a boom for a Kitten going off, a rising chirp for a Defuse, a riffle
// for a Shuffle, a growl for an Attack, a shimmer for See the Future.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { EkState } from '../engine';

export type EkCue = 'play' | 'draw' | 'nope' | 'boom' | 'defuse' | 'shuffle' | 'attack' | 'future' | 'take' | 'win' | 'lose' | 'turn';

export function ekCues(prev: EkState, next: EkState, meId: string): EkCue[] {
  if (next.game !== prev.game) return [];
  const cues: EkCue[] = [];
  for (const e of next.history.filter((x) => x.seq > (prev.last?.seq ?? 0))) {
    if (e.kind === 'play') cues.push('play');
    else if (e.kind === 'draw') cues.push('draw');
    else if (e.kind === 'nope') cues.push('nope');
    else if (e.kind === 'explode') cues.push('boom');
    else if (e.kind === 'defuse') cues.push('defuse');
    else if (e.kind === 'shuffle') cues.push('shuffle');
    else if (e.kind === 'attack') cues.push('attack');
    else if (e.kind === 'future') cues.push('future');
    else if (e.kind === 'give' || e.kind === 'steal' || e.kind === 'take' || (e.kind === 'named' && e.got)) cues.push('take');
  }
  if (next.over && !prev.over) cues.push(next.winner === meId ? 'win' : 'lose');
  else if (!next.over && !next.pending && next.players[next.turn].id === meId && (prev.players[prev.turn].id !== meId || !!prev.pending)) cues.push('turn');
  return cues;
}

export const EK_SOUNDS: Record<EkCue, () => void> = {
  play: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.07, peak: 0.08, band: 3000, q: 0.8 });
      tone(ac, t, { freq: 240, to: 150, glide: 0.05, type: 'triangle', peak: 0.06, decay: 0.08 });
    }),
  draw: () => withAudio((ac, t) => noise(ac, t, { dur: 0.12, peak: 0.05, band: 4200, q: 0.7 })),
  nope: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 196, type: 'square', peak: 0.07, decay: 0.16 });
      tone(ac, t + 0.14, { freq: 147, type: 'square', peak: 0.07, decay: 0.3 });
    }),
  boom: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.7, peak: 0.22, band: 260, q: 0.4 });
      tone(ac, t, { freq: 140, to: 36, glide: 0.5, type: 'sawtooth', peak: 0.14, decay: 0.7 });
    }),
  defuse: () =>
    withAudio((ac, t) => {
      [523.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.08, { freq, peak: 0.08, decay: 0.25 }));
    }),
  shuffle: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 6; i++) noise(ac, t + i * 0.05, { dur: 0.04, peak: 0.05, band: 3600, q: 0.9 });
    }),
  attack: () => withAudio((ac, t) => tone(ac, t, { freq: 110, to: 70, glide: 0.25, type: 'sawtooth', peak: 0.08, decay: 0.35 })),
  future: () =>
    withAudio((ac, t) => {
      [988, 1175, 1568].forEach((freq, i) => tone(ac, t + i * 0.06, { freq, peak: 0.04, decay: 0.3 }));
    }),
  take: () => withAudio((ac, t) => tone(ac, t, { freq: 420, to: 760, glide: 0.14, peak: 0.05, decay: 0.2 })),
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
