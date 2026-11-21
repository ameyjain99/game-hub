// Ticket to Ride's own cues, on the shared sound engine (src/shared/sound.ts),
// which also holds the hub-wide mute and the cues every game uses.

import { tone, withAudio } from '../../../shared/sound';

export { isMuted, setMuted, playTurn, playTimeWarning } from '../../../shared/sound';

/** Short wooden "thunk" when a train route is claimed. */
export function playClaim(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 320, to: 140, glide: 0.12, type: 'triangle', peak: 0.25, decay: 0.18 }));
}

/**
 * A gentle ascending chime for the final-round warning - a soft C-E-G bell
 * instead of a harsh siren. Each note is a pure sine with a quick attack and a
 * long, mellow decay, the three overlapping slightly.
 */
export function playLastRound(): void {
  withAudio((ac, t0) => {
    [523.25, 659.25, 783.99].forEach((freq, i) =>
      tone(ac, t0 + i * 0.16, { freq, peak: 0.18, attack: 0.03, decay: 0.9 }),
    );
  });
}

/** A card slid off the deck or the table. */
export function playDraw(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 620, to: 880, glide: 0.06, type: 'triangle', peak: 0.07, decay: 0.09 }));
}

/** Destination tickets taken: a two-note rustle. */
export function playTicketsTaken(): void {
  withAudio((ac, t) => {
    tone(ac, t, { freq: 440, type: 'triangle', peak: 0.08, decay: 0.12 });
    tone(ac, t + 0.09, { freq: 554.4, type: 'triangle', peak: 0.08, decay: 0.18 });
  });
}

/** Your own ticket completed: a short rising chord. */
export function playTicketDone(): void {
  withAudio((ac, t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ac, t + i * 0.07, { freq, peak: 0.12, attack: 0.01, decay: 0.5 }));
  });
}

/** Into a tunnel: a low rumble. */
export function playTunnel(): void {
  withAudio((ac, t) => tone(ac, t, { freq: 110, to: 70, glide: 0.5, type: 'sawtooth', peak: 0.08, decay: 0.6 }));
}
