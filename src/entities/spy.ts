import { SPY_ESCAPE_DIST, SPY_FLEE_SPEED, SPY_FLEE_TIME, SPY_FREEZE_DOT, SPY_SNEAK_SPEED, WORLD_H, WORLD_W } from '../config';
import { clamp, length, lerp, normalize, pick, rand, scale, sub, vec, type Vec } from '../math';
import { TAU, dot, drawChibi, groundShadow, outlinedText, pixelFont, speechBubble, type ChibiStyle } from '../render/draw';

/**
 * sneak: creeping up on Sam (frozen whenever he looks their way).
 * flee: got some RAM and is running for it.
 * caught / escaped / left: done, fading out.
 */
export type SpyState = 'sneak' | 'flee' | 'caught' | 'escaped' | 'left';

export const SPY_COLOR = '#ff6b6b';

const FREEZE_LINES = ['Just reading the news.', 'Nothing to see here.', 'Lovely weather.', "I'm a tourist."] as const;
const STEAL_LINES = ['Thanks for the secrets!', 'Copied. Bye!', 'For research purposes!'] as const;
const CAUGHT_LINES = ['This is a smear!', "I'm just a consultant!", "I don't even know a Jensen."] as const;
const ESCAPE_LINES = ['Off to the airport!', 'You never saw me.'] as const;
const FADE_TIME = 1.4;

// Trench coat, with the hair colored like the fedora so the hat sits on it cleanly.
const SPY_STYLE: ChibiStyle = { body: '#b89a6a', trim: '#7d6440', skin: '#ecc8a4', hair: '#3b2f2a', hairStyle: 'short' };

/** A cartoon spy in a trench coat. Allegedly. */
export class Spy {
  readonly pos: Vec;
  vel: Vec = vec();
  readonly radius = 14;
  state: SpyState = 'sneak';
  /** RAM they got away from Sam with. */
  loot = 0;
  /** Sam is looking their way: stand still behind the newspaper. */
  frozen = false;
  private look: Vec = vec(0, 1);
  private t = rand(0, 10);
  private fade = 0;
  private fleeTime = 0;
  /** Head start after a theft: still overlapping Sam, so touches don't count for a moment. */
  private slip = 0;
  private mutter = rand(0.6, 1.4);
  private speech: string | null = null;
  private speechTime = 0;

  constructor(pos: Vec) {
    this.pos = { ...pos };
  }

  /** Still in play (sneaking or running). */
  get active(): boolean {
    return this.state === 'sneak' || this.state === 'flee';
  }

  /** False for a moment after a theft, so the spy isn't caught on the very next frame. */
  get touchable(): boolean {
    return this.slip <= 0;
  }

  /** Finished fading out; safe to remove. */
  get done(): boolean {
    return !this.active && this.fade >= FADE_TIME;
  }

  /** True when Sam is facing the spy (within about 70 degrees). */
  static seenBy(samPos: Vec, samLook: Vec, spyPos: Vec): boolean {
    const to = normalize(sub(spyPos, samPos));
    return samLook.x * to.x + samLook.y * to.y > SPY_FREEZE_DOT;
  }

  say(text: string, duration = 2): void {
    this.speech = text;
    this.speechTime = duration;
  }

  /** Returns 'escaped' on the frame a fleeing spy gets away. */
  update(dt: number, samPos: Vec, samLook: Vec): 'escaped' | null {
    this.t += dt;
    this.slip = Math.max(0, this.slip - dt);
    if (this.speechTime > 0) {
      this.speechTime -= dt;
      if (this.speechTime <= 0) this.speech = null;
    }
    if (!this.active) {
      this.fade += dt;
      this.brake(dt, 8);
      this.move(dt);
      return null;
    }

    const toSam = sub(samPos, this.pos);
    const d = length(toSam);
    let event: 'escaped' | null = null;
    if (this.state === 'sneak') {
      this.frozen = Spy.seenBy(samPos, samLook, this.pos);
      if (this.frozen) {
        this.vel = vec(); // freeze on the spot
        this.mutter -= dt;
        if (this.mutter <= 0 && !this.speech) {
          this.mutter = rand(2.5, 4);
          this.say(pick(FREEZE_LINES), 1.6);
        }
      } else {
        this.steer(toSam, SPY_SNEAK_SPEED, dt);
        if (d > 1) this.look = scale(toSam, 1 / d);
      }
    } else {
      this.fleeTime += dt;
      const away = d > 1 ? scale(toSam, -1 / d) : vec(1, 0);
      this.steer(this.avoidWalls(away), SPY_FLEE_SPEED, dt);
      this.look = normalize(this.vel);
      if (d > SPY_ESCAPE_DIST || this.fleeTime > SPY_FLEE_TIME) {
        this.state = 'escaped';
        this.say(pick(ESCAPE_LINES), 1.6);
        event = 'escaped';
      }
    }
    this.move(dt);
    return event;
  }

  /** Sam touched the spy: facing them (or chasing them down) catches them; from behind, they get the RAM. */
  touch(samPos: Vec, samLook: Vec): 'caught' | 'steal' {
    return this.state === 'flee' || Spy.seenBy(samPos, samLook, this.pos) ? 'caught' : 'steal';
  }

  /** Got `n` RAM off Sam (maybe 0): now run. */
  steal(n: number): void {
    this.loot = n;
    this.state = 'flee';
    this.frozen = false;
    this.fleeTime = 0;
    this.slip = 0.5;
    this.say(pick(STEAL_LINES), 1.8);
  }

  /** Caught red-handed. */
  bust(): void {
    this.state = 'caught';
    this.frozen = false;
    this.vel = vec();
    this.say(pick(CAUGHT_LINES), 2.4);
  }

