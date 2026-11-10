export interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  /** Glide to this frequency over the note. */
  slide?: number;
  attack?: number;
  /** Fraction of the note held at full volume before the release. */
  sustain?: number;
  /** Lowpass cutoff in Hz. */
  cutoff?: number;
}

const MASTER_VOLUME = 0.5;
const MUSIC_VOLUME = 0.45;

/** Owns the AudioContext and the mix: master -> (sfx bus, music bus). Everything is synthesized. */
export class AudioEngine {
  ctx: AudioContext | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private musicOn = true;

  get isMuted(): boolean {
    return this.muted;
  }

  get isMusicOn(): boolean {
    return this.musicOn;
  }

  /** Browsers only allow audio after a user gesture, so this runs on the first key/click. */
  unlock(): void {
    if (!this.ctx) {
      let ctx: AudioContext;
      try {
        ctx = new AudioContext();
      } catch {
        return;
      }
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.applyGains();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyGains();
    return this.muted;
  }

  toggleMusic(): boolean {
    this.musicOn = !this.musicOn;
    this.applyGains();
    return this.musicOn;
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOLUME, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? MUSIC_VOLUME : 0, t, 0.05);
  }

  tone(bus: AudioNode, freq: number, t: number, dur: number, o: ToneOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slide), t + dur);

    const vol = o.vol ?? 0.1;
    const attack = Math.min(o.attack ?? 0.01, dur * 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (o.sustain) gain.gain.setValueAtTime(vol, t + Math.max(attack, dur * o.sustain));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let out: AudioNode = osc;
    if (o.cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.cutoff;
      osc.connect(filter);
      out = filter;
    }
    out.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A filtered burst from the shared white-noise buffer (drums, splashes, explosions). */
  noiseHit(bus: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }
}
