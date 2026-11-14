// Lineup cues: a chip clacking down, one plucked off, a card swapped, a
// fanfare for a completed line, and the turn chime.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { SeqState } from '../engine';

export type SeqCue = 'chip' | 'remove' | 'swap' | 'line' | 'win' | 'lose' | 'turn';

export function seqCues(prev: SeqState, next: SeqState, meId: string): SeqCue[] {
  const cues: SeqCue[] = [];
  const play = next.last;
  if (play && play.seq !== prev.last?.seq && next.game === prev.game) {
    if (play.kind === 'place') cues.push('chip');
    else if (play.kind === 'remove') cues.push('remove');
    else cues.push('swap');
    if (play.made) cues.push('line');
  }
  const myTeam = next.players.find((p) => p.id === meId)?.team;
  if (next.over && !prev.over && next.winner !== null) cues.push(next.winner === myTeam ? 'win' : 'lose');
  else if (!next.over && next.players[next.turn]?.id === meId && (prev.players[prev.turn]?.id !== meId || prev.game !== next.game)) cues.push('turn');
  return cues;
}

export const SEQ_SOUNDS: Record<SeqCue, () => void> = {
  chip: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.04, peak: 0.07, band: 3000, q: 1.5 });
      tone(ac, t, { freq: 760, to: 520, glide: 0.05, type: 'triangle', peak: 0.1, decay: 0.09 });
    }),
  remove: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 420, to: 860, glide: 0.1, type: 'triangle', peak: 0.09, decay: 0.15 });
      noise(ac, t + 0.05, { dur: 0.08, peak: 0.04, band: 1600, q: 0.8 });
    }),
  swap: () => withAudio((ac, t) => noise(ac, t, { dur: 0.14, peak: 0.05, band: 3800, q: 0.7 })),
  line: () =>
    withAudio((ac, t) => {
      [523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.08, { freq, peak: 0.1, attack: 0.01, decay: 0.5 }));
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
