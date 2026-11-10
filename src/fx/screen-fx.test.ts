import { describe, expect, it } from 'vitest';
import { ScreenFx } from './screen-fx';

const STILL = { x: 0, y: 0 };

describe('ScreenFx', () => {
  it('pulses the HUD element a pickup flies into, then fades', () => {
    const fx = new ScreenFx();
    fx.fly({ x: 400, y: 300 }, { x: 100, y: 120 }, 'ram');
    fx.update(0.1, STILL, 0);
    expect(fx.ramPulse).toBe(0); // still in flight
    fx.update(0.6, STILL, 0);
    expect(fx.ramPulse).toBe(1); // landed
    fx.update(0.1, STILL, 0);
    expect(fx.ramPulse).toBeLessThan(1);
    expect(fx.energyPulse).toBe(0);
    expect(fx.scorePulse).toBe(0);
  });

  it('routes each kind of pickup to its own HUD element', () => {
    const fx = new ScreenFx();
    fx.fly(STILL, STILL, 'gpu');
    fx.fly(STILL, STILL, 'energy');
    fx.update(0.7, STILL, 0);
    expect(fx.scorePulse).toBe(1);
    expect(fx.energyPulse).toBe(1);
  });

  it('clears everything on a new level', () => {
    const fx = new ScreenFx();
    fx.bubblePulse = 1;
    fx.fly(STILL, STILL, 'ram');
    fx.update(0.7, STILL, 0);
    fx.clear();
    expect([fx.ramPulse, fx.scorePulse, fx.energyPulse, fx.bubblePulse]).toEqual([0, 0, 0, 0]);
  });
});
