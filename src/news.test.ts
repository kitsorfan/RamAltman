import { describe, expect, it } from 'vitest';
import { NEWS_FIRST, NEWS_INTERVAL } from './config';
import { FILLER, NEWS_KINDS, NewsDesk, STORIES, type NewsStory } from './news';

const DT = 1 / 60;

/** Runs the desk for `seconds` and returns every story that broke. */
function run(desk: NewsDesk, seconds: number, canBreak = true): NewsStory[] {
  const broke: NewsStory[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const story = desk.update(DT, canBreak);
    if (story) broke.push(story);
  }
  return broke;
}

/** Runs the desk until a story breaks (at most `seconds`) and stops right there. */
function runUntilStory(desk: NewsDesk, seconds: number): NewsStory | undefined {
  for (let t = 0; t < seconds; t += DT) {
    const story = desk.update(DT);
    if (story) return story;
  }
  return undefined;
}

describe('breaking news', () => {
  it('every story explains itself and runs for a few seconds', () => {
    for (const kind of NEWS_KINDS) {
      const s = STORIES[kind];
      expect(s.kind).toBe(kind);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.headline.length).toBeGreaterThan(0);
      expect(s.rule.length).toBeGreaterThan(0);
      expect(s.samLines.length).toBeGreaterThan(0);
      expect(s.duration).toBeGreaterThan(3);
      expect(s.duration).toBeLessThan(20);
    }
  });

  it('breaks the first story a little way into a level', () => {
    const desk = new NewsDesk();
    expect(run(desk, NEWS_FIRST[0] - 1)).toEqual([]);
    // Check as it breaks: a short story that broke early may already be over a few seconds later.
    const story = runUntilStory(desk, NEWS_FIRST[1] - NEWS_FIRST[0] + 2);
    expect(story).toBeDefined();
    expect(desk.active?.story).toBe(story);
  });

  it('runs one story at a time, with a breather in between', () => {
    const desk = new NewsDesk();
    // Time from the moment it breaks: the first story lands at a random point in NEWS_FIRST.
    const first = runUntilStory(desk, NEWS_FIRST[1] + 0.1);
    expect(first).toBeDefined();
    if (!first) return;
    expect(run(desk, first.duration - 0.5)).toEqual([]); // still running
    expect(desk.active).not.toBeNull();
    expect(run(desk, 0.5 + NEWS_INTERVAL[0] - 1)).toEqual([]); // ended, but the next isn't due yet
    expect(desk.active).toBeNull();
  });

  it('holds a due story while blocked (e.g. a loan offer is open), then breaks it', () => {
    const desk = new NewsDesk();
    expect(run(desk, NEWS_FIRST[1] + 5, false)).toEqual([]);
    expect(run(desk, DT * 2)).toHaveLength(1);
  });

  it("this week's stories break first in a new session: the spy, then Jensen stepping down", () => {
    const desk = new NewsDesk();
    expect(runUntilStory(desk, NEWS_FIRST[1] + 0.1)?.kind).toBe('spy');
    desk.reset();
    expect(runUntilStory(desk, NEWS_FIRST[1] + 0.1)?.kind).toBe('resign');
  });

  it('tells every story once before repeating any', () => {
    const desk = new NewsDesk();
    const kinds = NEWS_KINDS.map(() => {
      desk.reset();
      return run(desk, NEWS_FIRST[1] + 0.1)[0]?.kind;
    });
    expect(new Set(kinds).size).toBe(NEWS_KINDS.length);
  });

  it('a new level clears the running story', () => {
    const desk = new NewsDesk();
    desk.breakStory('heatwave');
    expect(desk.isRunning('heatwave')).toBe(true);
    desk.reset();
    expect(desk.active).toBeNull();
  });
});

describe('news ticker', () => {
  it('shows filler when nothing is happening', () => {
    const desk = new NewsDesk();
    run(desk, 0.1, false);
    expect(desk.ticker?.filler).toBe(true);
    expect(FILLER).toContain(desk.ticker?.text);
  });

  it('real news replaces filler right away', () => {
    const desk = new NewsDesk();
    run(desk, 1, false);
    desk.report('Sam does a thing');
    run(desk, DT, false);
    expect(desk.ticker?.text).toBe('Sam does a thing');
    expect(desk.ticker?.filler).toBe(false);
  });

  it('keeps each real headline up long enough to read', () => {
    const desk = new NewsDesk();
    desk.report('First');
    desk.report('Second');
    run(desk, 1, false);
    expect(desk.ticker?.text).toBe('First');
    run(desk, 3, false);
    expect(desk.ticker?.text).toBe('Second');
  });

  it('rate-limits repeats of the same kind of story', () => {
    const desk = new NewsDesk();
    desk.report('Shove 1', 'shove', 10);
    desk.report('Shove 2', 'shove', 10);
    run(desk, 5, false);
    expect(desk.ticker?.text).toBe('Shove 1');
    run(desk, 3, false);
    expect(desk.ticker?.text).not.toBe('Shove 2');
    run(desk, 3, false);
    desk.report('Shove 3', 'shove', 10);
    run(desk, DT, false);
    expect(desk.ticker?.text).toBe('Shove 3');
  });
});
