import { clamp, dist, normalize, pick, rand, sub, type Vec } from '../math';
import { TAU, dot, outlinedText, pixelFont } from '../render/draw';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  drag: number;
  gravity: number;
  color: string;
  rect: boolean;
  rot: number;
  spin: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

interface Ring {
  x: number;
  y: number;
  maxR: number;
  width: number;
  color: string;
  life: number;
  max: number;
}

interface Beam {
  x: number;
  y: number;
  color: string;
  life: number;
  max: number;
}

interface Zap {
  points: Vec[];
  color: string;
  life: number;
  max: number;
}

interface Footprint {
  x: number;
  y: number;
  angle: number;
  life: number;
}

interface Slash {
  x: number;
  y: number;
  angle: number;
  color: string;
  life: number;
  max: number;
}

const MAX_PARTICLES = 900;
const MAX_FOOTPRINTS = 140;
const FOOTPRINT_LIFE = 5;
const CONFETTI = ['#5dff9a', '#ffe066', '#ff7ab6', '#7aa2ff', '#ff8a4c', '#ffffff'] as const;

/** World-space effects: particles, floating text, rings, beams, lightning and footprints. */
export class Effects {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private beams: Beam[] = [];
  private zaps: Zap[] = [];
  private footprints: Footprint[] = [];
  private slashes: Slash[] = [];

