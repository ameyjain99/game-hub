// Chess cues: a soft wooden placement per move, a sharper knock for a capture,
// a double tap for castling, a bright ping for check and a chime for promotion.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { ChessState } from '../engine';

export type ChessCue = 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'win' | 'lose' | 'draw' | 'turn';

export function chessCues(prev: ChessState, next: ChessState, meId: string): ChessCue[] {
  const cues: ChessCue[] = [];
  if (next.game === prev.game && next.moves.length > prev.moves.length) {
    const m = next.moves[next.moves.length - 1];
    if (m.san.startsWith('O-O')) cues.push('castle');
    else if (m.captured) cues.push('capture');
    else cues.push('move');
    if (m.promotion) cues.push('promote');
    if (m.san.endsWith('+')) cues.push('check');
    // A person waiting on another person hears when it's their move.
    const opponentIsHuman = next.players.some((p) => p.id !== meId && !p.isAI);
    const myColor = next.whiteId === meId ? 'w' : 'b';
    if (!next.over && opponentIsHuman && m.color !== myColor) cues.push('turn');
  }
  if (next.over && !prev.over) cues.push(next.winner === null ? 'draw' : next.winner === meId ? 'win' : 'lose');
  return cues;
}

const place = (ac: AudioContext, t: number, peak: number, freq: number) => {
  noise(ac, t, { dur: 0.03, peak: peak * 0.5, band: 2200, q: 1.2 });
  tone(ac, t, { freq, to: freq * 0.6, glide: 0.05, type: 'triangle', peak, decay: 0.09 });
};

export const CHESS_SOUNDS: Record<ChessCue, () => void> = {
  move: () => withAudio((ac, t) => place(ac, t, 0.11, 300)),
  capture: () =>
    withAudio((ac, t) => {
      place(ac, t, 0.14, 420);
      noise(ac, t + 0.02, { dur: 0.06, peak: 0.05, band: 900, q: 0.8 });
    }),
  castle: () =>
    withAudio((ac, t) => {
      place(ac, t, 0.1, 300);
      place(ac, t + 0.09, 0.1, 260);
    }),
  check: () => withAudio((ac, t) => tone(ac, t, { freq: 988, peak: 0.07, attack: 0.005, decay: 0.3 })),
  promote: () =>
    withAudio((ac, t) => {
      [659.3, 880, 1174.7].forEach((freq, i) => tone(ac, t + i * 0.07, { freq, peak: 0.07, decay: 0.4 }));
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
