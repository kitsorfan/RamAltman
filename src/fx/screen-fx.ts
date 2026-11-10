import { VIEW_H, VIEW_W } from '../config';
import { clamp, rand, type Vec } from '../math';
import { TAU, dot } from '../render/draw';

export type FlyerKind = 'ram' | 'gpu' | 'energy';

const FLYER_COLOR: Record<FlyerKind, string> = { ram: '#5dff9a', gpu: '#ffd75e', energy: '#ffe94d' };

interface Flash {
  color: string;
  alpha: number;
  life: number;
  max: number;
}

interface Flyer {
  from: Vec;
  ctrl: Vec;
  to: Vec;
  t: number;
  dur: number;
  kind: FlyerKind;
  trail: Vec[];
}

interface Mote {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
}

/** Screen-space effects: full-screen flashes, pickups flying into the HUD, drifting dust. */
export class ScreenFx {
  /** 0..1 glow on the HUD element a flyer just landed on. */
  ramPulse = 0;
  scorePulse = 0;
  energyPulse = 0;
  /** Bad press from shoving: the bubble meter glows. */
  bubblePulse = 0;
  private flashes: Flash[] = [];
  private flyers: Flyer[] = [];
  private readonly motes: Mote[] = Array.from({ length: 70 }, () => ({
    x: rand(0, VIEW_W),
    y: rand(0, VIEW_H),
    z: rand(0.3, 1),
    size: rand(0.8, 2.2),
    phase: rand(0, TAU),
  }));
  private time = 0;

  flash(color: string, alpha = 0.35, duration = 0.35): void {
    this.flashes.push({ color, alpha, life: duration, max: duration });
  }

  fly(from: Vec, to: Vec, kind: FlyerKind): void {
    const ctrl = { x: (from.x + to.x) / 2 + rand(-80, 80), y: Math.min(from.y, to.y) - rand(40, 120) };
    this.flyers.push({ from: { ...from }, ctrl, to: { ...to }, t: 0, dur: rand(0.45, 0.6), kind, trail: [] });
  }

  update(dt: number, camDelta: Vec, wind: number): void {
    this.time += dt;
    this.ramPulse = Math.max(0, this.ramPulse - dt * 3);
    this.scorePulse = Math.max(0, this.scorePulse - dt * 3);
    this.energyPulse = Math.max(0, this.energyPulse - dt * 3);
    this.bubblePulse = Math.max(0, this.bubblePulse - dt * 1.2);

    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter((f) => f.life > 0);

    for (const f of this.flyers) {
      f.t += dt / f.dur;
      f.trail.push(this.flyerPos(f));
      if (f.trail.length > 8) f.trail.shift();
      if (f.t >= 1) {
        if (f.kind === 'ram') this.ramPulse = 1;
        else if (f.kind === 'gpu') this.scorePulse = 1;
        else this.energyPulse = 1;
      }
    }
    this.flyers = this.flyers.filter((f) => f.t < 1);

    // Dust drifts with the wind and parallaxes against camera movement.
    for (const m of this.motes) {
      const parallax = 0.8 + 0.4 * m.z;
      m.x += wind * m.z * dt - camDelta.x * parallax;
      m.y += Math.sin(this.time * 1.3 + m.phase) * 8 * dt - camDelta.y * parallax;
      m.x = ((m.x % VIEW_W) + VIEW_W) % VIEW_W;
      m.y = ((m.y % VIEW_H) + VIEW_H) % VIEW_H;
    }
  }

  private flyerPos(f: Flyer): Vec {
    const e = clamp(f.t, 0, 1) ** 2; // ease-in: accelerates into the HUD
    const u = 1 - e;
    return {
      x: u * u * f.from.x + 2 * u * e * f.ctrl.x + e * e * f.to.x,
      y: u * u * f.from.y + 2 * u * e * f.ctrl.y + e * e * f.to.y,
    };
  }

  /** Drawn over the world but under the fog, so dust only shows where it's lit. */
  drawMotes(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(255, 238, 200, 0.6)';
    for (const m of this.motes) {
      ctx.globalAlpha = 0.25 + 0.5 * m.z;
      dot(ctx, m.x, m.y, m.size * m.z);
    }
    ctx.globalAlpha = 1;
  }

  /** Drawn on top of the HUD. */
  drawFront(ctx: CanvasRenderingContext2D): void {
    for (const f of this.flyers) {
      ctx.fillStyle = FLYER_COLOR[f.kind];
      f.trail.forEach((p, i) => {
        ctx.globalAlpha = ((i + 1) / f.trail.length) * 0.5;
        dot(ctx, p.x, p.y, 1.5 + i * 0.5);
      });
      ctx.globalAlpha = 1;

      const p = this.flyerPos(f);
      const s = 1 - 0.4 * f.t;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(s, s);
      ctx.rotate(f.t * 6);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = FLYER_COLOR[f.kind];
      dot(ctx, 0, 0, 16);
      ctx.globalAlpha = 1;
      if (f.kind === 'energy') {
        ctx.fillStyle = '#2a2d36';
        ctx.fillRect(-6, -9, 12, 18);
        ctx.fillStyle = '#ffd84d';
        ctx.fillRect(-4, -7, 8, 14);
      } else if (f.kind === 'ram') {
        ctx.fillStyle = '#1f8a4c';
        ctx.fillRect(-11, -5, 22, 9);
        ctx.fillStyle = '#111318';
        for (let i = 0; i < 3; i++) ctx.fillRect(-8 + i * 6, -3.5, 4, 4);
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(-10, 2, 20, 2);
      } else {
        ctx.fillStyle = '#2b2f3a';
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 2;
        ctx.fillRect(-12, -7, 24, 14);
        ctx.strokeRect(-12, -7, 24, 14);
      }
      ctx.restore();
    }

    for (const fl of this.flashes) {
      ctx.globalAlpha = fl.alpha * (fl.life / fl.max);
      ctx.fillStyle = fl.color;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.flashes = [];
    this.flyers = [];
    this.ramPulse = 0;
    this.scorePulse = 0;
    this.energyPulse = 0;
    this.bubblePulse = 0;
  }
}
