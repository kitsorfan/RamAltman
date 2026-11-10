import { describe, expect, it } from 'vitest';
import { clamp, dist, length, lerp, normalize, pick, shuffle } from './math';

describe('math', () => {
  it('clamps into a range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('measures distances', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(length({ x: -6, y: 8 })).toBe(10);
  });

  it('normalizes to unit length and leaves the zero vector alone', () => {
    const n = normalize({ x: 3, y: 4 });
    expect(n.x).toBeCloseTo(0.6);
    expect(n.y).toBeCloseTo(0.8);
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('picks an element of the list', () => {
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 20; i++) expect(items).toContain(pick(items));
  });

  it('shuffles in place without losing or duplicating elements', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffle([...items]);
    expect(shuffled).toHaveLength(items.length);
    expect(shuffled.toSorted((a, b) => a - b)).toEqual(items);
  });
});
