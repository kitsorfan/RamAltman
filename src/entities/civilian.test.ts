import { describe, expect, it } from 'vitest';
import { POOL_RANGE, POOL_TIME } from '../config';
import { Civilian, PROFILES } from './civilian';

const DT = 1 / 60;
const at = { x: 1000, y: 1000 };
const near = { x: at.x + POOL_RANGE - 10, y: at.y };
const far = { x: at.x + 600, y: at.y };

/** Runs the civilian for `seconds` with Sam at `sam`; returns how many times the RAM was taken. */
function run(c: Civilian, sam: { x: number; y: number }, seconds: number): number {
  let taken = 0;
  for (let t = 0; t < seconds; t += DT) if (c.update(DT, sam)) taken++;
  return taken;
}

describe('people with idle RAM', () => {
  it('everyone has some idle RAM to give', () => {
    expect(PROFILES.length).toBeGreaterThan(1);
    expect(PROFILES.every((p) => p.ram > 0)).toBe(true);
  });

  it('Sam takes the RAM after standing close for the pooling time', () => {
    const c = new Civilian(at);
    expect(run(c, near, POOL_TIME * 0.5)).toBe(0);
    expect(c.pooling).toBe(true);
    expect(run(c, near, POOL_TIME * 0.6)).toBe(1);
    expect(c.pooled).toBe(true);
    expect(c.ram).toBe(0);
  });

  it('can only be taken once', () => {
    const c = new Civilian(at);
    expect(run(c, near, POOL_TIME * 4)).toBe(1);
  });

  it('nothing happens from a distance', () => {
    const c = new Civilian(at);
    expect(run(c, far, 10)).toBe(0);
    expect(c.pooling).toBe(false);
  });

  it('stepping away stalls the upload, so it costs time to come back', () => {
    const c = new Civilian(at);
    run(c, near, POOL_TIME * 0.8);
    run(c, far, 2);
    expect(c.progress).toBe(0);
    expect(run(c, near, POOL_TIME * 0.5)).toBe(0);
  });

  it('leaves a while after the RAM is gone', () => {
    const c = new Civilian(at);
    run(c, near, POOL_TIME * 1.1);
    expect(c.gone).toBe(false);
    run(c, far, 6);
    expect(c.gone).toBe(true);
  });
});
