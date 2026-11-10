import { describe, expect, it } from 'vitest';
import { Pickup } from './pickup';

describe('Pickup', () => {
  it('sizes each kind', () => {
    expect(new Pickup('ram', { x: 0, y: 0 }).radius).toBe(12);
    expect(new Pickup('gpu', { x: 0, y: 0 }).radius).toBe(16);
    expect(new Pickup('energy', { x: 0, y: 0 }).radius).toBe(13);
  });

  it('stays put unless knocked loose', () => {
    const p = new Pickup('ram', { x: 100, y: 100 });
    for (let i = 0; i < 60; i++) p.update(1 / 60);
    expect(p.pos).toEqual({ x: 100, y: 100 });
  });

  it('slides to a stop when knocked loose from a rival', () => {
    const p = new Pickup('ram', { x: 0, y: 0 });
    p.vel.x = 300;
    for (let i = 0; i < 180; i++) p.update(1 / 60);
    expect(p.vel).toEqual({ x: 0, y: 0 });
    // Exponential drag of 5/s: travel distance is about v / 5.
    expect(p.pos.x).toBeGreaterThan(50);
    expect(p.pos.x).toBeLessThan(65);
  });
});
