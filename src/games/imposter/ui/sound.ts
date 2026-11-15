// Imposter cues: a card flip as each round deals, a soft pop as a clue lands,
// a stamp for each vote, a two-note question for a tie, a drum roll at the
// reveal, then a bright rise if the round went your way and a sly slide if
// it didn't.
import { noise, playTurn, tone, withAudio } from '../../../shared/sound';
import type { ImposterState } from '../engine';

export type ImCue = 'deal' | 'clue' | 'vote' | 'tie' | 'reveal' | 'good' | 'bad' | 'win' | 'lose' | 'turn';

const votes = (s: ImposterState) => s.round.ballots.reduce((t, b) => t + Object.keys(b).length, 0);
const myTurn = (s: ImposterState, me: string) => {
  if (s.phase === 'clues') return s.round.order[s.round.turn % s.round.order.length] === me;
  if (s.phase === 'vote') return !(me in (s.round.ballots[s.round.ballots.length - 1] ?? {}));
  return s.phase === 'guess' && s.round.imposter === me;
};

export function imCues(prev: ImposterState, next: ImposterState, me: string): ImCue[] {
  const cues: ImCue[] = [];
  if (next.over && !prev.over) return [next.winners.includes(me) ? 'win' : 'lose'];
  if (next.round.number !== prev.round.number) cues.push('deal');
  else {
    if (next.round.clues.length > prev.round.clues.length) cues.push('clue');
    if (votes(next) > votes(prev)) cues.push('vote');
    if (next.round.runoff && !prev.round.runoff) cues.push('tie');
    if (next.phase === 'guess' && prev.phase !== 'guess') cues.push('reveal');
    if (next.phase === 'reveal' && prev.phase !== 'reveal') {
      // The crew wins a round by catching the imposter; the imposter, by anything else.
      const crewWon = next.round.outcome === 'caught';
      const wasImposter = next.round.imposter === me;
      cues.push(next.round.outcome === 'void' ? 'reveal' : crewWon !== wasImposter ? 'good' : 'bad');
    }
  }
  if (myTurn(next, me) && !myTurn(prev, me) && next.players.some((p) => p.id === me && !p.out)) cues.push('turn');
  return cues;
}

export const IM_SOUNDS: Record<ImCue, () => void> = {
  deal: () =>
    withAudio((ac, t) => {
      noise(ac, t, { dur: 0.06, peak: 0.07, band: 3600, q: 0.9 });
      noise(ac, t + 0.08, { dur: 0.05, peak: 0.05, band: 4400, q: 0.9 });
    }),
  clue: () => withAudio((ac, t) => tone(ac, t, { freq: 660, to: 880, glide: 0.06, type: 'sine', peak: 0.06, decay: 0.12 })),
  vote: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 140, to: 80, glide: 0.08, type: 'triangle', peak: 0.14, decay: 0.12 });
      noise(ac, t, { dur: 0.04, peak: 0.05, band: 1800, q: 0.7 });
    }),
  tie: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 523.3, type: 'triangle', peak: 0.07, decay: 0.18 });
      tone(ac, t + 0.18, { freq: 622.3, type: 'triangle', peak: 0.07, decay: 0.3 });
    }),
  reveal: () =>
    withAudio((ac, t) => {
      for (let i = 0; i < 10; i++) noise(ac, t + i * 0.05, { dur: 0.04, peak: 0.03 + i * 0.006, band: 900, q: 0.8 });
    }),
  good: () =>
    withAudio((ac, t) => {
      [523.3, 659.3, 784, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.09, { freq, peak: 0.08, attack: 0.01, decay: 0.45 }));
    }),
  bad: () =>
    withAudio((ac, t) => {
      tone(ac, t, { freq: 740, to: 370, glide: 0.5, type: 'triangle', peak: 0.07, decay: 0.55 });
      tone(ac, t + 0.12, { freq: 554, to: 277, glide: 0.5, type: 'sine', peak: 0.05, decay: 0.6 });
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
