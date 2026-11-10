import type { AudioEngine } from './engine';
import { clamp } from '../math';

export type Track = 'title' | 'game';

const STEPS_PER_LOOP = 64; // 4 bars of 16th notes
const LOOKAHEAD = 0.15; // seconds of audio scheduled ahead of the clock

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

interface Chord {
  root: number;
  tones: readonly [number, number, number];
}

// A minor: Am - F - C - G, one bar each.
const PROGRESSION: readonly Chord[] = [
  { root: 45, tones: [57, 60, 64] },
  { root: 41, tones: [53, 57, 60] },
  { root: 48, tones: [55, 60, 64] },
  { root: 43, tones: [55, 59, 62] },
];

// [step, midi note] pairs over the 64-step loop. Two phrases alternate each loop.
const MELODY_A: ReadonlyArray<readonly [number, number]> = [
  [0, 76], [4, 72], [6, 74], [8, 76], [12, 69],
  [16, 77], [20, 76], [22, 72], [24, 69], [28, 72],
  [32, 79], [36, 76], [38, 72], [40, 76], [42, 79], [44, 81],
  [48, 79], [52, 77], [54, 74], [56, 71], [60, 74],
];
const MELODY_B: ReadonlyArray<readonly [number, number]> = [
  [0, 81], [2, 79], [4, 76], [8, 72], [10, 74], [12, 76],
  [16, 77], [18, 76], [20, 77], [24, 81], [28, 79],
  [32, 79], [34, 76], [36, 72], [40, 74], [44, 76],
  [48, 74], [50, 71], [52, 67], [56, 71], [58, 74], [60, 79],
];

interface Note {
  midi: number;
  steps: number;
}

/** Expands [step, note] pairs into a step-indexed lookup with each note's length. */
function compile(events: ReadonlyArray<readonly [number, number]>): Map<number, Note> {
  const map = new Map<number, Note>();
  events.forEach(([step, midi], i) => {
    const next = events[i + 1]?.[0] ?? STEPS_PER_LOOP;
    map.set(step, { midi, steps: next - step });
  });
  return map;
}

const MELODIES = [compile(MELODY_A), compile(MELODY_B)] as const;
const ARP = [0, 1, 2, 1] as const;

/**
 * Procedural chiptune with a lookahead step sequencer.
 * The game track adds layers and speeds up as `intensity` (the AI bubble) rises.
 */
export class Music {
  /** 0..1, driven by the bubble meter. */
  intensity = 0;
  private readonly engine: AudioEngine;
  private track: Track | null = null;
  private paused = false;
  private step = 0;
  private nextTime = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    window.setInterval(this.tick, 25);
  }

  /** Starts a track from the top (also restarts the same track). */
  play(track: Track): void {
    this.track = track;
    this.step = 0;
    this.nextTime = 0;
    this.paused = false;
    this.intensity = 0;
  }

  stop(): void {
    this.track = null;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.nextTime = 0;
  }

  private stepDuration(): number {
    const bpm = this.track === 'title' ? 96 : 120 + 36 * clamp((this.intensity - 0.5) / 0.5, 0, 1);
    return 60 / bpm / 4;
  }

  private readonly tick = (): void => {
    const e = this.engine;
    const ctx = e.ctx;
    if (!ctx || !this.track || this.paused || e.isMuted || !e.isMusicOn) {
      this.nextTime = 0;
      return;
    }
    // (Re)sync after a pause, a mute, or the tab being throttled, instead of bursting missed notes.
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.track === 'title') this.scheduleTitle(this.step, this.nextTime);
      else this.scheduleGame(this.step, this.nextTime);
      this.nextTime += this.stepDuration();
      this.step++;
    }
  };

  private scheduleGame(step: number, t: number): void {
    const s = step % STEPS_PER_LOOP;
    const loop = Math.floor(step / STEPS_PER_LOOP);
    const b = s % 16;
    const chord = PROGRESSION[Math.floor(s / 16) % PROGRESSION.length] as Chord;
    const dur = this.stepDuration();
    const hot = this.intensity;

    // Drums: four-on-the-floor feel, busier as the bubble inflates.
    if (b === 0 || b === 8 || (hot > 0.6 && b === 10)) this.kick(t);
    if (b === 4 || b === 12) this.snare(t);
    if (hot > 0.8 || b % 2 === 0) this.hat(t, b % 4 === 2 ? 0.05 : 0.03);

    // Pumping octave bass on 8th notes.
    if (b % 2 === 0) this.voice('sawtooth', hz(chord.root + (b % 4 === 2 ? 12 : 0)), t, dur * 1.8, 0.09, 520);

    // Arpeggio on 16ths.
    const arpNote = chord.tones[ARP[b % 4] ?? 0];
    this.voice('square', hz(arpNote + 12), t, dur * 0.9, 0.022, 3200);

    // Lead melody joins after the intro loop (or right away once things heat up).
    if (loop >= 1 || hot > 0.3) {
      const note = MELODIES[loop % 2]?.get(s);
      if (note) this.voice('square', hz(note.midi), t, note.steps * dur * 0.85, 0.045, 2400, 0.6);
    }
  }

  private scheduleTitle(step: number, t: number): void {
    const s = step % STEPS_PER_LOOP;
    const b = s % 16;
    const chord = PROGRESSION[Math.floor(s / 16) % PROGRESSION.length] as Chord;
    const dur = this.stepDuration();

    if (b === 0) {
      for (const n of chord.tones) this.voice('triangle', hz(n), t, dur * 16, 0.045, undefined, 0.7, 0.4);
      this.kick(t, 0.25);
    }
    if (b === 0 || b === 8) this.voice('triangle', hz(chord.root), t, dur * 8, 0.11, undefined, 0.6);
    if (b % 2 === 0) {
      const pattern = [0, 1, 2, 1, 0, 2, 1, 2] as const;
      const idx = pattern[(b / 2) % pattern.length] ?? 0;
      this.voice('sine', hz(chord.tones[idx] + 12), t, dur * 2.5, 0.05);
    }
  }

  private voice(
    type: OscillatorType,
    freq: number,
    t: number,
    dur: number,
    vol: number,
    cutoff?: number,
    sustain?: number,
    attack?: number,
  ): void {
    const e = this.engine;
    if (!e.musicBus) return;
    e.tone(e.musicBus, freq, t, dur, { type, vol, cutoff, sustain, attack: attack ?? 0.005 });
  }

  private kick(t: number, vol = 0.45): void {
    const e = this.engine;
    if (!e.musicBus) return;
    e.tone(e.musicBus, 150, t, 0.18, { type: 'sine', slide: 42, vol, attack: 0.002 });
  }

  private snare(t: number): void {
    const e = this.engine;
    if (!e.musicBus) return;
    e.noiseHit(e.musicBus, t, 0.13, 0.16, 'highpass', 1200);
    e.tone(e.musicBus, 190, t, 0.08, { type: 'triangle', vol: 0.06, attack: 0.002 });
  }

  private hat(t: number, vol: number): void {
    const e = this.engine;
    if (!e.musicBus) return;
    e.noiseHit(e.musicBus, t, 0.04, vol, 'highpass', 7000);
  }
}
