import { VIEW_H, VIEW_W, WORLD_H, WORLD_W } from '../config';
import { pick, rand, type Vec } from '../math';
import { TAU, groundShadow, uiFont } from './draw';

type DecorKind = 'rock' | 'cactus' | 'rack' | 'grave';

interface Decor {
  x: number;
  y: number;
  kind: DecorKind;
  s: number;
  seed: number;
  label: string;
}

// Previous bubbles, resting in peace.
const GRAVES = ['Pets.com', 'Webvan', 'Juicero', 'Quibi', 'Boo.com', 'eToys', 'Kozmo'] as const;

function makeSandTile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = '#dcb676';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(160, 115, 55, 0.18)' : 'rgba(255, 240, 200, 0.22)';
    g.fillRect(Math.random() * 256, Math.random() * 256, rand(1, 2.5), rand(1, 2.5));
  }
  // Dune ripples; two full sine periods across the tile so it repeats seamlessly.
  g.strokeStyle = 'rgba(170, 125, 65, 0.22)';
  g.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    const y0 = 20 + k * 51;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = y0 + Math.sin((x / 256) * TAU * 2 + k) * 6;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

export class Background {
  private readonly pattern: CanvasPattern | null;
  private decor: Decor[] = [];

  constructor(ctx: CanvasRenderingContext2D) {
    this.pattern = ctx.createPattern(makeSandTile(), 'repeat');
    this.regenerate();
  }

  regenerate(): void {
    this.decor = [];
    for (let i = 0; i < 150; i++) {
      const r = Math.random();
      const kind: DecorKind = r < 0.45 ? 'rock' : r < 0.8 ? 'cactus' : r < 0.92 ? 'rack' : 'grave';
      this.decor.push({
        x: rand(40, WORLD_W - 40),
        y: rand(40, WORLD_H - 40),
        kind,
        s: kind === 'grave' ? 1.2 : rand(0.8, 1.3),
        seed: Math.random(),
        label: pick(GRAVES),
      });
    }
    this.decor.sort((a, b) => a.y - b.y);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Vec, time: number): void {
    ctx.fillStyle = this.pattern ?? '#dcb676';
    ctx.fillRect(cam.x - 20, cam.y - 20, VIEW_W + 40, VIEW_H + 40);
    const m = 60;
    for (const d of this.decor) {
      if (d.x < cam.x - m || d.x > cam.x + VIEW_W + m || d.y < cam.y - m || d.y > cam.y + VIEW_H + m) continue;
      drawDecor(ctx, d, time);
    }
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, time: number): void {
  const { x, y, s } = d;
  switch (d.kind) {
    case 'rock':
      groundShadow(ctx, x + 2, y + 6 * s, 13 * s, 4 * s);
      ctx.fillStyle = '#9a8468';
      ctx.beginPath();
      ctx.ellipse(x, y, 13 * s, 9 * s, d.seed, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b8a283';
      ctx.beginPath();
      ctx.ellipse(x - 3 * s, y - 3 * s, 6 * s, 3.5 * s, d.seed, 0, TAU);
      ctx.fill();
      break;

    case 'cactus': {
      groundShadow(ctx, x, y + 2, 10 * s, 3.5 * s);
      ctx.fillStyle = '#4f8a3a';
      ctx.strokeStyle = '#2f5a22';
      ctx.lineWidth = 1.5;
      const parts: Array<[number, number, number, number, number]> = [
        [x - 4 * s, y - 28 * s, 8 * s, 30 * s, 4 * s],
        [x - 12 * s, y - 18 * s, 6 * s, 12 * s, 3 * s],
        [x - 12 * s, y - 10 * s, 10 * s, 5 * s, 2.5 * s],
        [x + 6 * s, y - 24 * s, 6 * s, 12 * s, 3 * s],
        [x + 2 * s, y - 15 * s, 10 * s, 5 * s, 2.5 * s],
      ];
      for (const [px, py, w, h, r] of parts) {
        ctx.beginPath();
        ctx.roundRect(px, py, w, h, r);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'rack': {
      // An abandoned server rack, half-buried in sand.
      groundShadow(ctx, x, y + 2, 16 * s, 5 * s);
      ctx.fillStyle = '#2b3040';
      ctx.strokeStyle = '#151824';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x - 11 * s, y - 36 * s, 22 * s, 38 * s, 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#1a1d28';
        ctx.fillRect(x - 8 * s, y - 33 * s + i * 7 * s, 16 * s, 5 * s);
        const on = Math.sin(time * (2 + ((d.seed * 7 + i) % 3)) + i + d.seed * 10) > 0;
        ctx.fillStyle = on ? (i % 2 ? '#5dff9a' : '#ff5a5a') : '#333844';
        ctx.fillRect(x + 4 * s, y - 32 * s + i * 7 * s, 3 * s, 2 * s);
      }
      ctx.fillStyle = '#d2ab6b';
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 15 * s, 5 * s, 0, 0, TAU);
      ctx.fill();
      break;
    }

    case 'grave':
      groundShadow(ctx, x, y + 2, 18 * s, 5 * s);
      ctx.fillStyle = '#8f8c96';
      ctx.strokeStyle = '#5e5b66';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 16 * s, y);
      ctx.lineTo(x - 16 * s, y - 22 * s);
      ctx.arc(x, y - 22 * s, 16 * s, Math.PI, 0);
      ctx.lineTo(x + 16 * s, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4a4752';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = uiFont(8 * s, 800);
      ctx.fillText('RIP', x, y - 26 * s);
      ctx.font = uiFont(6.5 * s, 700);
      ctx.fillText(d.label, x, y - 14 * s);
      break;
  }
}
