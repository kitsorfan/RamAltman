import { VIEW_W } from '../config';
import { JENSEN_COLOR, drawJensenFigure } from '../entities/jensen';
import { clamp, type Vec } from '../math';
import { TAU, dot, pixelFont, uiFont, wrapText } from './draw';

export interface LoanOfferView {
  title: string;
  pitch: string;
  gpus: number;
  bubblePct: number;
  timeLeft: number;
  duration: number;
  /** Seconds since the offer opened (drives the slide-in). */
  age: number;
  time: number;
}

export type OfferChoice = 'accept' | 'decline';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const W = 320;
const H = 196;
const HOME_X = VIEW_W - 12 - W;
const Y = 158;
const BAR_H = 22;

/** Overshooting ease, so the pop-up bounces in like an ad. */
const easeOutBack = (t: number): number => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

function layout(age: number): { win: Box; accept: Box; decline: Box; close: Box } {
  const slide = easeOutBack(clamp(age / 0.35, 0, 1));
  const x = HOME_X + (1 - slide) * (W + 24);
  return {
    win: { x, y: Y, w: W, h: H },
    accept: { x: x + 14, y: Y + H - 50, w: 168, h: 32 },
    decline: { x: x + W - 14 - 118, y: Y + H - 50, w: 118, h: 32 },
    close: { x: x + W - 22, y: Y + 4, w: 16, h: 14 },
  };
}

const inside = (p: Vec, b: Box): boolean => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

/** Which button (if any) a click at `p` (logical canvas coords) lands on. The close box counts as "no". */
export function offerButtonAt(p: Vec, age: number): OfferChoice | null {
  const l = layout(age);
  if (inside(p, l.accept)) return 'accept';
  if (inside(p, l.decline) || inside(p, l.close)) return 'decline';
  return null;
}

/** Jensen's loan offer, styled as a pushy pop-up ad. */
export function drawLoanOffer(ctx: CanvasRenderingContext2D, v: LoanOfferView): void {
  const { win, accept, decline, close } = layout(v.age);
  const { x, y } = win;
  ctx.save();

  // Window with a drop shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 7, W, H, 8);
  ctx.fill();
  ctx.fillStyle = '#f6f3ff';
  ctx.strokeStyle = '#2a0f3d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, W, H, 8);
  ctx.fill();
  ctx.stroke();

  // Title bar.
  const bar = ctx.createLinearGradient(x, 0, x + W, 0);
  bar.addColorStop(0, '#3d8a1f');
  bar.addColorStop(1, JENSEN_COLOR);
  ctx.fillStyle = bar;
  ctx.beginPath();
  ctx.roundRect(x, y, W, BAR_H, [8, 8, 0, 0]);
  ctx.fill();
  ctx.font = pixelFont(8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`JENSEN CAPITAL · ${v.title}`, x + 10, y + BAR_H / 2 + 1);
  ctx.fillStyle = '#ff5d73';
  ctx.beginPath();
  ctx.roundRect(close.x, close.y, close.w, close.h, 3);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(close.x + 5, close.y + 4);
  ctx.lineTo(close.x + close.w - 5, close.y + close.h - 4);
  ctx.moveTo(close.x + close.w - 5, close.y + 4);
  ctx.lineTo(close.x + 5, close.y + close.h - 4);
  ctx.stroke();

  // Portrait: Jensen on stage, GPU held high.
  const px = x + 50;
  const py = y + 82;
  ctx.fillStyle = '#e4f6d3';
  ctx.strokeStyle = JENSEN_COLOR;
  ctx.lineWidth = 2;
  dot(ctx, px, py, 38);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, 37, 0, TAU);
  ctx.clip();
  ctx.translate(px, py + 20);
  ctx.scale(1.2, 1.2);
  drawJensenFigure(ctx, 0, 0, 17, { x: 0, y: 0.3 }, Math.sin(v.time * 3) * 0.8, true, v.time);
  ctx.restore();

  // "0% APR*" starburst sticker.
  drawSticker(ctx, x + 22, y + 114, v.time);

  // The pitch and the terms.
  const tx = x + 100;
  const tw = W - 112;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = uiFont(14, 800);
  ctx.fillStyle = '#1b1b24';
  let ty = wrapText(ctx, `“${v.pitch}”`, tx, y + 42, tw, 17);
  ty += 2;
  const terms: Array<[string, string]> = [
    [`+${v.gpus} GPUs, delivered now`, '#1f8a4c'],
    [`AI bubble +${v.bubblePct}% (circular deal)`, '#d6336c'],
    ['GPUs run hot', '#e8590c'],
  ];
  ctx.font = uiFont(12, 700);
  for (const [text, color] of terms) {
    ctx.fillStyle = color;
    ctx.fillText(`• ${text}`, tx, ty);
    ty += 15;
  }
  ctx.font = uiFont(10, 600);
  ctx.fillStyle = '#7a7290';
  ctx.fillText('*Repayment due when the bubble pops.', tx, Math.min(ty + 1, accept.y - 6));

  // Buttons.
  const throb = 1 + 0.04 * Math.sin(v.time * 9);
  ctx.save();
  ctx.translate(accept.x + accept.w / 2, accept.y + accept.h / 2);
  ctx.scale(throb, throb);
  button(ctx, -accept.w / 2, -accept.h / 2, accept.w, accept.h, '#2fbf6a', '#0d4a27', 'Y', 'TAKE THE DEAL');
  ctx.restore();
  button(ctx, decline.x, decline.y, decline.w, decline.h, '#c9c3d9', '#5e5672', 'X', 'NO THANKS');

  // Countdown: the offer expires on its own.
  const f = clamp(v.timeLeft / v.duration, 0, 1);
  ctx.fillStyle = 'rgba(42, 15, 61, 0.15)';
  ctx.fillRect(x + 14, y + H - 12, W - 28, 4);
  ctx.fillStyle = f < 0.3 ? '#ff5d73' : '#3d8a1f';
  ctx.fillRect(x + 14, y + H - 12, (W - 28) * f, 4);
  ctx.restore();
}

function button(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  edge: string,
  key: string,
  label: string,
): void {
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.roundRect(x, y + 3, w, h, 7);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x + 7, y + 7, 18, 18, 4);
  ctx.fill();
  ctx.font = pixelFont(8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = edge;
  ctx.fillText(key, x + 16, y + 17);
  ctx.font = uiFont(12, 800);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + 25 + (w - 25) / 2, y + h / 2 + 1);
}

function drawSticker(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.3 + Math.sin(time * 4) * 0.06);
  ctx.fillStyle = '#ffe066';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    const r = i % 2 === 0 ? 22 : 17;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a1f00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = pixelFont(7);
  ctx.fillText('0%', 0, -4);
  ctx.fillText('APR*', 0, 6);
  ctx.restore();
}
