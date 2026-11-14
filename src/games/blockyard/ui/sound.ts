// Blockyard cues: a crunch when a block breaks, a soft thud when one is placed,
// and quiet footsteps while walking.
import { noise, tone, withAudio } from '../../../shared/sound';

export function playBreak(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.12, peak: 0.09, band: 900, q: 0.7 });
      noise(ac, t + 0.03, { dur: 0.08, peak: 0.05, band: 2400, q: 1 });
    },
    { queue: false },
  );
}

export function playPlace(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.05, peak: 0.07, band: 500, q: 0.9 });
      tone(ac, t, { freq: 180, to: 110, glide: 0.06, type: 'triangle', peak: 0.1, decay: 0.09 });
    },
    { queue: false },
  );
}

export function playFootstep(): void {
  withAudio((ac, t) => noise(ac, t, { dur: 0.05, peak: 0.025, band: 700, q: 0.8 }), { queue: false });
}
