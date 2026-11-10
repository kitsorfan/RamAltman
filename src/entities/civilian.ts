import { POOL_RANGE, POOL_TIME } from '../config';
import { clamp, dist, normalize, pick, rand, sub, vec, type Vec } from '../math';
import { TAU, dot, drawChibi, groundShadow, outlinedText, pixelFont, speechBubble, type ChibiStyle, type HeadInfo } from '../render/draw';

type Accessory = 'headset' | 'shades' | 'glasses' | 'none';

interface Profile {
  readonly name: string;
  readonly ram: number;
  readonly style: ChibiStyle;
  readonly accessory: Accessory;
  /** Said when Sam comes close. */
  readonly protest: string;
  /** Said once the RAM is gone. */
  readonly angry: readonly string[];
}

export const PROFILES: readonly Profile[] = [
  {
    name: 'Gamer',
    ram: 3,
    style: { body: '#3b3f9e', trim: '#22256b', skin: '#e9c39b', hair: '#2b2b2b', hairStyle: 'short' },
    accessory: 'headset',
    protest: "Don't touch my rig!",
    angry: ['My frames!!', 'I was mid-match!'],
  },
  {
    name: 'Grandma',
    ram: 2,
    style: { body: '#c76b9a', trim: '#8a3f66', skin: '#f2d3b8', hair: '#e6e6ea', hairStyle: 'curly' },
    accessory: 'glasses',
    protest: 'Oh, hello dear!',
    angry: ['That was for my recipes!', "I'm telling your mother."],
  },
  {
    name: 'Student',
    ram: 2,
    style: { body: '#e0a43a', trim: '#9c6b1a', skin: '#c98e62', hair: '#3a2516', hairStyle: 'swept' },
    accessory: 'none',
    protest: "It's not idle, it's 80 tabs!",
    angry: ['My thesis was in those tabs!', 'I have finals!'],
  },
  {
    name: 'Crypto Bro',
    ram: 3,
    style: { body: '#f2f2f2', trim: '#9a9a9a', skin: '#f0c9a0', hair: '#d9a441', hairStyle: 'swept' },
    accessory: 'shades',
    protest: 'This rig is mining, bro.',
    angry: ['Bro. BRO.', 'That RAM was my alpha!'],
  },
  {
    name: 'Dev',
    ram: 3,
    style: { body: '#2f3640', trim: '#151a20', skin: '#e8bf98', hair: '#5a3b26', hairStyle: 'short' },
    accessory: 'glasses',
    protest: 'I need 64GB for one chat app!',
    angry: ['My Docker containers!', 'My build was 90% done!'],
  },
];

const FADE_TIME = 5; // seconds a pooled civilian lingers before leaving

/** Someone out in the desert with a PC full of idle RAM. Stand next to them and Sam pools it to the cloud. */
export class Civilian {
  readonly profile: Profile;
  readonly pos: Vec;
  readonly radius = 14;
  /** 0..1 while Sam stands close; the RAM is taken at 1. */
  progress = 0;
  private taken = false;
  private fade = 0;
  private warned = false;
  private look: Vec = vec(0, 1);
  private t = rand(0, 10);
  private speech: string | null = null;
  private speechTime = 0;

  constructor(pos: Vec, profile: Profile = pick(PROFILES)) {
    this.pos = { ...pos };
    this.profile = profile;
  }

  get ram(): number {
    return this.taken ? 0 : this.profile.ram;
  }

  /** Where the PC stands (the RAM flies out of here). */
  get pcPos(): Vec {
    return { x: this.pos.x + 27, y: this.pos.y - 2 };
  }

  get pooled(): boolean {
    return this.taken;
  }

  get pooling(): boolean {
    return !this.taken && this.progress > 0;
  }

  /** Done sulking and gone. */
  get gone(): boolean {
    return this.taken && this.fade >= FADE_TIME;
  }

  say(text: string, duration = 2.2): void {
    this.speech = text;
    this.speechTime = duration;
  }

