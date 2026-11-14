// Tic-Tac-Toe's cues on the shared sound engine: a chalky tap per mark (X a
// little higher than O), and a short phrase when a round ends.
import { playTurn, tone, withAudio } from '../../../shared/sound';
import type { TttState } from '../engine';

export type TttCue = 'x' | 'o' | 'win' | 'lose' | 'draw' | 'turn';

export function tttCues(prev: TttState, next: TttState, meId: string): TttCue[] {
  const cues: TttCue[] = [];
  if (next.round === prev.round && next.moves.length > prev.moves.length) {
    const cell = next.moves[next.moves.length - 1];
    cues.push(next.board[cell] === 'X' ? 'x' : 'o');
  }
  if (next.roundOver && !prev.roundOver) {
    cues.push(next.winner === null ? 'draw' : next.winner === meId ? 'win' : 'lose');
  } else if (!next.roundOver && next.turn === meId && (prev.turn !== meId || prev.round !== next.round)) {
    cues.push('turn');
  }
  return cues;
}

const tap = (freq: number) =>
  withAudio((ac, t) => {
    tone(ac, t, { freq, to: freq * 0.7, glide: 0.06, type: 'triangle', peak: 0.12, decay: 0.09 });
    tone(ac, t + 0.04, { freq: freq * 2, type: 'sine', peak: 0.03, decay: 0.12 });
  });

export const TTT_SOUNDS: Record<TttCue, () => void> = {
  x: () => tap(620),
  o: () => tap(470),
  win: () =>
    withAudio((ac, t) => {
      [523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.08, { freq, peak: 0.1, attack: 0.02, decay: 0.5 }));
    }),
  lose: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 392, type: 'triangle', peak: 0.08, decay: 0.22 });
      tone(ac, t + 0.14, { freq: 311.1, type: 'triangle', peak: 0.07, decay: 0.4 });
    }),
  draw: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 440, peak: 0.07, decay: 0.2 });
      tone(ac, t + 0.12, { freq: 440, peak: 0.06, decay: 0.3 });
    }),
  turn: playTurn,
};
