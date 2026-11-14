// Ludo cues: a dice rattle per roll, a tick per square walked, a pop when a
// token comes out, a knock-back for a capture, a chime for reaching home.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { LudoState } from '../engine';

export type LudoCue = 'roll' | 'turn' | 'blocked';

export function ludoCues(prev: LudoState, next: LudoState, meId: string): LudoCue[] {
  const cues: LudoCue[] = [];
  if (next.rollSeq > prev.rollSeq && next.game === prev.game) cues.push('roll');
  if (next.last && next.last.seq !== prev.last?.seq && next.last.kind === 'three-sixes') cues.push('blocked');
  const mine = !next.over && next.players[next.turn]?.id === meId && next.phase === 'roll';
  const wasMine = !prev.over && prev.players[prev.turn]?.id === meId && prev.game === next.game;
  if (mine && !wasMine) cues.push('turn');
  return cues;
}

export const LUDO_SOUNDS: Record<LudoCue, () => void> = {
  roll: () =>
    withAudio((ac, t) => {
      [0, 0.06, 0.13, 0.21].forEach((dt, i) => noise(ac, t + dt, { dur: 0.03, peak: 0.07 - i * 0.012, band: 2600, q: 2 }));
    }),
  turn: playTurn,
  blocked: () =>
    withAudio((ac, t) => {
      tone(ac, t + 0.3, { freq: 220, type: 'square', peak: 0.04, decay: 0.18 });
      tone(ac, t + 0.5, { freq: 165, type: 'square', peak: 0.04, decay: 0.3 });
    }),
};

export function playStep(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 950, to: 700, glide: 0.04, type: 'triangle', peak: 0.03, decay: 0.05 }), { queue: false });
}

export function playOut(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 520, to: 880, glide: 0.08, peak: 0.08, decay: 0.18 }), { queue: false });
}

export function playCapture(): void {
  withAudio(
    (ac, t) => {
      noise(ac, t, { dur: 0.08, peak: 0.08, band: 700, q: 0.9 });
      tone(ac, t, { freq: 300, to: 90, glide: 0.35, type: 'triangle', peak: 0.12, decay: 0.4 });
    },
    { queue: false },
  );
}

export function playHome(): void {
  withAudio(
    (ac, t) => {
      [659.3, 880, 1318.5].forEach((freq, i) => tone(ac, t + i * 0.08, { freq, peak: 0.08, decay: 0.45 }));
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
