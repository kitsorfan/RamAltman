import type { Sfx } from '../audio/sfx';
import { RESIGN_GPUS, WORLD_H, WORLD_W } from '../config';
import type { Effects } from '../fx/effects';
import { clamp, dist, length, lerp, normalize, pick, rand, scale, sub, vec, type Vec } from '../math';
import { TAU, dot, drawCardboardBox, drawChibi, groundShadow, outlinedText, pixelFont, speechBubble, type ChibiStyle, type HeadInfo } from '../render/draw';
import type { Player } from './player';

/**
 * What a visit is for: a keynote that throws free GPUs around, a loan offer for Sam, or (breaking news)
 * stepping down: he walks off with his box, dropping GPUs as he goes.
 */
export type JensenVisit = 'giveaway' | 'loan' | 'resign';

type Phase = 'arrive' | 'keynote' | 'pitch' | 'announce' | 'walkout' | 'linger' | 'gone';

/** What Jensen can see and do in the game world. */
export interface JensenWorld {
  readonly player: Player;
  readonly fx: Effects;
  readonly sfx: Sfx;
  /** Keynote finale: throw free GPUs around. */
  jensenGiveaway(jensen: Jensen): void;
  /** Open the loan offer. Answer it with `resolve()`. */
  jensenPitch(jensen: Jensen, pitch: string): void;
  /** Stepping down: a GPU falls out of the box. */
  jensenDropGpu(jensen: Jensen): void;
}

export const JENSEN_COLOR = '#9be15d';

const ARRIVE_TIME = 0.7;
const KEYNOTE_TIME = 1.4;
const LINGER_GIVEAWAY = 2.6;
const LINGER_LOAN = 1.8;
const PITCH_DISTANCE = 100; // how close he stays while pitching
const ANNOUNCE_TIME = 1.8;
const DROP_EVERY = 0.7;
const WALK_SPEED = 125; // slower than Sam, so the trail of GPUs can be followed

const KEYNOTE_LINES = ['The more you buy, the more you save!', 'Welcome to my keynote!', 'Who wants a GPU?'] as const;
const GIVEAWAY_LINES = ['Free GPUs! Catch!', 'GPUs for everyone!', 'Tell your investors!'] as const;
const PITCHES = [
  'I will lend you the money to buy my chips!',
  "No cash? I'll invest. You buy my GPUs.",
  'The more you borrow, the more you save!',
  'I fund your round. You buy my chips. Deal?',
] as const;
const ACCEPT_LINES = ['Pleasure doing business!', 'See you next round!', 'Wise choice. Very wise.'] as const;
const RESIGN_LINES = ["I'm stepping down. Effective immediately.", 'I will cooperate fully. Bye!', 'Time to step down.'] as const;
const FAREWELL_LINES = ['See you in Congress.', 'The more you resign, the more you save.', 'Keep the GPUs.'] as const;

const JENSEN_STYLE: ChibiStyle = { body: '#16161b', trim: '#000000', skin: '#f0cba6', hair: '#c4c7cf', hairStyle: 'swept' };

/** Jensen, in his leather jacket. Not a rival: he sells to everyone. */
export class Jensen {
  readonly visit: JensenVisit;
  readonly pos: Vec;
  vel: Vec = vec();
  readonly radius = 17;
  /** Holding a GPU over his head (keynote pose). */
  holding = false;
  /** Carrying his cardboard box out of the building (stepping down). */
  carrying = false;
  showLabel = true;
  private phase: Phase = 'arrive';
  private phaseTime = ARRIVE_TIME;
  private t = rand(0, 10);
  private look: Vec = vec(0, 1);
  private speech: string | null = null;
  private speechTime = 0;
  private dropsLeft = 0;
  private dropTimer = 0;

  constructor(visit: JensenVisit, pos: Vec) {
    this.visit = visit;
    this.pos = { ...pos };
  }

  get gone(): boolean {
    return this.phase === 'gone';
  }

  /** True while waiting for Sam's answer to a loan offer. */
  get pitching(): boolean {
    return this.phase === 'pitch';
  }

  /** True until the keynote GPUs have been thrown. */
  get beforeGiveaway(): boolean {
    return this.visit === 'giveaway' && (this.phase === 'arrive' || this.phase === 'keynote');
  }

  say(text: string, duration = 2.4): void {
    this.speech = text;
    this.speechTime = duration;
  }

  /** Advance animation and speech timers only (used for the title-screen Jensen too). */
  animate(dt: number): void {
    this.t += dt;
    if (this.speechTime > 0) {
      this.speechTime -= dt;
      if (this.speechTime <= 0) this.speech = null;
    }
  }

