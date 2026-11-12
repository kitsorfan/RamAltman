import { COMBO_WINDOW, SOLAR_MAX, VIEW_H, VIEW_W, WORLD_H, WORLD_W, seriesName } from '../config';
import type { Rival, Team } from '../entities/rivals';
import type { WaterSource } from '../entities/water';
import { clamp, type Vec } from '../math';
import { TAU, dot, outlinedText, pixelFont, uiFont } from './draw';

export interface HudData {
  score: number;
  highScore: number;
  level: number;
  lives: number;
  heat: number;
  power: number;
  ram: number;
  target: number;
  bubble: number;
  bubbleLeft: number;
  combo: number;
  comboTimer: number;
  teams: readonly Team[];
  playerTeam: Team;
  time: number;
  muted: boolean;
  musicOn: boolean;
  ramPulse: number;
  scorePulse: number;
  energyPulse: number;
  bubblePulse: number;
  /** Why the bubble just jumped (shown while bubblePulse glows). */
  bubbleNote: string;
  news: NewsView;
  /** Hype tweet recharge, 0 (just posted) to 1 (ready). */
  tweetReady: number;
  solar: SolarState;
}

/** The solar panels: not needed yet, ready (energy is low), unfolding, or charging. */
export type SolarState = 'locked' | 'ready' | 'unfolding' | 'charging';

/** The ticker under the bubble meter: a headline, or a breaking story in progress. */
export interface NewsView {
  headline: string | null;
  /** Seconds the headline has been showing. */
  headlineAge: number;
  story: { title: string; rule: string; timeLeft: number; duration: number } | null;
}

// Status panel layout, exported so pickups can fly to the right HUD element.
const PANEL_X = 12;
const PANEL_Y = 12;
const BAR_X = PANEL_X + 12 + 62;
const BAR_W = 176;
export const HUD_SCORE: Vec = { x: PANEL_X + 70, y: PANEL_Y + 35 };
export const HUD_ENERGY_BAR = { x: BAR_X, y: PANEL_Y + 90, w: BAR_W, h: 11 } as const;
export const HUD_RAM_BAR = { x: BAR_X, y: PANEL_Y + 108, w: BAR_W, h: 11 } as const;

export interface MinimapData {
  player: Vec;
  cam: Vec;
  rivals: readonly Rival[];
  water: readonly WaterSource[];
  pingTarget: WaterSource | null;
  /** Jensen, while he's visiting. */
  jensen: Vec | null;
  time: number;
}

const blink = (time: number, hz = 4): boolean => Math.floor(time * hz) % 2 === 0;

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(14, 10, 30, 0.74)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  ctx.fill();
}

function meter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  fill: string,
  label: string,
  warn: boolean,
  valueText?: string,
): void {
  ctx.font = pixelFont(8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = warn ? '#ff8a7a' : '#c9c3e6';
  ctx.fillText(label, x, y + h / 2 + 1);
  const bx = x + 62;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.roundRect(bx, y, w, h, 4);
  ctx.fill();
  const f = clamp(frac, 0, 1);
  if (f > 0.01) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(bx, y, w * f, h, 4);
    ctx.fill();
  }
  if (valueText) {
    ctx.textAlign = 'center';
    outlinedText(ctx, valueText, bx + w / 2, y + h / 2 + 1, '#ffffff', 'rgba(10, 6, 20, 0.9)', 3);
  }
}

export function drawHud(ctx: CanvasRenderingContext2D, d: HudData): void {
  drawStatusPanel(ctx, d);
  drawTweetChip(ctx, d);
  drawSolarChip(ctx, d);
  drawBubbleMeter(ctx, d);
  drawNews(ctx, d);
  drawLeaderboard(ctx, d);
  drawCombo(ctx, d);

  ctx.font = uiFont(12, 600);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  outlinedText(
    ctx,
    `WASD move · SHIFT sprint · SPACE shove · E sonar · T tweet · R solar · P pause · M ${d.muted ? 'unmute' : 'mute'} · N music ${d.musicOn ? 'off' : 'on'}`,
    VIEW_W - 14,
    VIEW_H - 14,
    'rgba(255, 255, 255, 0.8)',
  );
}

