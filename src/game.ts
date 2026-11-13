import type { AudioEngine } from './audio/engine';
import type { Sfx } from './audio/sfx';
import {
  CIVILIANS_ON_FIELD,
  CIVILIAN_RESPAWN,
  COMBO_MAX,
  COMBO_WINDOW,
  CREDIT_URL,
  COOL_RATE,
  ENERGY_ON_FIELD,
  ENERGY_POWER,
  ENERGY_SPAWN_INTERVAL,
  FIRED_TIME,
  GPU_ON_FIELD,
  GPU_POINTS,
  HEAT_BASE,
  HEAT_GPU,
  HEAT_PER_LEVEL,
  HEAT_SPRINT,
  HEATWAVE_MULT,
  JENSEN_FIRST_VISIT,
  JENSEN_GIVEAWAY_GPUS,
  JENSEN_INTERVAL,
  LAWSUIT_FURY,
  LEADER_BONUS,
  LOAN_BUBBLE,
  LOAN_GPUS,
  LOAN_OFFER_TIME,
  LOW_POWER_MULT,
  MAGNET_RADIUS,
  PANIC_BUBBLE,
  PING_COST,
  POOL_BAD_PRESS,
  POWER_DRAIN,
  POWER_SPRINT,
  RAIN_RAM,
  RESIGN_BUBBLE,
  RAM_POINTS,
  RAM_SPAWN_INTERVAL,
  SHOVE_ARC,
  SHOVE_BAD_PRESS,
  SHOVE_DROP,
  SHOVE_ENERGY,
  SHOVE_HEAT,
  SHOVE_POINTS,
  SHOVE_RANGE,
  SPY_BOUNTY,
  SPY_STEAL,
  SOLAR_BELOW,
  SOLAR_HEAT,
  SOLAR_MAX,
  SOLAR_RATE,
  START_LIVES,
  SWARM_DROP_DIST,
  SWARM_FIRST,
  SWARM_INTERVAL,
  TIME_BONUS_PER_SEC,
  TWEET_BUBBLE,
  TWEET_COOLDOWN,
  TWEET_RANGE,
  TWEET_READ_TIME,
  VIEW_H,
  VIEW_W,
  WATER_CAPACITY,
  WATER_DRAIN,
  WATER_RESPAWN_DELAY,
  WORLD_H,
  WORLD_W,
  bubbleDuration,
  levelTarget,
  ramOnField,
  seriesName,
  swarmSize,
  waterCount,
} from './config';
import { Effects } from './fx/effects';
import { Civilian } from './entities/civilian';
import { SPY_COLOR, Spy } from './entities/spy';
import { JENSEN_COLOR, Jensen, type JensenVisit, type JensenWorld } from './entities/jensen';
import { Pickup, type PickupKind } from './entities/pickup';
import { Player } from './entities/player';
import {
  SWARM_NAMES,
  SwarmBot,
  allTeams,
  createTeams,
  spawnRivals,
  type Rival,
  type RivalWorld,
  type Teams,
} from './entities/rivals';
import { WaterSource } from './entities/water';
import type { Input } from './input';
import { clamp, dist, length, lerp, normalize, pick, rand, scale, sub, vec, type Vec } from './math';
import type { Music } from './audio/music';
import { Background } from './render/background';
import { TAU, outlinedText, pixelFont, uiFont } from './render/draw';
import { HUD_ENERGY_BAR, HUD_RAM_BAR, HUD_SCORE, drawHud, drawMinimap } from './render/hud';
import {
  drawBanner,
  drawGameOver,
  drawLevelClear,
  drawPaused,
  type GameOverInfo,
  type LevelClearInfo,
} from './render/overlays';
import { drawLoanOffer, offerButtonAt } from './render/offer';
import { PANEL_OFFSETS, drawSun } from './render/solar';
import { TitleScreen } from './render/title';
import { loadHighScore, saveHighScore } from './storage';
import { ScreenFx } from './fx/screen-fx';
import {
  Headlines,
  NewsDesk,
  PANIC_LINES,
  STORIES,
  SPY_DENIALS,
  SUMMIT_LECTURE,
  SUMMIT_LINES,
  TWEETS,
  TWEET_REACTIONS,
  type NewsKind,
  type NewsStory,
} from './news';

type State = 'title' | 'playing' | 'paused' | 'levelClear' | 'gameOver';

interface Timed {
  title: string;
  sub: string;
  time: number;
  color?: string;
}

/** The visits Jensen makes on his own schedule (stepping down only happens as breaking news). */
type DropInVisit = Exclude<JensenVisit, 'resign'>;

interface LoanOffer {
  title: string;
  pitch: string;
  time: number;
  age: number;
}

interface Drawable {
  pos: Vec;
  draw(ctx: CanvasRenderingContext2D, time: number): void;
}

const ZERO: Vec = { x: 0, y: 0 };
const COMBO_MILESTONES = new Set([3, 5, 8]);
const START_LINES = ["Let's raise another round!", 'AGI is near. RAM is nearer.', 'Time to scale.'] as const;
const GPU_LINES = ['We need $7 trillion more.', 'Feel the AGI!', 'More compute!', 'Scaling laws, baby.'] as const;
const WATER_LINES = ['Ahh, liquid cooling.', 'Hydrating the cluster.', 'Water-cooled AGI.'] as const;
const ENERGY_LINES = ['Fusion would be nice.', 'Charging up!', 'More power!'] as const;
const SOLAR_LINES = ['Sustainable AGI!', 'Free energy, baby.', 'Powered by the big lamp in the sky.', 'Fusion is late. Sun it is.'] as const;
const DROP_LINES =['Surprise!', 'Open weights!', 'Trained for $5M!', 'Hello from nowhere!'] as const;
const POOL_LINES = [
  'Idle RAM is quite terrible.',
  "I'm pooling it to the cloud.",
  "You'll get it back as a subscription.",
  'Thank you for your service to AGI.',
] as const;
const LOAN_TITLES = ['VENDOR FINANCING', 'CIRCULAR DEAL', 'LIMITED-TIME OFFER'] as const;
const LOAN_YES_LINES = ['Put it on my tab!', 'Circular? Never heard of it.', 'What could go wrong?'] as const;
const FIRED_LINES = ['Wait, what?', 'Not consistently candid? Me?', 'Can I at least keep the plant?'] as const;
const REHIRED_LINES = ["I'm back, baby.", 'Miss me?', 'I never really left.'] as const;
const CLEAR_QUIPS = [
  'Valuation up. The bubble holds… for now.',
  "Valuation: $1 trillion. Revenue: let's not talk about it.",
  `Investors: "We don't get it, but we're in."`,
  'The board is thrilled. For now.',
  'AGI is just one more round away. Probably.',
] as const;
const POP_LINES = [
  'Investors want their money back.',
  'Turns out it WAS a bubble.',
  'Analysts who said "not a bubble" are unavailable for comment.',
] as const;

/** A random line for this team from a per-team table, if it has any. */
function lineFor(lines: Readonly<Record<string, readonly string[]>>, teamId: string): string | undefined {
  const options = lines[teamId];
  return options?.length ? pick(options) : undefined;
}

export class Game implements RivalWorld, JensenWorld {
  readonly player = new Player();
  readonly fx = new Effects();
  readonly sfx: Sfx;
  pickups: Pickup[] = [];
  level = 1;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fogCanvas: HTMLCanvasElement;
  private readonly fogCtx: CanvasRenderingContext2D;
  private readonly input: Input;
  private readonly audio: AudioEngine;
  private readonly music: Music;
  private readonly bg: Background;
  private readonly screenFx = new ScreenFx();
  private readonly title = new TitleScreen();
  private pxScale = 1;
  private clicked = false;

