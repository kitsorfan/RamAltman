import { beforeEach, describe, expect, it } from 'vitest';
import { Input } from './input';

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
    ctx.blur();
    expect(ctx.input.isDown('KeyA')).toBe(false);
  });
});
