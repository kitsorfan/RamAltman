import { describe, expect, it } from 'vitest';
import { SPY_FLEE_TIME } from '../config';
import { dist } from '../math';
import { Spy } from './spy';

const DT = 1 / 60;
const sam = { x: 1600, y: 1200 };
const lookRight = { x: 1, y: 0 };
const lookLeft = { x: -1, y: 0 };

/** Runs the spy for `seconds` with Sam standing still, facing `look`. Returns how often it escaped. */
function run(spy: Spy, look: { x: number; y: number }, seconds: number): number {
  let escaped = 0;
  for (let t = 0; t < seconds; t += DT) if (spy.update(DT, sam, look) === 'escaped') escaped++;
  return escaped;
}

describe('the alleged spy', () => {
  it('creeps up on Sam while his back is turned', () => {
    const spy = new Spy({ x: sam.x + 300, y: sam.y }); // to Sam's right
    run(spy, lookLeft, 0.6);
    expect(spy.frozen).toBe(false);
    expect(dist(spy.pos, sam)).toBeLessThan(250);
  });

  it('freezes behind the newspaper the moment Sam looks their way', () => {
    const spy = new Spy({ x: sam.x + 300, y: sam.y });
    run(spy, lookRight, 1);
    expect(spy.frozen).toBe(true);
    expect(dist(spy.pos, sam)).toBeCloseTo(300, 0);
  });

  it('walking into them face-on catches them', () => {
    const spy = new Spy({ x: sam.x + 20, y: sam.y });
    expect(spy.touch(sam, lookRight)).toBe('caught');
  });

  it('touching Sam from behind gets them his RAM, and then they run', () => {
    const spy = new Spy({ x: sam.x + 20, y: sam.y });
    expect(spy.touch(sam, lookLeft)).toBe('steal');
    spy.steal(2);
    expect(spy.state).toBe('flee');
    expect(spy.loot).toBe(2);
    run(spy, lookLeft, 1);
    expect(dist(spy.pos, sam)).toBeGreaterThan(150);
  });

  it('gets a head start after a theft, so the steal is not undone on the next frame', () => {
    const spy = new Spy({ x: sam.x + 20, y: sam.y });
    spy.steal(2);
    expect(spy.touchable).toBe(false);
    run(spy, lookLeft, 0.6);
    expect(spy.touchable).toBe(true);
    expect(dist(spy.pos, sam)).toBeGreaterThan(100);
  });

  it('catching up with a fleeing spy catches them, whichever way Sam faces', () => {
    const spy = new Spy({ x: sam.x + 20, y: sam.y });
    spy.steal(1);
    expect(spy.touch(sam, lookLeft)).toBe('caught');
  });

  it('a spy who keeps running gets away, once', () => {
    const spy = new Spy({ x: sam.x + 20, y: sam.y });
    spy.steal(2);
    expect(run(spy, lookLeft, SPY_FLEE_TIME + 1)).toBe(1);
    expect(spy.state).toBe('escaped');
    run(spy, lookLeft, 2);
    expect(spy.done).toBe(true);
  });

  it('slips away quietly when the story ends, but not with RAM in hand', () => {
    const sneaking = new Spy({ x: sam.x + 300, y: sam.y });
    sneaking.leave();
    expect(sneaking.state).toBe('left');

    const fleeing = new Spy({ x: sam.x + 20, y: sam.y });
    fleeing.steal(2);
    fleeing.leave();
    expect(fleeing.state).toBe('flee');
  });
});
