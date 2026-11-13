import type { AudioEngine, ToneOpts } from './engine';

interface SfxOpts extends ToneOpts {
  delay?: number;
}

/** One-shot sound effects. */
export class Sfx {
  private readonly engine: AudioEngine;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  private tone(freq: number, dur: number, o: SfxOpts = {}): void {
    const e = this.engine;
    if (!e.ctx || !e.sfxBus || e.isMuted) return;
    e.tone(e.sfxBus, freq, e.ctx.currentTime + (o.delay ?? 0), dur, o);
  }

  private noise(dur: number, vol: number, cutoff: number, delay = 0): void {
    const e = this.engine;
    if (!e.ctx || !e.sfxBus || e.isMuted) return;
    e.noiseHit(e.sfxBus, e.ctx.currentTime + delay, dur, vol, 'lowpass', cutoff);
  }

  start(): void {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.12, { vol: 0.1, delay: i * 0.07 }));
  }

  pickup(combo: number): void {
    const base = 660 * Math.pow(1.06, combo);
    this.tone(base, 0.06, { vol: 0.1 });
    this.tone(base * 1.5, 0.09, { vol: 0.09, delay: 0.05 });
  }

  comboUp(combo: number): void {
    const base = 523 * Math.pow(1.06, combo);
    [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(base * m, 0.1, { type: 'triangle', vol: 0.13, delay: i * 0.05 }));
  }

  energy(): void {
    this.tone(330, 0.25, { type: 'sawtooth', slide: 1320, vol: 0.08, cutoff: 3000 });
    this.tone(990, 0.12, { type: 'square', vol: 0.06, delay: 0.18 });
  }

  swing(): void {
    this.noise(0.12, 0.18, 5000);
  }

  hit(): void {
    this.tone(220, 0.12, { type: 'square', slide: 70, vol: 0.2 });
    this.noise(0.15, 0.35, 1800);
  }

  gpu(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.16, delay: i * 0.06 }));
  }

  splash(): void {
    this.noise(0.35, 0.3, 1400);
    this.tone(300, 0.2, { type: 'sine', slide: 120, vol: 0.08 });
  }

  discover(): void {
    this.tone(880, 0.1, { type: 'sine', vol: 0.12 });
    this.tone(1320, 0.18, { type: 'sine', vol: 0.12, delay: 0.08 });
  }

  ping(): void {
    this.tone(1200, 0.6, { type: 'sine', slide: 500, vol: 0.18 });
    this.tone(1200, 0.4, { type: 'sine', slide: 600, vol: 0.06, delay: 0.35 });
  }

  denied(): void {
    this.tone(150, 0.15, { vol: 0.1 });
  }

  steal(): void {
    this.tone(500, 0.25, { type: 'sawtooth', slide: 110, vol: 0.14 });
  }

  zap(): void {
    this.tone(1400, 0.15, { slide: 200, vol: 0.08 });
    this.noise(0.1, 0.15, 4000);
  }

  bump(): void {
    this.tone(160, 0.12, { type: 'triangle', slide: 80, vol: 0.18 });
  }

  warn(): void {
    this.tone(880, 0.1, { vol: 0.08 });
    this.tone(880, 0.1, { vol: 0.08, delay: 0.18 });
  }

  overheat(): void {
    this.noise(0.7, 0.4, 900);
    this.tone(440, 0.7, { type: 'sawtooth', slide: 55, vol: 0.16 });
  }

  teleport(): void {
    this.tone(300, 0.3, { type: 'sine', slide: 1500, vol: 0.1 });
  }

  dash(): void {
    this.noise(0.3, 0.2, 2500);
    this.tone(200, 0.3, { type: 'sawtooth', slide: 600, vol: 0.08 });
  }

  /** Someone's idle RAM uploads to the cloud. */
  pool(): void {
    this.tone(330, 0.35, { type: 'sine', slide: 1500, vol: 0.12 });
    this.tone(1760, 0.12, { type: 'triangle', vol: 0.08, delay: 0.3 });
  }

  /** Jensen takes the stage. */
  keynote(): void {
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.08 }));
  }

  /** Free GPUs flying everywhere. */
  giveaway(): void {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.09, { type: 'triangle', vol: 0.1, delay: i * 0.04 }));
    this.noise(0.25, 0.15, 6000);
  }

  /** A pop-up notification ding. */
  offer(): void {
    this.tone(1319, 0.12, { type: 'sine', vol: 0.14 });
    this.tone(1760, 0.22, { type: 'sine', vol: 0.14, delay: 0.11 });
  }

  /** Cha-ching: the deal is signed. */
  deal(): void {
    this.noise(0.08, 0.25, 7000);
    this.tone(1568, 0.08, { type: 'square', vol: 0.08, delay: 0.06 });
    this.tone(2093, 0.3, { type: 'square', vol: 0.08, delay: 0.12 });
  }

  /** TV news sting: "dun, dun, DUNNN". */
  breaking(): void {
    [988, 740, 494].forEach((f, i) => this.tone(f, 0.11, { type: 'square', vol: 0.09, delay: i * 0.1, cutoff: 3500 }));
    [247, 311, 370].forEach((f) => this.tone(f, 0.6, { type: 'sawtooth', vol: 0.06, delay: 0.3, cutoff: 1800, sustain: 0.5 }));
    this.noise(0.3, 0.15, 5000, 0.3);
  }

  /** Two quick chirps: a post goes out. */
  tweet(): void {
    this.tone(2200, 0.07, { type: 'sine', slide: 3400, vol: 0.1 });
    this.tone(2600, 0.08, { type: 'sine', slide: 3900, vol: 0.1, delay: 0.09 });
  }

  /** Sad trombone. */
  fired(): void {
    [392, 370, 349].forEach((f, i) => this.tone(f, 0.26, { type: 'sawtooth', vol: 0.1, delay: 0.35 + i * 0.28, cutoff: 1400 }));
    this.tone(330, 0.9, { type: 'sawtooth', slide: 280, vol: 0.1, delay: 1.19, cutoff: 1400, sustain: 0.6 });
  }

  /** Back in the building. */
  rehired(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.13, delay: i * 0.06 }));
    this.noise(0.2, 0.12, 6000, 0.2);
  }

  /** Glitchy blips and a zap: a new model drops out of nowhere. */
  modelDrop(): void {
    [1568, 784, 2093, 1046].forEach((f, i) => this.tone(f, 0.05, { type: 'square', vol: 0.07, delay: i * 0.045 }));
    this.noise(0.18, 0.2, 4500, 0.05);
    this.tone(180, 0.25, { type: 'sawtooth', slide: 900, vol: 0.08, delay: 0.1 });
  }

  /** Panels click open and the sun comes up: a warm rising chord. */
  solar(): void {
    [0, 0.08, 0.16].forEach((d) => this.noise(0.04, 0.14, 6000, d));
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', vol: 0.09, delay: 0.25 + i * 0.07, sustain: 0.4 }));
  }

  /** Panels snap shut. */
  solarPack(): void {
    this.noise(0.05, 0.16, 5000);
    this.tone(700, 0.12, { type: 'triangle', slide: 300, vol: 0.08, delay: 0.04 });
  }

  /** Something heavy lands in the sand. */
  thud(): void {
    this.noise(0.12, 0.2, 600);
    this.tone(130, 0.12, { type: 'triangle', slide: 60, vol: 0.12 });
  }

  /** Spy caught: a short "busted" fanfare. */
  busted(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.1, { type: 'square', vol: 0.09, delay: i * 0.07 }));
    this.tone(1047, 0.28, { type: 'triangle', vol: 0.12, delay: 0.22 });
  }

  /** Jensen steps down: a sad trombone. */
  resign(): void {
    [392, 370, 349].forEach((f, i) => this.tone(f, 0.3, { type: 'sawtooth', vol: 0.07, cutoff: 1400, delay: i * 0.32 }));
    this.tone(330, 0.9, { type: 'sawtooth', slide: 300, vol: 0.07, cutoff: 1400, delay: 0.96 });
  }

  levelUp(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, { vol: 0.1, delay: i * 0.09 }));
  }

  pop(): void {
    this.noise(0.5, 0.5, 3000);
    this.tone(900, 0.25, { type: 'sine', slide: 60, vol: 0.2 });
  }

  gameOver(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.16, delay: 0.3 + i * 0.22 }));
  }
}
