// Lightweight procedural sound effects via the Web Audio API — no asset files to
// ship or license. A single shared AudioContext is created lazily on first use
// (after a user gesture, so browsers allow it) and reused for every cue.

let ctx: AudioContext | null = null;
let muted = loadMuted();

const STORAGE_KEY = 'ttr-muted';

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
}

/** The shared context, or null when muted / Web Audio is unavailable. */
function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Two cues can be triggered by the same state update — e.g. the last player's
// claim "thunk" and your turn chime. Serialise starts with a minimum gap so they
// play back-to-back instead of stacking on top of each other.
let lastStart = 0;
const MIN_GAP = 0.24;

/** Start time for the next cue: now, but never less than MIN_GAP after the last. */
function slot(ac: AudioContext): number {
  const t = Math.max(ac.currentTime, lastStart + MIN_GAP);
  lastStart = t;
  return t;
}

/** Short wooden "thunk" when a train route is claimed. */
export function playClaim(): void {
  const ac = audio();
  if (!ac) return;
  const t = slot(ac);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** A short, bright two-note cue when it becomes your turn (your device only). */
export function playTurn(): void {
  const ac = audio();
  if (!ac) return;
  const t0 = slot(ac);
  [587.33, 880].forEach((freq, i) => {
    // D5 → A5
    const t = t0 + i * 0.1;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

/**
 * A gentle ascending chime for the final-round warning — a soft C-E-G bell
 * instead of the old harsh siren. Each note is a pure sine with a quick attack
 * and a long, mellow decay, the three overlapping slightly.
 */
export function playLastRound(): void {
  const ac = audio();
  if (!ac) return;
  const t0 = slot(ac);
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const t = t0 + i * 0.16;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03); // soft attack
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); // mellow decay
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  });
}

/**
 * A gentle "time's nearly up" nudge — three soft, quick sine pips (~1.5s total).
 * Urgent enough to notice, soft enough not to grate. Played on the current
 * player's device when their turn clock reaches the last few seconds.
 */
export function playTimeWarning(): void {
  const ac = audio();
  if (!ac) return;
  const t0 = slot(ac);
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.42;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 740; // F#5 — clear but not shrill
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}
