import { describe, expect, it } from 'vitest';
import { FIRED_TIME, PLAYER_SPEED, SHOVE_COOLDOWN, SOLAR_SETUP, TWEET_COOLDOWN, WORLD_H, WORLD_W } from '../config';
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

describe('Sam getting fired', () => {
  it('stands still holding his box, then can move again', () => {
    const p = new Player();
    p.fire(FIRED_TIME);
    expect(p.canShove).toBe(false);
    expect(p.canTweet).toBe(false);
    const startX = p.pos.x;
    run(p, FIRED_TIME * 0.9, { x: 1, y: 0 });
    expect(p.pos.x).toBe(startX);
    run(p, FIRED_TIME * 0.2 + 0.5, { x: 1, y: 0 });
    expect(p.pos.x).toBeGreaterThan(startX);
    expect(p.canShove).toBe(true);
  });

  it('a new level clears it', () => {
    const p = new Player();
    p.fire(FIRED_TIME);
    p.reset();
    expect(p.fired).toBe(0);
  });
});

describe('hype tweet', () => {
  it('has to wait for the cooldown before posting again', () => {
    const p = new Player();
    expect(p.canTweet).toBe(true);
    p.tweet('feel the agi', TWEET_COOLDOWN);
    expect(p.canTweet).toBe(false);
    run(p, TWEET_COOLDOWN - 0.5);
    expect(p.canTweet).toBe(false);
    run(p, 1);
    expect(p.canTweet).toBe(true);
  });
});

describe('solar panels', () => {
  it('unfold first, then charge', () => {
    const p = new Player();
    p.deploySolar();
    expect(p.solarOut).toBe(true);
    expect(p.charging).toBe(false);
    run(p, SOLAR_SETUP + 0.1);
    expect(p.charging).toBe(true);
    p.packSolar();
    expect(p.solarOut).toBe(false);
    expect(p.charging).toBe(false);
  });

  it('get packed away when the board fires Sam, and at the start of a level', () => {
    const p = new Player();
    p.deploySolar();
    p.fire(FIRED_TIME);
    expect(p.solarOut).toBe(false);
    p.deploySolar();
    p.reset();
    expect(p.solarOut).toBe(false);
  });
});
