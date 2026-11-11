import type { Sfx } from '../audio/sfx';
import { FURY_SPEED, FURY_TIME, RIVAL_BOOST_TIME, RIVAL_SPEED_SCALE, STUN_TIME, WORLD_H, WORLD_W } from '../config';
import type { Effects } from '../fx/effects';
import { clamp, dist, length, lerp, normalize, pick, rand, scale, shuffle, sub, vec, type Vec } from '../math';
import { TAU, dot, drawChibi, droplet, groundShadow, outlinedText, pixelFont, speechBubble, type ChibiStyle } from '../render/draw';
import type { Pickup } from './pickup';
import type { Player } from './player';

/** A competitor's running market share. Several bodies can share one team (the swarm). */
export interface Team {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  ram: number;
  gpus: number;
}

export interface Teams {
  readonly player: Team;
  readonly dario: Team;
  readonly elon: Team;
  readonly gemini: Team;
  readonly china: Team;
}

/** What a rival is allowed to see and do in the game world. */
export interface RivalWorld {
  readonly player: Player;
  readonly pickups: readonly Pickup[];
  readonly fx: Effects;
  readonly sfx: Sfx;
  readonly level: number;
  rivalCollect(rival: Rival, pickup: Pickup): void;
  stealRam(rival: Rival, amount: number): number;
  distill(rival: Rival, powerLoss: number): void;
  knockPlayer(from: Vec, force: number): void;
}

const newTeam = (id: string, name: string, color: string): Team => ({ id, name, color, ram: 0, gpus: 0 });

/**
 * Something that makes a rival stop playing for a while: reading Sam's tweet, panicking about the
 * markets, attending Dario's safety summit, or giving it.
 */
export type DistractionKind = 'phone' | 'panic' | 'summit' | 'lecture';

export interface DistractOptions {
  /** Walk here first (the summit), then stand around. */
  goTo?: Vec;
  /** Said once, right away. */
  line?: string;
  /** Said every few seconds while it lasts. */
  chatter?: readonly string[];
}

interface Distraction {
  kind: DistractionKind;
  time: number;
  goTo: Vec | null;
  chatter: readonly string[];
  chatterTimer: number;
}

export function createTeams(): Teams {
  return {
    player: newTeam('sam', 'Sam (you)', '#ffffff'),
    dario: newTeam('dario', 'Dario', '#e8875f'),
    elon: newTeam('elon', 'Elon', '#c3c9d6'),
    gemini: newTeam('gemini', 'Gemini', '#7aa2ff'),
    china: newTeam('china', 'Chinese Labs', '#ff4d5e'),
  };
}

export const allTeams = (t: Teams): Team[] => [t.player, t.dario, t.elon, t.gemini, t.china];

export abstract class Rival {
  readonly team: Team;
  readonly label: string;
  pos: Vec;
  vel: Vec = vec();
  radius = 16;
  contactCooldown = 0;
  /** Seconds left stunned (after Sam shoves them). Stunned rivals can't move, collect or hurt you. */
  stun = 0;
  /** Seconds left of the speed boost from an energy cell. */
  boost = 0;
  /** Seconds left hunting Sam for revenge after being shoved. */
  fury = 0;
  /** Cosmetic switches (the title screen turns these off). */
  showAura = true;
  showLabel = true;
  protected baseSpeed = 160;
  protected target: Pickup | null = null;
  protected retargetTimer = 0;
  protected t = rand(0, 10);
  protected abstract readonly lines: readonly string[];
  protected abstract readonly hurtLines: readonly string[];
  protected abstract readonly angryLines: readonly string[];
  private furyPending = false;
  private distraction: Distraction | null = null;
  private hurtFlash = 0;
  private wanderAngle = rand(0, TAU);
  private speech: string | null = null;
  private speechTime = 0;
  private chatterTimer = rand(3, 8);

  constructor(team: Team, label: string, pos: Vec) {
    this.team = team;
    this.label = label;
    this.pos = { ...pos };
  }

  /** Decide where to go this frame (set `vel`). */
  protected abstract think(dt: number, world: RivalWorld): void;
  /** Called when the rival touches the player. */
  abstract onPlayerContact(world: RivalWorld): void;
  protected abstract drawBody(ctx: CanvasRenderingContext2D, time: number): void;

  get stunned(): boolean {
    return this.stun > 0;
  }

  get furious(): boolean {
    return this.fury > 0;
  }

