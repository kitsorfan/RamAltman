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

describe('RAM rain', () => {
  it('falls straight down, lands once, then stays put', () => {
    const p = new Pickup('ram', { x: 100, y: 100 });
    p.z = 600;
    expect(p.airborne).toBe(true);
    let landings = 0;
    for (let i = 0; i < 180; i++) {
      p.update(1 / 60);
      if (p.landed) landings++;
    }
    expect(landings).toBe(1);
    expect(p.airborne).toBe(false);
    expect(p.z).toBe(0);
    expect(p.pos).toEqual({ x: 100, y: 100 });
  });

  it('higher drops land later', () => {
    const low = new Pickup('ram', { x: 0, y: 0 });
    const high = new Pickup('ram', { x: 0, y: 0 });
    low.z = 300;
    high.z = 900;
    let lowAt = -1;
    let highAt = -1;
    for (let i = 0; i < 180; i++) {
      low.update(1 / 60);
      high.update(1 / 60);
      if (low.landed) lowAt = i;
      if (high.landed) highAt = i;
    }
    expect(lowAt).toBeGreaterThan(0);
    expect(highAt).toBeGreaterThan(lowAt);
  });
});
