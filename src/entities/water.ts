import { WATER_CAPACITY } from '../config';
import { dist, rand, type Vec } from '../math';
import { TAU, droplet, groundShadow } from '../render/draw';

interface Palm {
  angle: number;
  size: number;
  lean: number;
}

/** An oasis. Standing in it cools you and recharges power, but it shrinks and eventually dries up. */
export class WaterSource {
  readonly pos: Vec;
  readonly maxRadius: number;
  capacity = WATER_CAPACITY;
  discovered = false;
  private readonly phase = rand(0, TAU);
  private readonly palms: Palm[];

  constructor(pos: Vec, maxRadius: number) {
    this.pos = pos;
    this.maxRadius = maxRadius;
    const count = Math.random() < 0.5 ? 1 : 2;
    this.palms = Array.from({ length: count }, (_, i) => ({
      angle: -Math.PI / 2 + (i === 0 ? rand(-1.2, -0.4) : rand(0.4, 1.2)),
      size: rand(0.85, 1.15),
      lean: rand(-1, 1),
    }));
  }

  get fraction(): number {
    return this.capacity / WATER_CAPACITY;
  }

  get radius(): number {
    return this.maxRadius * (0.35 + 0.65 * this.fraction);
  }

  get empty(): boolean {
    return this.capacity <= 0;
  }

  contains(p: Vec, pad = 0): boolean {
    return dist(p, this.pos) < this.radius + pad;
  }

  private blob(ctx: CanvasRenderingContext2D, r: number, time: number): void {
    const { x, y } = this.pos;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU;
      const rr = r * (1 + 0.07 * Math.sin(a * 3 + this.phase) + 0.04 * Math.sin(a * 5 + this.phase * 2 + time * 0.8));
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.pos;
    const r = this.radius;

    ctx.fillStyle = 'rgba(140, 100, 55, 0.35)';
    this.blob(ctx, this.maxRadius * 1.18, 0);
    ctx.fill();

    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#9be7ff');
    g.addColorStop(0.6, '#3aa6e8');
    g.addColorStop(1, '#1b5fa8');
    ctx.fillStyle = g;
    this.blob(ctx, r, time);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const k = (time * 0.4 + i / 3 + this.phase) % 1;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r * k * 0.9, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const palm of this.palms) {
      const px = x + Math.cos(palm.angle) * this.maxRadius * 1.15;
      const py = y + Math.sin(palm.angle) * this.maxRadius * 1.15;
      drawPalm(ctx, px, py, palm.size, palm.lean, time);
    }
  }

  /** Dashed outline + droplet drawn above the fog so known water stays findable. */
  drawMarker(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.2 * Math.sin(time * 3 + this.phase);
    ctx.strokeStyle = '#7fd6ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -time * 20;
    this.blob(ctx, this.radius, time);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7fd6ff';
    droplet(ctx, this.pos.x, this.pos.y, 10);
    ctx.fill();
    ctx.restore();
  }
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lean: number, time: number): void {
  groundShadow(ctx, x + 10 * s, y + 2, 18 * s, 6 * s);
  const topX = x + lean * 10 * s;
  const topY = y - 38 * s;
  ctx.strokeStyle = '#7a5532';
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 2 * s, y - 20 * s, topX, topY);
  ctx.stroke();

  const sway = Math.sin(time * 1.5 + x) * 0.08;
  ctx.strokeStyle = '#3f8f3a';
  ctx.lineWidth = 4 * s;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + sway;
    const len = 22 * s;
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.6 + 10 * s;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - 6 * s, ex, ey);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