  get distracted(): DistractionKind | null {
    return this.distraction?.kind ?? null;
  }

  /** Stunned or distracted: can't collect anything and can't touch Sam. */
  get busy(): boolean {
    return this.stun > 0 || this.distraction !== null;
  }

  /** Sam landed a shove: stun, knock back, complain, and get furious once the stun wears off. */
  hit(dir: Vec): void {
    this.stun = STUN_TIME;
    this.hurtFlash = 0.15;
    this.vel = scale(dir, 380);
    this.target = null;
    this.fury = 0;
    this.furyPending = true;
    this.distraction = null; // a shove snaps you out of anything
    this.say(pick(this.hurtLines), 1.4);
    this.onInterrupted();
    this.onStunned();
  }

  /** Start hunting Sam for revenge. */
  enrage(duration = FURY_TIME): void {
    this.fury = duration;
    this.furyPending = false;
    this.distraction = null;
    this.say(pick(this.angryLines), 2);
  }

  /**
   * Stop playing for `time` seconds. Fury and strategy are paused, not forgotten.
   * A shorter distraction doesn't cut a longer one short.
   */
  distract(kind: DistractionKind, time: number, opts: DistractOptions = {}): void {
    if (this.distraction && this.distraction.time > time) return;
    this.distraction = {
      kind,
      time,
      goTo: opts.goTo ? { ...opts.goTo } : null,
      chatter: opts.chatter ?? [],
      chatterTimer: rand(1.6, 2.6),
    };
    this.target = null;
    if (opts.line) this.say(opts.line, 1.8);
    this.onInterrupted();
  }

  /** Touching Sam: a furious rival takes revenge, otherwise it's the rival's own behavior. */
  handleContact(world: RivalWorld): void {
    if (this.fury > 0) {
      const n = world.stealRam(this, 1);
      world.knockPlayer(this.pos, 320);
      this.fury = 0;
      this.say(n > 0 ? 'Payback!' : 'Lucky you.', 1.6);
      this.contactCooldown = 1.5;
      return;
    }
    this.onPlayerContact(world);
  }

  /** Advance animation and speech timers only (used for cosmetic copies on the title screen). */
  animate(dt: number): void {
    this.t += dt;
    if (this.speechTime > 0) {
      this.speechTime -= dt;
      if (this.speechTime <= 0) this.speech = null;
    }
  }

  /** Say one of this rival's catchphrases. */
  chatter(duration = 2.2): void {
    this.say(pick(this.lines), duration);
  }

  /** Grabbed an energy cell. */
  energize(): void {
    this.boost = RIVAL_BOOST_TIME;
  }

  /** Hook for rivals with their own state machine: stunned or distracted mid-move. */
  protected onInterrupted(): void {}

  /** Hook: just got stunned by Sam. */
  protected onStunned(): void {}

