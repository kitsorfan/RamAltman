import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SHOVE_ACTIVE,
  SHOVE_COOLDOWN,
  SHOVE_LUNGE,
  SPRINT_MULT,
  WORLD_H,
  WORLD_W,
} from '../config';
import { clamp, lerp, normalize, vec, type Vec } from '../math';
import { TAU, dot, drawChibi, groundShadow, outlinedText, pixelFont, speechBubble, uiFont, type ChibiStyle } from '../render/draw';

const ZERO: Vec = { x: 0, y: 0 };
const TWEET_SHOW = 2.6;

const SAM_STYLE: ChibiStyle = {
  body: '#8f96a3',
  trim: '#5d6470',
  skin: '#f2cfae',
  hair: '#7a5a3c',
  hairStyle: 'short',
};

/** Sam Altman, in his trademark plain grey sweater, on a quest for RAM. */
export class Player {
  readonly pos: Vec = vec(WORLD_W / 2, WORLD_H / 2);
  readonly vel: Vec = vec();
  readonly knock: Vec = vec();
  readonly radius = PLAYER_RADIUS;
  /** Unit facing direction (shoves go this way). */
  look: Vec = vec(0, 1);
  heat = 0;
  power = 100;
  lives = 3;
  ram = 0;
  invuln = 0;
  inWater = false;
  sprinting = false;
  moving = false;
  shoveCooldown = 0;
  /** While > 0 the shove can connect with rivals. */
  shoveActive = 0;
  tweetCooldown = 0;
  /** Seconds left standing around holding a box after the board fired him. Can't move or act. */
  fired = 0;
  t = 0;
  private shoveAnim = 0;
  private speech: string | null = null;
  private speechTime = 0;
  private tweetText: string | null = null;
  private tweetTime = 0;

  get canShove(): boolean {
    return this.shoveCooldown <= 0 && this.fired <= 0;
  }

  get canTweet(): boolean {
    return this.tweetCooldown <= 0 && this.fired <= 0;
  }

  /** Post something vague. Shows as a little tweet card above Sam. */
  tweet(text: string, cooldown: number): void {
    this.tweetText = text;
    this.tweetTime = TWEET_SHOW;
    this.tweetCooldown = cooldown;
    this.speech = null;
  }

  /** The board fires Sam: he stands there holding his box until he's rehired. */
  fire(time: number): void {
    this.fired = time;
    this.shoveActive = 0;
    this.sprinting = false;
  }

  /** Lunge forward with a punch. */
  startShove(): void {
    this.shoveCooldown = SHOVE_COOLDOWN;
    this.shoveActive = SHOVE_ACTIVE;
    this.shoveAnim = 0.22;
    this.knock.x += this.look.x * SHOVE_LUNGE;
    this.knock.y += this.look.y * SHOVE_LUNGE;
  }

  /** Resets per-level state (lives are kept). */
  reset(): void {
    this.pos.x = WORLD_W / 2;
    this.pos.y = WORLD_H / 2;
    this.vel.x = this.vel.y = 0;
    this.knock.x = this.knock.y = 0;
    this.heat = 0;
    this.power = 100;
    this.ram = 0;
    this.invuln = 1;
    this.inWater = false;
    this.sprinting = false;
    this.shoveCooldown = 0;
    this.shoveActive = 0;
    this.shoveAnim = 0;
    this.tweetCooldown = 0;
    this.fired = 0;
    this.speech = null;
    this.tweetText = null;
  }

  say(text: string, duration = 2): void {
    this.speech = text;
    this.speechTime = duration;
  }

  /** Advance animation and speech timers only (used for the title-screen Sam too). */
  animate(dt: number): void {
    this.t += dt;
    if (this.speechTime > 0) {
      this.speechTime -= dt;
      if (this.speechTime <= 0) this.speech = null;
    }
    if (this.tweetTime > 0) {
      this.tweetTime -= dt;
      if (this.tweetTime <= 0) this.tweetText = null;
    }
  }

