import { describe, expect, it } from 'vitest';
import { RAM_SPAWN_INTERVAL, bubbleDuration, levelTarget, ramOnField, seriesName, waterCount } from './config';

describe('level tuning', () => {
  it('names levels after funding rounds', () => {
    expect(seriesName(1)).toBe('A');
    expect(seriesName(2)).toBe('B');
    expect(seriesName(26)).toBe('Z');
    expect(seriesName(27)).toBe('Z+1');
  });

  it('asks for more RAM every series', () => {
    for (let level = 1; level < 30; level++) {
      expect(levelTarget(level + 1)).toBeGreaterThan(levelTarget(level));
    }
  });

  it('supplies at least twice the target in RAM over a level, leaving room for rivals', () => {
    for (let level = 1; level <= 15; level++) {
      const supply = ramOnField(level) + bubbleDuration(level) / RAM_SPAWN_INTERVAL;
      expect(supply).toBeGreaterThanOrEqual(levelTarget(level) * 2);
    }
  });

  it('shrinks the bubble timer but never below a minute', () => {
    expect(bubbleDuration(2)).toBeLessThan(bubbleDuration(1));
    expect(bubbleDuration(100)).toBe(60);
  });

  it('always leaves at least two oases', () => {
    expect(waterCount(1)).toBeGreaterThanOrEqual(waterCount(10));
    expect(waterCount(100)).toBe(2);
  });
});
