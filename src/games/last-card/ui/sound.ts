// Last Card cues: a card slapped down, a card drawn, a buzz for a skip, a swoosh
// for a reverse, a thud for a penalty, a shimmer for a wild, a big whoosh when
// the table flips, a bell for "Last card", an alarm for a catch.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import { faceOf, type LcState } from '../engine';

export type LcCue = 'play' | 'draw' | 'skip' | 'reverse' | 'penalty' | 'wild' | 'flip' | 'call' | 'catch' | 'win' | 'lose' | 'turn';

export function lcCues(prev: LcState, next: LcState, meId: string): LcCue[] {
  if (next.game !== prev.game) return [];
  const fresh = next.history.filter((e) => e.seq > (prev.last?.seq ?? 0)).reverse();
  const cues: LcCue[] = [];
  for (const e of fresh) {
    if (e.kind === 'play' && e.card) {
      const f = faceOf(e.card, next.side === prev.side ? next.side : prev.side);
      cues.push('play');
      if (f?.kind === 'skip' || f?.kind === 'skip-all') cues.push('skip');
      else if (f?.kind === 'reverse') cues.push('reverse');
      else if (f?.kind === 'flip') cues.push('flip');
      else if (f && f.color === null) cues.push('wild');
    } else if (e.kind === 'draw') cues.push('draw');
    else if (e.kind === 'penalty') cues.push('penalty');
    else if (e.kind === 'call') cues.push('call');
    else if (e.kind === 'catch') cues.push('catch');
  }
  if (next.over && !prev.over) cues.push(next.winner === meId ? 'win' : 'lose');
  else if (!next.over && next.players[next.turn]?.id === meId && prev.players[prev.turn]?.id !== meId) cues.push('turn');
  return cues;
}

const slap = (ac: AudioContext, t: number) => {
  noise(ac, t, { dur: 0.07, peak: 0.08, band: 3000, q: 0.8 });
  tone(ac, t, { freq: 260, to: 160, glide: 0.05, type: 'triangle', peak: 0.06, decay: 0.08 });
};

export const LC_SOUNDS: Record<LcCue, () => void> = {
  play: () => withAudio((ac, t) => slap(ac, t)),
  draw: () => withAudio((ac, t) => noise(ac, t, { dur: 0.12, peak: 0.05, band: 4200, q: 0.7 })),
  skip: () => withAudio((ac, t) => tone(ac, t, { freq: 220, type: 'square', peak: 0.04, decay: 0.18 })),
  reverse: () => withAudio((ac, t) => tone(ac, t, { freq: 300, to: 700, glide: 0.18, peak: 0.07, decay: 0.24 })),
  penalty: () => withAudio((ac, t) => tone(ac, t, { freq: 160, to: 80, glide: 0.2, type: 'triangle', peak: 0.12, decay: 0.3 })),
  wild: () =>
    withAudio((ac, t) => {
      [784, 988, 1175, 1568].forEach((freq, i) => tone(ac, t + i * 0.05, { freq, peak: 0.05, decay: 0.3 }));
    }),
  flip: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.4, peak: 0.06, band: 1800, q: 0.5 });
      tone(ac, t, { freq: 180, to: 900, glide: 0.35, type: 'sawtooth', peak: 0.03, decay: 0.45 });
    }),
  call: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 1046.5, peak: 0.09, decay: 0.25 });
      tone(ac, t + 0.12, { freq: 1318.5, peak: 0.09, decay: 0.35 });
    }),
  catch: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 3; i++) tone(ac, t + i * 0.12, { freq: 880, to: 660, glide: 0.1, type: 'square', peak: 0.04, decay: 0.1 });
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
