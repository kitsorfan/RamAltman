import { NEWS_FIRST, NEWS_INTERVAL } from './config';
import { pick, rand, shuffle } from './math';

/** Breaking stories that change the rules for a few seconds. */
export type NewsKind = 'rain' | 'panic' | 'heatwave' | 'lawsuit' | 'summit';

export interface NewsStory {
  readonly kind: NewsKind;
  /** Short name shown in the ticker while the story runs. */
  readonly title: string;
  /** The headline on the big banner. */
  readonly headline: string;
  /** What it means for the player, in plain words. */
  readonly rule: string;
  readonly duration: number;
  /** Sam's reaction. */
  readonly samLines: readonly string[];
}

export const STORIES: Readonly<Record<NewsKind, NewsStory>> = {
  rain: {
    kind: 'rain',
    title: 'DATA CENTER FIRE SALE',
    headline: 'Liquidated RAM is falling from the sky!',
    rule: 'RAM rain! Follow the green arrow and grab it first',
    duration: 12,
    samLines: ["It's raining RAM!", 'Make it rain!'],
  },
  panic: {
    kind: 'panic',
    title: 'A DEEPSEEK MOMENT',
    headline: 'Chinese lab matches the frontier for $6M. Markets panic!',
    rule: 'Rivals panic · Bubble shrinks · The labs speed up',
    duration: 8,
    samLines: ['Okay, but have you seen our roadmap?', 'Stay calm. Buy RAM.'],
  },
  heatwave: {
    kind: 'heatwave',
    title: 'RECORD HEATWAVE',
    headline: 'Desert hits 58°C. Data centers sweat.',
    rule: 'Heat rises 80% faster · Every oasis refilled and revealed',
    duration: 12,
    samLines: ['Is it hot, or is it me?', 'Need. Liquid. Cooling.'],
  },
  lawsuit: {
    kind: 'lawsuit',
    title: 'ELON SUES SAM',
    headline: 'Elon files lawsuit #47. He is serving it in person.',
    rule: 'Elon is serving you in person · Run, tweet, or shove him',
    duration: 9,
    samLines: ['Not again…', 'My lawyers are typing.'],
  },
  summit: {
    kind: 'summit',
    title: 'AI SAFETY SUMMIT',
    headline: 'Dario hosts an emergency AI Safety Summit.',
    rule: "Rivals attend Dario's talk · Elon wasn't invited",
    duration: 9,
    samLines: ['Great. More RAM for me.', 'I RSVPed "maybe".'],
  },
};

export const NEWS_KINDS = Object.keys(STORIES) as NewsKind[];

/** What rivals say when a story hits them, keyed by team id. */
export const PANIC_LINES: Readonly<Record<string, readonly string[]>> = {
  dario: ['This is concerning for safety!', 'Running emergency evals…'],
  elon: ['Concerning.', 'Buying the dip. All of it.'],
  gemini: ['Searching: "how to short"', 'Did you mean: crash?'],
  china: ['Efficient!', 'Told you.'],
};

export const SUMMIT_LECTURE = [
  'Slide 1 of 412…',
  'First, let\'s define "safety"…',
  'Any questions? No? Slide 2.',
  'This talk is four hours long.',
] as const;

export const SUMMIT_LINES: Readonly<Record<string, readonly string[]>> = {
  gemini: ['Attending… for SEO.', 'Indexing the talk…'],
  china: ['Taking notes!', 'Distilling the talk…', 'Open-sourcing the slides.'],
};

/** Sam's vague-posts. Lowercase, as is tradition. */
export const TWEETS = [
  'something big is coming',
  'feel the agi',
  'we are so back',
  'i have been reliably informed agi is near',
  'ok this is pretty cool',
  'agi achieved internally (jk) (unless?)',
  'scaling laws still hold. buy ram',
  'excited to share some news soon!!',
] as const;

/** How each rival reacts to reading one of Sam's tweets, keyed by team id. */
export const TWEET_REACTIONS: Readonly<Record<string, readonly string[]>> = {
  dario: ['Is that a safety risk?', 'Hmm. Vague.', 'Drafting a reply essay…'],
  elon: ['Concerning.', 'Community note added.', 'lol'],
  gemini: ['Did you mean: hype?', 'Indexing tweet…'],
  china: ['Screenshotting…', 'Translating…', 'Distilling tweet…'],
};

/** Headlines for the in-game ticker, written as things happen. */
export const Headlines = {
  levelStart: (series: string): string =>
    pick([`Sam opens Series ${series}: "We need more RAM"`, `Series ${series} announced. Valuation: yes.`, `Sam raises Series ${series}, spends it on RAM`]),
  shove: (name: string): string =>
    pick([`Sam shoves ${name}, calls it "alignment"`, `${name} files complaint after shove from Sam`, `Sam and ${name} in "frank exchange of views"`]),
  stolen: (name: string, n: number): string =>
    name === 'Elon' ? `Elon takes ${n} RAM from Sam, replies "lol"` : `${name} takes ${n} RAM from Sam: "It's called payback"`,
  distilled: (name: string): string => pick([`${name} distills Sam's energy, calls it "open research"`, `${name} copies Sam's homework, gets an A`]),
  pooled: (who: string): string =>
    pick([`${who}'s RAM "pooled to the cloud" by Sam`, `${who} offered free trial of their own RAM`, `Sam thanks ${who} for "donation" to AGI`]),
  loanTaken: (): string => pick(['Jensen lends Sam money to buy Jensen\'s chips', 'Sam signs "totally not circular" deal with Jensen']),
  loanDeclined: (taker: string): string => `${taker} takes Jensen's loan. Analysts: "Circular"`,
  keynote: (): string => pick(['Jensen keynote: "The more you buy, the more you save"', 'Jensen throws GPUs into crowd, stock up 4%']),
  lead: (teamId: string): string => LEAD_LINES[teamId] ?? 'New leader in the RAM race',
  fired: (): string => pick(['Board fires Sam for "not being consistently cool"', 'Sam fired after data center overheats']),
  rehired: (): string => pick(['Sam rehired after staff threaten to quit', 'Board "never really meant it," rehires Sam']),
  tweet: (text: string): string => `Sam tweets "${text}". Bubble inflates.`,
  bubbleDanger: (): string => pick(['Analysts: "This is definitely NOT a bubble"', 'Experts agree bubble will "probably" hold']),
} as const;

