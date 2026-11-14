// Solitaire cues: a papery flick to turn a card, a soft tap to lay one down, a
// rising tick as each foundation grows, a shuffle for a new deal, and the win.
import { noise, tone, withAudio } from '../../../shared/sound';

export function playFlip(): void {
  withAudio((ac, t) => noise(ac, t, { dur: 0.07, peak: 0.05, band: 4200, q: 0.8 }), { queue: false });
}

export function playPlace(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.03, peak: 0.05, band: 1800, q: 1.2 });
      tone(ac, t, { freq: 240, to: 170, glide: 0.04, type: 'triangle', peak: 0.06, decay: 0.07 });
    },
    { queue: false },
  );
}

/** A foundation card: the pitch climbs with its rank. */
export function playHome(rank: number): void {
  withAudio((ac, t) => tone(ac, t, { freq: 440 * 2 ** ((rank - 1) / 12), peak: 0.07, decay: 0.25 }), { queue: false });
}

export function playNope(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 160, to: 120, glide: 0.08, type: 'triangle', peak: 0.07, decay: 0.12 }), { queue: false });
}

export function playShuffle(): void {
  withAudio((ac, t) => {
    for (let i = 0; i < 7; i++) noise(ac, t + i * 0.045, { dur: 0.05, peak: 0.035, band: 3600, q: 0.7 });
  });
}

export function playWin(): void {
  withAudio((ac, t) => {
    [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((freq, i) => tone(ac, t + i * 0.09, { freq, peak: 0.09, attack: 0.02, decay: 0.6 }));
  });
}
