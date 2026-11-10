import { CREDIT_TEXT, VIEW_H, VIEW_W } from '../config';
import { Effects } from '../fx/effects';
import { JENSEN_COLOR, Jensen } from '../entities/jensen';
import { Pickup, type PickupKind } from '../entities/pickup';
import { Player } from '../entities/player';
import { createTeams, spawnRivals, type Rival } from '../entities/rivals';
import { pick, rand } from '../math';
import { TAU, dot, outlinedText, pixelFont, uiFont, wrapText } from './draw';

interface Falling {
  icon: Pickup;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  rot: number;
  spin: number;
  scale: number;
  ambient: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  life: number;
}

const HEADLINES = [
  'Sam asks investors for $7 trillion, "mostly for RAM"',
  'GPU prices hit an all-time high for the 40th week in a row',
  'Analysts insist: "This is NOT a bubble"',
  'Dario publishes 40,000-word essay on responsible RAM hoarding',
  'Elon promises Colossus 3 "by next Tuesday"',
  'Gemini finds 1,000,000 results for "RAM near me"',
  'Chinese lab matches frontier performance with a single stick of RAM',
  'Jensen offers to lend everyone the money to buy his chips',
  'Leather jacket futures soar after surprise keynote',
  'Desert data center runs out of water, again',
  'Local man trades house for 16 GB of DDR5',
  'VCs launch new fund to fund the funds that fund AI',
  'RAM ALTMAN was created by www.kitsorfan.com',
  'Disclaimer: RAM ALTMAN is a parody, not affiliated with any company or person in it',
] as const;

const CARDS = [
  { name: 'DARIO', color: '#e8875f', text: 'Avoids you and stops for safety evals. Never steals.', cast: [0] },
  { name: 'ELON', color: '#c3c9d6', text: 'A red ! means he is about to charge. A hit steals 2 RAM.', cast: [1] },
  { name: 'GEMINI', color: '#7aa2ff', text: 'Magnet-pulls RAM and teleports to the good stuff.', cast: [2] },
  { name: 'CHINESE LABS', color: '#ff4d5e', text: 'A fast swarm. Snipes your path and drains your energy.', cast: [3, 4, 5] },
] as const;