  private add(p: Partial<Particle> & Pick<Particle, 'x' | 'y' | 'life' | 'size' | 'color'>): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({
      vx: 0,
      vy: 0,
      max: p.life,
      grow: 0,
      drag: 3,
      gravity: 0,
      rect: false,
      rot: 0,
      spin: 0,
      ...p,
    });
  }

  burst(x: number, y: number, color: string, count = 12, speed = 120, size = 3, life = 0.6): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1), size: size * rand(0.6, 1.3), color });
    }
  }

  /** Droplets thrown up and falling back (entering water). */
  splash(x: number, y: number, count = 20): void {
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const s = rand(110, 260);
      this.add({
        x: x + rand(-8, 8),
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.45, 0.7),
        size: rand(1.8, 3.4),
        drag: 1,
        gravity: 650,
        color: pick(['#bfefff', '#7fd6ff', '#ffffff']),
      });
    }
  }

  confetti(x: number, y: number, count = 90): void {
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const s = rand(200, 480);
      this.add({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(1.4, 2.2),
        size: rand(3, 5),
        drag: 1.4,
        gravity: 340,
        color: pick(CONFETTI),
        rect: true,
        rot: rand(0, TAU),
        spin: rand(-12, 12),
      });
    }
  }

  /** Little chips thrown from one point toward another (stolen RAM). */
  fling(from: Vec, to: Vec, color: string, count: number): void {
    const dir = normalize(sub(to, from));
    const speed = Math.min(520, dist(from, to) * 2.4 + 120);
    for (let i = 0; i < count; i++) {
      const spread = rand(-0.5, 0.5);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const s = speed * rand(0.7, 1.1);
      this.add({
        x: from.x,
        y: from.y,
        vx: (dir.x * cos - dir.y * sin) * s,
        vy: (dir.x * sin + dir.y * cos) * s,
        life: rand(0.4, 0.6),
        size: 3.5,
        drag: 2,
        color,
        rect: true,
        rot: rand(0, TAU),
        spin: rand(-15, 15),
      });
    }
  }

  steam(x: number, y: number): void {
    this.add({ x: x + rand(-8, 8), y, vx: rand(-10, 10), vy: rand(-55, -30), life: 0.9, size: rand(3, 5), grow: 6, drag: 0.5, color: 'rgba(235, 235, 240, 0.7)' });
  }

  /** A shrinking blob that stays put: dust, dash trails, afterimages. */
  puff(x: number, y: number, color: string, size: number, life = 0.35): void {
    this.add({ x, y, life, size, grow: -size / life, drag: 0, color });
  }

  text(x: number, y: number, text: string, color = '#ffffff', size = 10): void {
    // Stack upward instead of overlapping other recent text nearby.
    let yy = y;
    for (let pass = 0; pass < 5; pass++) {
      const clash = this.texts.find((t) => Math.abs(t.x - x) < 70 && Math.abs(t.y - yy) < 13);
      if (!clash) break;
      yy = clash.y - 15;
    }
    this.texts.push({ x, y: yy, text, color, size, life: 1.1, max: 1.1 });
  }

  ring(x: number, y: number, color: string, maxR: number, life = 0.8, width = 3): void {
    this.rings.push({ x, y, maxR, width, color, life, max: life });
  }

  /** Vertical column of light (teleports). */
  beam(x: number, y: number, color: string): void {
    this.beams.push({ x, y, color, life: 0.6, max: 0.6 });
  }

  /** Jagged lightning bolt between two points. */
  zap(from: Vec, to: Vec, color: string): void {
    const points: Vec[] = [];
    const segs = 9;
    const n = normalize(sub(to, from));
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const jitter = i === 0 || i === segs ? 0 : rand(-12, 12);
      points.push({ x: from.x + (to.x - from.x) * k - n.y * jitter, y: from.y + (to.y - from.y) * k + n.x * jitter });
    }
    this.zaps.push({ points, color, life: 0.3, max: 0.3 });
  }

  /** Swoosh arc in front of an attacker. */
  slash(x: number, y: number, angle: number, color = '#ffffff'): void {
    this.slashes.push({ x, y, angle, color, life: 0.2, max: 0.2 });
  }

  footprint(x: number, y: number, angle: number): void {
    this.footprints.push({ x, y, angle, life: FOOTPRINT_LIFE });
    if (this.footprints.length > MAX_FOOTPRINTS) this.footprints.shift();
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size = Math.max(0.1, p.size + p.grow * dt);
      p.rot += p.spin * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);

    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const z of this.zaps) z.life -= dt;
    this.zaps = this.zaps.filter((z) => z.life > 0);
    for (const f of this.footprints) f.life -= dt;
    this.footprints = this.footprints.filter((f) => f.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
  }

  /** Drawn right after the sand, under everything else. */
  drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#8a6438';
    for (const f of this.footprints) {
      ctx.globalAlpha = 0.28 * clamp(f.life / FOOTPRINT_LIFE, 0, 1);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 4, 2.4, f.angle, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Drawn below the fog of war. */
  drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      if (p.rect) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else {
        dot(ctx, p.x, p.y, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Drawn above the fog of war so feedback is always readable. */
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.beams) {
      const k = b.life / b.max;
      const w = 46 * k;
      const g = ctx.createLinearGradient(0, b.y - 320, 0, b.y + 20);
      g.addColorStop(0, 'rgba(0, 0, 0, 0)');
      g.addColorStop(0.8, b.color);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = k;
      ctx.fillStyle = g;
      ctx.fillRect(b.x - w / 2, b.y - 320, w, 340);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - w / 8, b.y - 320, w / 4, 340);
    }
    ctx.restore();

    for (const z of this.zaps) {
      ctx.globalAlpha = clamp(z.life / z.max, 0, 1) * (Math.random() < 0.3 ? 0.4 : 1);
      for (const [width, color] of [[5, z.color], [1.5, '#ffffff']] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        z.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      }
    }

    ctx.lineCap = 'round';
    for (const s of this.slashes) {
      const k = s.life / s.max;
      const sweep = (1 - k) * 0.9;
      ctx.globalAlpha = k;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 7 * k + 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 44, s.angle - 1.1 + sweep, s.angle + 0.4 + sweep);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const radius = r.maxR * (1 - (1 - t) * (1 - t));
      ctx.globalAlpha = clamp(1 - t, 0, 1);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, TAU);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp((t.life / t.max) * 1.6, 0, 1);
      const pop = 1 + 0.35 * Math.max(0, (t.life - t.max + 0.15) / 0.15);
      ctx.font = pixelFont(Math.round(t.size * pop));
      outlinedText(ctx, t.text, t.x, t.y, t.color);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.beams = [];
    this.zaps = [];
    this.footprints = [];
    this.slashes = [];
  }
}
