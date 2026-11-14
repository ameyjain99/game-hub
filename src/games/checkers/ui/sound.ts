// Checkers cues: a wooden click per move, a double clack per capture, a bright
// chime when a man is crowned, and a short phrase when the game ends.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { CheckersState } from '../engine';

export type CheckersCue = 'move' | 'capture' | 'crown' | 'win' | 'lose' | 'draw' | 'turn';

export function checkersCues(prev: CheckersState, next: CheckersState, meId: string): CheckersCue[] {
  const cues: CheckersCue[] = [];
  const hop = next.lastHop;
  if (hop && hop !== prev.lastHop && next.game === prev.game) {
    cues.push(hop.captured !== null ? 'capture' : 'move');
    const before = prev.board[hop.from];
    if (Math.abs(before) === 1 && Math.abs(next.board[hop.to]) === 2) cues.push('crown');
  }
  if (next.over && !prev.over) cues.push(next.draw ? 'draw' : next.winner === meId ? 'win' : 'lose');
  else if (!next.over) {
    const myTurnNow = (next.turn === 'black') === (next.blackId === meId);
    const myTurnBefore = !prev.over && (prev.turn === 'black') === (prev.blackId === meId) && prev.game === next.game;
    if (myTurnNow && !myTurnBefore && next.chain === null) cues.push('turn');
  }
  return cues;
}

const click = (ac: AudioContext, t: number, peak = 0.12) => {
  noise(ac, t, { dur: 0.035, peak: peak * 0.6, band: 1800, q: 1.4 });
  tone(ac, t, { freq: 340, to: 220, glide: 0.05, type: 'triangle', peak, decay: 0.08 });
};

export const CHECKERS_SOUNDS: Record<CheckersCue, () => void> = {
  move: () => withAudio((ac, t) => click(ac, t)),
  capture: () =>
    withAudio((ac, t) => {
      click(ac, t, 0.13);
      click(ac, t + 0.07, 0.1);
    }),
  crown: () =>
    withAudio((ac, t) => {
      [784, 1046.5, 1318.5].forEach((freq, i) => tone(ac, t + i * 0.07, { freq, peak: 0.08, attack: 0.01, decay: 0.45 }));
    }),
  win: () =>
    withAudio((ac, t) => {
      [523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.09, { freq, peak: 0.1, attack: 0.02, decay: 0.55 }));
    }),
  lose: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 392, type: 'triangle', peak: 0.08, decay: 0.25 });
      tone(ac, t + 0.16, { freq: 293.7, type: 'triangle', peak: 0.07, decay: 0.45 });
    }),
  draw: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 440, peak: 0.07, decay: 0.25 });
      tone(ac, t + 0.14, { freq: 440, peak: 0.06, decay: 0.35 });
    }),
  turn: playTurn,
};