const CONTROLS: ReadonlyArray<{ keys: readonly string[]; label: string }> = [
  { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
  { keys: ['SHIFT'], label: 'Sprint' },
  { keys: ['SPACE'], label: 'Shove' },
  { keys: ['E'], label: 'Sonar' },
  { keys: ['P'], label: 'Pause' },
  { keys: ['M'], label: 'Mute' },
  { keys: ['N'], label: 'Music' },
];

const SAM_LINES = ['We need more RAM!', '$7 trillion, please!', 'Feel the AGI!', "It's NOT a bubble!"] as const;
const JENSEN_KEYNOTE_LINES = ['The more you buy, the more you save!', 'Who wants a GPU?'] as const;
const JENSEN_TOSS_LINES = ['I will lend you the money to buy my chips!', 'Free GPUs! Catch!'] as const;
const JENSEN_Y = 526;
const JENSEN_SHOW = 3.6;
const KINDS: readonly PickupKind[] = ['ram', 'ram', 'ram', 'gpu', 'energy'];

const BUBBLE_X = VIEW_W / 2;
const BUBBLE_Y = 92;
const LANE_Y = 552;
const RUN_SPEED = 150;
const BUBBLE_GROW_TIME = 6.5;

/** Attract-mode splash screen: a bubble that inflates and pops, a chase across the dunes, and a news ticker. */
export class TitleScreen {
  /** Set by the game while the pointer is over the credit badge. */
  creditHover = false;
  private creditBox = { x: 0, y: 0, w: 0, h: 0 };
  private readonly fx = new Effects();
  private readonly sam = new Player();
  /** Rivals chasing Sam across the dunes. */
  private readonly cast: Rival[];
  /** Separate copies posing on the trading cards. */
  private readonly portraits: Rival[];
  private falling: Falling[] = [];
  /** GPUs Jensen throws; drawn in front of the dunes. */
  private tossed: Falling[] = [];
  private shooting: ShootingStar | null = null;
  /** Jensen pops up on the dunes now and then to throw GPUs around. */
  private readonly jensen = new Jensen('giveaway', { x: -200, y: JENSEN_Y });
  private jensenTimer = 3.5;
  private jensenShow = 0;
  private jensenTossed = false;
  private time = 0;
  private bubbleT = 0;
  private popCooldown = 0;
  private flash = 0;
  private titleKick = 0;
  private speechTimer = 1.2;
  private geminiTimer = 3;
  private geminiOffset = -240;
  private starTimer = 2;
  private readonly ticker = `${HEADLINES.join('     ★     ')}     ★     `;

  constructor() {
    this.cast = spawnRivals(createTeams());
    this.portraits = spawnRivals(createTeams());
    for (const r of [...this.cast, ...this.portraits]) r.showAura = false;
    for (const r of this.portraits) r.showLabel = false;
    this.sam.look = { x: 1, y: 0 };
    this.sam.moving = true;
    for (let i = 0; i < 16; i++) this.falling.push(this.makeFalling(true, rand(-VIEW_H, VIEW_H)));
  }

  private makeFalling(ambient: boolean, y: number, x = rand(0, VIEW_W)): Falling {
    return {
      icon: new Pickup(pick(KINDS), { x: 0, y: 0 }),
      x,
      y,
      vx: ambient ? 0 : rand(-180, 180),
      vy: ambient ? rand(25, 60) : rand(-260, -120),
      gravity: ambient ? 0 : 320,
      rot: rand(0, TAU),
      spin: rand(-1.5, 1.5),
      scale: ambient ? rand(0.6, 1) : rand(0.8, 1.1),
      ambient,
    };
  }

  update(dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.titleKick = Math.max(0, this.titleKick - dt * 2.5);

    // The bubble inflates... and pops. Forever.
    if (this.popCooldown > 0) {
      this.popCooldown -= dt;
      if (this.popCooldown <= 0) this.bubbleT = 0;
    } else {
      this.bubbleT += dt / BUBBLE_GROW_TIME;
      if (this.bubbleT >= 1) this.pop();
    }

    for (const f of [...this.falling, ...this.tossed]) {
      f.vy += f.gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.ambient && f.y > VIEW_H + 40) {
        f.y = -40;
        f.x = rand(0, VIEW_W);
      }
    }
    this.falling = this.falling.filter((f) => f.ambient || f.y < VIEW_H + 40);
    this.tossed = this.tossed.filter((f) => f.y < VIEW_H + 40);
    this.updateJensen(dt);

    this.starTimer -= dt;
    if (this.starTimer <= 0) {
      this.starTimer = rand(3, 6);
      this.shooting = { x: rand(200, VIEW_W), y: rand(10, 110), life: 0.8 };
    }
    if (this.shooting) {
      this.shooting.x -= 600 * dt;
      this.shooting.y += 220 * dt;
      this.shooting.life -= dt;
      if (this.shooting.life <= 0) this.shooting = null;
    }

    this.updateChase(dt);
    for (const r of this.portraits) r.animate(dt);
  }

  private updateChase(dt: number): void {
    const span = VIEW_W + 720;
    const lead = ((this.time * RUN_SPEED) % span) - 120;
    const run = { x: RUN_SPEED, y: 0 };

    this.sam.pos.x = lead;
    this.sam.pos.y = LANE_Y;
    this.sam.animate(dt);
    if (Math.random() < dt * 12) this.fx.burst(lead - 8, LANE_Y + 15, 'rgba(230, 170, 110, 0.7)', 1, 40, 2.5, 0.4);

    const [dario, elon, gemini, ...bots] = this.cast;

    if (elon) {
      // Elon lunges at Sam every few seconds.
      const phase = this.time % 3.2;
      const lunge = phase > 2.6 ? Math.sin(((phase - 2.6) / 0.6) * Math.PI) * 60 : 0;
      elon.pos = { x: lead - 100 + lunge, y: LANE_Y + 4 };
      if (lunge > 5) this.fx.puff(elon.pos.x - 12, elon.pos.y, 'rgba(255, 90, 90, 0.5)', 12);
    }

    bots.forEach((b, i) => {
      b.pos = { x: lead - 170 - i * 38 + Math.sin(this.time * 4 + i) * 6, y: LANE_Y + 8 + Math.sin(this.time * 6 + i * 2) * 7 };
    });

    if (gemini) {
      this.geminiTimer -= dt;
      const before = { x: lead + this.geminiOffset, y: LANE_Y - 4 };
      if (this.geminiTimer <= 0) {
        this.geminiTimer = rand(2.8, 4.2);
        this.fx.beam(before.x, before.y, '#7aa2ff');
        this.geminiOffset = pick([-300, -260, 120, 160].filter((o) => o !== this.geminiOffset));
        this.fx.beam(lead + this.geminiOffset, before.y, '#b06cff');
      }
      gemini.pos = { x: lead + this.geminiOffset, y: LANE_Y - 4 };
    }

    if (dario) dario.pos = { x: lead - 400 + Math.sin(this.time * 0.8) * 25, y: LANE_Y };

    for (const r of this.cast) {
      r.vel = { ...run };
      r.animate(dt);
    }

    this.speechTimer -= dt;
    if (this.speechTimer <= 0) {
      this.speechTimer = rand(1.5, 2.5);
      const onScreen = [this.sam, ...this.cast.slice(0, 4)].filter((a) => a.pos.x > 80 && a.pos.x < VIEW_W - 80);
      if (onScreen.length) {
        const who = pick(onScreen);
        if (who instanceof Player) who.say(pick(SAM_LINES), 2);
        else who.chatter(2);
      }
    }
  }

  /** Beam in on the dunes, hold a GPU up, throw a handful, pitch a loan, beam out. */
  private updateJensen(dt: number): void {
    const j = this.jensen;
    j.animate(dt);
    if (this.jensenShow <= 0) {
      this.jensenTimer -= dt;
      if (this.jensenTimer > 0) return;
      // Off to one side, clear of the centered start button.
      j.pos.x = Math.random() < 0.5 ? rand(170, 260) : rand(700, 790);
      j.pos.y = JENSEN_Y;
      j.holding = true;
      j.say(pick(JENSEN_KEYNOTE_LINES), 1.4);
      this.jensenShow = JENSEN_SHOW;
      this.jensenTossed = false;
      this.fx.beam(j.pos.x, j.pos.y, JENSEN_COLOR);
      this.fx.ring(j.pos.x, j.pos.y, JENSEN_COLOR, 60, 0.5, 3);
      return;
    }

    this.jensenShow -= dt;
    if (!this.jensenTossed && this.jensenShow < JENSEN_SHOW - 1.4) {
      this.jensenTossed = true;
      j.holding = false;
      j.say(pick(JENSEN_TOSS_LINES), 2);
      const away = j.pos.x < VIEW_W / 2 ? -1 : 1; // throw outward, away from the start button
      for (let i = 0; i < 4; i++) {
        this.tossed.push({
          icon: new Pickup('gpu', { x: 0, y: 0 }),
          x: j.pos.x,
          y: j.pos.y - 30,
          vx: away * rand(-50, 170),
          vy: rand(-380, -280),
          gravity: 520,
          rot: rand(0, TAU),
          spin: rand(-4, 4),
          scale: rand(0.8, 1),
          ambient: false,
        });
      }
      this.fx.confetti(j.pos.x, j.pos.y - 30, 30);
    }
    if (this.jensenShow <= 0) {
      this.fx.beam(j.pos.x, j.pos.y, JENSEN_COLOR);
      this.jensenTimer = rand(6, 9);
    }
  }

  private pop(): void {
    this.popCooldown = 1.4;
    this.flash = 1;
    this.titleKick = 1;
    const x = BUBBLE_X;
    const y = BUBBLE_Y;
    this.fx.burst(x, y, '#ffb3e6', 50, 420, 4, 1);
    this.fx.confetti(x, y, 90);
    this.fx.ring(x, y, '#ffd6f2', 280, 0.8, 6);
    this.fx.text(x, y - 6, 'POP!', '#ff8ad8', 40);
    for (let i = 0; i < 10; i++) this.falling.push(this.makeFalling(false, y, x + rand(-60, 60)));
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  draw(ctx: CanvasRenderingContext2D, highScore: number): void {
    const sky = this.drawSky(ctx);
    this.drawSun(ctx, sky);
    this.drawFalling(ctx, this.falling);
    this.drawBubble(ctx);
    this.drawTitle(ctx);
    this.drawCards(ctx);
    this.drawControls(ctx);
    this.drawStartButton(ctx);
    this.fx.drawParticles(ctx);
    this.drawDunes(ctx);
    this.drawFalling(ctx, this.tossed);
    this.drawChase(ctx);
    this.fx.drawOverlay(ctx);
    this.drawCredit(ctx);
    this.drawTicker(ctx);
    this.drawCorners(ctx, highScore);
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D): CanvasGradient {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, '#140a30');
    sky.addColorStop(0.5, '#3d1d55');
    sky.addColorStop(0.78, '#a4506a');
    sky.addColorStop(1, '#f08a5d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    for (let i = 0; i < 90; i++) {
      const sx = (i * 397.3) % VIEW_W;
      const sy = (i * 211.7) % (VIEW_H * 0.6);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 1.5 + i));
      ctx.fillStyle = `rgba(255, 255, 255, ${tw * 0.8})`;
      const size = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, size, size);
    }

    if (this.shooting) {
      const { x, y, life } = this.shooting;
      const g = ctx.createLinearGradient(x, y, x + 70, y - 26);
      g.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, life * 2)})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 70, y - 26);
      ctx.stroke();
    }
    return sky;
  }

  /** Retro striped sunset sun peeking over the dunes. */
  private drawSun(ctx: CanvasRenderingContext2D, sky: CanvasGradient): void {
    const sx = VIEW_W * 0.8;
    const sy = 470;
    const sr = 80;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.clip();
    const g = ctx.createLinearGradient(0, sy - sr, 0, sy + sr * 0.3);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#ff5e7e');
    ctx.fillStyle = g;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.fillStyle = sky;
    for (let i = 0; i < 6; i++) ctx.fillRect(sx - sr, sy - 20 + i * 12 + ((this.time * 8) % 12), sr * 2, 2 + i * 1.2);
    ctx.restore();
  }

  private drawFalling(ctx: CanvasRenderingContext2D, items: readonly Falling[]): void {
    for (const f of items) {
      ctx.save();
      ctx.globalAlpha = f.ambient ? 0.4 : 1;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.scale(f.scale, f.scale);
      f.icon.drawIcon(ctx, this.time);
      ctx.restore();
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D): void {
    if (this.popCooldown > 0) return;
    const e = 1 - Math.pow(1 - this.bubbleT, 3);
    const tense = this.bubbleT > 0.82;
    const x = BUBBLE_X + (tense ? rand(-2.5, 2.5) : 0);
    const y = BUBBLE_Y + (tense ? rand(-2.5, 2.5) : 0);
    const r = 34 + 130 * e + Math.sin(this.time * 5) * 3 * e;

    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    g.addColorStop(0.5, 'rgba(255, 140, 220, 0.12)');
    g.addColorStop(1, tense ? 'rgba(255, 90, 120, 0.4)' : 'rgba(140, 120, 255, 0.25)');
    ctx.fillStyle = g;
    dot(ctx, x, y, r);
    ctx.strokeStyle = 'rgba(255, 200, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 3.6, 4.4);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Hype money orbiting the bubble.
    ctx.font = pixelFont(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const a = this.time * 0.9 + (i * TAU) / 6;
      outlinedText(ctx, '$', x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14) * 0.85, '#9dffbf', '#0b2a18', 3);
    }
  }

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    const text = 'RAM ALTMAN';
    const baseY = 68;
    ctx.font = pixelFont(50);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ramGrad = ctx.createLinearGradient(0, -25, 0, 25);
    ramGrad.addColorStop(0, '#d4ffe2');
    ramGrad.addColorStop(1, '#2fbf6a');
    const altGrad = ctx.createLinearGradient(0, -25, 0, 25);
    altGrad.addColorStop(0, '#fff6c8');
    altGrad.addColorStop(1, '#ffa23a');

    let x = VIEW_W / 2 - ctx.measureText(text).width / 2;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      const w = ctx.measureText(ch).width;
      if (ch !== ' ') {
        const wave = Math.sin(this.time * 4 - i * 0.55) * 6;
        const kick = this.titleKick * 24 * (0.6 + 0.4 * Math.sin(i * 2.1));
        const rot = Math.sin(this.time * 3 + i) * 0.05 + this.titleKick * 0.35 * Math.sin(i * 1.3);
        ctx.save();
        ctx.translate(x + w / 2, baseY + wave - kick);
        ctx.rotate(rot);
        ctx.fillStyle = 'rgba(20, 5, 40, 0.5)';
        ctx.fillText(ch, -w / 2 + 4, 6);
        outlinedText(ctx, ch, -w / 2, 0, i < 3 ? ramGrad : altGrad, '#2a0f3d', 9);
        ctx.restore();
      }
      x += w;
    }

    ctx.textAlign = 'center';
    ctx.font = uiFont(17, 800);
    outlinedText(ctx, "You're Sam. Hoard the RAM before the AI bubble bursts!", VIEW_W / 2, 122, '#ffe9f5', '#2a0f3d', 5);
  }

  private drawCards(ctx: CanvasRenderingContext2D): void {
    const w = 210;
    const h = 158;
    const gap = 14;
    const startX = (VIEW_W - (4 * w + 3 * gap)) / 2;
    const top = 148;

    CARDS.forEach((card, i) => {
      const bob = Math.sin(this.time * 2.2 + i * 1.3) * 3;
      const tilt = Math.sin(this.time * 1.4 + i) * 0.015;
      ctx.save();
      ctx.translate(startX + i * (w + gap) + w / 2, top + h / 2 + bob);
      ctx.rotate(tilt);
      ctx.translate(-w / 2, -h / 2);

      ctx.fillStyle = 'rgba(14, 10, 30, 0.86)';
      ctx.strokeStyle = card.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 12);
      ctx.fill();
      ctx.stroke();

      ctx.globalAlpha = 0.22 + 0.06 * Math.sin(this.time * 3 + i);
      ctx.fillStyle = card.color;
      dot(ctx, w / 2, 52, 44);
      ctx.globalAlpha = 1;

      card.cast.forEach((idx, k) => {
        const r = this.portraits[idx];
        if (!r) return;
        const px = w / 2 + (k - (card.cast.length - 1) / 2) * 36;
        const py = 56 + Math.sin(this.time * 5 + k + i) * 2;
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1.55, 1.55);
        r.pos = { x: 0, y: 0 };
        r.vel = { x: 0, y: 0 };
        r.draw(ctx, this.time);
        ctx.restore();
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = pixelFont(10);
      outlinedText(ctx, card.name, w / 2, 112, card.color, '#0a0614', 3);
      ctx.font = uiFont(12, 600);
      ctx.fillStyle = '#e6e1f5';
      wrapText(ctx, card.text, w / 2, 131, w - 22, 15);
      ctx.restore();
    });
  }

  private drawControls(ctx: CanvasRenderingContext2D): void {
    const y = 322;
    const capFont = uiFont(11, 800);
    const labelFont = uiFont(13, 700);
    const groups = CONTROLS.map((g) => {
      ctx.font = capFont;
      const caps = g.keys.map((k) => Math.max(22, ctx.measureText(k).width + 14));
      ctx.font = labelFont;
      const labelW = ctx.measureText(g.label).width;
      return { keys: g.keys, label: g.label, caps, labelW, width: caps.reduce((a, b) => a + b, 0) + (caps.length - 1) * 3 + 6 + labelW };
    });
    const total = groups.reduce((a, g) => a + g.width, 0) + (groups.length - 1) * 18;

    // One key at a time "gets pressed", like an arcade demo.
    const keyCount = groups.reduce((a, g) => a + g.keys.length, 0);
    const pressed = Math.floor(this.time * 4) % keyCount;
    let keyIndex = 0;
    let x = VIEW_W / 2 - total / 2;
    for (const g of groups) {
      g.keys.forEach((k, i) => {
        const cw = g.caps[i] ?? 22;
        drawKeycap(ctx, x, y, cw, 22, k, capFont, keyIndex === pressed);
        keyIndex++;
        x += cw + 3;
      });
      x += 3;
      ctx.font = labelFont;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      outlinedText(ctx, g.label, x, y + 12, '#ffffff', '#2a0f3d', 3);
      x += g.labelW + 18;
    }

    ctx.textAlign = 'center';
    ctx.font = uiFont(14, 700);
    outlinedText(
      ctx,
      'Grab RAM before the bubble pops  ·  Cool off in WATER  ·  Refill ENERGY cells  ·  Shoving works, but it costs you',
      VIEW_W / 2,
      368,
      '#ffe9f5',
      '#2a0f3d',
      4,
    );
  }

  private drawStartButton(ctx: CanvasRenderingContext2D): void {
    const cx = VIEW_W / 2;
    const cy = 414;
    const w = 390;
    const h = 46;
    const s = 1 + 0.05 * Math.sin(this.time * 6);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(255, 120, 200, 0.9)';
    ctx.shadowBlur = 20 + 10 * Math.sin(this.time * 6);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#ff5fa2');
    g.addColorStop(1, '#ff9a3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#ffe9f5';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Shine sweeping across the button.
    ctx.save();
    ctx.clip();
    const sx = -w / 2 + (((this.time * 0.7) % 1.6) - 0.3) * w;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(sx, -h / 2);
    ctx.lineTo(sx + 34, -h / 2);
    ctx.lineTo(sx + 12, h / 2);
    ctx.lineTo(sx - 22, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.font = pixelFont(14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, 'PRESS ENTER TO START', 0, 2, '#ffffff', '#7a1f4a', 5);
    ctx.restore();

    ctx.font = uiFont(12, 600);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('or click anywhere', cx, cy + 38);
  }

  private drawDunes(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4a2a4a';
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 16) ctx.lineTo(x, 482 + Math.sin(x * 0.007 + 1) * 14 + Math.sin(x * 0.019) * 5);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.fill();

    const g = ctx.createLinearGradient(0, 500, 0, VIEW_H);
    g.addColorStop(0, '#b56a43');
    g.addColorStop(1, '#6e3a2c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 16) ctx.lineTo(x, 514 + Math.sin(x * 0.009 + 2) * 9 + Math.sin(x * 0.023) * 4);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.fill();
  }

  private drawChase(ctx: CanvasRenderingContext2D): void {
    const actors: Array<Player | Rival | Jensen> = [this.sam, ...this.cast];
    if (this.jensenShow > 0) actors.push(this.jensen);
    const visible = actors.filter((a) => a.pos.x > -60 && a.pos.x < VIEW_W + 60).toSorted((a, b) => a.pos.y - b.pos.y);
    for (const a of visible) a.draw(ctx, this.time);
    for (const a of visible) a.drawSpeech(ctx);
  }

  /** True if a point (logical canvas coords) is on the credit badge. */
  hitCredit(p: { x: number; y: number }): boolean {
    const b = this.creditBox;
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  /** Clickable "Created by" badge just above the ticker. */
  private drawCredit(ctx: CanvasRenderingContext2D): void {
    ctx.font = uiFont(13, 800);
    const tw = ctx.measureText(CREDIT_TEXT).width;
    const w = tw + 28;
    const h = 22;
    const x = VIEW_W / 2 - w / 2;
    const y = 586;
    this.creditBox = { x, y, w, h };

    ctx.fillStyle = this.creditHover ? 'rgba(255, 95, 162, 0.9)' : 'rgba(14, 10, 30, 0.8)';
    ctx.strokeStyle = this.creditHover ? '#ffffff' : 'rgba(255, 233, 245, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(CREDIT_TEXT, VIEW_W / 2, y + h / 2 + 1);
    if (this.creditHover) {
      ctx.fillRect(VIEW_W / 2 - tw / 2, y + h / 2 + 8, tw, 1.5);
    }
  }

  private drawTicker(ctx: CanvasRenderingContext2D): void {
    const y = 612;
    const h = 28;
    ctx.fillStyle = 'rgba(10, 6, 20, 0.94)';
    ctx.fillRect(0, y, VIEW_W, h);
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(0, y, 104, h);
    ctx.font = pixelFont(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BREAKING', 52, y + h / 2 + 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(108, y, VIEW_W - 108, h);
    ctx.clip();
    ctx.font = uiFont(14, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a8';
    const tw = ctx.measureText(this.ticker).width;
    const off = (this.time * 90) % tw;
    ctx.fillText(this.ticker, 112 - off, y + h / 2 + 1);
    ctx.fillText(this.ticker, 112 - off + tw, y + h / 2 + 1);
    ctx.restore();
  }

  private drawCorners(ctx: CanvasRenderingContext2D, highScore: number): void {
    ctx.font = pixelFont(10);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    outlinedText(ctx, `HI ${String(highScore).padStart(7, '0')}`, 16, 14, '#ffffff', '#2a0f3d', 4);
    if (Math.floor(this.time * 2) % 2 === 0) {
      ctx.textAlign = 'right';
      outlinedText(ctx, 'INSERT $7 TRILLION', VIEW_W - 16, 14, '#ffe066', '#2a0f3d', 4);
    }
  }
}

function drawKeycap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  font: string,
  pressed: boolean,
): void {
  const lift = pressed ? 1 : 4;
  ctx.fillStyle = '#6b5a96';
  ctx.beginPath();
  ctx.roundRect(x, y + 4, w, h, 5);
  ctx.fill();
  ctx.fillStyle = pressed ? '#fff3b0' : '#f4efff';
  ctx.beginPath();
  ctx.roundRect(x, y + 4 - lift, w, h, 5);
  ctx.fill();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2a0f3d';
  ctx.fillText(label, x + w / 2, y + 4 - lift + h / 2 + 1);
}