function drawStatusPanel(ctx: CanvasRenderingContext2D, d: HudData): void {
  const x = PANEL_X;
  const y = PANEL_Y;
  const w = 262;
  panel(ctx, x, y, w, 128);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = pixelFont(8);
  ctx.fillStyle = '#a99fd0';
  ctx.fillText('SCORE', x + 12, y + 20);
  const sp = 1 + 0.18 * d.scorePulse;
  ctx.save();
  ctx.translate(x + 12, y + 41);
  ctx.scale(sp, sp);
  ctx.font = pixelFont(14);
  ctx.fillStyle = d.scorePulse > 0 ? '#fff3b0' : '#ffffff';
  ctx.fillText(String(d.score).padStart(7, '0'), 0, 0);
  ctx.restore();

  for (let i = 0; i < d.lives; i++) heart(ctx, x + w - 20 - i * 20, y + 24, 7, '#ff5d73');

  ctx.font = pixelFont(8);
  ctx.fillStyle = '#a99fd0';
  ctx.fillText(`SERIES ${seriesName(d.level)}`, x + 12, y + 60);
  ctx.textAlign = 'right';
  ctx.fillText(`HI ${String(Math.max(d.highScore, d.score)).padStart(7, '0')}`, x + w - 12, y + 60);

  const heat = d.heat / 100;
  const heatColor = heat < 0.5 ? '#ffb347' : heat < 0.75 ? '#ff7a3c' : '#ff3b3b';
  meter(ctx, x + 12, y + 72, BAR_W, 11, heat, heatColor, 'HEAT', d.heat > 75 && blink(d.time));
  meter(ctx, x + 12, HUD_ENERGY_BAR.y, BAR_W, 11, d.power / 100, '#ffd84d', 'ENERGY', d.power < 20 && blink(d.time));
  meter(ctx, x + 12, HUD_RAM_BAR.y, BAR_W, 11, d.ram / d.target, '#5dff9a', 'RAM', false, `${d.ram}/${d.target}`);
  barGlow(ctx, HUD_ENERGY_BAR, d.energyPulse, '255, 233, 77');
  barGlow(ctx, HUD_RAM_BAR, d.ramPulse, '93, 255, 154');
  if (d.solar === 'unfolding' || d.solar === 'charging') {
    // How far the sun will take you.
    const mx = HUD_ENERGY_BAR.x + HUD_ENERGY_BAR.w * (SOLAR_MAX / 100);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 1, HUD_ENERGY_BAR.y - 3, 2, HUD_ENERGY_BAR.h + 6);
  }
}

