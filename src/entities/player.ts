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
import { TAU, dot, drawChibi, groundShadow, outlinedText, pixelFont, speechBubble, type ChibiStyle } from '../render/draw';

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
  t = 0;
  private shoveAnim = 0;
  private speech: string | null = null;
  private speechTime = 0;

  get canShove(): boolean {
    return this.shoveCooldown <= 0;
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
    this.speech = null;
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
  }

  update(dt: number, axis: Vec, speedMult: number): void {
    this.animate(dt);
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
    if (this.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;

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
    if (this.speech) speechBubble(ctx, this.pos.x, this.pos.y - this.radius - 22, this.speech, '#9be7ff');
  }
}