  /** Sam answered the loan offer. Says something fitting, then heads off. */
  resolve(accepted: boolean, taker = 'Elon'): void {
    if (this.phase !== 'pitch') return;
    this.say(accepted ? pick(ACCEPT_LINES) : pick([`Fine. ${taker} said yes.`, `Your loss. ${taker} will take it.`]), 2);
    this.enter('linger', LINGER_LOAN);
  }

  update(dt: number, world: JensenWorld): void {
    this.animate(dt);
    if (this.phase === 'gone') return;
    this.phaseTime -= dt;
    const toPlayer = sub(world.player.pos, this.pos);
    if (length(toPlayer) > 1) this.look = normalize(toPlayer);

    switch (this.phase) {
      case 'arrive':
        this.brake(dt);
        if (this.phaseTime <= 0) {
          if (this.visit === 'giveaway') {
            this.holding = true;
            this.say(pick(KEYNOTE_LINES), KEYNOTE_TIME + 0.6);
            this.enter('keynote', KEYNOTE_TIME);
          } else if (this.visit === 'resign') {
            this.carrying = true;
            this.say(pick(RESIGN_LINES), ANNOUNCE_TIME + 0.8);
            this.enter('announce', ANNOUNCE_TIME);
          } else {
            const pitch = pick(PITCHES);
            this.say(pitch, 30);
            this.enter('pitch', Infinity);
            world.jensenPitch(this, pitch);
          }
        }
        break;
      case 'keynote':
        this.brake(dt);
        if (Math.random() < dt * 12) world.fx.puff(this.pos.x + rand(-14, 14), this.pos.y - 34, 'rgba(155, 225, 93, 0.8)', 2.5, 0.4);
        if (this.phaseTime <= 0) {
          this.holding = false;
          world.jensenGiveaway(this);
          this.say(pick(GIVEAWAY_LINES), 1.8);
          this.enter('linger', LINGER_GIVEAWAY);
        }
        break;
      case 'announce':
        this.carrying = true;
        this.brake(dt);
        if (this.phaseTime <= 0) {
          this.dropsLeft = RESIGN_GPUS;
          this.dropTimer = 0.35;
          this.enter('walkout', Infinity);
        }
        break;
      case 'walkout': {
        // Walks away from Sam (and away from the walls), a GPU falling out of the box every so often.
        const away = this.avoidWalls(length(toPlayer) > 1 ? scale(toPlayer, -1) : vec(1, 0));
        this.steer(away, WALK_SPEED, dt);
        this.look = away;
        this.dropTimer -= dt;
        if (this.dropTimer <= 0 && this.dropsLeft > 0) {
          this.dropTimer = DROP_EVERY;
          this.dropsLeft--;
          world.jensenDropGpu(this);
        }
        if (this.dropsLeft === 0) {
          this.carrying = false;
          this.say(pick(FAREWELL_LINES), 2.2);
          this.enter('linger', 1.6);
        }
        break;
      }
      case 'pitch': {
        // A persistent salesman: stays close while you think it over.
        const d = dist(this.pos, world.player.pos);
        if (d > PITCH_DISTANCE) this.steer(toPlayer, Math.min(260, (d - PITCH_DISTANCE) * 4), dt);
        else this.brake(dt);
        break;
      }
      case 'linger':
        this.brake(dt, 3);
        if (this.phaseTime <= 0) this.leave(world);
        break;
    }

    this.pos.x = clamp(this.pos.x + this.vel.x * dt, this.radius, WORLD_W - this.radius);
    this.pos.y = clamp(this.pos.y + this.vel.y * dt, this.radius, WORLD_H - this.radius);
  }

  private enter(phase: Phase, time: number): void {
    this.phase = phase;
    this.phaseTime = time;
  }

  private leave(world: JensenWorld): void {
    world.fx.beam(this.pos.x, this.pos.y, JENSEN_COLOR);
    world.fx.burst(this.pos.x, this.pos.y, JENSEN_COLOR, 18, 180, 3, 0.6);
    this.speech = null;
    this.enter('gone', 0);
  }

  private avoidWalls(dir: Vec): Vec {
    const m = 160;
    let { x, y } = normalize(dir);
    if (this.pos.x < m) x += 1;
    if (this.pos.x > WORLD_W - m) x -= 1;
    if (this.pos.y < m) y += 1;
    if (this.pos.y > WORLD_H - m) y -= 1;
    return normalize({ x, y });
  }

  private steer(dir: Vec, speed: number, dt: number): void {
    const n = normalize(dir);
    const k = Math.min(1, dt * 6);
    this.vel.x = lerp(this.vel.x, n.x * speed, k);
    this.vel.y = lerp(this.vel.y, n.y * speed, k);
  }

