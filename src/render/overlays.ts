import { CREDIT_TEXT, VIEW_H, VIEW_W, seriesName } from '../config';
import { clamp } from '../math';
import { outlinedText, pixelFont, uiFont } from './draw';

export interface LevelClearInfo {
  level: number;
  ram: number;
  target: number;
  gpus: number;
  timeBonus: number;
  leaderBonus: number;
  rank: number;
  score: number;
  /** A one-liner under the title. */
  quip: string;
}

export interface GameOverInfo {
  title: string;
  sub: string;
  score: number;
  highScore: number;
  newHigh: boolean;
  level: number;
}

const blinkOn = (time: number): boolean => Math.floor(time * 2.5) % 2 === 0;

function dim(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.fillStyle = `rgba(8, 4, 18, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function card(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string): { x: number; y: number } {
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = 'rgba(20, 12, 40, 0.94)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  return { x, y };
}

export function drawBanner(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub: string,
  alpha: number,
  color = '#ffe066',
): void {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = pixelFont(30);
  outlinedText(ctx, title, VIEW_W / 2, 196, color, '#2a0f3d', 8);
  ctx.font = uiFont(18, 700);
  outlinedText(ctx, sub, VIEW_W / 2, 234, '#ffffff', 'rgba(10, 6, 20, 0.9)', 4);
  ctx.restore();
}

export function drawPaused(ctx: CanvasRenderingContext2D): void {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = pixelFont(28);
  outlinedText(ctx, 'PAUSED', VIEW_W / 2, VIEW_H / 2 - 16, '#ffffff', '#2a0f3d', 6);
  ctx.font = uiFont(16, 600);
  ctx.fillStyle = '#d9d2f2';
  ctx.fillText('Press P to resume  ·  M sound  ·  N music', VIEW_W / 2, VIEW_H / 2 + 28);
}

export function drawLevelClear(ctx: CanvasRenderingContext2D, info: LevelClearInfo, time: number): void {
  dim(ctx, 0.5);
  const w = 560;
  const h = 400;
  const { x, y } = card(ctx, w, h, '#5dff9a');
  const cx = VIEW_W / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = pixelFont(20);
  outlinedText(ctx, `SERIES ${seriesName(info.level)} CLOSED!`, cx, y + 54, '#5dff9a', '#0b2a18', 5);
  ctx.font = uiFont(15, 600);
  ctx.fillStyle = '#d9d2f2';
  ctx.fillText(info.quip, cx, y + 86);

  const rows: Array<[string, string]> = [
    ['RAM secured', `${info.ram} / ${info.target}`],
    ['GPUs grabbed', String(info.gpus)],
    ['Time bonus', `+${info.timeBonus}`],
    ['Market rank', info.leaderBonus > 0 ? `#1  +${info.leaderBonus}` : `#${info.rank}`],
    ['Score', String(info.score)],
  ];
  rows.forEach(([label, value], i) => {
    const ry = y + 130 + i * 30;
    ctx.textAlign = 'left';
    ctx.font = uiFont(16, 600);
    ctx.fillStyle = '#bdb3e0';
    ctx.fillText(label, x + 70, ry);
    ctx.textAlign = 'right';
    ctx.font = pixelFont(12);
    ctx.fillStyle = i === rows.length - 1 ? '#ffe066' : '#ffffff';
    ctx.fillText(value, x + w - 70, ry);
  });

  ctx.textAlign = 'center';
  if (info.leaderBonus === 0) {
    ctx.font = uiFont(13, 600);
    ctx.fillStyle = '#ffb3b3';
    ctx.fillText('Tip: finish a series as #1 in market share for a +2,500 bonus.', cx, y + h - 70);
  }
  if (blinkOn(time)) {
    ctx.font = pixelFont(12);
    outlinedText(ctx, `PRESS ENTER FOR SERIES ${seriesName(info.level + 1)}`, cx, y + h - 32, '#ffe066', '#2a0f3d', 4);
  }
}

export function drawGameOver(ctx: CanvasRenderingContext2D, info: GameOverInfo, time: number): void {
  dim(ctx, 0.6);
  const w = 580;
  const h = 380;
  const { y } = card(ctx, w, h, '#ff5d73');
  const cx = VIEW_W / 2;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = pixelFont(22);
  outlinedText(ctx, info.title, cx, y + 62, '#ff5d73', '#2a0010', 5);
  ctx.font = uiFont(16, 600);
  ctx.fillStyle = '#e6dcf5';
  ctx.fillText(info.sub, cx, y + 98);
  ctx.fillStyle = '#bdb3e0';
  ctx.font = uiFont(15, 600);
  ctx.fillText(`You made it to Series ${seriesName(info.level)}.`, cx, y + 136);

  ctx.font = pixelFont(10);
  ctx.fillStyle = '#a99fd0';
  ctx.fillText('FINAL SCORE', cx, y + 180);
  ctx.font = pixelFont(28);
  outlinedText(ctx, String(info.score), cx, y + 222, '#ffffff', '#2a0f3d', 5);

  if (info.newHigh) {
    if (blinkOn(time * 2)) {
      ctx.font = pixelFont(12);
      outlinedText(ctx, 'NEW HIGH SCORE!', cx, y + 260, '#ffe066', '#2a0f3d', 4);
    }
  } else {
    ctx.font = pixelFont(10);
    ctx.fillStyle = '#a99fd0';
    ctx.fillText(`HIGH SCORE ${info.highScore}`, cx, y + 260);
  }

  if (blinkOn(time)) {
    ctx.font = pixelFont(12);
    outlinedText(ctx, 'PRESS ENTER TO RAISE AGAIN', cx, y + h - 40, '#ffe066', '#2a0f3d', 4);
  }
  ctx.font = uiFont(12, 700);
  ctx.fillStyle = '#a99fd0';
  ctx.fillText(CREDIT_TEXT, cx, y + h - 14);
}