/** Flash around a bar when a pickup lands in it. */
function barGlow(
  ctx: CanvasRenderingContext2D,
  bar: { x: number; y: number; w: number; h: number },
  pulse: number,
  rgb: string,
): void {
  if (pulse <= 0) return;
  const e = 3 * pulse;
  ctx.strokeStyle = `rgba(${rgb}, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bar.x - e, bar.y - e, bar.w + e * 2, bar.h + e * 2, 6);
  ctx.stroke();
}

interface Chip {
  key: string;
  label: string;
  /** How full the chip is, 0 to 1. */
  fill: number;
  /** Bright and pulsing: you can use it right now. */
  ready: boolean;
  /** Fill color as "r, g, b". */
  rgb: string;
  /** Label color when ready. */
  color: string;
}

/** A small key + label chip under the status panel, filling up as an ability recharges. */
function drawChip(ctx: CanvasRenderingContext2D, y: number, c: Chip, time: number): void {
  const x = PANEL_X;
  const w = 150;
  const h = 22;
  panel(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = c.ready ? `rgba(${c.rgb}, ${0.3 + 0.12 * Math.sin(time * 5)})` : `rgba(${c.rgb}, 0.16)`;
  ctx.fillRect(x, y, w * clamp(c.fill, 0, 1), h);
  ctx.restore();

  ctx.fillStyle = c.ready ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 4, 14, 14, 3);
  ctx.fill();
  ctx.font = pixelFont(7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a0f3d';
  ctx.fillText(c.key, x + 13, y + 12);
  ctx.textAlign = 'left';
  ctx.fillStyle = c.ready ? c.color : '#8d86ad';
  ctx.fillText(c.label, x + 28, y + 12);
}

/** Under the status panel: is the hype tweet ready yet? */
function drawTweetChip(ctx: CanvasRenderingContext2D, d: HudData): void {
  const ready = d.tweetReady >= 1;
  drawChip(
    ctx,
    PANEL_Y + 134,
    { key: 'T', label: ready ? 'HYPE TWEET' : 'DRAFTING…', fill: d.tweetReady, ready, rgb: '79, 184, 255', color: '#bfeaff' },
    d.time,
  );
}

const SOLAR_LABELS: Readonly<Record<SolarState, string>> = {
  locked: 'SOLAR PANELS',
  ready: 'SOLAR READY!',
  unfolding: 'UNFOLDING…',
  charging: 'CHARGING…',
};

/** Under the tweet chip: the solar panels light up once energy runs low, then fill toward the sun's limit. */
function drawSolarChip(ctx: CanvasRenderingContext2D, d: HudData): void {
  const s = d.solar;
  const fill = s === 'locked' ? 0 : s === 'ready' ? 1 : d.power / SOLAR_MAX;
  drawChip(
    ctx,
    PANEL_Y + 162,
    { key: 'R', label: SOLAR_LABELS[s], fill, ready: s !== 'locked', rgb: '255, 201, 60', color: '#ffe08a' },
    d.time,
  );
}

const TICKER_W = 400;
const TICKER_X = VIEW_W / 2 - TICKER_W / 2;
const TICKER_Y = 68;

function drawNews(ctx: CanvasRenderingContext2D, d: HudData): void {
  const n = d.news;
  if (n.story) {
    drawStory(ctx, n.story, d.time);
    return;
  }
  if (!n.headline) return;
  const h = 20;
  const x = TICKER_X;
  const y = TICKER_Y;
  ctx.fillStyle = 'rgba(14, 10, 30, 0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, TICKER_W, h, 6);
  ctx.fill();
  ctx.fillStyle = '#d6264a';
  ctx.beginPath();
  ctx.roundRect(x, y, 46, h, [6, 0, 0, 6]);
  ctx.fill();
  ctx.font = pixelFont(7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('NEWS', x + 23, y + h / 2 + 1);

  // Each new headline flips up into place; one that doesn't fit scrolls slowly to its end.
  const left = x + 54;
  const avail = TICKER_W - 60;
  ctx.font = uiFont(12, 700);
  const tw = ctx.measureText(n.headline).width;
  const k = clamp(n.headlineAge / 0.25, 0, 1);
  const scroll = tw > avail ? clamp((n.headlineAge - 1.2) * 45, 0, tw - avail) : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left - 2, y, avail + 4, h);
  ctx.clip();
  ctx.globalAlpha = k;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText(n.headline, left - scroll, y + h / 2 + 1 + (1 - k) * 12);
  ctx.restore();
}

/** A breaking story: what happened, what it means, and how long it lasts. */
function drawStory(ctx: CanvasRenderingContext2D, s: NonNullable<NewsView['story']>, time: number): void {
  const x = TICKER_X;
  const y = TICKER_Y;
  const h = 44;
  ctx.fillStyle = 'rgba(58, 6, 22, 0.92)';
  ctx.strokeStyle = '#ff3b5c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, TICKER_W, h, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = blink(time, 3) ? '#ff3b5c' : '#c41e3f';
  ctx.beginPath();
  ctx.roundRect(x, y, 82, 20, [6, 0, 6, 0]);
  ctx.fill();
  ctx.font = pixelFont(7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('BREAKING', x + 41, y + 11);

  ctx.textAlign = 'left';
  ctx.font = pixelFont(9);
  outlinedText(ctx, s.title, x + 92, y + 11, '#ffe066', 'rgba(10, 6, 20, 0.9)', 3);
  ctx.textAlign = 'right';
  ctx.font = pixelFont(8);
  ctx.fillStyle = '#ffd6de';
  ctx.fillText(`${Math.max(0, Math.ceil(s.timeLeft))}s`, x + TICKER_W - 8, y + 11);

  ctx.textAlign = 'center';
  ctx.font = uiFont(12, 700);
  if (ctx.measureText(s.rule).width > TICKER_W - 16) ctx.font = uiFont(11, 700);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(s.rule, x + TICKER_W / 2, y + 30);

  const f = clamp(s.timeLeft / s.duration, 0, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x + 8, y + h - 5, TICKER_W - 16, 2);
  ctx.fillStyle = '#ff3b5c';
  ctx.fillRect(x + 8, y + h - 5, (TICKER_W - 16) * f, 2);
}

function drawBubbleMeter(ctx: CanvasRenderingContext2D, d: HudData): void {
  const w = 340;
  const h = 50;
  const danger = d.bubble > 0.85;
  const x = VIEW_W / 2 - w / 2 + (danger ? (Math.random() - 0.5) * 3 : 0);
  const y = 12 + (danger ? (Math.random() - 0.5) * 3 : 0);
  panel(ctx, x, y, w, h);

  ctx.font = pixelFont(8);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const jumped = d.bubblePulse > 0;
  ctx.fillStyle = (danger || jumped) && blink(d.time) ? '#ff5d73' : '#ffb3e6';
  ctx.fillText(danger ? 'AI BUBBLE: ABOUT TO POP!' : jumped ? `AI BUBBLE: ${d.bubbleNote}` : 'AI BUBBLE', x + 14, y + 20);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.max(0, Math.ceil(d.bubbleLeft))}s`, x + w - 14, y + 20);

  const bx = x + 14;
  const by = y + 29;
  const bw = w - 28;
  const bh = 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 6);
  ctx.fill();
  barGlow(ctx, { x: bx, y: by, w: bw, h: bh }, d.bubblePulse, '255, 95, 162');
  const f = clamp(d.bubble, 0, 1);
  if (f > 0.01) {
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#ff9ad5');
    g.addColorStop(0.7, '#ff5fa2');
    g.addColorStop(1, '#ff2d55');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw * f, bh, 6);
    ctx.fill();
  }

  // The bubble itself rides the end of the bar and grows as it inflates.
  const ix = bx + bw * f;
  const iy = by + bh / 2;
  const ir = 7 + 7 * f + Math.sin(d.time * 6) * 0.8;
  const bg = ctx.createRadialGradient(ix - ir * 0.35, iy - ir * 0.35, ir * 0.1, ix, iy, ir);
  bg.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  bg.addColorStop(0.4, 'rgba(255, 170, 230, 0.45)');
  bg.addColorStop(1, 'rgba(180, 120, 255, 0.55)');
  ctx.fillStyle = bg;
  dot(ctx, ix, iy, ir);
  ctx.strokeStyle = 'rgba(255, 220, 250, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLeaderboard(ctx: CanvasRenderingContext2D, d: HudData): void {
  const rows = d.teams.toSorted((a, b) => b.ram - a.ram);
  const rowH = 18;
  const w = 236;
  const h = 32 + rows.length * rowH + 4;
  const x = 12;
  const y = VIEW_H - 12 - h;
  panel(ctx, x, y, w, h);

  ctx.font = pixelFont(8);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a99fd0';
  ctx.fillText('MARKET SHARE (RAM)', x + 12, y + 20);

  const total = Math.max(1, rows.reduce((s, t) => s + t.ram, 0));
  rows.forEach((t, i) => {
    const ry = y + 30 + i * rowH;
    const isPlayer = t === d.playerTeam;
    if (isPlayer) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.beginPath();
      ctx.roundRect(x + 6, ry - 1, w - 12, rowH - 1, 4);
      ctx.fill();
    }
    ctx.fillStyle = t.color;
    dot(ctx, x + 16, ry + 8, 4);
    ctx.font = uiFont(12, isPlayer ? 800 : 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isPlayer ? '#ffffff' : '#ddd6f3';
    ctx.fillText(t.name, x + 26, ry + 8);

    const barX = x + 122;
    const barW = 66;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, ry + 5, barW, 6);
    ctx.fillStyle = t.color;
    ctx.fillRect(barX, ry + 5, barW * (t.ram / total), 6);

    ctx.font = pixelFont(8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(t.ram), x + w - 12, ry + 9);
  });
}