  private brake(dt: number, sharpness = 6): void {
    this.vel = scale(this.vel, 1 - Math.min(1, dt * sharpness));
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    if (this.phase === 'gone') return;
    const { x, y } = this.pos;
    groundShadow(ctx, x, y + this.radius * 0.85, this.radius * 0.9);
    const bob = length(this.vel) > 20 ? Math.sin(this.t * 14) * 1.5 : Math.sin(time * 2) * 0.6;
    drawJensenFigure(ctx, x, y, this.radius, this.look, bob, this.holding, time, this.carrying);
    if (this.showLabel) {
      ctx.font = pixelFont(8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const label = this.visit === 'resign' ? 'Jensen (ex-CEO)' : 'Jensen';
      outlinedText(ctx, label, x, y - this.radius - (this.holding ? 34 : 12), JENSEN_COLOR);
    }
  }

  /** A keynote spotlight drawn above the fog, so you can spot him from afar. */
  drawSpotlight(ctx: CanvasRenderingContext2D, time: number): void {
    if (this.phase === 'gone') return;
    const fade = this.phase === 'arrive' ? 1 - this.phaseTime / ARRIVE_TIME : 1;
    const { x, y } = this.pos;
    const a = (0.16 + 0.04 * Math.sin(time * 5)) * fade;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y - 260, 0, y + 20);
    g.addColorStop(0, 'rgba(200, 255, 170, 0)');
    g.addColorStop(1, `rgba(200, 255, 170, ${a})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 260);
    ctx.lineTo(x + 10, y - 260);
    ctx.lineTo(x + 34, y + 14);
    ctx.lineTo(x - 34, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(200, 255, 170, ${a * 1.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 34, 11, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawSpeech(ctx: CanvasRenderingContext2D): void {
    if (this.speech && this.phase !== 'gone') {
      speechBubble(ctx, this.pos.x, this.pos.y - this.radius - (this.holding ? 44 : 22), this.speech, JENSEN_COLOR);
    }
  }
}

/** Leather jacket over a black tee, silver hair, and (on stage) a GPU held high, or (leaving) a box of them. */
export function drawJensenFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  look: Vec,
  bob: number,
  holding: boolean,
  time: number,
  carrying = false,
): HeadInfo {
  const head = drawChibi(ctx, x, y, r, JENSEN_STYLE, look, bob);
  const by = y + bob;

  // Black tee in the V between the jacket lapels.
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, by + r * 0.1);
  ctx.lineTo(x + r * 0.3, by + r * 0.1);
  ctx.lineTo(x, by + r * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#55555f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, by + r * 0.1);
  ctx.lineTo(x - r * 0.02, by + r * 0.72);
  ctx.moveTo(x + r * 0.3, by + r * 0.1);
  ctx.lineTo(x + r * 0.02, by + r * 0.72);
  ctx.stroke();

  // Leather shine.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, by + r * 0.3, r * 0.68, Math.PI * 1.08, Math.PI * 1.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, by + r * 0.3, r * 0.68, Math.PI * 1.7, Math.PI * 1.82);
  ctx.stroke();
  ctx.lineCap = 'butt';

  if (holding) {
    const gy = head.y - head.r - 14 + Math.sin(time * 6) * 1.5;
    const glow = ctx.createRadialGradient(x, gy, 2, x, gy, 26);
    glow.addColorStop(0, 'rgba(155, 225, 93, 0.6)');
    glow.addColorStop(1, 'rgba(155, 225, 93, 0)');
    ctx.fillStyle = glow;
    dot(ctx, x, gy, 26);
    ctx.fillStyle = JENSEN_STYLE.skin;
    dot(ctx, x - 13, gy + 3, 3.5);
    dot(ctx, x + 13, gy + 3, 3.5);
    ctx.fillStyle = '#2b2f3a';
    ctx.strokeStyle = JENSEN_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-12 + x, gy - 6, 24, 12, 2);
    ctx.fill();
    ctx.stroke();
    for (const fx of [-5.5, 5.5]) {
      ctx.fillStyle = '#151820';
      dot(ctx, x + fx, gy, 4);
      ctx.strokeStyle = '#8a93a6';
      ctx.lineWidth = 1;
      const a = time * 14;
      ctx.beginPath();
      ctx.moveTo(x + fx - Math.cos(a) * 3.5, gy - Math.sin(a) * 3.5);
      ctx.lineTo(x + fx + Math.cos(a) * 3.5, gy + Math.sin(a) * 3.5);
      ctx.stroke();
    }
  }
  if (carrying) drawCardboardBox(ctx, x, by, time, JENSEN_STYLE.skin, 'gpus');
  return head;
}
