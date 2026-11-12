import { SOLAR_SETUP } from '../config';
import { TAU, dot, groundShadow } from './draw';

/** Where the sun hangs once it's up, relative to Sam. */
export const SUN_OFFSET = { x: 58, y: -132 } as const;
/** Where each panel sits, relative to Sam. */
export const PANEL_OFFSETS = [
  { x: -34, y: 0 },
  { x: 34, y: 0 },
] as const;

const PANEL_W = 28;
const PANEL_H = 15;
const LEAN = 5; // the top edge tilts toward the sun

const ease = (k: number): number => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

/** How far the panels have unfolded, 0 to 1. */
export const unfold = (solarTime: number): number => ease(solarTime / SOLAR_SETUP);

function panelPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy + PANEL_H / 2);
  ctx.lineTo(cx + w / 2, cy + PANEL_H / 2);
  ctx.lineTo(cx + w / 2 + LEAN, cy - PANEL_H / 2);
  ctx.lineTo(cx - w / 2 + LEAN, cy - PANEL_H / 2);
  ctx.closePath();
}

/** Two little panels on stands either side of Sam. They unfold sideways, then a glint sweeps across. */
export function drawPanels(ctx: CanvasRenderingContext2D, x: number, y: number, solarTime: number, time: number): void {
  const k = unfold(solarTime);
  const w = Math.max(2, PANEL_W * k);
  ctx.save();
  PANEL_OFFSETS.forEach((o, i) => {
    const cx = x + o.x;
    const cy = y + o.y;
    const base = cy + 14;
    groundShadow(ctx, cx + 2, base, 4 + 10 * k);

    ctx.strokeStyle = '#5d6470';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx + 1, cy + PANEL_H / 2);
    ctx.stroke();

    panelPath(ctx, cx, cy, w);
    ctx.fillStyle = '#1f3f8f';
    ctx.fill();

    // Solar cells: a 3 x 2 grid.
    ctx.save();
    panelPath(ctx, cx, cy, w);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120, 170, 255, 0.7)';
    ctx.lineWidth = 1;
    for (let c = 1; c < 3; c++) {
      const f = c / 3;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + w * f, cy + PANEL_H / 2);
      ctx.lineTo(cx - w / 2 + w * f + LEAN, cy - PANEL_H / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 2, cy);
    ctx.lineTo(cx + w / 2 + LEAN + 2, cy);
    ctx.stroke();

    // A glint sweeps across once they're out.
    if (k >= 1) {
      const g = ((time * 0.9 + i * 0.45) % 1.6) - 0.3;
      const gx = cx - w / 2 + (w + LEAN) * g;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(gx, cy + PANEL_H / 2);
      ctx.lineTo(gx + 5, cy + PANEL_H / 2);
      ctx.lineTo(gx + 5 + LEAN, cy - PANEL_H / 2);
      ctx.lineTo(gx + LEAN, cy - PANEL_H / 2);
      ctx.fill();
    }
    ctx.restore();

    panelPath(ctx, cx, cy, w);
    ctx.strokeStyle = '#d7deea';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  ctx.restore();
}

/** A cartoon sun in shades that rises over Sam while the panels unfold, then beams down on them. */
export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, solarTime: number, time: number): void {
  const k = unfold(solarTime);
  const sx = x + SUN_OFFSET.x;
  const sy = y + SUN_OFFSET.y * (0.55 + 0.45 * k);
  ctx.save();
  ctx.globalAlpha = k;

  // Sunbeams onto each panel.
  if (k >= 1) {
    const flicker = 0.85 + 0.15 * Math.sin(time * 7);
    for (const o of PANEL_OFFSETS) {
      const px = x + o.x + LEAN / 2;
      const py = y + o.y;
      const g = ctx.createLinearGradient(sx, sy, px, py);
      g.addColorStop(0, `rgba(255, 236, 140, ${0.32 * flicker})`);
      g.addColorStop(1, `rgba(255, 236, 140, ${0.1 * flicker})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy);
      ctx.lineTo(sx + 6, sy);
      ctx.lineTo(px + PANEL_W / 2, py);
      ctx.lineTo(px - PANEL_W / 2, py);
      ctx.closePath();
      ctx.fill();
    }
  }

  const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 52);
  glow.addColorStop(0, 'rgba(255, 220, 90, 0.55)');
  glow.addColorStop(1, 'rgba(255, 220, 90, 0)');
  ctx.fillStyle = glow;
  dot(ctx, sx, sy, 52);

  // Rays, turning slowly.
  ctx.fillStyle = '#ffc93c';
  const spin = time * 0.6;
  for (let i = 0; i < 12; i++) {
    const a = spin + (i / 12) * TAU;
    const len = 26 + (i % 2 ? 4 : 0) + 2 * Math.sin(time * 5 + i);
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a - 0.14) * 16, sy + Math.sin(a - 0.14) * 16);
    ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    ctx.lineTo(sx + Math.cos(a + 0.14) * 16, sy + Math.sin(a + 0.14) * 16);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd84d';
  dot(ctx, sx, sy, 17);
  ctx.fillStyle = '#fff3b0';
  dot(ctx, sx - 4, sy - 5, 7);

  // It's the desert. The sun wears shades.
  ctx.fillStyle = '#1b1b24';
  ctx.beginPath();
  ctx.roundRect(sx - 11, sy - 4, 9, 6, 2);
  ctx.roundRect(sx + 2, sy - 4, 9, 6, 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1b24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - 2, sy - 2);
  ctx.lineTo(sx + 2, sy - 2);
  ctx.stroke();
  ctx.strokeStyle = '#a8551e';
  ctx.beginPath();
  ctx.arc(sx, sy + 4, 5, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.restore();
}
