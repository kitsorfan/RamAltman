import type { Vec } from '../math';

export const TAU = Math.PI * 2;

const PIXEL_FAMILY = '"Press Start 2P", ui-monospace, monospace';
const UI_FAMILY = '"Segoe UI", "Trebuchet MS", system-ui, sans-serif';

export const pixelFont = (size: number): string => `${size}px ${PIXEL_FAMILY}`;
export const uiFont = (size: number, weight = 600): string => `${weight} ${size}px ${UI_FAMILY}`;

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry = rx * 0.35): void {
  ctx.fillStyle = 'rgba(70, 45, 15, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string | CanvasGradient,
  stroke = 'rgba(10, 6, 20, 0.85)',
  width = 3,
): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function speechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, accent: string): void {
  ctx.save();
  ctx.font = uiFont(12, 700);
  const w = ctx.measureText(text).width + 18;
  const h = 22;
  const bx = x - w / 2;
  const by = y - h - 8;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, by + h - 1.5);
  ctx.lineTo(x, by + h + 7);
  ctx.lineTo(x + 6, by + h - 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b1b24';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + h / 2 + 1);
  ctx.restore();
}

/** Draws word-wrapped text and returns the y of the next line. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  let line = '';
  let yy = y;
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy + lineHeight;
}

export function droplet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 0.1, x + s * 0.8, y + s, x, y + s);
  ctx.bezierCurveTo(x - s * 0.8, y + s, x - s * 0.9, y - s * 0.1, x, y - s);
  ctx.closePath();
}

/**
 * The classic "clearing out my desk" cardboard box, held in both hands at chest height.
 * Sam's (fired) has a desk plant poking out; Jensen's (stepping down) is full of GPUs.
 */
export function drawCardboardBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  skin: string,
  contents: 'plant' | 'gpus',
): void {
  const bx = x - 13;
  const by = y + 4;
  if (contents === 'plant') {
    ctx.strokeStyle = '#3e7d32';
    ctx.lineWidth = 2;
    for (const [dx, lean] of [[5, -0.3], [8, 0.2], [11, 0.7]] as const) {
      const sway = Math.sin(time * 3 + dx) * 1.2;
      ctx.beginPath();
      ctx.moveTo(x + dx, by + 2);
      ctx.quadraticCurveTo(x + dx + lean * 3, by - 5, x + dx + lean * 6 + sway, by - 9);
      ctx.stroke();
    }
  } else {
    for (const [dx, tilt] of [[-6, -0.25], [4, 0.2]] as const) {
      ctx.save();
      ctx.translate(x + dx, by - 1);
      ctx.rotate(tilt + Math.sin(time * 5 + dx) * 0.04);
      ctx.fillStyle = '#2b2f3a';
      ctx.strokeStyle = '#9be15d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-6, -7, 12, 8, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#151820';
      dot(ctx, -2.5, -3, 2);
      dot(ctx, 2.5, -3, 2);
      ctx.restore();
    }
  }
  ctx.fillStyle = '#c99a5b';
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, 26, 15, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + 3, by + 4);
  ctx.lineTo(bx + 23, by + 4);
  ctx.stroke();
  ctx.fillStyle = skin;
  dot(ctx, bx + 1, by + 8, 3.5);
  dot(ctx, bx + 25, by + 8, 3.5);
}

export interface ChibiStyle {
  body: string;
  trim: string;
  skin: string;
  hair: string;
  hairStyle: 'short' | 'curly' | 'swept';
}

export interface HeadInfo {
  x: number;
  y: number;
  r: number;
}

/** Shared cartoon body used by the player and the human rivals. Returns head geometry for accessories. */
export function drawChibi(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  style: ChibiStyle,
  look: Vec,
  bob: number,
): HeadInfo {
  const by = y + bob;

  ctx.lineWidth = 2;
  ctx.fillStyle = style.body;
  ctx.strokeStyle = style.trim;
  ctx.beginPath();
  ctx.ellipse(x, by + r * 0.3, r * 0.85, r * 0.72, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  const head: HeadInfo = { x: x + look.x * r * 0.08, y: by - r * 0.55, r: r * 0.62 };
  ctx.fillStyle = style.skin;
  ctx.strokeStyle = 'rgba(90, 55, 30, 0.55)';
  ctx.lineWidth = 1.5;
  dot(ctx, head.x, head.y, head.r);
  ctx.stroke();

  ctx.fillStyle = style.hair;
  if (style.hairStyle === 'curly') {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1 + i / 6);
      dot(ctx, head.x + Math.cos(a) * head.r * 0.82, head.y + Math.sin(a) * head.r * 0.82, head.r * 0.36);
    }
  } else {
    ctx.beginPath();
    ctx.arc(head.x, head.y, head.r * 1.04, Math.PI * 1.02, Math.PI * 1.98);
    if (style.hairStyle === 'swept') {
      ctx.quadraticCurveTo(head.x + head.r * 0.6, head.y - head.r * 0.1, head.x - head.r * 0.2, head.y - head.r * 0.35);
    } else {
      ctx.quadraticCurveTo(head.x, head.y - head.r * 0.45, head.x - head.r * 1.04, head.y - head.r * 0.06);
    }
    ctx.closePath();
    ctx.fill();
  }

  const ex = look.x * head.r * 0.22;
  const ey = look.y * head.r * 0.15;
  ctx.fillStyle = '#1b1b24';
  dot(ctx, head.x - head.r * 0.33 + ex, head.y + head.r * 0.12 + ey, head.r * 0.13);
  dot(ctx, head.x + head.r * 0.33 + ex, head.y + head.r * 0.12 + ey, head.r * 0.13);
  return head;
}