function drawCombo(ctx: CanvasRenderingContext2D, d: HudData): void {
  if (d.combo < 2) return;
  const x = VIEW_W / 2;
  const y = VIEW_H - 56;
  const s = 1 + 0.08 * Math.sin(d.time * 12);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.font = pixelFont(16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  outlinedText(ctx, `COMBO x${d.combo}`, 0, 0, '#ffe066', '#3a1a00', 5);
  ctx.restore();
  const bw = 120 * clamp(d.comboTimer / COMBO_WINDOW, 0, 1);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(x - bw / 2, y + 16, bw, 4);
}

export function drawMinimap(ctx: CanvasRenderingContext2D, d: MinimapData): void {
  const w = 180;
  const h = 135;
  const x = VIEW_W - w - 12;
  const y = 12;
  const sx = w / WORLD_W;
  const sy = h / WORLD_H;
  panel(ctx, x, y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.clip();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + d.cam.x * sx, y + d.cam.y * sy, VIEW_W * sx, VIEW_H * sy);

  for (const wtr of d.water) {
    if (!wtr.discovered) continue;
    const isPing = wtr === d.pingTarget;
    ctx.fillStyle = isPing && blink(d.time, 6) ? '#ffffff' : '#4fb8ff';
    dot(ctx, x + wtr.pos.x * sx, y + wtr.pos.y * sy, Math.max(2.5, wtr.radius * sx * 1.3));
  }

  for (const r of d.rivals) {
    ctx.fillStyle = r.team.color;
    dot(ctx, x + r.pos.x * sx, y + r.pos.y * sy, r.radius > 12 ? 3 : 2);
  }

  if (d.jensen) {
    const jx = x + d.jensen.x * sx;
    const jy = y + d.jensen.y * sy;
    ctx.strokeStyle = 'rgba(155, 225, 93, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(jx, jy, 3 + ((d.time * 6) % 5), 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#9be15d';
    dot(ctx, jx, jy, 3);
  }

  const px = x + d.player.x * sx;
  const py = y + d.player.y * sy;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(px, py, 4 + ((d.time * 8) % 6), 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  dot(ctx, px, py, 3.5);
  ctx.restore();
}
