// Minesweeper cues: a soft click per square, an airy sweep when an area opens,
// a pop for a flag (and a lower one taking it off), a boom, and the win.
import { noise, tone, withAudio } from '../../../shared/sound';

export function playOpen(count: number): void {
  withAudio((ac, t) => tone(ac, t, { freq: 520 + count * 60, to: 420, glide: 0.05, type: 'triangle', peak: 0.06, decay: 0.07 }), { queue: false });
}

export function playSpread(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.25, peak: 0.04, band: 3200, q: 0.6 });
      [660, 880, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.04, { freq, peak: 0.03, decay: 0.2 }));
    },
    { queue: false },
  );
}

export function playFlag(on: boolean): void {
  withAudio((ac, t) => tone(ac, t, { freq: on ? 700 : 480, to: on ? 980 : 360, glide: 0.06, peak: 0.07, decay: 0.1 }), { queue: false });
}

export function playBoom(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.6, peak: 0.16, band: 260, q: 0.5 });
      tone(ac, t, { freq: 120, to: 40, glide: 0.5, type: 'triangle', peak: 0.18, decay: 0.6 });
    },
    { queue: false },
  );
}

export function playWin(): void {
  withAudio((ac, t) => {
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((freq, i) => tone(ac, t + i * 0.09, { freq, peak: 0.09, attack: 0.02, decay: 0.55 }));
  });
}