const LEAD_LINES: Readonly<Record<string, string>> = {
  sam: 'Sam takes the RAM lead, asks for $7T more anyway',
  dario: 'Dario takes the lead, publishes 90-page apology',
  elon: 'Elon takes the lead, renames it "X Share"',
  gemini: 'Gemini takes the lead. Nobody notices.',
  china: 'Chinese Labs take the lead for $5.6M',
};

/** Shown when nothing is happening. */
export const FILLER = [
  'Analysts: "This is definitely not a bubble"',
  'VCs launch fund to fund the funds that fund AI',
  'Startup adds "AI" to name, valuation up 40x',
  'Local man trades house for 16 GB of DDR5',
  'Gemini rebrands again, keeps the name',
  'Elon promises full self-driving RAM by next year',
  'Desert data center asks clouds for more water',
  'Leather jacket sales up 900%',
  'Benchmark saturated; harder benchmark announced',
  'AGI now expected "in a few thousand days"',
  'Study: 9 out of 10 chatbots agree with you',
  'Prompt engineer salary passes brain surgeon',
  'Your idle RAM is "quite terrible," experts say',
  'Dario: "Have you considered the risks?"',
  'Chinese lab open-sources the desert',
  'RAM now accepted as rent in San Francisco',
] as const;

/** A headline on the ticker. */
export interface TickerItem {
  readonly text: string;
  /** Seconds on screen. */
  age: number;
  /** Filler gives way as soon as real news comes in. */
  readonly filler: boolean;
}

export interface ActiveStory {
  readonly story: NewsStory;
  timeLeft: number;
}

const MIN_ON_SCREEN = 3.5; // real news stays at least this long before the next replaces it
const FILLER_AFTER = 8; // seconds before quiet news gives way to filler
const QUEUE_MAX = 3;

/** Schedules breaking stories and runs the headline ticker. */
export class NewsDesk {
  active: ActiveStory | null = null;
  ticker: TickerItem | null = null;
  private timer = rand(...NEWS_FIRST);
  private bag: NewsKind[] = [];
  private fillerBag: string[] = [];
  private queue: string[] = [];
  private readonly lastByKey = new Map<string, number>();
  private time = 0;

  /** A new level: no story running, the first one a little way off. The bags carry over, so stories don't repeat. */
  reset(): void {
    this.active = null;
    this.timer = rand(...NEWS_FIRST);
    this.queue = [];
    this.ticker = null;
    this.lastByKey.clear();
  }

  isRunning(kind: NewsKind): boolean {
    return this.active?.story.kind === kind;
  }

  /**
   * Advances the clock and the ticker. Returns a story on the frame it breaks.
   * While `canBreak` is false a due story waits (so it never lands on top of Jensen's pop-up).
   */
  update(dt: number, canBreak = true): NewsStory | null {
    this.time += dt;
    this.updateTicker(dt);
    if (this.active) {
      this.active.timeLeft -= dt;
      if (this.active.timeLeft <= 0) {
        this.active = null;
        this.timer = rand(...NEWS_INTERVAL);
      }
      return null;
    }
    this.timer -= dt;
    if (this.timer > 0 || !canBreak) return null;
    return this.breakStory(this.nextKind());
  }

  /** Starts a story right away. */
  breakStory(kind: NewsKind): NewsStory {
    const story = STORIES[kind];
    this.active = { story, timeLeft: story.duration };
    return story;
  }

  /**
   * Queues a headline. Stories with the same `key` are rate-limited to one per `cooldown` seconds,
   * so a busy fight doesn't flood the ticker.
   */
  report(text: string, key?: string, cooldown = 12): void {
    if (key) {
      const last = this.lastByKey.get(key);
      if (last !== undefined && this.time - last < cooldown) return;
      this.lastByKey.set(key, this.time);
    }
    this.queue.push(text);
    if (this.queue.length > QUEUE_MAX) this.queue.shift();
  }

  private updateTicker(dt: number): void {
    const cur = this.ticker;
    if (cur) cur.age += dt;
    const next = this.queue[0];
    if (next !== undefined && (!cur || cur.filler || cur.age >= MIN_ON_SCREEN)) {
      this.queue.shift();
      this.ticker = { text: next, age: 0, filler: false };
    } else if (!cur || cur.age >= FILLER_AFTER) {
      this.ticker = { text: this.nextFiller(), age: 0, filler: true };
    }
  }

  private nextKind(): NewsKind {
    if (!this.bag.length) this.bag = shuffle([...NEWS_KINDS]);
    return this.bag.pop() ?? 'rain';
  }

  private nextFiller(): string {
    if (!this.fillerBag.length) this.fillerBag = shuffle([...FILLER]);
    return this.fillerBag.pop() ?? pick(FILLER);
  }
}
