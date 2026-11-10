import { describe, expect, it } from 'vitest';
import { WATER_CAPACITY } from '../config';
import { WaterSource } from './water';

describe('WaterSource', () => {
  it('starts full and undiscovered', () => {
    const w = new WaterSource({ x: 500, y: 500 }, 60);
    expect(w.capacity).toBe(WATER_CAPACITY);
    expect(w.radius).toBe(60);
    expect(w.discovered).toBe(false);
    expect(w.empty).toBe(false);
  });

  it('shrinks as it is used, but never below a third of its size before drying up', () => {
    const w = new WaterSource({ x: 0, y: 0 }, 60);
    w.capacity = WATER_CAPACITY / 2;
    expect(w.radius).toBeLessThan(60);
    w.capacity = 0;
    expect(w.radius).toBeCloseTo(60 * 0.35);
    expect(w.empty).toBe(true);
  });

  it('knows whether Sam is standing in it', () => {
    const w = new WaterSource({ x: 0, y: 0 }, 60);
    expect(w.contains({ x: 30, y: 0 })).toBe(true);
    expect(w.contains({ x: 70, y: 0 })).toBe(false);
  });
});
