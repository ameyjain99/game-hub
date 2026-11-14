// Snakes & Ladders cues: a dice rattle per roll, a soft tick per square walked,
// a rising run for a ladder, a hissing slide for a snake, and the finish.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { SnlState } from '../engine';

export type SnlCue = 'roll' | 'turn';

export function snlCues(prev: SnlState, next: SnlState, meId: string): SnlCue[] {
  const cues: SnlCue[] = [];
  if (next.last && next.last.seq !== prev.last?.seq && next.game === prev.game) cues.push('roll');
  const mine = !next.over && next.players[next.turn]?.id === meId;
  const wasMine = !prev.over && prev.players[prev.turn]?.id === meId && prev.game === next.game;
  if (mine && !wasMine) cues.push('turn');
  return cues;
}

export const SNL_SOUNDS: Record<SnlCue, () => void> = {
  roll: () =>
    withAudio((ac, t) => {
      [0, 0.06, 0.13, 0.21].forEach((dt, i) => noise(ac, t + dt, { dur: 0.03, peak: 0.07 - i * 0.012, band: 2600, q: 2 }));
    }),
  turn: playTurn,
};

export function playStep(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 900, to: 650, glide: 0.04, type: 'triangle', peak: 0.03, decay: 0.05 }), { queue: false });
}

export function playLadder(): void {
  withAudio(
    (ac, t) => {
      [392, 523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.08, { freq, peak: 0.07, decay: 0.22 }));
    },
    { queue: false },
  );
}

export function playSnake(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.45, peak: 0.035, band: 5200, q: 0.6 });
      tone(ac, t + 0.05, { freq: 620, to: 140, glide: 0.6, type: 'sawtooth', peak: 0.03, decay: 0.65 });
    },
    { queue: false },
  );
}

export function playFinish(won: boolean): void {
  withAudio((ac, t) => {
    const notes = won ? [523.3, 659.3, 784, 1046.5, 1318.5] : [392, 329.6, 261.6];
    notes.forEach((freq, i) => tone(ac, t + i * 0.1, { freq, type: won ? 'sine' : 'triangle', peak: 0.09, attack: 0.02, decay: 0.5 }));
  });
}
