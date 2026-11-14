// Lightweight procedural sound effects via the Web Audio API — no asset files to
// ship or license — shared by every game. A single AudioContext is created
// lazily on first use (after a user gesture, so browsers allow it) and reused
// for every cue. One mute switch covers the whole hub.

import { useState } from 'react';

let ctx: AudioContext | null = null;

const STORAGE_KEY = 'gamehub-muted';
/** Where Ticket to Ride kept its mute before sounds were shared. */
const LEGACY_KEY = 'ttr-muted';

let muted = loadMuted();

function loadMuted(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    return value === '1';
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

/** The hub-wide mute switch as React state. */
export function useMuted(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(isMuted);
  return [
    value,
    (next) => {
      setMuted(next);
      setValue(next);
    },
  ];
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

// Two cues can be triggered by the same state update — e.g. a payment and your
// turn chime. Serialise starts with a minimum gap so they play back-to-back
// instead of stacking on top of each other.
let lastStart = 0;
const MIN_GAP = 0.24;

/** Start time for the next cue: now, but never less than MIN_GAP after the last. */
function slot(ac: AudioContext): number {
  const t = Math.max(ac.currentTime, lastStart + MIN_GAP);
  lastStart = t;
  return t;
}

/**
 * Play a cue unless muted. It starts in its own slot after the previous cue,
 * or right away with `queue: false` (rapid ticks that must not lag behind).
 */
export function withAudio(play: (ac: AudioContext, t: number) => void, { queue = true } = {}): void {
  const ac = audio();
  if (!ac) return;
  play(ac, queue ? slot(ac) : ac.currentTime);
}

export interface ToneOptions {
  freq: number;
  /** Glide to this pitch over `glide` seconds. */
  to?: number;
  glide?: number;
  type?: OscillatorType;
  /** Peak gain: keep cues soft (well under 0.3). */
  peak: number;
  attack?: number;
  /** Seconds until the tone has faded out. */
  decay: number;
}

/** One enveloped oscillator note starting at `t`. */
export function tone(ac: AudioContext, t: number, o: ToneOptions): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? o.decay));
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(o.peak, t + (o.attack ?? 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.decay);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + o.decay + 0.05);
}

/** A short burst of band-passed noise (dice clicks, a card's whoosh). */
export function noise(ac: AudioContext, t: number, o: { dur: number; peak: number; band: number; q?: number }): void {
  const frames = Math.max(1, Math.floor(ac.sampleRate * o.dur));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = o.band;
  filter.Q.value = o.q ?? 1.2;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(o.peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + o.dur + 0.02);
}

/** A short, bright two-note cue when it becomes your turn (your device only). */
export function playTurn(): void {
  withAudio((ac, t0) => {
    // D5 → A5
    [587.33, 880].forEach((freq, i) => tone(ac, t0 + i * 0.1, { freq, peak: 0.13, attack: 0.02, decay: 0.35 }));
  });
}

/**
 * A gentle "time's nearly up" nudge — three soft, quick sine pips (~1.5s total).
 * Urgent enough to notice, soft enough not to grate. Played on the current
 * player's device when their turn clock reaches the last few seconds.
 */
export function playTimeWarning(): void {
  withAudio((ac, t0) => {
    // F#5 — clear but not shrill.
    for (let i = 0; i < 3; i++) tone(ac, t0 + i * 0.42, { freq: 740, peak: 0.14, attack: 0.02, decay: 0.26 });
  });
}