  update(dt: number, input: Vec, speedMult: number): void {
    this.animate(dt);
    const axis = this.fired > 0 ? ZERO : input;
    this.fired = Math.max(0, this.fired - dt);
    this.tweetCooldown = Math.max(0, this.tweetCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shoveCooldown = Math.max(0, this.shoveCooldown - dt);
    this.shoveActive = Math.max(0, this.shoveActive - dt);
    this.shoveAnim = Math.max(0, this.shoveAnim - dt);

    const speed = PLAYER_SPEED * speedMult * (this.sprinting ? SPRINT_MULT : 1);
    const k = Math.min(1, dt * 12);
    this.vel.x = lerp(this.vel.x, axis.x * speed, k);
    this.vel.y = lerp(this.vel.y, axis.y * speed, k);

    const decay = Math.exp(-dt * 6);
    this.knock.x *= decay;
    this.knock.y *= decay;

    this.pos.x = clamp(this.pos.x + (this.vel.x + this.knock.x) * dt, this.radius, WORLD_W - this.radius);
    this.pos.y = clamp(this.pos.y + (this.vel.y + this.knock.y) * dt, this.radius, WORLD_H - this.radius);

    this.moving = axis.x !== 0 || axis.y !== 0;
    if (this.moving) this.look = normalize(axis);
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.pos;
    ctx.save();
    if (this.invuln > 0 && this.fired <= 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;

    if (this.heat > 40) {
      const a = ((this.heat - 40) / 60) * (0.35 + 0.15 * Math.sin(time * 10));
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 36);
      glow.addColorStop(0, `rgba(255, 80, 40, ${a})`);
      glow.addColorStop(1, 'rgba(255, 80, 40, 0)');
      ctx.fillStyle = glow;
      dot(ctx, x, y, 36);
    }

    if (this.inWater) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        const k = (time * 1.2 + i * 0.5) % 1;
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.beginPath();
        ctx.ellipse(x, y + this.radius * 0.7, this.radius * (1 + k), this.radius * (0.4 + k * 0.4), 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      groundShadow(ctx, x, y + this.radius * 0.95, this.radius * 0.9);
    }

    if (this.shoveCooldown > 0) {
      // Shove recharge ring at Sam's feet.
      const k = 1 - this.shoveCooldown / SHOVE_COOLDOWN;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, y + this.radius * 0.95, this.radius * 1.1, this.radius * 0.45, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
    }

    const bob = this.moving ? Math.sin(this.t * (this.sprinting ? 22 : 14)) * 1.8 : Math.sin(time * 2) * 0.6;
    drawChibi(ctx, x, y, this.radius, SAM_STYLE, this.look, bob);

    if (this.shoveAnim > 0) {
      // Fist punches out and back along the facing direction.
      const k = Math.sin((this.shoveAnim / 0.22) * Math.PI);
      const reach = this.radius * 0.6 + 16 * k;
      ctx.fillStyle = SAM_STYLE.skin;
      ctx.strokeStyle = 'rgba(90, 55, 30, 0.7)';
      ctx.lineWidth = 1.5;
      dot(ctx, x + this.look.x * reach, y + bob + 2 + this.look.y * reach, 5.5);
      ctx.stroke();
    }

    if (this.fired > 0) drawBox(ctx, x, y + bob, time);

    if (this.inWater) {
      ctx.fillStyle = 'rgba(60, 150, 230, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y + this.radius * 0.7, this.radius * 1.15, this.radius * 0.45, 0, 0, TAU);
      ctx.fill();
    }

    ctx.font = pixelFont(8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    outlinedText(ctx, 'Sam', x, y - this.radius - 12, '#ffffff');
    ctx.restore();
  }

  drawSpeech(ctx: CanvasRenderingContext2D): void {
    if (this.tweetText) drawTweet(ctx, this.pos.x, this.pos.y - this.radius - 22, this.tweetText, this.tweetTime);
    else if (this.speech) speechBubble(ctx, this.pos.x, this.pos.y - this.radius - 22, this.speech, '#9be7ff');
  }
}

/** The classic "you're fired" cardboard box, with a desk plant poking out. */
function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bx = x - 13;
  const by = y + 4;
  ctx.strokeStyle = '#3e7d32';
  ctx.lineWidth = 2;
  for (const [dx, lean] of [[5, -0.3], [8, 0.2], [11, 0.7]] as const) {
    const sway = Math.sin(time * 3 + dx) * 1.2;
    ctx.beginPath();
    ctx.moveTo(x + dx, by + 2);
    ctx.quadraticCurveTo(x + dx + lean * 3, by - 5, x + dx + lean * 6 + sway, by - 9);
    ctx.stroke();
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
  ctx.fillStyle = '#f2cfae';
  dot(ctx, bx + 1, by + 8, 3.5);
  dot(ctx, bx + 25, by + 8, 3.5);
}

/** A little post card: avatar, handle, and something vague in lowercase. */
function drawTweet(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, timeLeft: number): void {
  ctx.save();
  const pop = 1 + 0.25 * Math.max(0, (timeLeft - TWEET_SHOW + 0.15) / 0.15);
  ctx.font = uiFont(13, 600);
  const w = Math.max(150, ctx.measureText(text).width + 24);
  const h = 44;
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  const bx = -w / 2;
  const by = -h - 8;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#4fb8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, by + h - 1.5);
  ctx.lineTo(0, by + h + 7);
  ctx.lineTo(6, by + h - 1.5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#8f96a3';
  dot(ctx, bx + 16, by + 13, 7);
  ctx.fillStyle = '#7a5a3c';
  ctx.beginPath();
  ctx.arc(bx + 16, by + 12, 7, Math.PI, TAU);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = uiFont(11, 800);
  ctx.fillStyle = '#1b1b24';
  ctx.fillText('Sam', bx + 28, by + 13);
  const nameW = ctx.measureText('Sam').width;
  ctx.font = uiFont(11, 600);
  ctx.fillStyle = '#7a7290';
  ctx.fillText('@sam · now', bx + 32 + nameW, by + 13);
  ctx.font = uiFont(13, 600);
  ctx.fillStyle = '#1b1b24';
  ctx.fillText(text, bx + 12, by + 31);
  ctx.restore();
}
