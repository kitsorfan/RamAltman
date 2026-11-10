import { describe, expect, it } from 'vitest';
import { loadHighScore, saveHighScore, type KeyValueStore } from './storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError: storage disabled');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('high score storage', () => {
  it('starts at 0 when nothing is saved', () => {
    expect(loadHighScore(memoryStore())).toBe(0);
    expect(loadHighScore(null)).toBe(0);
  });

  it('round-trips a score', () => {
    const store = memoryStore();
    saveHighScore(12_345, store);
    expect(loadHighScore(store)).toBe(12_345);
  });

  it.each(['abc', '-5', '12.5', '1e309', 'NaN', '99999999999999999999', ''])('treats a tampered value %j as 0', (raw) => {
    expect(loadHighScore(memoryStore({ 'ram-altman.highscore': raw }))).toBe(0);
  });

  it('refuses to save invalid scores', () => {
    const store = memoryStore();
    saveHighScore(-1, store);
    saveHighScore(Number.NaN, store);
    saveHighScore(1.5, store);
    expect(store.data.size).toBe(0);
  });

  it('never throws when storage is blocked or full', () => {
    expect(loadHighScore(brokenStore)).toBe(0);
    expect(() => saveHighScore(100, brokenStore)).not.toThrow();
  });
});