  /** The story is over and nobody got anything: slip away. */
  leave(): void {
    if (this.state !== 'sneak') return;
    this.state = 'left';
    this.frozen = false;
    this.say('Wrong desert. Bye!', 1.6);
  }

  private avoidWalls(dir: Vec): Vec {
    const m = 140;
    let { x, y } = dir;
    if (this.pos.x < m) x += 1;
    if (this.pos.x > WORLD_W - m) x -= 1;
    if (this.pos.y < m) y += 1;
    if (this.pos.y > WORLD_H - m) y -= 1;
    return normalize({ x, y });
  }

  private steer(dir: Vec, speed: number, dt: number): void {
    const n = normalize(dir);
    const k = Math.min(1, dt * 8);
    this.vel.x = lerp(this.vel.x, n.x * speed, k);
    this.vel.y = lerp(this.vel.y, n.y * speed, k);
  }

  private brake(dt: number, sharpness: number): void {
    this.vel = scale(this.vel, 1 - Math.min(1, dt * sharpness));
  }

  private move(dt: number): void {
    this.pos.x = clamp(this.pos.x + this.vel.x * dt, this.radius, WORLD_W - this.radius);
    this.pos.y = clamp(this.pos.y + this.vel.y * dt, this.radius, WORLD_H - this.radius);
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.pos;
    ctx.save();
    if (!this.active) ctx.globalAlpha = clamp(1 - (this.fade - (FADE_TIME - 0.6)) / 0.6, 0, 1);
    groundShadow(ctx, x, y + this.radius * 0.85, this.radius * 0.9);

    // Tiptoe while sneaking, run while fleeing, dead still while "reading".
    const moving = length(this.vel) > 20;
    const bob = moving ? Math.abs(Math.sin(this.t * (this.state === 'flee' ? 18 : 12))) * -2.5 : 0;
    const head = drawChibi(ctx, x, y, this.radius, SPY_STYLE, this.look, bob);
    const by = y + bob;

    // Belt and turned-up collar.
    ctx.strokeStyle = '#7d6440';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - this.radius * 0.8, by + this.radius * 0.42);
    ctx.lineTo(x + this.radius * 0.8, by + this.radius * 0.42);
    ctx.stroke();
    ctx.fillStyle = '#a3865a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(head.x + s * head.r * 0.2, head.y + head.r * 0.75);
      ctx.lineTo(head.x + s * head.r * 1.05, head.y + head.r * 0.25);
      ctx.lineTo(head.x + s * head.r * 0.95, head.y + head.r * 1.05);
      ctx.closePath();
      ctx.fill();
    }

    if (this.frozen) {
      // Hiding behind a newspaper, with two eye holes.
      const w = head.r * 2.7;
      const h = head.r * 2.3;
      const nx = head.x - w / 2;
      const ny = head.y - h * 0.42;
      ctx.fillStyle = '#f4f1e8';
      ctx.strokeStyle = '#9a9480';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(nx, ny, w, h, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b9b39f';
      ctx.fillRect(nx + 2, ny + 2, w - 4, 3);
      for (let i = 0; i < 3; i++) ctx.fillRect(nx + 2, ny + h * 0.55 + i * 3, w - 4, 1);
      ctx.fillStyle = '#1b1b24';
      const blink = Math.sin(time * 3 + this.t) > 0.96;
      if (!blink) {
        dot(ctx, head.x - head.r * 0.32, ny + h * 0.33, 1.4);
        dot(ctx, head.x + head.r * 0.32, ny + h * 0.33, 1.4);
      }
    } else {
      // Dark glasses.
      const ex = this.look.x * head.r * 0.22;
      const eyeY = head.y + head.r * 0.12 + this.look.y * head.r * 0.15;
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.roundRect(head.x - head.r * 0.64 + ex, eyeY - head.r * 0.17, head.r * 1.28, head.r * 0.34, 2);
      ctx.fill();
      // A rolled-up newspaper under the arm.
      ctx.fillStyle = '#f4f1e8';
      ctx.strokeStyle = '#9a9480';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x + this.radius * 0.55, by + this.radius * 0.05, 5, 13, 1.5);
      ctx.fill();
      ctx.stroke();
    }

    // Fedora on top of everything.
    ctx.fillStyle = '#3b2f2a';
    ctx.beginPath();
    ctx.ellipse(head.x, head.y - head.r * 0.55, head.r * 1.25, head.r * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(head.x - head.r * 0.72, head.y - head.r * 1.35, head.r * 1.44, head.r * 0.85, [5, 5, 1, 1]);
    ctx.fill();
    ctx.fillStyle = '#1b1512';
    ctx.fillRect(head.x - head.r * 0.72, head.y - head.r * 0.72, head.r * 1.44, head.r * 0.18);

    ctx.font = pixelFont(8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = this.state === 'caught' ? 'BUSTED' : 'Alleged Spy';
    outlinedText(ctx, label, x, y - this.radius - 16, this.state === 'caught' ? '#5dff9a' : '#d9d2f2');
    if (this.loot > 0 && this.state === 'flee') {
      ctx.font = pixelFont(7);
      outlinedText(ctx, `HAS ${this.loot} OF YOUR RAM`, x, y - this.radius - 27, SPY_COLOR);
    }
    ctx.restore();
  }

  drawSpeech(ctx: CanvasRenderingContext2D): void {
    // Raised once caught, so it doesn't cover Sam's reply right next to them.
    const lift = this.state === 'caught' ? 54 : 30;
    if (this.speech && !this.done) speechBubble(ctx, this.pos.x, this.pos.y - this.radius - lift, this.speech, SPY_COLOR);
  }
}
