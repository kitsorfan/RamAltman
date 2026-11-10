import { rand, vec, type Vec } from '../math';
import { TAU, dot, groundShadow } from '../render/draw';

/** RAM counts toward the target, GPUs are bonus points (and heat), energy cells refill energy. */
export type PickupKind = 'ram' | 'gpu' | 'energy';

const RADIUS: Record<PickupKind, number> = { ram: 12, gpu: 16, energy: 13 };

export class Pickup {
  readonly kind: PickupKind;
  readonly pos: Vec;
  readonly radius: number;
  /** Set when knocked loose from a rival; slides to a stop. */
  readonly vel: Vec = vec();
  alive = true;
  private age = 0;
  private readonly phase = rand(0, TAU);

  constructor(kind: PickupKind, pos: Vec) {
    this.kind = kind;
    this.pos = pos;
    this.radius = RADIUS[kind];
  }

  update(dt: number): void {
    this.age += dt;
    if (this.vel.x !== 0 || this.vel.y !== 0) {
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      const k = Math.exp(-dt * 5);
      this.vel.x *= k;
      this.vel.y *= k;
      if (Math.abs(this.vel.x) + Math.abs(this.vel.y) < 5) this.vel.x = this.vel.y = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const s = Math.min(1, this.age * 4);
    const bob = Math.sin(time * 3 + this.phase) * 3;
    groundShadow(ctx, this.pos.x, this.pos.y + 10, 12 * s, 4 * s);
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y + bob - 4);
    ctx.scale(s, s);
    this.drawIcon(ctx, time);
    ctx.restore();
  }

  /** Just the item, centered on the current origin (no shadow or bobbing). */
  drawIcon(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    if (this.kind === 'ram') this.drawRam(ctx, time);
    else if (this.kind === 'gpu') this.drawGpu(ctx, time);
    else this.drawEnergy(ctx, time);
    ctx.restore();
  }

  /** Energy cells emit light: a glow drawn above the fog so they can be spotted from afar. */
  drawBeacon(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.pos;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + this.phase);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 20);
    g.addColorStop(0, `rgba(255, 230, 80, ${0.5 + 0.3 * pulse})`);
    g.addColorStop(1, 'rgba(255, 230, 80, 0)');
    ctx.fillStyle = g;
    dot(ctx, x, y, 20);
    ctx.fillStyle = '#fff6b0';
    dot(ctx, x, y, 2.5);
  }

  private drawRam(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.fillStyle = 'rgba(120, 255, 160, 0.18)';
    dot(ctx, 0, 0, 19);
    ctx.rotate(-0.15);
    ctx.fillStyle = '#1f8a4c';
    ctx.strokeStyle = '#0d4a27';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-15, -7, 30, 13, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111318';
    for (let i = 0; i < 4; i++) ctx.fillRect(-12.5 + i * 6.5, -5, 5, 6);
    ctx.fillStyle = '#e8c547';
    for (let i = 0; i < 9; i++) ctx.fillRect(-13.5 + i * 3, 3, 2, 3);

    // Occasional glint so RAM catches the eye.
    const g = (time * 0.8 + this.phase) % 2.5;
    if (g < 0.4) sparkle(ctx, 9, -6, Math.sin((g / 0.4) * Math.PI) * 6);
  }

  private drawGpu(ctx: CanvasRenderingContext2D, time: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(time * 5 + this.phase);
    ctx.fillStyle = `rgba(255, 210, 80, ${0.15 + 0.2 * pulse})`;
    dot(ctx, 0, 0, 27);
    ctx.fillStyle = '#2b2f3a';
    ctx.strokeStyle = '#0e1014';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-18, -11, 36, 22, 3);
    ctx.fill();
    ctx.stroke();

    const rgb = ctx.createLinearGradient(-18, 0, 18, 0);
    rgb.addColorStop(0, '#ff4d6d');
    rgb.addColorStop(0.5, '#5dff9a');
    rgb.addColorStop(1, '#4f8cff');
    ctx.fillStyle = rgb;
    ctx.fillRect(-17, 7, 34, 2);

    for (const fx of [-8, 8]) {
      ctx.fillStyle = '#151820';
      dot(ctx, fx, -1, 7);
      ctx.strokeStyle = '#8a93a6';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const a = time * 14 + (k * TAU) / 3;
        ctx.beginPath();
        ctx.moveTo(fx, -1);
        ctx.lineTo(fx + Math.cos(a) * 6, -1 + Math.sin(a) * 6);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(-12, 11, 20, 3);
  }

  private drawEnergy(ctx: CanvasRenderingContext2D, time: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6 + this.phase);
    ctx.fillStyle = `rgba(255, 230, 70, ${0.18 + 0.22 * pulse})`;
    dot(ctx, 0, 0, 22);

    // Battery body
    ctx.fillStyle = '#2a2d36';
    ctx.strokeStyle = '#0e1014';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-9, -13, 18, 26, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9ced8';
    ctx.fillRect(-4, -16, 8, 3);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.roundRect(-6, -10, 12, 20, 2);
    ctx.fill();

    // Lightning bolt
    ctx.fillStyle = '#2a2d36';
    ctx.beginPath();
    ctx.moveTo(1.5, -8);
    ctx.lineTo(-4, 1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-1.5, 8);
    ctx.lineTo(4, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();

    // Crackle
    if (Math.sin(time * 9 + this.phase * 3) > 0.85) {
      ctx.strokeStyle = '#fff6b0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(9, -8);
      ctx.lineTo(14, -11);
      ctx.lineTo(12, -6);
      ctx.lineTo(17, -8);
      ctx.stroke();
    }
  }
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}