  update(dt: number, world: RivalWorld): void {
    this.animate(dt);
    this.contactCooldown = Math.max(0, this.contactCooldown - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (this.stun > 0) {
      this.stun -= dt;
      const k = Math.exp(-dt * 5);
      this.vel.x *= k;
      this.vel.y *= k;
      this.move(dt);
      if (this.stun <= 0 && this.furyPending) this.enrage();
      return;
    }

    if (this.distraction) {
      this.updateDistraction(dt, world, this.distraction);
      this.move(dt);
      return;
    }

    if (this.boost > 0 && Math.random() < dt * 20) {
      world.fx.puff(this.pos.x + rand(-10, 10), this.pos.y + rand(-14, 8), 'rgba(255, 220, 60, 0.8)', 3, 0.3);
    }

    if (this.fury > 0) {
      // Revenge mode: forget the strategy, chase Sam.
      this.fury -= dt;
      this.steer(sub(world.player.pos, this.pos), this.speed(world) * FURY_SPEED, dt, 6);
      if (Math.random() < dt * 15) world.fx.puff(this.pos.x, this.pos.y + 6, 'rgba(255, 70, 70, 0.45)', this.radius * 0.7);
    } else {
      this.chatterTimer -= dt;
      if (this.chatterTimer <= 0) {
        this.chatterTimer = rand(8, 15);
        if (!this.speech) this.say(pick(this.lines));
      }
      if (this.target && !this.target.alive) this.target = null;
      this.think(dt, world);
    }
    this.move(dt);

    for (const p of world.pickups) {
      if (p.alive && !p.airborne && dist(p.pos, this.pos) < this.radius + p.radius) world.rivalCollect(this, p);
    }
  }

  private updateDistraction(dt: number, world: RivalWorld, d: Distraction): void {
    d.time -= dt;
    if (d.goTo && dist(this.pos, d.goTo) > 40) this.steer(sub(d.goTo, this.pos), this.speed(world), dt, 4);
    else this.brake(dt, 8);
    if (d.chatter.length) {
      d.chatterTimer -= dt;
      if (d.chatterTimer <= 0) {
        d.chatterTimer = rand(2.4, 3.4);
        this.say(pick(d.chatter), 2);
      }
    }
    if (d.time <= 0) this.distraction = null;
  }

  private move(dt: number): void {
    this.pos.x = clamp(this.pos.x + this.vel.x * dt, this.radius, WORLD_W - this.radius);
    this.pos.y = clamp(this.pos.y + this.vel.y * dt, this.radius, WORLD_H - this.radius);
  }

  say(text: string, duration = 2.4): void {
    this.speech = text;
    this.speechTime = duration;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    groundShadow(ctx, this.pos.x, this.pos.y + this.radius * 0.85, this.radius * 0.9);
    if (this.boost > 0) {
      ctx.strokeStyle = `rgba(255, 220, 60, ${0.4 + 0.3 * Math.sin(time * 20)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius + 6, 0, TAU);
      ctx.stroke();
    }
    this.drawBody(ctx, time);

    if (this.hurtFlash > 0) {
      ctx.globalAlpha = (this.hurtFlash / 0.15) * 0.8;
      ctx.fillStyle = '#ffffff';
      dot(ctx, this.pos.x, this.pos.y - this.radius * 0.1, this.radius * 1.1);
      ctx.globalAlpha = 1;
    }
    if (this.stun > 0) {
      // Dizzy stars orbiting the head.
      const cy = this.pos.y - this.radius - 4;
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * TAU) / 3;
        drawStar(ctx, this.pos.x + Math.cos(a) * 14, cy + Math.sin(a) * 4, 4.5, '#ffe066');
      }
    }
    if (this.distraction) this.drawDistraction(ctx, time, this.distraction);
    if (this.fury > 0) {
      ctx.strokeStyle = `rgba(255, 60, 60, ${0.5 + 0.3 * Math.sin(time * 16)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius + 5, 0, TAU);
      ctx.stroke();
      drawAngerMark(ctx, this.pos.x + this.radius * 0.8, this.pos.y - this.radius - 2, 1 + 0.15 * Math.sin(time * 14));
    }

    if (this.showLabel) {
      ctx.font = pixelFont(8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      outlinedText(ctx, this.label, this.pos.x, this.pos.y - this.radius - 12, this.fury > 0 ? '#ff6b6b' : this.team.color);
    }
  }

  drawSpeech(ctx: CanvasRenderingContext2D): void {
    if (this.speech) speechBubble(ctx, this.pos.x, this.pos.y - this.radius - 22, this.speech, this.team.color);
  }

  private drawDistraction(ctx: CanvasRenderingContext2D, time: number, d: Distraction): void {
    const { x, y } = this.pos;
    const r = this.radius;
    switch (d.kind) {
      case 'phone': {
        // Head down, reading Sam's latest post.
        const glow = ctx.createRadialGradient(x, y, 1, x, y, r);
        glow.addColorStop(0, 'rgba(155, 231, 255, 0.55)');
        glow.addColorStop(1, 'rgba(155, 231, 255, 0)');
        ctx.fillStyle = glow;
        dot(ctx, x, y, r);
        ctx.fillStyle = '#1b1b24';
        ctx.beginPath();
        ctx.roundRect(x - 4.5, y - 2, 9, 13, 2);
        ctx.fill();
        ctx.fillStyle = '#9be7ff';
        ctx.fillRect(x - 3, y, 6, 8);
        ctx.fillStyle = '#1b1b24';
        for (let i = 0; i < 3; i++) ctx.fillRect(x - 2, y + 1.5 + i * 2.2 - ((time * 6) % 2.2), 4, 0.8);
        break;
      }
      case 'panic': {
        // Sweating over a crashing chart.
        const cx = x + (Math.random() - 0.5) * 2;
        const cy = y - r - 30;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2a0f3d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cx - 12, cy - 8, 24, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 9, cy - 5);
        ctx.lineTo(cx - 3, cy - 1);
        ctx.lineTo(cx, cy - 3);
        ctx.lineTo(cx + 8, cy + 5);
        ctx.stroke();
        const k = (time * 2.5 + this.t) % 1;
        ctx.fillStyle = `rgba(140, 210, 255, ${1 - k})`;
        droplet(ctx, x + r * 0.75, y - r * 0.6 + k * 10, 3.2);
        ctx.fill();
        break;
      }
      case 'summit': {
        if (d.goTo && dist(this.pos, d.goTo) > 40) break; // still on the way
        // Bored in the audience.
        ctx.font = pixelFont(8);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 2; i++) {
          const k = (time * 0.7 + i * 0.5 + this.t) % 1;
          ctx.globalAlpha = Math.sin(k * Math.PI);
          outlinedText(ctx, 'z', x + r * 0.6 + k * 10, y - r - 4 - k * 18, '#cfe8ff');
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'lecture': {
        // A whiteboard with one very important chart.
        const bx = x + r + 6;
        const by = y - r - 10;
        ctx.strokeStyle = '#5a4636';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 5, by + 20);
        ctx.lineTo(bx + 2, by + 34);
        ctx.moveTo(bx + 25, by + 20);
        ctx.lineTo(bx + 28, by + 34);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#9c4c30';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, 30, 21, 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = pixelFont(5);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#9c4c30';
        ctx.fillText('P(DOOM)', bx + 15, by + 3);
        ctx.strokeStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.moveTo(bx + 4, by + 18);
        ctx.lineTo(bx + 14, by + 15);
        ctx.lineTo(bx + 26, by + 9);
        ctx.stroke();
        break;
      }
    }
  }

  protected speed(world: RivalWorld): number {
    return this.baseSpeed * RIVAL_SPEED_SCALE * (1 + 0.05 * (world.level - 1)) * (this.boost > 0 ? 1.35 : 1);
  }

  protected steer(dir: Vec, speed: number, dt: number, sharpness = 6): void {
    const n = normalize(dir);
    const k = Math.min(1, dt * sharpness);
    this.vel.x = lerp(this.vel.x, n.x * speed, k);
    this.vel.y = lerp(this.vel.y, n.y * speed, k);
  }

  protected brake(dt: number, sharpness = 6): void {
    const k = Math.min(1, dt * sharpness);
    this.vel.x = lerp(this.vel.x, 0, k);
    this.vel.y = lerp(this.vel.y, 0, k);
  }

  protected wander(dt: number, speed: number): void {
    this.wanderAngle += rand(-2.5, 2.5) * dt;
    const m = 200;
    if (this.pos.x < m || this.pos.x > WORLD_W - m || this.pos.y < m || this.pos.y > WORLD_H - m) {
      this.wanderAngle = Math.atan2(WORLD_H / 2 - this.pos.y, WORLD_W / 2 - this.pos.x);
    }
    this.steer({ x: Math.cos(this.wanderAngle), y: Math.sin(this.wanderAngle) }, speed * 0.6, dt, 3);
  }

  /** Lowest score wins; return Infinity to exclude a pickup. */
  protected nearest(world: RivalWorld, score: (p: Pickup) => number): Pickup | null {
    let best: Pickup | null = null;
    let bestScore = Infinity;
    for (const p of world.pickups) {
      if (!p.alive) continue;
      const s = score(p);
      if (s < bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return best;
  }

  protected nearPlayer(world: RivalWorld, range: number): boolean {
    return dist(this.pos, world.player.pos) < range;
  }

  protected lookDir(): Vec {
    const s = length(this.vel);
    return s > 15 ? scale(this.vel, 1 / s) : { x: 0, y: 0.3 };
  }

  protected bob(): number {
    return length(this.vel) > 20 ? Math.sin(this.t * 14) * 1.5 : 0;
  }
}

// ---------------------------------------------------------------------------
// Dario: careful scaler. Avoids you, never steals, stops for safety evals.
// ---------------------------------------------------------------------------

const DARIO_STYLE: ChibiStyle = { body: '#d97757', trim: '#9c4c30', skin: '#f1cfae', hair: '#2e2320', hairStyle: 'curly' };

export class Dario extends Rival {
  protected readonly lines = [
    'Responsible scaling!',
    'Have you considered the risks?',
    'Constitutional RAM only.',
    'Let me write a 20k-word essay on this.',
    'Machines of loving RAM.',
  ] as const;
  protected readonly hurtLines = ["That's not very aligned!", 'Ow! Filing a safety report.', 'Unsafe behavior detected!'] as const;
  protected readonly angryLines = ['Okay, gloves off.', 'Writing you a VERY long essay!', 'Safety first. Revenge second.'] as const;
  private evalTimer = rand(8, 12);
  private evaluating = 0;

  constructor(team: Team, pos: Vec) {
    super(team, 'Dario', pos);
    this.baseSpeed = 175;
  }

  protected think(dt: number, w: RivalWorld): void {
    if (this.evaluating > 0) {
      this.evaluating -= dt;
      this.brake(dt);
      return;
    }
    this.evalTimer -= dt;
    if (this.evalTimer <= 0) {
      this.evalTimer = rand(9, 13);
      this.evaluating = 1.6;
      this.say('Running safety evals…', 1.6);
      return;
    }

    this.retargetTimer -= dt;
    if (!this.target || this.retargetTimer <= 0) {
      this.retargetTimer = 0.6;
      const pp = w.player.pos;
      // Prefer pickups far from the player: big penalty for anything within 300px of Sam.
      this.target = this.nearest(
        w,
        (p) => dist(this.pos, p.pos) + Math.max(0, 300 - dist(pp, p.pos)) * 4 - (p.kind === 'gpu' ? 80 : 0),
      );
    }

    const speed = this.speed(w);
    if (!this.target) {
      this.wander(dt, speed);
      return;
    }
    let dir = normalize(sub(this.target.pos, this.pos));
    const away = sub(this.pos, w.player.pos);
    const d = length(away);
    if (d < 200) {
      const n = normalize(away);
      const f = ((200 - d) / 200) * 2.2;
      dir = normalize({ x: dir.x + n.x * f, y: dir.y + n.y * f });
    }
    this.steer(dir, speed, dt);
  }

  onPlayerContact(w: RivalWorld): void {
    w.knockPlayer(this.pos, 90);
    this.say('Oh, sorry! After you.', 1.6);
    this.contactCooldown = 1.5;
  }

  protected drawBody(ctx: CanvasRenderingContext2D, time: number): void {
    const look = this.lookDir();
    const head = drawChibi(ctx, this.pos.x, this.pos.y, this.radius, DARIO_STYLE, look, this.bob());
    const ex = look.x * head.r * 0.22;
    const ey = look.y * head.r * 0.15;
    const eyeY = head.y + head.r * 0.12 + ey;
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(head.x + s * head.r * 0.33 + ex, eyeY, head.r * 0.26, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(head.x - head.r * 0.07 + ex, eyeY);
    ctx.lineTo(head.x + head.r * 0.07 + ex, eyeY);
    ctx.stroke();

    if (this.evaluating > 0) {
      const a = time * 8;
      ctx.strokeStyle = this.team.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(head.x + head.r + 10, head.y - head.r, 6, a, a + Math.PI * 1.3);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }
}

// ---------------------------------------------------------------------------
// Elon: aggressive. Hunts GPUs, winds up and dashes at you to steal RAM.
// ---------------------------------------------------------------------------

const ELON_STYLE: ChibiStyle = { body: '#23252d', trim: '#0f1014', skin: '#f0c9a8', hair: '#5a4636', hairStyle: 'swept' };

type ElonMode = 'hunt' | 'windup' | 'dash';

export class Elon extends Rival {
  protected readonly lines = [
    'Colossus hungers.',
    'Concerning.',
    'Moving fast, breaking RAM.',
    "I'll buy the whole desert.",
    'Full self-grabbing!',
  ] as const;
  protected readonly hurtLines = ['Ow! I will sue.', 'Concerning!!', 'Rude. Very rude.'] as const;
  protected readonly angryLines = ["Now it's personal.", 'See you in court!', 'Cage match. Now.'] as const;
  private mode: ElonMode = 'hunt';
  private modeTimer = 0;
  private dashCooldown = rand(4, 6);
  private dashDir: Vec = vec(1, 0);

  constructor(team: Team, pos: Vec) {
    super(team, 'Elon', pos);
    this.baseSpeed = 190;
    this.radius = 18;
  }

  protected think(dt: number, w: RivalWorld): void {
    const pl = w.player;
    this.dashCooldown -= dt;

    if (this.mode === 'windup') {
      this.brake(dt, 10);
      this.modeTimer -= dt;
      if (this.modeTimer <= 0) {
        this.mode = 'dash';
        this.modeTimer = 0.7;
        const aim = { x: pl.pos.x + pl.vel.x * 0.25, y: pl.pos.y + pl.vel.y * 0.25 };
        this.dashDir = normalize(sub(aim, this.pos));
        w.fx.ring(this.pos.x, this.pos.y, '#ff5a5a', 60, 0.4, 3);
        w.fx.burst(this.pos.x, this.pos.y + 10, 'rgba(190, 150, 90, 0.8)', 10, 160, 3, 0.5);
        if (this.nearPlayer(w, 700)) w.sfx.dash();
      }
      return;
    }

    if (this.mode === 'dash') {
      this.vel = scale(this.dashDir, 480 * (1 + 0.04 * (w.level - 1)));
      this.modeTimer -= dt;
      w.fx.puff(this.pos.x, this.pos.y, 'rgba(255, 90, 90, 0.55)', 12);
      if (this.modeTimer <= 0) this.endDash();
      return;
    }

    if (this.dashCooldown <= 0 && pl.ram > 0 && pl.invuln <= 0 && this.nearPlayer(w, 330)) {
      this.mode = 'windup';
      this.modeTimer = 0.6;
      this.say(pick(['Mine now.', 'Hold my RAM.', 'Incoming!']), 1.2);
      return;
    }

    this.retargetTimer -= dt;
    if (!this.target || this.retargetTimer <= 0) {
      this.retargetTimer = 0.7;
      this.target = this.nearest(w, (p) => dist(this.pos, p.pos) - (p.kind === 'gpu' ? 700 : 0));
    }
    const speed = this.speed(w);
    if (!this.target) {
      this.wander(dt, speed);
      return;
    }
    // Erratic: weave side to side on the way.
    const dir = normalize(sub(this.target.pos, this.pos));
    const wob = Math.sin(this.t * 2.5) * 0.45;
    this.steer({ x: dir.x - dir.y * wob, y: dir.y + dir.x * wob }, speed, dt);
  }

  private endDash(): void {
    this.mode = 'hunt';
    this.dashCooldown = rand(4.5, 6.5);
  }

  protected override onInterrupted(): void {
    this.endDash();
  }

  onPlayerContact(w: RivalWorld): void {
    if (this.mode === 'dash') {
      const n = w.stealRam(this, 2);
      this.say(n > 0 ? pick(['LOL. Mine.', 'Thanks for the RAM!']) : 'Concerning.', 1.6);
      w.knockPlayer(this.pos, 420);
      this.endDash();
      this.vel = scale(this.vel, -0.3);
    } else {
      w.knockPlayer(this.pos, 180);
    }
    this.contactCooldown = 1;
  }

  protected drawBody(ctx: CanvasRenderingContext2D, time: number): void {
    const jx = this.mode === 'windup' ? rand(-2, 2) : 0;
    const x = this.pos.x + jx;
    const r = this.radius;
    const bob = this.bob();
    const head = drawChibi(ctx, x, this.pos.y, r, ELON_STYLE, this.lookDir(), bob);

    const cy = this.pos.y + bob + r * 0.3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 5, cy - 5);
    ctx.lineTo(x + 5, cy + 5);
    ctx.moveTo(x + 5, cy - 5);
    ctx.lineTo(x - 5, cy + 5);
    ctx.stroke();

    if (this.mode === 'windup') {
      ctx.font = pixelFont(18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const s = 1 + 0.2 * Math.sin(time * 30);
      ctx.save();
      ctx.translate(head.x, this.pos.y - r - 26);
      ctx.scale(s, s);
      outlinedText(ctx, '!', 0, 0, '#ff3b3b', '#2a0000', 4);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// Gemini: search giant. Slow, magnet-pulls nearby pickups, teleports to clusters.
// ---------------------------------------------------------------------------

export class Gemini extends Rival {
  protected readonly lines = [
    "I'm feeling lucky.",
    'About 1,000,000 results.',
    'Did you mean: RAM?',
    'TPUs > GPUs.',
    'Indexing the desert…',
  ] as const;
  protected readonly hurtLines = ['Error 500!', 'Ouch. Re-ranking you.', 'Search interrupted!'] as const;
  protected readonly angryLines = ["You've been ranked: LAST.", 'Searching for revenge…', 'Deindexing you!'] as const;
  private indexTimer = rand(8, 11);
  private readonly magnet = 125;

  constructor(team: Team, pos: Vec) {
    super(team, 'Gemini', pos);
    this.baseSpeed = 120;
    this.radius = 20;
  }

  protected think(dt: number, w: RivalWorld): void {
    this.indexTimer -= dt;
    if (this.indexTimer <= 0) {
      this.indexTimer = rand(10, 13);
      this.reindex(w);
    }

    for (const p of w.pickups) {
      if (!p.alive || p.airborne) continue;
      const d = dist(p.pos, this.pos);
      if (d < this.magnet && d > 1) {
        const n = normalize(sub(this.pos, p.pos));
        p.pos.x += n.x * 150 * dt;
        p.pos.y += n.y * 150 * dt;
      }
    }

    this.retargetTimer -= dt;
    if (!this.target || this.retargetTimer <= 0) {
      this.retargetTimer = 1;
      this.target = this.nearest(w, (p) => dist(p.pos, this.pos));
    }
    const speed = this.speed(w);
    if (this.target) this.steer(sub(this.target.pos, this.pos), speed, dt, 3);
    else this.wander(dt, speed);
  }

  /** Teleport to the densest cluster of pickups (away from the player). */
  private reindex(w: RivalWorld): void {
    const candidates = w.pickups.filter((p) => p.alive && dist(p.pos, w.player.pos) > 280);
    let best: Pickup | null = null;
    let bestCount = -1;
    for (const a of candidates) {
      let count = 0;
      for (const b of candidates) if (dist(a.pos, b.pos) < 260) count += b.kind === 'gpu' ? 3 : 1;
      if (count > bestCount) {
        bestCount = count;
        best = a;
      }
    }
    if (!best) return;

    w.fx.burst(this.pos.x, this.pos.y, '#7aa2ff', 24, 200, 3, 0.7);
    w.fx.ring(this.pos.x, this.pos.y, '#b06cff', 80, 0.5);
    w.fx.beam(this.pos.x, this.pos.y, '#7aa2ff');
    const wasNear = this.nearPlayer(w, 700);
    this.pos = {
      x: clamp(best.pos.x + rand(-50, 50), this.radius, WORLD_W - this.radius),
      y: clamp(best.pos.y + rand(-50, 50), this.radius, WORLD_H - this.radius),
    };
    this.vel = vec();
    this.target = null;
    w.fx.burst(this.pos.x, this.pos.y, '#b06cff', 24, 200, 3, 0.7);
    w.fx.ring(this.pos.x, this.pos.y, '#7aa2ff', 80, 0.5);
    w.fx.beam(this.pos.x, this.pos.y, '#b06cff');
    this.say(pick(['Re-indexing…', 'Found 1,240 results.', "I'm feeling lucky."]), 1.8);
    if (wasNear || this.nearPlayer(w, 700)) w.sfx.teleport();
  }

  onPlayerContact(w: RivalWorld): void {
    w.knockPlayer(this.pos, 300);
    this.say('Did you mean: move?', 1.6);
    this.contactCooldown = 1.5;
  }

  protected drawBody(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.pos;
    const R = this.radius;

    if (this.showAura) {
      ctx.save();
      ctx.strokeStyle = 'rgba(122, 162, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ctx.arc(x, y, this.magnet, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const rot = this.t * 0.9;
    const pulse = 1 + 0.06 * Math.sin(this.t * 4);
    const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
    g.addColorStop(0, '#4f8cff');
    g.addColorStop(0.55, '#a46bff');
    g.addColorStop(1, '#ff7ab6');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const a = rot + (i * TAU) / 4;
      const tipX = x + Math.cos(a) * R * 1.35 * pulse;
      const tipY = y + Math.sin(a) * R * 1.35 * pulse;
      if (i === 0) {
        ctx.moveTo(tipX, tipY);
      } else {
        const ca = a - TAU / 8;
        ctx.quadraticCurveTo(x + Math.cos(ca) * R * 0.2, y + Math.sin(ca) * R * 0.2, tipX, tipY);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const look = this.lookDir();
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      dot(ctx, x + s * 5, y - 1, 3.6);
      ctx.fillStyle = '#1b1b24';
      dot(ctx, x + s * 5 + look.x * 1.5, y - 1 + look.y * 1.5, 1.8);
    }
  }
}

// ---------------------------------------------------------------------------
// Chinese Labs: a cheap, fast swarm. Shadows your path, snipes your targets,
// and "distills" your power on contact.
// ---------------------------------------------------------------------------

export class SwarmBot extends Rival {
  protected readonly lines = [
    'Same RAM, 1/10 the cost.',
    'Open weights!',
    'Distilling…',
    'Efficient!',
    'Mixture of RAM experts.',
  ] as const;
  protected readonly hurtLines = ['Ow! Rebooting…', 'Recompiling…', 'Error 404!'] as const;
  protected readonly angryLines = ['Whole lab: retaliate!', 'You hit one, you hit us all.', 'Counter-distilling!'] as const;
  private readonly flock: SwarmBot[];

  /** Hit one bot and the rest of the lab comes after you right away. */
  protected override onStunned(): void {
    for (const b of this.flock) if (b !== this && !b.stunned) b.enrage();
  }

  constructor(team: Team, label: string, pos: Vec, flock: SwarmBot[]) {
    super(team, label, pos);
    this.baseSpeed = 200;
    this.radius = 11;
    this.flock = flock;
    flock.push(this);
  }

  protected think(dt: number, w: RivalWorld): void {
    this.retargetTimer -= dt;
    if (!this.target || this.retargetTimer <= 0) {
      this.retargetTimer = 0.4;
      const pl = w.player;
      // Predict where Sam is heading and grab what's there first.
      const lead = { x: pl.pos.x + pl.vel.x * 0.9, y: pl.pos.y + pl.vel.y * 0.9 };
      const claimed = new Set<Pickup>();
      for (const b of this.flock) if (b !== this && b.target) claimed.add(b.target);
      this.target = this.nearest(w, (p) =>
        claimed.has(p) ? Infinity : dist(p.pos, lead) + dist(p.pos, this.pos) * 0.35,
      );
    }

    let dir = this.target ? normalize(sub(this.target.pos, this.pos)) : normalize(sub(w.player.pos, this.pos));
    for (const b of this.flock) {
      if (b === this) continue;
      const d = dist(b.pos, this.pos);
      if (d < 40 && d > 0) {
        const n = normalize(sub(this.pos, b.pos));
        const f = (40 - d) / 40;
        dir = { x: dir.x + n.x * f, y: dir.y + n.y * f };
      }
    }
    this.steer(dir, this.speed(w), dt, 7);
  }

  onPlayerContact(w: RivalWorld): void {
    w.distill(this, 15);
    this.say('Distilling…', 1.4);
    this.contactCooldown = 2.5;
  }

  protected drawBody(ctx: CanvasRenderingContext2D, time: number): void {
    const r = this.radius;
    const x = this.pos.x;
    const y = this.pos.y + Math.sin(this.t * 10) * 1.2;
    ctx.fillStyle = '#d92b3a';
    ctx.strokeStyle = '#7a0f19';
    ctx.lineWidth = 2;
    dot(ctx, x, y, r);
    ctx.stroke();

    const look = this.lookDir();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.roundRect(x - r * 0.7 + look.x * 2, y - r * 0.35 + look.y * 2, r * 1.4, r * 0.5, r * 0.25);
    ctx.fill();

    ctx.strokeStyle = '#7a0f19';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + 3, y - r - 7);
    ctx.stroke();
    ctx.fillStyle = Math.sin(time * 8 + this.t) > 0 ? '#ffd23f' : '#ff7a85';
    dot(ctx, x + 3, y - r - 8, 2.2);
  }
}

/** Cartoon anger "vein" mark. */
function drawAngerMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#ff3b3b';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.arc(5, 5, 3.5, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Places each rival in its own corner of the map. */
export function spawnRivals(teams: Teams): Rival[] {
  const m = 260;
  const [a, b, c, d] = shuffle<Vec>([
    { x: m, y: m },
    { x: WORLD_W - m, y: m },
    { x: m, y: WORLD_H - m },
    { x: WORLD_W - m, y: WORLD_H - m },
  ]) as [Vec, Vec, Vec, Vec];
  const flock: SwarmBot[] = [];
  return [
    new Dario(teams.dario, a),
    new Elon(teams.elon, b),
    new Gemini(teams.gemini, c),
    new SwarmBot(teams.china, 'DeepSeek', { x: d.x - 30, y: d.y }, flock),
    new SwarmBot(teams.china, 'Qwen', { x: d.x + 30, y: d.y }, flock),
    new SwarmBot(teams.china, 'Kimi', { x: d.x, y: d.y + 30 }, flock),
  ];
}