  private state: State = 'title';
  private stateTime = 0;
  private levelTime = 0;
  private water: WaterSource[] = [];
  private rivals: Rival[] = [];
  private teams: Teams = createTeams();
  private score = 0;
  private highScore = loadHighScore();
  private combo = 0;
  private comboTimer = 0;
  private bubble = 0;
  private bubbleNote = 'BAD PRESS!';
  private time = 0;
  private cam: Vec = vec();
  private shake = 0;
  private hitStop = 0;
  private ramSpawnTimer = 0;
  private gpuSpawnTimer = 0;
  private energySpawnTimer = 0;
  private waterQueue: number[] = [];
  private pingTimer = 0;
  private pingTarget: WaterSource | null = null;
  private heatWarned = false;
  private levelGpus = 0;
  private stepDist = 0;
  private footSide = 1;
  private ghostTimer = 0;
  /** The Chinese Labs models on the field this level (they drop in over time). */
  private flock: SwarmBot[] = [];
  private swarmTimer = 0;
  /** Counts down to the next "+energy" tick while the solar panels charge. */
  private solarTick = 0;
  /** Has the player found the solar panels this game? Until then, low energy shows a hint about them. */
  private solarTaught = false;
  private readonly hitThisShove = new Set<Rival>();
  /** People out in the desert with idle RAM in their PCs. */
  private civilians: Civilian[] = [];
  private civilianQueue: number[] = [];
  private jensen: Jensen | null = null;
  private jensenTimer = 0;
  private nextVisit: DropInVisit = 'giveaway';
  /** Jensen stepped down this series (he's off testifying): no more keynotes or loans until the next one. */
  private jensenRetired = false;
  /** The alleged spy, while the spy story runs (and a moment after, while they fade out). */
  private spy: Spy | null = null;
  private offer: LoanOffer | null = null;
  /** Loans taken from Jensen this level. */
  private loans = 0;
  /** Where the pointer went down this frame while a loan offer is open. */
  private tap: Vec | null = null;
  private readonly news = new NewsDesk();
  /** RAM rain in progress: where it comes down, and what's still up for grabs. */
  private rain: { pos: Vec; drops: Pickup[] } | null = null;
  private thudTimer = 0;
  /** Team leading the RAM race (for the ticker). */
  private leaderId: string | null = null;
  private bubbleWarned = false;
  private banner: Timed | null = null;
  private toast: { text: string; time: number } | null = null;
  private clearInfo: LevelClearInfo | null = null;
  private overInfo: GameOverInfo | null = null;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement, input: Input, audio: AudioEngine, sfx: Sfx, music: Music) {
    this.canvas = canvas;
    this.input = input;
    this.audio = audio;
    this.sfx = sfx;
    this.music = music;
    const ctx = canvas.getContext('2d');
    this.fogCanvas = document.createElement('canvas');
    const fogCtx = this.fogCanvas.getContext('2d');
    if (!ctx || !fogCtx) throw new Error('Canvas 2D is not supported in this browser.');
    this.ctx = ctx;
    this.fogCtx = fogCtx;
    this.bg = new Background(ctx);

    // Pointer: the title's credit badge opens the creator's site; any other click acts like Enter.
    const toLogical = (e: PointerEvent): Vec => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * VIEW_W) / r.width, y: ((e.clientY - r.top) * VIEW_H) / r.height };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (this.state === 'title' && this.title.hitCredit(toLogical(e))) {
        // noopener + noreferrer: the new tab gets no handle back to the game and no referrer.
        window.open(CREDIT_URL, '_blank', 'noopener,noreferrer');
        return;
      }
      if (this.state === 'playing' && this.offer) {
        this.tap = toLogical(e);
        return;
      }
      this.clicked = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      const over = this.state === 'title' && this.title.hitCredit(toLogical(e));
      this.title.creditHover = over;
      canvas.style.cursor = over ? 'pointer' : '';
    });
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.setState('paused');
    });
    this.canvas.dataset['state'] = this.state;
    this.music.play('title');
  }

  start(): void {
    requestAnimationFrame(this.frame);
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private readonly resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const cssScale = this.canvas.clientWidth > 0 ? this.canvas.clientWidth / VIEW_W : 1;
    this.pxScale = clamp(cssScale * dpr, 1, 3);
    for (const c of [this.canvas, this.fogCanvas]) {
      c.width = Math.round(VIEW_W * this.pxScale);
      c.height = Math.round(VIEW_H * this.pxScale);
    }
  };

  private readonly frame = (ts: number): void => {
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;
    this.update(dt);
    this.render();
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  };

  private setState(state: State): void {
    const prev = this.state;
    this.state = state;
    this.stateTime = 0;
    this.canvas.dataset['state'] = state; // observable by tests and assistive tech
    switch (state) {
      case 'title':
        this.music.play('title');
        break;
      case 'playing':
        if (prev === 'paused') this.music.resume();
        else this.music.play('game');
        break;
      case 'paused':
        this.music.pause();
        break;
      default:
        this.music.stop();
    }
  }

  private update(dt: number): void {
    this.time += dt;
    this.stateTime += dt;
    const clicked = this.clicked;
    this.clicked = false;
    const confirm = this.input.wasPressed('Enter', 'NumpadEnter', 'Space') || clicked;

    if (this.input.wasPressed('KeyM')) this.showToast(this.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
    if (this.input.wasPressed('KeyN')) this.showToast(this.audio.toggleMusic() ? 'MUSIC ON' : 'MUSIC OFF');
    if (this.toast) {
      this.toast.time -= dt;
      if (this.toast.time <= 0) this.toast = null;
    }

    switch (this.state) {
      case 'title':
        this.title.update(dt);
        if (confirm) this.newGame();
        break;
      case 'playing':
        if (this.input.wasPressed('KeyP', 'Escape')) {
          this.setState('paused');
          break;
        }
        this.updatePlaying(dt);
        break;
      case 'paused':
        if (this.input.wasPressed('KeyP', 'Escape', 'Enter')) this.setState('playing');
        break;
      case 'levelClear':
        this.fx.update(dt);
        this.screenFx.update(dt, ZERO, 28);
        if (this.stateTime > 1 && confirm) {
          this.level++;
          this.startLevel();
        }
        break;
      case 'gameOver':
        this.fx.update(dt);
        this.screenFx.update(dt, ZERO, 28);
        this.shake = Math.max(0, this.shake - dt * 30);
        if (this.stateTime > 1.2 && confirm) this.newGame();
        break;
    }
    this.tap = null;
  }

  // -------------------------------------------------------------------------
  // Game flow
  // -------------------------------------------------------------------------

  private newGame(): void {
    this.teams = createTeams();
    this.leaderId = null;
    this.solarTaught = false;
    this.score = 0;
    this.level = 1;
    this.player.lives = START_LIVES;
    this.sfx.start();
    this.startLevel();
  }

  private startLevel(): void {
    const p = this.player;
    p.reset();
    this.bubble = 0;
    this.levelTime = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.levelGpus = 0;
    this.heatWarned = false;
    this.waterQueue = [];
    this.pingTimer = 0;
    this.pingTarget = null;
    this.clearInfo = null;
    this.civilians = [];
    this.civilianQueue = [];
    this.jensen = null;
    this.offer = null;
    this.loans = 0;
    this.jensenTimer = rand(...JENSEN_FIRST_VISIT);
    this.nextVisit = pick(['giveaway', 'loan'] as const);
    this.jensenRetired = false;
    this.spy = null;
    this.news.reset();
    this.news.report(Headlines.levelStart(seriesName(this.level)));
    this.rain = null;
    this.bubbleWarned = false;
    this.fx.clear();
    this.screenFx.clear();
    this.bg.regenerate();

    // One oasis within reach of the start, the rest scattered further out.
    this.water = [];
    const n = waterCount(this.level);
    for (let i = 0; i < n; i++) this.spawnWater(i === 0 ? 350 : 600, i === 0 ? 600 : Infinity);

    this.pickups = [];
    for (let i = 0; i < ramOnField(this.level); i++) this.spawnPickup('ram');
    for (let i = 0; i < 2; i++) this.spawnPickup('gpu');
    for (let i = 0; i < ENERGY_ON_FIELD; i++) this.spawnPickup('energy');
    for (let i = 0; i < CIVILIANS_ON_FIELD; i++) this.spawnCivilian();
    this.rivals = spawnRivals(this.teams, 0);
    this.flock = [];
    this.swarmTimer = rand(...SWARM_FIRST);
    this.ramSpawnTimer = RAM_SPAWN_INTERVAL;
    this.gpuSpawnTimer = rand(5, 8);
    this.energySpawnTimer = ENERGY_SPAWN_INTERVAL;

    this.updateCamera(0, true);
    this.banner = {
      title: `SERIES ${seriesName(this.level)}`,
      sub: `Collect ${levelTarget(this.level)} RAM before the AI bubble bursts`,
      time: 3,
    };
    p.say(pick(START_LINES), 2.5);
    this.setState('playing');
  }

  private levelClear(): void {
    const timeLeft = (1 - this.bubble) * bubbleDuration(this.level);
    const timeBonus = Math.round(timeLeft) * TIME_BONUS_PER_SEC;
    const standings = allTeams(this.teams).toSorted((a, b) => b.ram - a.ram);
    const rank = standings.indexOf(this.teams.player) + 1;
    const leaderBonus = rank === 1 ? LEADER_BONUS : 0;
    this.score += timeBonus + leaderBonus;
    this.clearInfo = {
      level: this.level,
      ram: this.player.ram,
      target: levelTarget(this.level),
      gpus: this.levelGpus,
      timeBonus,
      leaderBonus,
      rank,
      score: this.score,
      quip: pick(CLEAR_QUIPS),
    };
    const { x, y } = this.player.pos;
    this.fx.confetti(x, y - 10, 120);
    this.fx.ring(x, y, '#5dff9a', 220, 0.9, 5);
    this.screenFx.flash('#ffffff', 0.5, 0.5);
    this.sfx.levelUp();
    this.setState('levelClear');
  }

  private gameOver(title: string, subtitle: string): void {
    const newHigh = this.score > this.highScore;
    if (newHigh) {
      this.highScore = this.score;
      saveHighScore(this.score);
    }
    this.overInfo = { title, sub: subtitle, score: this.score, highScore: this.highScore, newHigh, level: this.level };
    this.sfx.gameOver();
    this.setState('gameOver');
  }

  private showToast(text: string): void {
    this.toast = { text, time: 1.4 };
  }

  // -------------------------------------------------------------------------
  // Playing
  // -------------------------------------------------------------------------

  private visionRadius(): number {
    return 180 + 150 * (this.player.power / 100);
  }

  private updatePlaying(dt: number): void {
    const p = this.player;

    // Brief freeze on a landed hit sells the impact.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }

    this.levelTime += dt;
    this.music.intensity = this.bubble;
    if (this.banner) {
      this.banner.time -= dt;
      if (this.banner.time <= 0) this.banner = null;
    }

    // Movement and actions
    const axis = this.input.axis();
    const hasPower = p.power > 0;
    const fired = p.fired > 0;
    const moving = axis.x !== 0 || axis.y !== 0;
    if (p.solarOut && moving) this.packSolar(); // walking off packs the panels away
    p.sprinting = this.input.isDown('ShiftLeft', 'ShiftRight') && hasPower && !fired && moving;
    p.update(dt, axis, hasPower ? 1 : LOW_POWER_MULT);
    if (fired && p.fired <= 0) this.rehire();
    this.trailEffects(dt);

    if (!fired) {
      if (this.input.wasPressed('Space', 'KeyJ')) this.tryShove();
      if (this.input.wasPressed('KeyE', 'KeyQ')) this.sonarPing();
      if (this.input.wasPressed('KeyT')) this.tryTweet();
      if (this.input.wasPressed('KeyR')) this.toggleSolar(moving);
    }
    if (p.shoveActive > 0) this.checkShoveHits();

    // Water cools you down (the pool shrinks while you use it).
    const pool = this.water.find((w) => w.contains(p.pos, -4)) ?? null;
    if (pool && !p.inWater) {
      this.sfx.splash();
      this.fx.splash(p.pos.x, p.pos.y + 6);
      this.fx.ring(p.pos.x, p.pos.y + 6, '#bff0ff', 50, 0.5, 2);
      if (p.heat > 40) p.say(pick(WATER_LINES), 1.8);
    }
    p.inWater = pool !== null;

    if (pool) {
      if (p.heat > 0) pool.capacity -= WATER_DRAIN * dt;
      p.heat = Math.max(0, p.heat - COOL_RATE * dt);
      if (Math.random() < dt * 10) this.fx.burst(p.pos.x, p.pos.y + 8, '#bfefff', 2, 60, 2, 0.4);
    } else {
      const weather = this.news.isRunning('heatwave') ? HEATWAVE_MULT : 1;
      const exertion = (p.sprinting ? HEAT_SPRINT : 0) + (p.charging ? SOLAR_HEAT : 0);
      p.heat += (HEAT_BASE + HEAT_PER_LEVEL * (this.level - 1) + exertion) * weather * dt;
    }
    // Energy always drains; refill it from energy cells, or slowly from the sun.
    if (p.charging) this.chargeSolar(dt);
    else p.power = Math.max(0, p.power - (POWER_DRAIN + (p.sprinting ? POWER_SPRINT : 0)) * dt);

    if (p.heat > 60 && Math.random() < (dt * (p.heat - 50)) / 4) this.fx.steam(p.pos.x, p.pos.y - 20);
    if (p.heat > 75 && !this.heatWarned) {
      this.heatWarned = true;
      p.say('Need water… fast!', 2);
      this.sfx.warn();
    }
    if (p.heat < 50) this.heatWarned = false;

    if (p.heat >= 100) {
      this.overheat();
      if (this.state !== 'playing') return;
    }

    this.updateWater(dt);

    // Pickups: nearby ones get pulled in by Sam's magnet. Falling ones can't be grabbed until they land.
    this.thudTimer -= dt;
    for (const pk of this.pickups) {
      pk.update(dt);
      if (!pk.alive) continue;
      if (pk.landed) this.dropLanded(pk);
      if (pk.airborne) continue;
      const d = dist(pk.pos, p.pos);
      if (d < MAGNET_RADIUS && d > 1) {
        const n = normalize(sub(p.pos, pk.pos));
        const pull = (1 - d / MAGNET_RADIUS) * 420 + 120;
        pk.pos.x += n.x * pull * dt;
        pk.pos.y += n.y * pull * dt;
      }
      if (dist(pk.pos, p.pos) < p.radius + pk.radius) this.collect(pk);
    }
    this.updateCivilians(dt);

    // Rivals
    for (const r of this.rivals) r.update(dt, this);
    for (const r of this.rivals) {
      if (r.busy || r.contactCooldown > 0 || p.invuln > 0) continue;
      if (dist(r.pos, p.pos) < r.radius + p.radius) r.handleContact(this);
    }
    this.updateJensen(dt);
    this.updateSwarm(dt);
    this.updateNews(dt);
    this.updateSpy(dt);
    this.updateLeader();

    this.pickups = this.pickups.filter((pk) => pk.alive);
    this.spawnPickups(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.pingTimer > 0) this.pingTimer -= dt;

    if (p.heat >= 100) {
      this.overheat(); // GPUs can push you over the edge.
      if (this.state !== 'playing') return;
    }

    if (p.ram >= levelTarget(this.level)) {
      this.levelClear();
      return;
    }

    this.bubble += dt / bubbleDuration(this.level);
    if (this.bubble > 0.85 && !this.bubbleWarned) {
      this.bubbleWarned = true;
      this.news.report(Headlines.bubbleDanger());
    }
    if (this.bubble >= 1) {
      this.fx.burst(p.pos.x, p.pos.y, '#ff8ad8', 70, 460, 5, 1.2);
      this.fx.ring(p.pos.x, p.pos.y, '#ff8ad8', 600, 1.2, 6);
      this.screenFx.flash('#ff8ad8', 0.85, 0.9);
      this.shake = 18;
      this.sfx.pop();
      this.gameOver('THE AI BUBBLE BURST!', this.loans > 0 ? 'Jensen wants his money back.' : pick(POP_LINES));
      return;
    }

    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    const prevCam = { ...this.cam };
    this.updateCamera(dt);
    this.screenFx.update(dt, sub(this.cam, prevCam), p.sprinting ? 70 : 28);
  }

  /** Footprints in the sand and sprint afterimages. */
  private trailEffects(dt: number): void {
    const p = this.player;
    const speed = length(p.vel);
    if (speed > 20 && !p.inWater) {
      this.stepDist += speed * dt;
      if (this.stepDist > 20) {
        this.stepDist = 0;
        this.footSide = -this.footSide;
        const n = normalize(p.vel);
        const side = 4 * this.footSide;
        this.fx.footprint(p.pos.x - n.y * side, p.pos.y + 13 + n.x * side, Math.atan2(n.y, n.x));
      }
    }
    if (p.sprinting) {
      if (Math.random() < dt * 25) this.fx.burst(p.pos.x, p.pos.y + 14, 'rgba(190, 150, 90, 0.8)', 1, 40, 3, 0.4);
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        this.ghostTimer = 0.05;
        const n = normalize(p.vel);
        this.fx.puff(p.pos.x - n.x * 10, p.pos.y - 2 - n.y * 10, 'rgba(180, 200, 255, 0.35)', 12, 0.25);
      }
    }
  }

  private updateWater(dt: number): void {
    const p = this.player;
    const vr = this.visionRadius();
    for (const w of this.water) {
      if (!w.discovered && dist(w.pos, p.pos) < vr + w.radius * 0.5) {
        w.discovered = true;
        this.fx.text(w.pos.x, w.pos.y - w.radius - 14, 'WATER FOUND', '#7fd6ff', 10);
        this.fx.ring(w.pos.x, w.pos.y, '#7fd6ff', w.maxRadius + 40, 0.8, 3);
        this.sfx.discover();
      }
    }

    const dried = this.water.filter((w) => w.empty);
    for (const w of dried) {
      this.fx.burst(w.pos.x, w.pos.y, 'rgba(200, 160, 100, 0.9)', 24, 160, 4, 0.8);
      this.fx.text(w.pos.x, w.pos.y, 'DRIED UP', '#ffb347', 10);
      this.waterQueue.push(WATER_RESPAWN_DELAY);
      if (this.pingTarget === w) this.pingTarget = null;
    }
    if (dried.length) this.water = this.water.filter((w) => !w.empty);

    this.waterQueue = this.waterQueue.map((t) => t - dt);
    while (this.waterQueue.length && (this.waterQueue[0] ?? 1) <= 0) {
      this.waterQueue.shift();
      this.spawnWater(700, Infinity);
    }
  }

  private sonarPing(): void {
    const p = this.player;
    if (p.power < PING_COST) {
      this.sfx.denied();
      p.say('Not enough energy to ping!', 1.4);
      return;
    }
    p.power -= PING_COST;
    const byDistance = this.water.toSorted((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos));
    const target = byDistance.find((w) => !w.discovered) ?? byDistance[0] ?? null;
    if (target) {
      target.discovered = true;
      this.pingTarget = target;
      this.pingTimer = 5;
    }
    this.fx.ring(p.pos.x, p.pos.y, '#7fd6ff', 520, 1.2, 3);
    this.fx.ring(p.pos.x, p.pos.y, '#bff0ff', 300, 0.9, 2);
    this.screenFx.flash('#7fd6ff', 0.1, 0.3);
    this.sfx.ping();
  }

  // -------------------------------------------------------------------------
  // Shoving rivals
  // -------------------------------------------------------------------------

  private tryShove(): void {
    const p = this.player;
    if (!p.canShove) return;
    if (p.power < SHOVE_ENERGY) {
      this.sfx.denied();
      p.say('Too tired to shove!', 1.2);
      p.shoveCooldown = 0.4;
      return;
    }
    // Every shove costs energy and heat, hit or miss.
    this.packSolar();
    p.power -= SHOVE_ENERGY;
    p.heat += SHOVE_HEAT;
    p.startShove();
    this.hitThisShove.clear();
    this.fx.slash(p.pos.x + p.look.x * 6, p.pos.y - 4 + p.look.y * 6, Math.atan2(p.look.y, p.look.x));
    this.fx.burst(p.pos.x, p.pos.y + 12, 'rgba(190, 150, 90, 0.8)', 5, 90, 2.5, 0.4);
    this.sfx.swing();
    this.checkShoveHits();
  }

  private checkShoveHits(): void {
    const p = this.player;
    for (const r of this.rivals) {
      if (r.stunned || this.hitThisShove.has(r)) continue;
      const to = sub(r.pos, p.pos);
      const d = length(to);
      if (d > SHOVE_RANGE + r.radius) continue;
      const touching = d < p.radius + r.radius + 4;
      const facing = d > 1 ? (p.look.x * to.x + p.look.y * to.y) / d : 1;
      if (!touching && Math.acos(clamp(facing, -1, 1)) > SHOVE_ARC) continue;
      this.hitThisShove.add(r);
      this.hitRival(r, d > 1 ? normalize(to) : p.look);
    }
    const spy = this.spy;
    if (spy?.active) {
      const to = sub(spy.pos, p.pos);
      const d = length(to);
      const touching = d < p.radius + spy.radius + 4;
      const facing = d > 1 ? (p.look.x * to.x + p.look.y * to.y) / d : 1;
      if (d <= SHOVE_RANGE + spy.radius && (touching || Math.acos(clamp(facing, -1, 1)) <= SHOVE_ARC)) this.catchSpy();
    }
  }

  /**
   * A landed shove: the rival is stunned, knocked back and drops some RAM.
   * The price: bad press inflates the AI bubble, and the victim comes back furious.
   */
  private hitRival(r: Rival, dir: Vec): void {
    r.hit(dir);
    const drop = Math.min(SHOVE_DROP, r.team.ram);
    r.team.ram -= drop;
    const base = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < drop; i++) {
      const pk = new Pickup('ram', { x: r.pos.x, y: r.pos.y });
      const a = base + rand(-1.2, 1.2);
      const s = rand(220, 320);
      pk.vel.x = Math.cos(a) * s;
      pk.vel.y = Math.sin(a) * s;
      this.pickups.push(pk);
    }

    this.score += SHOVE_POINTS;
    const { x, y } = r.pos;
    this.fx.burst(x, y, '#ffffff', 14, 240, 3, 0.35);
    this.fx.burst(x, y, '#ffe066', 10, 160, 2.5, 0.5);
    this.fx.ring(x, y, '#ffffff', 46, 0.3, 4);
    this.fx.text(x, y - 36, drop > 0 ? `POW! -${drop} RAM` : 'POW!', '#ffe066', 12);
    this.bubble += SHOVE_BAD_PRESS;
    this.bubbleNote = 'BAD PRESS!';
    this.screenFx.bubblePulse = 1;
    this.fx.text(this.player.pos.x, this.player.pos.y - 50, 'BAD PRESS! BUBBLE +', '#ff8ad8', 10);
    this.news.report(Headlines.shove(r.label), 'shove', 10);
    this.shake = Math.max(this.shake, 7);
    this.hitStop = 0.06;
    this.screenFx.flash('#ffffff', 0.12, 0.12);
    this.sfx.hit();
  }

  // -------------------------------------------------------------------------
  // Collecting
  // -------------------------------------------------------------------------

  private toScreen(v: Vec): Vec {
    return { x: v.x - this.cam.x, y: v.y - this.cam.y };
  }

  private collect(pk: Pickup): void {
    const p = this.player;
    pk.alive = false;
    const from = this.toScreen(pk.pos);

    if (pk.kind === 'energy') {
      p.power = Math.min(100, p.power + ENERGY_POWER);
      this.fx.burst(pk.pos.x, pk.pos.y, '#ffe94d', 16, 160, 3, 0.6);
      this.fx.ring(pk.pos.x, pk.pos.y, '#ffe94d', 50, 0.4, 3);
      this.fx.text(pk.pos.x, pk.pos.y - 18, `+${ENERGY_POWER} ENERGY`, '#ffe94d', 10);
      this.screenFx.fly(from, { x: HUD_ENERGY_BAR.x + HUD_ENERGY_BAR.w * (p.power / 100), y: HUD_ENERGY_BAR.y + 5 }, 'energy');
      this.sfx.energy();
      if (Math.random() < 0.3) p.say(pick(ENERGY_LINES), 1.6);
      return;
    }

    const prevCombo = this.combo;
    const c = this.bumpCombo();
    if (pk.kind === 'ram') {
      const pts = RAM_POINTS * c;
      this.score += pts;
      p.ram++;
      this.teams.player.ram++;
      this.fx.burst(pk.pos.x, pk.pos.y, '#5dff9a', 10, 110, 2.5, 0.5);
      this.fx.text(pk.pos.x, pk.pos.y - 16, c > 1 ? `+${pts} x${c}` : `+${pts}`, '#9dffbf', 10);
      const frac = Math.min(1, p.ram / levelTarget(this.level));
      this.screenFx.fly(from, { x: HUD_RAM_BAR.x + HUD_RAM_BAR.w * frac, y: HUD_RAM_BAR.y + 5 }, 'ram');
      this.sfx.pickup(c);
    } else {
      const pts = GPU_POINTS * c;
      this.score += pts;
      this.levelGpus++;
      this.teams.player.gpus++;
      p.heat += HEAT_GPU;
      this.fx.burst(pk.pos.x, pk.pos.y, '#ffd75e', 26, 240, 3.5, 0.8);
      this.fx.ring(pk.pos.x, pk.pos.y, '#ffd75e', 80, 0.5, 4);
      this.fx.text(pk.pos.x, pk.pos.y - 20, `GPU! +${pts}`, '#ffd75e', 12);
      this.screenFx.fly(from, HUD_SCORE, 'gpu');
      this.screenFx.flash('#ffd75e', 0.18, 0.3);
      this.shake = Math.max(this.shake, 4);
      this.sfx.gpu();
      p.say(pick(GPU_LINES), 2);
    }

    if (c !== prevCombo && COMBO_MILESTONES.has(c)) {
      this.fx.text(p.pos.x, p.pos.y - 58, `COMBO x${c}!`, '#ffe066', 16);
      this.fx.ring(p.pos.x, p.pos.y, '#ffe066', 90, 0.5, 4);
      this.screenFx.flash('#ffe066', 0.12, 0.25);
      this.sfx.comboUp(c);
    }
  }

  private bumpCombo(): number {
    this.combo = this.comboTimer > 0 ? Math.min(COMBO_MAX, this.combo + 1) : 1;
    this.comboTimer = COMBO_WINDOW;
    return this.combo;
  }

  /** Overheating costs a life, and the board fires Sam. He's rehired a moment later (if lives are left). */
  private overheat(): void {
    const p = this.player;
    p.lives--;
    p.heat = 35;
    p.invuln = 2 + FIRED_TIME;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 14;
    this.fx.burst(p.pos.x, p.pos.y, '#ff6a3c', 34, 280, 4, 0.9);
    this.fx.ring(p.pos.x, p.pos.y, '#ff6a3c', 140, 0.6, 5);
    for (let i = 0; i < 14; i++) this.fx.steam(p.pos.x + rand(-14, 14), p.pos.y - 10);
    this.fx.text(p.pos.x, p.pos.y - 40, 'OVERHEATED!', '#ff6a3c', 14);
    this.screenFx.flash('#ff6a3c', 0.45, 0.5);
    this.sfx.overheat();
    if (p.lives <= 0) {
      this.gameOver('MELTDOWN!', 'The board fired you. This time it stuck.');
      return;
    }
    p.fire(FIRED_TIME);
    this.fx.text(p.pos.x, p.pos.y + 50, 'FIRED BY THE BOARD!', '#ff8a7a', 12);
    this.sfx.fired();
    p.say(pick(FIRED_LINES), FIRED_TIME + 0.2);
    this.news.report(Headlines.fired(), 'fired', 0);
  }

  private rehire(): void {
    const p = this.player;
    this.fx.text(p.pos.x, p.pos.y - 44, 'REHIRED!', '#5dff9a', 14);
    this.fx.confetti(p.pos.x, p.pos.y - 10, 50);
    this.fx.ring(p.pos.x, p.pos.y, '#5dff9a', 90, 0.5, 4);
    this.sfx.rehired();
    p.say(pick(REHIRED_LINES), 1.8);
    this.news.report(Headlines.rehired(), 'rehired', 0);
  }

  // -------------------------------------------------------------------------
  // Hype tweet
  // -------------------------------------------------------------------------

  /** Sam vague-posts. Every rival in range stops to read it. Hype is what inflates bubbles. */
  private tryTweet(): void {
    const p = this.player;
    if (!p.canTweet) {
      this.sfx.denied();
      return;
    }
    const text = pick(TWEETS);
    p.tweet(text, TWEET_COOLDOWN);
    this.bubble += TWEET_BUBBLE;
    this.bubbleNote = 'HYPE!';
    this.screenFx.bubblePulse = 1;
    this.fx.text(p.pos.x, p.pos.y + 36, 'HYPE! BUBBLE +', '#ff8ad8', 10);
    this.fx.ring(p.pos.x, p.pos.y, '#4fb8ff', TWEET_RANGE, 0.8, 3);
    this.fx.ring(p.pos.x, p.pos.y, '#bfeaff', TWEET_RANGE * 0.55, 0.6, 2);
    for (const r of this.rivals) {
      if (r.stunned || dist(r.pos, p.pos) > TWEET_RANGE) continue;
      r.distract('phone', TWEET_READ_TIME, { line: lineFor(TWEET_REACTIONS, r.team.id) });
    }
    this.sfx.tweet();
    this.news.report(Headlines.tweet(text), 'tweet', 0);
  }

  // -------------------------------------------------------------------------
  // Solar panels
  // -------------------------------------------------------------------------

  /** R: unfold the panels when energy is low (standing still, on dry sand), or pack them away again. */
  private toggleSolar(moving: boolean): void {
    const p = this.player;
    if (p.solarOut) {
      this.packSolar();
      return;
    }
    const problem = moving
      ? 'Stand still to set up the panels.'
      : p.inWater
        ? "Panels and water don't mix."
        : p.power >= SOLAR_BELOW
          ? 'Plenty of energy. Save the sun for later.'
          : null;
    if (problem) {
      this.sfx.denied();
      p.say(problem, 1.6);
      return;
    }
    p.deploySolar();
    this.solarTaught = true;
    this.solarTick = 1;
    this.fx.burst(p.pos.x, p.pos.y + 14, 'rgba(190, 150, 90, 0.8)', 10, 110, 2.5, 0.4);
    this.fx.text(p.pos.x, p.pos.y + 40, 'IN THE SUN: HEAT +', '#ffb347', 10);
    this.sfx.solar();
    p.say(pick(SOLAR_LINES), 2);
    this.news.report(Headlines.solar(), 'solar', 20);
    const elon = this.rivals.find((r) => r.team.id === 'elon' && !r.busy && dist(r.pos, p.pos) < 420);
    elon?.say("Tesla Solar. You're welcome.", 2);
  }

  /** Slow energy from the sun, up to SOLAR_MAX. Past that (an energy cell got there first) the panels pack up. */
  private chargeSolar(dt: number): void {
    const p = this.player;
    if (p.power >= SOLAR_MAX) {
      this.packSolar('PANELS FULL');
      p.say("That's all the sun gives. Find a real cell!", 2);
      return;
    }
    p.power = Math.min(SOLAR_MAX, p.power + SOLAR_RATE * dt);
    this.solarTick -= dt;
    if (this.solarTick <= 0) {
      this.solarTick = 1;
      this.fx.text(p.pos.x + 26, p.pos.y - 12, `+${SOLAR_RATE}`, '#ffe94d', 9);
      this.screenFx.energyPulse = 0.6;
    }
    if (Math.random() < dt * 10) {
      const o = pick(PANEL_OFFSETS);
      this.fx.fling({ x: p.pos.x + o.x, y: p.pos.y + o.y }, p.pos, '#ffe94d', 1);
    }
  }

  /** Folds the panels away (if they're out), with a little puff and an optional note. */
  private packSolar(note?: string): void {
    const p = this.player;
    if (!p.solarOut) return;
    p.packSolar();
    for (const o of PANEL_OFFSETS) this.fx.burst(p.pos.x + o.x, p.pos.y + o.y, '#7aa2ff', 6, 90, 2.5, 0.35);
    if (note) this.fx.text(p.pos.x, p.pos.y + 40, note, '#ffe94d', 10);
    this.sfx.solarPack();
  }

  // -------------------------------------------------------------------------
  // Breaking news
  // -------------------------------------------------------------------------

  /** Starts a story right away. Public so it can be tried from the dev console: `game.breakNews('rain')`. */
  breakNews(kind: NewsKind): void {
    if (this.state !== 'playing' || this.news.active) return;
    this.runStory(this.news.breakStory(kind));
  }

  private updateNews(dt: number): void {
    const story = this.news.update(dt, !this.offer && this.levelTime > 3);
    if (story) this.runStory(story);
    if (this.rain) {
      this.rain.drops = this.rain.drops.filter((pk) => pk.alive);
      if (!this.rain.drops.length || !this.news.isRunning('rain')) this.rain = null;
    }
  }

  private runStory(story: NewsStory): void {
    this.banner = { title: 'BREAKING NEWS', sub: story.headline, time: 2.6, color: '#ff5d73' };
    this.screenFx.flash('#ff3b5c', 0.16, 0.4);
    this.shake = Math.max(this.shake, 5);
    this.sfx.breaking();
    this.player.say(pick(story.samLines), 2.4);
    switch (story.kind) {
      case 'rain':
        this.ramRain();
        break;
      case 'panic':
        this.marketPanic();
        break;
      case 'heatwave':
        this.heatwave();
        break;
      case 'lawsuit':
        this.lawsuit();
        break;
      case 'summit':
        this.safetySummit();
        break;
      case 'spy':
        this.spyAppears();
        break;
      case 'resign':
        this.jensenResigns();
        break;
    }
  }

  /** A data center fire sale: a pile of RAM falls out of the sky a short run from Sam. Rivals race for it too. */
  private ramRain(): void {
    const p = this.player.pos;
    const m = 160;
    let pos: Vec = { x: clamp(p.x + 450, m, WORLD_W - m), y: clamp(p.y, m, WORLD_H - m) };
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      const d = rand(320, 480);
      const c = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
      if (c.x < m || c.x > WORLD_W - m || c.y < m || c.y > WORLD_H - m) continue;
      if (this.water.some((w) => dist(c, w.pos) < w.maxRadius + 140)) continue;
      pos = c;
      break;
    }
    const drops: Pickup[] = [];
    for (let i = 0; i < RAIN_RAM + this.level; i++) {
      const a = rand(0, TAU);
      const r = Math.sqrt(Math.random()) * 110;
      const pk = new Pickup('ram', { x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r });
      pk.z = rand(320, 950); // different heights, so they land one after another
      drops.push(pk);
    }
    this.pickups.push(...drops);
    this.rain = { pos, drops };
    this.fx.ring(pos.x, pos.y, '#5dff9a', 140, 0.9, 4);
  }

  private dropLanded(pk: Pickup): void {
    this.fx.burst(pk.pos.x, pk.pos.y + 8, 'rgba(190, 150, 90, 0.8)', 6, 110, 2.5, 0.4);
    this.fx.ring(pk.pos.x, pk.pos.y + 8, '#5dff9a', 26, 0.3, 2);
    if (this.thudTimer <= 0 && dist(pk.pos, this.player.pos) < this.visionRadius() + 250) {
      this.thudTimer = 0.09;
      this.sfx.thud();
    }
  }

  /** A cheap model spooks the markets: rivals freeze, the labs speed up, and the bubble deflates a little. */
  private marketPanic(): void {
    this.bubble = Math.max(0, this.bubble - PANIC_BUBBLE);
    this.bubbleNote = `MARKETS PANIC! -${Math.round(PANIC_BUBBLE * 100)}%`;
    this.screenFx.bubblePulse = 1;
    let gloated = false;
    for (const r of this.rivals) {
      if (r.team === this.teams.china) {
        r.boost = Math.max(r.boost, 8);
        if (!gloated) r.say(lineFor(PANIC_LINES, 'china') ?? 'Efficient!', 2);
        gloated = true;
      } else {
        r.distract('panic', 3.2, { line: lineFor(PANIC_LINES, r.team.id) });
      }
    }
  }

  /** Heat rises faster for a while, but every oasis is topped up and shows on the map. */
  private heatwave(): void {
    for (const w of this.water) {
      w.capacity = WATER_CAPACITY;
      if (w.discovered) continue;
      w.discovered = true;
      this.fx.ring(w.pos.x, w.pos.y, '#7fd6ff', w.maxRadius + 40, 0.8, 3);
    }
    this.screenFx.flash('#ff8a3c', 0.15, 0.5);
  }

  /** Elon serves a lawsuit in person: he flies in if he's far away, then hunts Sam for a while. */
  private lawsuit(): void {
    const elon = this.rivals.find((r) => r.team === this.teams.elon);
    if (!elon) return;
    const p = this.player.pos;
    if (dist(elon.pos, p) > 650) {
      this.fx.beam(elon.pos.x, elon.pos.y, elon.team.color);
      const a = rand(0, TAU);
      elon.pos = { x: clamp(p.x + Math.cos(a) * 460, 60, WORLD_W - 60), y: clamp(p.y + Math.sin(a) * 460, 60, WORLD_H - 60) };
      elon.vel = vec();
      this.fx.beam(elon.pos.x, elon.pos.y, elon.team.color);
      this.fx.burst(elon.pos.x, elon.pos.y, elon.team.color, 20, 180, 3, 0.6);
    }
    elon.stun = 0;
    elon.enrage(LAWSUIT_FURY);
    elon.say('See you in court!', 2.4);
  }

  /** Dario gives a very long talk. Gemini and the labs go and sit through it. Elon wasn't invited. */
  private safetySummit(): void {
    const dario = this.rivals.find((r) => r.team === this.teams.dario);
    if (!dario) return;
    const time = STORIES.summit.duration;
    dario.distract('lecture', time, { line: 'Welcome, everyone!', chatter: SUMMIT_LECTURE });
    const audience = this.rivals.filter((r) => r.team !== this.teams.dario && r.team !== this.teams.elon);
    audience.forEach((r, i) => {
      const a = Math.PI * (0.15 + (0.7 * i) / Math.max(1, audience.length - 1));
      const seat = { x: dario.pos.x + Math.cos(a) * 80, y: dario.pos.y + Math.sin(a) * 64 };
      r.distract('summit', time, { goTo: seat, line: lineFor(SUMMIT_LINES, r.team.id), chatter: SUMMIT_LINES[r.team.id] });
    });
    this.rivals.find((r) => r.team === this.teams.elon)?.say("Wasn't invited. Fine.", 2.4);
    this.fx.beam(dario.pos.x, dario.pos.y, dario.team.color);
  }

  /** The ticker reports every change at the top of the RAM race (ties don't count). */
  private updateLeader(): void {
    const teams = allTeams(this.teams);
    let lead = teams[0];
    for (const t of teams) if (lead && t.ram > lead.ram) lead = t;
    if (!lead || lead.ram < 3 || lead.id === this.leaderId) return;
    const current = teams.find((t) => t.id === this.leaderId);
    if (current && current.ram >= lead.ram) return;
    this.leaderId = lead.id;
    this.news.report(Headlines.lead(lead.id), 'lead', 6);
  }

  // -------------------------------------------------------------------------
  // RivalWorld: how rivals affect the game
  // -------------------------------------------------------------------------

  rivalCollect(rival: Rival, pk: Pickup): void {
    if (!pk.alive) return;
    pk.alive = false;
    if (pk.kind === 'energy') {
      rival.energize();
      this.fx.burst(pk.pos.x, pk.pos.y, '#ffe94d', 12, 140, 2.5, 0.5);
      this.fx.ring(pk.pos.x, pk.pos.y, '#ffe94d', 40, 0.4, 2);
      return;
    }
    if (pk.kind === 'ram') rival.team.ram++;
    else rival.team.gpus++;
    this.fx.burst(pk.pos.x, pk.pos.y, rival.team.color, pk.kind === 'gpu' ? 16 : 7, 100, 2.5, 0.5);
  }

  stealRam(rival: Rival, amount: number): number {
    const p = this.player;
    const n = Math.min(amount, p.ram);
    p.ram -= n;
    this.teams.player.ram -= n;
    rival.team.ram += n;
    this.combo = 0;
    this.comboTimer = 0;
    p.invuln = 1.3;
    this.shake = Math.max(this.shake, 10);
    this.fx.text(p.pos.x, p.pos.y - 36, n > 0 ? `-${n} RAM` : 'BUMP!', '#ff6b6b', 12);
    this.fx.fling(p.pos, rival.pos, '#2fbf6a', n * 5 + 3);
    this.screenFx.flash('#ff3b3b', 0.25, 0.3);
    this.sfx.steal();
    if (n > 0) {
      p.say('Hey! That was my RAM!', 1.8);
      this.news.report(Headlines.stolen(rival.label, n), 'steal', 8);
    }
    return n;
  }

  distill(rival: Rival, powerLoss: number): void {
    const p = this.player;
    p.power = Math.max(0, p.power - powerLoss);
    rival.team.ram++; // They copy your work: free RAM for them, you keep yours.
    p.invuln = 0.8;
    this.shake = Math.max(this.shake, 5);
    this.fx.zap(rival.pos, p.pos, '#ffd23f');
    this.fx.text(p.pos.x, p.pos.y - 36, `DISTILLED -${powerLoss} ENERGY`, '#ff9aa5', 10);
    this.fx.burst(p.pos.x, p.pos.y, '#ffd23f', 10, 120, 2.5, 0.5);
    this.screenFx.flash('#ffd23f', 0.15, 0.2);
    this.sfx.zap();
    p.say(pick(['Stop distilling me!', 'Hey, those are my weights!']), 1.6);
    this.news.report(Headlines.distilled(rival.label), 'distill', 15);
  }

  knockPlayer(from: Vec, force: number): void {
    const p = this.player;
    let n = normalize(sub(p.pos, from));
    if (n.x === 0 && n.y === 0) n = { x: 1, y: 0 };
    p.knock.x = n.x * force;
    p.knock.y = n.y * force;
    this.packSolar('PANELS KNOCKED OVER!');
    this.fx.burst(p.pos.x - n.x * 14, p.pos.y - n.y * 14, 'rgba(190, 150, 90, 0.8)', 8, 120, 3, 0.4);
    this.shake = Math.max(this.shake, force / 60);
    this.sfx.bump();
  }

  // -------------------------------------------------------------------------
  // People with idle RAM: Sam pools it to the cloud
  // -------------------------------------------------------------------------

  private updateCivilians(dt: number): void {
    const p = this.player;
    for (const c of this.civilians) {
      if (c.update(dt, p.pos)) this.poolRam(c);
      else if (c.pooling && Math.random() < dt * 18) this.fx.fling(c.pcPos, p.pos, '#2fbf6a', 1);
    }
    const gone = this.civilians.filter((c) => c.gone);
    if (gone.length) {
      this.civilians = this.civilians.filter((c) => !c.gone);
      this.civilianQueue.push(...gone.map(() => CIVILIAN_RESPAWN));
    }
    this.civilianQueue = this.civilianQueue.map((t) => t - dt);
    while (this.civilianQueue.length && (this.civilianQueue[0] ?? 1) <= 0) {
      this.civilianQueue.shift();
      this.spawnCivilian();
    }
  }

  /** Their RAM is now Sam's. The price: a headline that inflates the bubble. */
  private poolRam(c: Civilian): void {
    const p = this.player;
    const pc = c.pcPos;
    for (let i = 0; i < c.profile.ram; i++) this.collect(new Pickup('ram', { x: pc.x + rand(-6, 6), y: pc.y + rand(-6, 6) }));
    this.bubble += POOL_BAD_PRESS;
    this.bubbleNote = 'BAD PRESS!';
    this.screenFx.bubblePulse = 1;
    this.fx.text(p.pos.x, p.pos.y - 50, `HEADLINE: SAM TAKES ${c.profile.name.toUpperCase()}'S RAM`, '#ff8ad8', 9);
    this.fx.fling(pc, p.pos, '#2fbf6a', 12);
    this.fx.ring(pc.x, pc.y, '#5dff9a', 60, 0.5, 3);
    this.sfx.pool();
    p.say(pick(POOL_LINES), 2.2);
    this.news.report(Headlines.pooled(c.profile.name), 'pool', 0);
  }

  private spawnCivilian(): void {
    let pos = this.randomFreePos(160, 380);
    for (let i = 0; i < 20 && this.civilians.some((c) => dist(c.pos, pos) < 500); i++) pos = this.randomFreePos(160, 380);
    this.civilians.push(new Civilian(pos));
  }

  // -------------------------------------------------------------------------
  // Chinese Labs: models drop in out of nowhere
  // -------------------------------------------------------------------------

  /** One model in Series A, one more each series: they arrive one at a time, with no warning. */
  private updateSwarm(dt: number): void {
    if (this.flock.length >= swarmSize(this.level)) return;
    this.swarmTimer -= dt;
    if (this.swarmTimer > 0) return;
    this.swarmTimer = rand(...SWARM_INTERVAL);
    this.dropModel();
  }

  /**
   * A new Chinese model drops out of nowhere, close to Sam and preferably in his path.
   * Public so it can be tried from the dev console: `game.dropModel()`.
   */
  dropModel(): void {
    if (this.state !== 'playing') return;
    const p = this.player;
    const moving = length(p.vel) > 20;
    const heading = Math.atan2(p.vel.y, p.vel.x);
    const m = 40;
    let pos: Vec | null = null;
    for (let i = 0; i < 24 && !pos; i++) {
      const a = moving && i < 12 ? heading + rand(-1, 1) : rand(0, TAU);
      const d = rand(...SWARM_DROP_DIST);
      const c = { x: p.pos.x + Math.cos(a) * d, y: p.pos.y + Math.sin(a) * d };
      if (c.x < m || c.x > WORLD_W - m || c.y < m || c.y > WORLD_H - m) continue;
      if (this.water.some((w) => w.contains(c, 20))) continue;
      pos = c;
    }
    pos ??= { x: clamp(p.pos.x + SWARM_DROP_DIST[0], m, WORLD_W - m), y: clamp(p.pos.y, m, WORLD_H - m) };

    const name = SWARM_NAMES[this.flock.length % SWARM_NAMES.length] ?? 'DeepSeek';
    const bot = new SwarmBot(this.teams.china, name, pos, this.flock);
    bot.contactCooldown = 1; // no distilling the instant it lands
    this.rivals.push(bot);

    const { x, y } = pos;
    this.fx.beam(x, y, '#ff4d5e');
    this.fx.burst(x, y, '#ff4d5e', 24, 220, 3, 0.6);
    this.fx.burst(x, y, '#ffd23f', 12, 140, 2.5, 0.5);
    this.fx.ring(x, y, '#ff4d5e', 70, 0.5, 4);
    this.fx.text(x, y - 44, 'NEW MODEL DROPPED!', '#ff4d5e', 11);
    this.screenFx.flash('#ff4d5e', 0.1, 0.25);
    this.shake = Math.max(this.shake, 4);
    this.sfx.modelDrop();
    bot.say(pick(DROP_LINES), 2);
    this.news.report(Headlines.modelDrop(name), 'drop', 0);
  }

  // -------------------------------------------------------------------------
  // Breaking news: the alleged spy
  // -------------------------------------------------------------------------

  /** An alleged spy turns up behind Sam, just out of sight. The labs have never met them. */
  private spyAppears(): void {
    const p = this.player;
    const back = Math.atan2(-p.look.y, -p.look.x);
    const m = 80;
    let pos: Vec | null = null;
    for (let i = 0; i < 24 && !pos; i++) {
      const a = back + rand(-0.7, 0.7) * (i < 12 ? 1 : 3);
      const d = rand(300, 360);
      const c = { x: p.pos.x + Math.cos(a) * d, y: p.pos.y + Math.sin(a) * d };
      if (c.x < m || c.x > WORLD_W - m || c.y < m || c.y > WORLD_H - m) continue;
      if (this.water.some((w) => w.contains(c, 20))) continue;
      pos = c;
    }
    pos ??= { x: clamp(p.pos.x - 320, m, WORLD_W - m), y: clamp(p.pos.y, m, WORLD_H - m) };
    this.spy = new Spy(pos);
    this.rivals.find((r) => r.team === this.teams.china)?.say(pick(SPY_DENIALS), 2.4);
  }

  private updateSpy(dt: number): void {
    const spy = this.spy;
    if (!spy) return;
    const p = this.player;
    if (spy.update(dt, p.pos, p.look) === 'escaped') this.spyEscapes(spy);
    if (spy.state === 'sneak' && !this.news.isRunning('spy')) spy.leave();
    if (spy.active && spy.touchable && p.fired <= 0 && dist(spy.pos, p.pos) < spy.radius + p.radius) {
      if (spy.touch(p.pos, p.look) === 'caught') this.catchSpy();
      else if (p.invuln <= 0) this.spySteals(spy);
    }
    if (spy.done) this.spy = null;
  }

  /** Caught: a bounty, and any RAM they took comes back. Unlike shoving a rival, this is good press. */
  private catchSpy(): void {
    const spy = this.spy;
    if (!spy?.active) return;
    const p = this.player;
    spy.bust();
    this.score += SPY_BOUNTY;
    for (let i = 0; i < spy.loot; i++) {
      this.collect(new Pickup('ram', { x: spy.pos.x + rand(-6, 6), y: spy.pos.y + rand(-6, 6) }));
    }
    const { x, y } = spy.pos;
    this.fx.text(x, y - 52, `SPY CAUGHT! +${SPY_BOUNTY}`, '#5dff9a', 13);
    this.fx.confetti(x, y - 10, 50);
    this.fx.ring(x, y, '#5dff9a', 90, 0.5, 4);
    this.screenFx.fly(this.toScreen(spy.pos), HUD_SCORE, 'gpu');
    this.screenFx.flash('#5dff9a', 0.12, 0.3);
    this.shake = Math.max(this.shake, 5);
    this.sfx.busted();
    p.say(pick(['Gotcha!', 'Nice try.', 'Not my weights!']), 1.8);
    this.news.report(Headlines.spyCaught(), 'spy', 0);
  }

  /** Touched from behind: they copy some of Sam's RAM and run. */
  private spySteals(spy: Spy): void {
    const p = this.player;
    const n = Math.min(SPY_STEAL, p.ram);
    p.ram -= n;
    this.teams.player.ram -= n;
    spy.steal(n);
    this.combo = 0;
    this.comboTimer = 0;
    p.invuln = 1;
    this.shake = Math.max(this.shake, 8);
    this.fx.text(p.pos.x, p.pos.y - 40, n > 0 ? `SECRETS COPIED! -${n} RAM` : 'SECRETS COPIED!', SPY_COLOR, 11);
    if (n > 0) this.fx.fling(p.pos, spy.pos, '#2fbf6a', n * 5 + 3);
    this.screenFx.flash('#ff3b3b', 0.22, 0.3);
    this.sfx.steal();
    p.say(n > 0 ? 'Hey! Come back with my RAM!' : 'Joke is on you, I had no RAM.', 2);
    this.news.report(Headlines.spyStole(), 'spy', 0);
  }

  /** Got away: whatever they took ends up with the Chinese Labs. Coincidentally. */
  private spyEscapes(spy: Spy): void {
    this.teams.china.ram += spy.loot;
    this.fx.beam(spy.pos.x, spy.pos.y, SPY_COLOR);
    this.fx.text(spy.pos.x, spy.pos.y - 44, 'SPY ESCAPED', SPY_COLOR, 11);
    this.news.report(Headlines.spyEscaped(), 'spy', 0);
  }

  // -------------------------------------------------------------------------
  // Breaking news: Jensen steps down
  // -------------------------------------------------------------------------

  /** Whatever Jensen was doing ends (an open offer is withdrawn), and he walks off with his box. */
  private jensenResigns(): void {
    if (this.offer) {
      this.offer = null;
      this.fx.text(this.player.pos.x, this.player.pos.y - 60, 'OFFER WITHDRAWN', JENSEN_COLOR, 10);
    }
    const old = this.jensen;
    if (old && !old.gone) this.fx.beam(old.pos.x, old.pos.y, JENSEN_COLOR);
    const pos = old && !old.gone ? { ...old.pos } : this.jensenSpot(160, VIEW_W - 150);
    this.jensen = new Jensen('resign', pos);
    this.jensenRetired = true;
    this.bubble = Math.max(0, this.bubble - RESIGN_BUBBLE);
    this.bubbleNote = `NVDA -${Math.round(RESIGN_BUBBLE * 100)}%!`;
    this.screenFx.bubblePulse = 1;
    this.fx.beam(pos.x, pos.y, JENSEN_COLOR);
    this.fx.ring(pos.x, pos.y, JENSEN_COLOR, 70, 0.5, 3);
    this.sfx.resign();
    this.news.report(Headlines.resigned());
  }

  /** A GPU falls out of the box as he walks off. It slides back toward whoever's following. */
  jensenDropGpu(j: Jensen): void {
    const pk = new Pickup('gpu', { x: j.pos.x, y: j.pos.y + 4 });
    const back = normalize(scale(j.vel, -1));
    pk.vel.x = back.x * rand(60, 120) + rand(-40, 40);
    pk.vel.y = back.y * rand(60, 120) + rand(-40, 40);
    this.pickups.push(pk);
    this.fx.burst(j.pos.x, j.pos.y + 4, '#ffd75e', 6, 90, 2.5, 0.4);
    if (dist(j.pos, this.player.pos) < this.visionRadius() + 200) this.sfx.thud();
  }

  // -------------------------------------------------------------------------
  // Jensen: free GPUs, and loans to buy his chips
  // -------------------------------------------------------------------------

  /** Brings Jensen in near Sam. Public so it can be tried from the dev console: `game.summonJensen('loan')`. */
  summonJensen(visit: DropInVisit = this.nextVisit): void {
    if (this.state !== 'playing' || this.jensen || this.jensenRetired) return;
    this.nextVisit = visit === 'giveaway' ? 'loan' : 'giveaway';
    this.jensenTimer = rand(...JENSEN_INTERVAL);

    const pos =
      visit === 'loan' ? this.jensenSpot(140, 560) : this.jensenSpot(rand(170, 220), VIEW_W - 150);
    this.jensen = new Jensen(visit, pos);
    this.fx.beam(pos.x, pos.y, JENSEN_COLOR);
    this.fx.ring(pos.x, pos.y, JENSEN_COLOR, 70, 0.5, 3);
    this.fx.text(pos.x, pos.y - 62, visit === 'loan' ? 'SPECIAL OFFER!' : "JENSEN'S KEYNOTE!", JENSEN_COLOR, 11);
    this.sfx.keynote();
  }

  /**
   * Somewhere `d` from Sam that's close enough to see, far enough from the world edges that thrown GPUs
   * stay inside, and on a part of the screen where his speech isn't hidden by the HUD (or, with
   * `maxScreenX` lowered, by the loan pop-up on the right).
   */
  private jensenSpot(d: number, maxScreenX: number): Vec {
    const p = this.player.pos;
    const m = 130;
    const camX = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const camY = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    const safe = { x0: 150, x1: maxScreenX, y0: 210, y1: VIEW_H - 170 };
    let pos: Vec | null = null;
    for (let i = 0; i < 24 && !pos; i++) {
      const a = rand(0, TAU);
      const c = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
      const sx = c.x - camX;
      const sy = c.y - camY;
      if (sx < safe.x0 || sx > safe.x1 || sy < safe.y0 || sy > safe.y1) continue;
      if (c.x < m || c.x > WORLD_W - m || c.y < m || c.y > WORLD_H - m) continue;
      if (this.water.some((w) => dist(c, w.pos) < w.radius + 30)) continue;
      pos = c;
    }
    return (pos ??= {
      x: clamp(camX + clamp(p.x - camX - d, safe.x0, safe.x1), m, WORLD_W - m),
      y: clamp(camY + clamp(p.y - camY, safe.y0, safe.y1), m, WORLD_H - m),
    });
  }

  private updateJensen(dt: number): void {
    const j = this.jensen;
    if (j) {
      j.update(dt, this);
      if (j.gone) this.jensen = null;
    } else if (!this.jensenRetired) {
      this.jensenTimer -= dt;
      if (this.jensenTimer <= 0) this.summonJensen();
    }

    const offer = this.offer;
    if (!offer) return;
    offer.age += dt;
    offer.time -= dt;
    const clicked = this.tap ? offerButtonAt(this.tap, offer.age) : null;
    if (clicked === 'accept' || this.input.wasPressed('KeyY', 'Enter', 'NumpadEnter')) this.acceptLoan();
    else if (clicked === 'decline' || this.input.wasPressed('KeyX') || offer.time <= 0) this.declineLoan();
  }

  /** Keynote finale: GPUs fly out in all directions. Rivals race you for them. */
  jensenGiveaway(j: Jensen): void {
    const { x, y } = j.pos;
    const base = rand(0, TAU);
    for (let i = 0; i < JENSEN_GIVEAWAY_GPUS; i++) {
      const a = base + (i * TAU) / JENSEN_GIVEAWAY_GPUS + rand(-0.3, 0.3);
      const s = rand(380, 520);
      const pk = new Pickup('gpu', { x, y: y - 8 });
      pk.vel.x = Math.cos(a) * s;
      pk.vel.y = Math.sin(a) * s;
      this.pickups.push(pk);
    }
    this.fx.confetti(x, y - 30, 40);
    this.fx.ring(x, y, JENSEN_COLOR, 110, 0.6, 4);
    this.fx.text(x, y - 70, 'FREE GPUs!', '#ffd75e', 14);
    this.screenFx.flash(JENSEN_COLOR, 0.12, 0.3);
    this.sfx.giveaway();
    this.news.report(Headlines.keynote(), 'keynote', 0);
  }

  jensenPitch(_jensen: Jensen, pitch: string): void {
    this.offer = { title: pick(LOAN_TITLES), pitch, time: LOAN_OFFER_TIME, age: 0 };
    this.sfx.offer();
  }

  /** GPUs now, paid for with a bigger bubble (it's a circular deal) and the heat GPUs bring. */
  private acceptLoan(): void {
    const p = this.player;
    const j = this.jensen;
    this.offer = null;
    this.loans++;
    this.bubble += LOAN_BUBBLE;
    this.bubbleNote = 'CIRCULAR DEAL!';
    this.screenFx.bubblePulse = 1;
    this.fx.text(p.pos.x, p.pos.y - 50, 'CIRCULAR DEAL! BUBBLE +', '#ff8ad8', 10);

    // Jensen throws the GPUs at Sam. Pickups glide about v / 5 before stopping, so aim for that.
    const from = j ? { x: j.pos.x, y: j.pos.y - 8 } : { ...p.pos };
    const aim = { x: p.pos.x + p.vel.x * 0.35, y: p.pos.y + p.vel.y * 0.35 };
    for (let i = 0; i < LOAN_GPUS; i++) {
      const pk = new Pickup('gpu', { ...from });
      pk.vel.x = (aim.x + rand(-24, 24) - from.x) * 5;
      pk.vel.y = (aim.y + rand(-24, 24) - from.y) * 5;
      this.pickups.push(pk);
    }
    this.fx.burst(from.x, from.y, '#ffd75e', 16, 160, 3, 0.5);
    this.sfx.deal();
    j?.resolve(true);
    p.say(pick(LOAN_YES_LINES), 2);
    this.news.report(Headlines.loanTaken(), 'loan', 0);
  }

  /** Saying no is free, but someone else always takes the deal. */
  private declineLoan(): void {
    this.offer = null;
    const t = this.teams;
    const taker = pick([t.elon, t.dario, t.gemini, t.china]);
    taker.gpus += LOAN_GPUS;
    this.jensen?.resolve(false, taker.name);
    this.sfx.denied();
    this.news.report(Headlines.loanDeclined(taker.name), 'loan', 0);
  }

  // -------------------------------------------------------------------------
  // Spawning
  // -------------------------------------------------------------------------

  private randomFreePos(margin: number, avoidPlayer: number): Vec {
    const random = (): Vec => ({ x: rand(margin, WORLD_W - margin), y: rand(margin, WORLD_H - margin) });
    for (let i = 0; i < 30; i++) {
      const pos = random();
      if (dist(pos, this.player.pos) < avoidPlayer) continue;
      if (this.water.some((w) => dist(pos, w.pos) < w.maxRadius + 30)) continue;
      return pos;
    }
    return random();
  }

  private spawnPickup(kind: PickupKind): void {
    this.pickups.push(new Pickup(kind, this.randomFreePos(60, kind === 'energy' ? 200 : 80)));
  }

  private spawnPickups(dt: number): void {
    const count = (kind: PickupKind): number => this.pickups.filter((pk) => pk.kind === kind).length;
    this.ramSpawnTimer -= dt;
    if (this.ramSpawnTimer <= 0) {
      this.ramSpawnTimer = RAM_SPAWN_INTERVAL;
      if (count('ram') < ramOnField(this.level)) this.spawnPickup('ram');
    }
    this.gpuSpawnTimer -= dt;
    if (this.gpuSpawnTimer <= 0) {
      this.gpuSpawnTimer = rand(5, 9);
      if (count('gpu') < GPU_ON_FIELD) this.spawnPickup('gpu');
    }
    this.energySpawnTimer -= dt;
    if (this.energySpawnTimer <= 0) {
      this.energySpawnTimer = ENERGY_SPAWN_INTERVAL;
      if (count('energy') < ENERGY_ON_FIELD) this.spawnPickup('energy');
    }
  }

  private spawnWater(minDist: number, maxDist: number): void {
    const margin = 150;
    let pos: Vec | null = null;
    for (let i = 0; i < 60 && !pos; i++) {
      const c = { x: rand(margin, WORLD_W - margin), y: rand(margin, WORLD_H - margin) };
      const d = dist(c, this.player.pos);
      if (d < minDist || d > maxDist) continue;
      if (this.water.some((w) => dist(w.pos, c) < 450)) continue;
      if (this.civilians.some((cv) => dist(cv.pos, c) < 150)) continue;
      pos = c;
    }
    pos ??= { x: rand(margin, WORLD_W - margin), y: rand(margin, WORLD_H - margin) };
    const w = new WaterSource(pos, rand(55, 75));
    for (const pk of this.pickups) if (dist(pk.pos, w.pos) < w.maxRadius + 10) pk.alive = false;
    this.pickups = this.pickups.filter((pk) => pk.alive);
    this.water.push(w);
  }

  private updateCamera(dt: number, snap = false): void {
    const tx = clamp(this.player.pos.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(this.player.pos.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    const k = snap ? 1 : Math.min(1, dt * 8);
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.pxScale, 0, 0, this.pxScale, 0, 0);

    if (this.state === 'title') {
      this.title.draw(ctx, this.highScore);
      this.renderToast();
      return;
    }

    this.renderWorld();

    const p = this.player;
    drawHud(ctx, {
      score: this.score,
      highScore: this.highScore,
      level: this.level,
      lives: p.lives,
      heat: p.heat,
      power: p.power,
      ram: p.ram,
      target: levelTarget(this.level),
      bubble: this.bubble,
      bubbleLeft: (1 - this.bubble) * bubbleDuration(this.level),
      combo: this.combo,
      comboTimer: this.comboTimer,
      teams: allTeams(this.teams),
      playerTeam: this.teams.player,
      time: this.time,
      muted: this.audio.isMuted,
      musicOn: this.audio.isMusicOn,
      ramPulse: this.screenFx.ramPulse,
      scorePulse: this.screenFx.scorePulse,
      energyPulse: this.screenFx.energyPulse,
      bubblePulse: this.screenFx.bubblePulse,
      bubbleNote: this.bubbleNote,
      news: {
        headline: this.news.ticker?.text ?? null,
        headlineAge: this.news.ticker?.age ?? 0,
        story: this.news.active
          ? {
              title: this.news.active.story.title,
              rule: this.news.active.story.rule,
              timeLeft: this.news.active.timeLeft,
              duration: this.news.active.story.duration,
            }
          : null,
      },
      tweetReady: 1 - p.tweetCooldown / TWEET_COOLDOWN,
      solar: p.charging ? 'charging' : p.solarOut ? 'unfolding' : p.power < SOLAR_BELOW ? 'ready' : 'locked',
    });
    drawMinimap(ctx, {
      player: p.pos,
      cam: this.cam,
      rivals: this.rivals,
      water: this.water,
      pingTarget: this.pingTimer > 0 ? this.pingTarget : null,
      jensen: this.jensen?.pos ?? null,
      time: this.time,
    });
    if (this.offer && (this.state === 'playing' || this.state === 'paused')) {
      drawLoanOffer(ctx, {
        title: this.offer.title,
        pitch: this.offer.pitch,
        gpus: LOAN_GPUS,
        bubblePct: Math.round(LOAN_BUBBLE * 100),
        timeLeft: this.offer.time,
        duration: LOAN_OFFER_TIME,
        age: this.offer.age,
        time: this.time,
      });
    }
    this.screenFx.drawFront(ctx);

    if (this.banner && this.state === 'playing') {
      drawBanner(ctx, this.banner.title, this.banner.sub, Math.min(1, this.banner.time / 0.6), this.banner.color);
    }
    if (this.state === 'paused') drawPaused(ctx);
    if (this.state === 'levelClear' && this.clearInfo) drawLevelClear(ctx, this.clearInfo, this.stateTime);
    if (this.state === 'gameOver' && this.overInfo) drawGameOver(ctx, this.overInfo, this.stateTime);
    this.renderToast();
  }

  private renderWorld(): void {
    const ctx = this.ctx;
    const p = this.player;
    const t = this.time;
    const ox = Math.round(this.cam.x + (Math.random() - 0.5) * this.shake);
    const oy = Math.round(this.cam.y + (Math.random() - 0.5) * this.shake);
    const inView = (v: Vec, m: number): boolean =>
      v.x > ox - m && v.x < ox + VIEW_W + m && v.y > oy - m && v.y < oy + VIEW_H + m;

    // World (hidden by fog outside your vision)
    ctx.save();
    ctx.translate(-ox, -oy);
    this.bg.draw(ctx, { x: ox, y: oy }, t);
    this.fx.drawGround(ctx);
    for (const w of this.water) if (inView(w.pos, w.maxRadius + 70)) w.draw(ctx, t);
    for (const pk of this.pickups) if (inView(pk.pos, 40)) pk.draw(ctx, t);
    const actors: Drawable[] = [...this.rivals.filter((r) => inView(r.pos, 60)), p];
    if (this.jensen && inView(this.jensen.pos, 80)) actors.push(this.jensen);
    actors.push(...this.civilians.filter((c) => inView(c.pos, 70)));
    if (this.spy && inView(this.spy.pos, 70)) actors.push(this.spy);
    actors.sort((a, b) => a.pos.y - b.pos.y);
    for (const a of actors) a.draw(ctx, t);
    this.fx.drawParticles(ctx);
    ctx.restore();
    this.screenFx.drawMotes(ctx);

    const vr = this.visionRadius();
    this.drawFog(p.pos.x - ox, p.pos.y - oy, vr);

    // Above the fog: known water, chatter, floating text, lightning, beams
    ctx.save();
    ctx.translate(-ox, -oy);
    for (const w of this.water) {
      if (w.discovered && inView(w.pos, w.maxRadius) && dist(w.pos, p.pos) > vr * 0.75) w.drawMarker(ctx, t);
    }
    for (const pk of this.pickups) {
      if (pk.kind === 'energy' && inView(pk.pos, 20) && dist(pk.pos, p.pos) > vr * 0.7) pk.drawBeacon(ctx, t);
    }
    for (const c of this.civilians) {
      if (inView(c.pos, 30) && dist(c.pos, p.pos) > vr * 0.7) c.drawBeacon(ctx, t);
    }
    if (this.jensen && inView(this.jensen.pos, 300)) this.jensen.drawSpotlight(ctx, t);
    if (this.rain && inView(this.rain.pos, 400)) this.drawRainZone(this.rain, t);
    if (p.solarOut) drawSun(ctx, p.pos.x, p.pos.y, p.solarTime, t);
    for (const c of this.civilians) if (inView(c.pos, 120)) c.drawSpeech(ctx);
    for (const r of this.rivals) if (inView(r.pos, 120)) r.drawSpeech(ctx);
    this.jensen?.drawSpeech(ctx);
    this.spy?.drawSpeech(ctx);
    p.drawSpeech(ctx);
    this.fx.drawOverlay(ctx);
    ctx.restore();

    if (this.news.isRunning('heatwave')) this.drawVignette(88, 65, 35, '255, 150, 40', 3);
    this.drawVignette(this.player.heat, 65, 35, '255, 40, 20', 9);
    this.drawVignette(this.bubble * 100, 80, 20, '255, 90, 200', 12);
    this.drawNavigation(ox, oy);
    this.drawHints();
  }

  /** Above the fog: where the RAM rain comes down, and streaks for drops still in the air. */
  private drawRainZone(rain: { pos: Vec; drops: readonly Pickup[] }, t: number): void {
    const ctx = this.ctx;
    const { x, y } = rain.pos;
    ctx.save();
    ctx.strokeStyle = `rgba(93, 255, 154, ${0.45 + 0.25 * Math.sin(t * 6)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.ellipse(x, y, 125, 95, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    for (const pk of rain.drops) {
      if (!pk.airborne) continue;
      const top = pk.pos.y - pk.z;
      const g = ctx.createLinearGradient(0, top - 50, 0, top);
      g.addColorStop(0, 'rgba(93, 255, 154, 0)');
      g.addColorStop(1, 'rgba(157, 255, 191, 0.9)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pk.pos.x, top - 50);
      ctx.lineTo(pk.pos.x, top);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.font = pixelFont(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, 'RAM RAIN', x, y - 110, '#5dff9a');
    ctx.restore();
  }

  private drawFog(px: number, py: number, r: number): void {
    const f = this.fogCtx;
    f.setTransform(this.pxScale, 0, 0, this.pxScale, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, VIEW_W, VIEW_H);
    f.fillStyle = 'rgba(16, 9, 32, 0.9)';
    f.fillRect(0, 0, VIEW_W, VIEW_H);
    f.globalCompositeOperation = 'destination-out';
    const g = f.createRadialGradient(px, py, r * 0.5, px, py, r);
    g.addColorStop(0, 'rgba(0, 0, 0, 1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    f.fillStyle = g;
    f.beginPath();
    f.arc(px, py, r, 0, TAU);
    f.fill();
    f.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.fogCanvas, 0, 0, VIEW_W, VIEW_H);
  }

  /** Pulsing colored screen edges once `value` passes `from` (heat: red, bubble: pink). */
  private drawVignette(value: number, from: number, span: number, rgb: string, hz: number): void {
    if (value < from) return;
    const ctx = this.ctx;
    const a = clamp(((value - from) / span) * (0.45 + 0.2 * Math.sin(this.time * hz)), 0, 0.65);
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.65);
    g.addColorStop(0, `rgba(${rgb}, 0)`);
    g.addColorStop(1, `rgba(${rgb}, ${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /**
   * Arrows around Sam: blue to pinged water (or the nearest known water when running hot),
   * yellow to the nearest energy cell when energy is low.
   */
  private drawNavigation(ox: number, oy: number): void {
    const p = this.player;
    let water: WaterSource | null = null;
    let waterColor = '#7fd6ff';
    if (this.pingTimer > 0 && this.pingTarget && this.water.includes(this.pingTarget)) {
      water = this.pingTarget;
      waterColor = '#bff0ff';
    } else if (p.heat > 50 && !p.inWater) {
      let best = Infinity;
      for (const w of this.water) {
        const d = dist(w.pos, p.pos);
        if (w.discovered && d < best) {
          best = d;
          water = w;
        }
      }
    }
    if (water) this.drawArrow(ox, oy, water.pos, water.radius + 30, waterColor);

    if (p.power < 30) {
      let cell: Pickup | null = null;
      let best = Infinity;
      for (const pk of this.pickups) {
        const d = dist(pk.pos, p.pos);
        if (pk.kind === 'energy' && d < best) {
          best = d;
          cell = pk;
        }
      }
      if (cell) this.drawArrow(ox, oy, cell.pos, 40, '#ffe94d');
    }

    // Green to Jensen's keynote when it's out in the dark, so the free GPUs aren't missed.
    const j = this.jensen;
    if (j && j.visit !== 'loan') this.drawArrow(ox, oy, j.pos, this.visionRadius() * 0.9, JENSEN_COLOR);
    // Red to the spy when they're out in the dark: sneaking up, or running off with your RAM.
    const spy = this.spy;
    if (spy?.active) this.drawArrow(ox, oy, spy.pos, this.visionRadius() * 0.75, SPY_COLOR);
    if (this.rain) this.drawArrow(ox, oy, this.rain.pos, 130, '#5dff9a');
  }

  private drawArrow(ox: number, oy: number, target: Vec, minDist: number, color: string): void {
    const p = this.player;
    const d = dist(target, p.pos);
    if (d < minDist) return;

    const ctx = this.ctx;
    const ang = Math.atan2(target.y - p.pos.y, target.x - p.pos.x);
    const sx = p.pos.x - ox;
    const sy = p.pos.y - oy;
    const pulse = 1 + 0.15 * Math.sin(this.time * 8);
    ctx.save();
    ctx.translate(sx + Math.cos(ang) * 48, sy + Math.sin(ang) * 48);
    ctx.rotate(ang);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0b2a44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.font = pixelFont(8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, `${Math.round(d / 10)}m`, sx + Math.cos(ang) * 74, sy + Math.sin(ang) * 74, color);
  }

  private drawHints(): void {
    const p = this.player;
    let hint: string | null = null;
    if (p.solarOut && p.solarTime < 4) hint = 'Charging from the sun. It heats you up, though! Move to pack up.';
    else if (p.power <= 0) hint = 'Out of energy! Press R for solar panels, or grab a yellow energy cell.';
    else if (p.power < SOLAR_BELOW && !this.solarTaught) hint = 'Low energy! Stand still and press R for solar panels.';
    else if (p.heat > 50 && !p.inWater && !this.water.some((w) => w.discovered)) {
      hint = 'Overheating! Press E to sonar-ping for water.';
    } else if (this.level === 1 && this.levelTime > 3 && this.levelTime < 10) {
      hint = 'Tip: SPACE shoves rivals. It costs energy, feeds the bubble, and they hit back!';
    } else if (this.level === 1 && this.levelTime > 11 && this.levelTime < 18) {
      hint = 'Tip: stand next to people with glowing PCs to take their idle RAM. Bad press, though!';
    } else if (this.level === 1 && this.levelTime > 19 && this.levelTime < 26) {
      hint = 'Tip: T posts a hype tweet. Nearby rivals stop to read it, but hype inflates the bubble!';
    }
    if (!hint) return;
    const ctx = this.ctx;
    ctx.font = uiFont(16, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, hint, VIEW_W / 2, VIEW_H - 150, '#ffe08a', 'rgba(10, 6, 20, 0.9)', 4);
  }

  private renderToast(): void {
    if (!this.toast) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.toast.time / 0.3);
    ctx.font = pixelFont(10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Below the news ticker in game; under the logo on the title screen.
    outlinedText(ctx, this.toast.text, VIEW_W / 2, this.state === 'title' ? 84 : 132, '#ffffff', '#2a0f3d', 4);
    ctx.restore();
  }
}