  /** Returns true on the frame Sam finishes taking the RAM. */
  update(dt: number, sam: Vec): boolean {
    this.t += dt;
    if (this.speechTime > 0) {
      this.speechTime -= dt;
      if (this.speechTime <= 0) this.speech = null;
    }
    if (this.taken) {
      this.fade += dt;
      return false;
    }

    const d = dist(sam, this.pos);
    if (d < 260) this.look = normalize(sub(sam, this.pos));
    if (!this.warned && d < 150) {
      this.warned = true;
      this.say(this.profile.protest);
    }
    if (d < POOL_RANGE) {
      this.progress += dt / POOL_TIME;
      if (this.progress >= 1) {
        this.progress = 0;
        this.taken = true;
        this.say(pick(this.profile.angry), 2.6);
        return true;
      }
    } else {
      this.progress = Math.max(0, this.progress - dt * 1.5); // step away and the upload stalls
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    const { x, y } = this.pos;
    ctx.save();
    if (this.taken) ctx.globalAlpha = clamp(FADE_TIME - this.fade, 0, 1); // fade out in the last second
    groundShadow(ctx, x + 10, y + 13, 32, 7);
    this.drawPc(ctx, time);

    const bob = this.pooling ? Math.sin(this.t * 30) * 1 : Math.sin(this.t * 2) * 0.6;
    const head = drawChibi(ctx, x, y, this.radius, this.profile.style, this.look, bob);
    drawAccessory(ctx, head, this.profile.accessory, this.look);

    ctx.font = pixelFont(8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    outlinedText(ctx, this.profile.name, x + 6, y - this.radius - 12, '#cfe8ff');
    ctx.font = pixelFont(7);
    if (this.taken) outlinedText(ctx, 'NOW IN THE CLOUD', x + 6, y - this.radius - 24, '#a99fd0');
    else outlinedText(ctx, `IDLE RAM x${this.profile.ram}`, x + 6, y - this.radius - 24, '#5dff9a');

    if (this.pooling) {
      const pc = this.pcPos;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pc.x, pc.y, 22, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#5dff9a';
      ctx.beginPath();
      ctx.arc(pc.x, pc.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * this.progress);
      ctx.stroke();
      ctx.font = pixelFont(7);
      ctx.textBaseline = 'top';
      outlinedText(ctx, 'POOLING TO THE CLOUD…', pc.x - 8, pc.y + 26, '#9dffbf');
    }
    ctx.restore();
  }

  /** A gaming tower with a glass side panel, so you can see the RAM inside. */
  private drawPc(ctx: CanvasRenderingContext2D, time: number): void {
    const pc = this.pcPos;
    const px = pc.x - 7;
    const py = pc.y - 14;
    ctx.fillStyle = '#1d1f27';
    ctx.strokeStyle = '#0b0c10';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, 14, 28, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.taken ? '#0f1118' : 'rgba(60, 255, 150, 0.22)';
    ctx.fillRect(px + 2, py + 3, 10, 16);
    if (this.taken) {
      // A sad little cloud where the RAM used to be.
      ctx.fillStyle = '#cfd6e6';
      dot(ctx, px + 5, py + 12, 2.2);
      dot(ctx, px + 8, py + 11, 2.8);
      dot(ctx, px + 9.5, py + 13, 2);
    } else {
      ctx.fillStyle = '#2fbf6a';
      for (let i = 0; i < this.profile.ram; i++) ctx.fillRect(px + 3 + i * 3, py + 5, 2, 11);
    }
    ctx.fillStyle = this.taken ? '#333640' : `hsl(${(time * 140) % 360}, 90%, 60%)`;
    ctx.fillRect(px + 2, py + 22, 10, 2);
  }

  /** Glow drawn above the fog: idle PCs light up the night, so people can be found from afar. */
  drawBeacon(ctx: CanvasRenderingContext2D, time: number): void {
    if (this.taken) return;
    const { x, y } = this.pcPos;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3 + this.t);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, `rgba(93, 255, 154, ${0.4 + 0.25 * pulse})`);
    g.addColorStop(1, 'rgba(93, 255, 154, 0)');
    ctx.fillStyle = g;
    dot(ctx, x, y, 22);
    ctx.fillStyle = `hsl(${(time * 140) % 360}, 90%, 70%)`;
    ctx.fillRect(x - 3, y + 7, 6, 2);
  }

  drawSpeech(ctx: CanvasRenderingContext2D): void {
    // Raised once the RAM is gone, so the complaint doesn't cover Sam's reply next to them.
    const lift = this.taken ? 60 : 34;
    if (this.speech && !this.gone) speechBubble(ctx, this.pos.x, this.pos.y - this.radius - lift, this.speech, '#5dff9a');
  }
}

function drawAccessory(ctx: CanvasRenderingContext2D, head: HeadInfo, accessory: Accessory, look: Vec): void {
  const ex = look.x * head.r * 0.22;
  const eyeY = head.y + head.r * 0.12 + look.y * head.r * 0.15;
  ctx.lineWidth = 1.4;
  switch (accessory) {
    case 'headset':
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(head.x, head.y, head.r * 1.08, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#ff4d6d';
      dot(ctx, head.x - head.r * 1.02, head.y, head.r * 0.3);
      dot(ctx, head.x + head.r * 1.02, head.y, head.r * 0.3);
      break;
    case 'shades':
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.roundRect(head.x - head.r * 0.62 + ex, eyeY - head.r * 0.17, head.r * 1.24, head.r * 0.34, 2);
      ctx.fill();
      break;
    case 'glasses':
      ctx.strokeStyle = '#2a2a2a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(head.x + s * head.r * 0.33 + ex, eyeY, head.r * 0.24, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'none':
      break;
  }
}
