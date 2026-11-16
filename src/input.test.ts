import { beforeEach, describe, expect, it } from 'vitest';
import { Input, stickAxis } from './input';

/** Minimal stand-in for window: Input only needs addEventListener. */
function setup(): { input: Input; key: (type: 'keydown' | 'keyup', code: string, repeat?: boolean) => void; blur: () => void } {
  const target = new EventTarget();
  const input = new Input(target as unknown as Window);
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false): void => {
    target.dispatchEvent(Object.assign(new Event(type), { code, repeat }));
  };
  return { input, key, blur: () => target.dispatchEvent(new Event('blur')) };
}

describe('Input', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('tracks held keys', () => {
    ctx.key('keydown', 'KeyW');
    expect(ctx.input.isDown('KeyW')).toBe(true);
    ctx.key('keyup', 'KeyW');
    expect(ctx.input.isDown('KeyW')).toBe(false);
  });

  it('reports a press for one frame only, and ignores auto-repeat', () => {
    ctx.key('keydown', 'Space');
    expect(ctx.input.wasPressed('Space')).toBe(true);
    ctx.input.endFrame();
    expect(ctx.input.wasPressed('Space')).toBe(false);
    ctx.key('keydown', 'Space', true);
    expect(ctx.input.wasPressed('Space')).toBe(false);
  });

  it('turns WASD and arrows into a normalized direction', () => {
    ctx.key('keydown', 'KeyD');
    expect(ctx.input.axis()).toEqual({ x: 1, y: 0 });
    ctx.key('keydown', 'ArrowDown');
    const diagonal = ctx.input.axis();
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('releases everything when the window loses focus', () => {
    ctx.key('keydown', 'KeyA');
    ctx.input.setStick({ x: 1, y: 0 });
    ctx.blur();
    expect(ctx.input.isDown('KeyA')).toBe(false);
    expect(ctx.input.axis()).toEqual({ x: 0, y: 0 });
  });

  it('treats an on-screen button like the key it stands in for', () => {
    ctx.input.press('ShiftLeft');
    expect(ctx.input.wasPressed('ShiftLeft')).toBe(true);
    ctx.input.endFrame();
    expect(ctx.input.wasPressed('ShiftLeft')).toBe(false);
    expect(ctx.input.isDown('ShiftLeft')).toBe(true); // still held
    ctx.input.release('ShiftLeft');
    expect(ctx.input.isDown('ShiftLeft')).toBe(false);
  });

  it('moves with the on-screen stick, unless movement keys are held', () => {
    ctx.input.setStick({ x: 0, y: -0.5 });
    expect(ctx.input.axis()).toEqual({ x: 0, y: -0.5 });
    ctx.key('keydown', 'KeyD');
    expect(ctx.input.axis()).toEqual({ x: 1, y: 0 });
  });
});

describe('stickAxis', () => {
  const REACH = 50;

  it('ignores a resting thumb inside the dead zone', () => {
    expect(stickAxis(0, 0, REACH)).toEqual({ x: 0, y: 0 });
    expect(stickAxis(6, -6, REACH)).toEqual({ x: 0, y: 0 });
  });

  it('walks right away once past the dead zone, and runs at full speed from about half way out', () => {
    const nudge = stickAxis(0, 12, REACH);
    expect(nudge.x).toBe(0);
    expect(nudge.y).toBeGreaterThanOrEqual(0.4);
    expect(nudge.y).toBeLessThan(0.5);
    expect(stickAxis(30, 0, REACH)).toEqual({ x: 1, y: 0 });
    expect(stickAxis(-REACH, 0, REACH)).toEqual({ x: -1, y: 0 });
  });

  it('keeps the direction of the drag', () => {
    const v = stickAxis(30, 30, REACH);
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(Math.SQRT1_2);
  });
});
