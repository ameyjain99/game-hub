// Sudoku cues: a soft tap per number, a pencil tick per note, a low thud for a
// mistake, a bright run when a row, column or box completes, and the win.
import { tone, withAudio } from '../../../shared/sound';

export const playTap = () => withAudio((ac, t) => tone(ac, t, { freq: 660, to: 560, glide: 0.04, type: 'triangle', peak: 0.06, decay: 0.08 }), { queue: false });
export const playNote = () => withAudio((ac, t) => tone(ac, t, { freq: 1200, type: 'triangle', peak: 0.025, decay: 0.04 }), { queue: false });
export const playMistake = () =>
  withAudio((ac, t) => {
    tone(ac, t, { freq: 200, to: 140, glide: 0.12, type: 'triangle', peak: 0.1, decay: 0.2 });
  }, { queue: false });
export const playGroup = (n: number) =>
  withAudio((ac, t) => {
    const notes = [659.3, 784, 987.8, 1174.7].slice(0, 2 + n);
    notes.forEach((freq, i) => tone(ac, t + i * 0.06, { freq, peak: 0.07, decay: 0.3 }));
  });
export const playWin = () =>
  withAudio((ac, t) => {
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((freq, i) => tone(ac, t + i * 0.1, { freq, peak: 0.09, attack: 0.02, decay: 0.6 }));
  });
export const playLose = () =>
  withAudio((ac, t) => {
    tone(ac, t, { freq: 392, type: 'triangle', peak: 0.08, decay: 0.25 });
    tone(ac, t + 0.16, { freq: 293.7, type: 'triangle', peak: 0.07, decay: 0.45 });
  });
