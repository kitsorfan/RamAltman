import { describe, expect, it } from 'vitest';
import { PLAYER_SPEED, SHOVE_COOLDOWN, WORLD_H, WORLD_W } from '../config';
import { Player } from './player';

const STILL = { x: 0, y: 0 };

function run(player: Player, seconds: number, axis = STILL, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) player.update(dt, axis, 1);
}

describe('Player (Sam)', () => {
  it('starts each level in the middle of the map, fully charged, with no RAM', () => {
    const p = new Player();
    p.heat = 80;
    p.power = 5;
    p.ram = 9;
    p.reset();
    expect(p.pos).toEqual({ x: WORLD_W / 2, y: WORLD_H / 2 });
    expect(p.heat).toBe(0);
    expect(p.power).toBe(100);
    expect(p.ram).toBe(0);
  });

  it('moves at roughly the configured speed', () => {
    const p = new Player();
    const startX = p.pos.x;
    run(p, 1, { x: 1, y: 0 });
    expect(p.pos.x - startX).toBeGreaterThan(PLAYER_SPEED * 0.85);
    expect(p.pos.x - startX).toBeLessThan(PLAYER_SPEED * 1.05);
  });

  it('sprints faster than it walks', () => {
    const walker = new Player();
    const sprinter = new Player();
    sprinter.sprinting = true;
    run(walker, 1, { x: 1, y: 0 });
    run(sprinter, 1, { x: 1, y: 0 });
    expect(sprinter.pos.x).toBeGreaterThan(walker.pos.x);
  });

  it('cannot leave the world', () => {
    const p = new Player();
    p.pos.x = 30;
    run(p, 2, { x: -1, y: 0 });
    expect(p.pos.x).toBe(p.radius);
  });

  it('lunges when shoving and must wait for the cooldown before shoving again', () => {
    const p = new Player();
    p.look = { x: 1, y: 0 };
    expect(p.canShove).toBe(true);
    const startX = p.pos.x;
    p.startShove();
    expect(p.canShove).toBe(false);
    expect(p.shoveActive).toBeGreaterThan(0);
    run(p, 0.3);
    expect(p.pos.x).toBeGreaterThan(startX); // the lunge carried Sam forward
    expect(p.canShove).toBe(false);
    run(p, SHOVE_COOLDOWN);
    expect(p.canShove).toBe(true);
  });
});
