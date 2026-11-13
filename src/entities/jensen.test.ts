import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../audio/engine';
import { Sfx } from '../audio/sfx';
import { Effects } from '../fx/effects';
import { RESIGN_GPUS } from '../config';
import { dist } from '../math';
import { Jensen, type JensenWorld } from './jensen';
import { Player } from './player';

/** A tiny stand-in for the Game: records what Jensen asks it to do. */
function makeWorld() {
  const player = new Player();
  const log = { giveaways: 0, pitches: [] as string[], drops: 0 };
  const world: JensenWorld = {
    player,
    fx: new Effects(),
    sfx: new Sfx(new AudioEngine()), // no AudioContext in tests: every sound is a no-op
    jensenGiveaway() {
      log.giveaways++;
    },
    jensenPitch(_jensen, pitch) {
      log.pitches.push(pitch);
    },
    jensenDropGpu() {
      log.drops++;
    },
  };
  return { world, player, log };
}

function step(jensen: Jensen, world: JensenWorld, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) jensen.update(dt, world);
}

describe('Jensen', () => {
  it('holds a keynote, throws GPUs exactly once, then leaves', () => {
    const { world, player, log } = makeWorld();
    const jensen = new Jensen('giveaway', { x: player.pos.x + 200, y: player.pos.y });
    expect(jensen.beforeGiveaway).toBe(true);
    step(jensen, world, 10);
    expect(log.giveaways).toBe(1);
    expect(log.pitches).toEqual([]);
    expect(jensen.gone).toBe(true);
  });

  it('pitches a loan once and waits for an answer instead of leaving', () => {
    const { world, player, log } = makeWorld();
    const jensen = new Jensen('loan', { x: player.pos.x + 140, y: player.pos.y });
    step(jensen, world, 20);
    expect(log.pitches).toHaveLength(1);
    expect(log.giveaways).toBe(0);
    expect(jensen.pitching).toBe(true);
    expect(jensen.gone).toBe(false);

    jensen.resolve(false, 'Dario');
    expect(jensen.pitching).toBe(false);
    step(jensen, world, 5);
    expect(jensen.gone).toBe(true);
  });

  it('follows Sam around while the offer is open', () => {
    const { world, player } = makeWorld();
    const jensen = new Jensen('loan', { x: player.pos.x + 600, y: player.pos.y });
    step(jensen, world, 6);
    expect(jensen.pitching).toBe(true);
    expect(dist(jensen.pos, player.pos)).toBeLessThan(140);
  });

  it('ignores an answer when no offer is open', () => {
    const { world, player, log } = makeWorld();
    const jensen = new Jensen('giveaway', { x: player.pos.x + 200, y: player.pos.y });
    jensen.resolve(true);
    step(jensen, world, 10);
    expect(log.giveaways).toBe(1);
  });

  it('steps down: walks off with the box, drops every GPU, then leaves', () => {
    const { world, player, log } = makeWorld();
    const jensen = new Jensen('resign', { x: player.pos.x + 150, y: player.pos.y });
    step(jensen, world, 1);
    expect(jensen.carrying).toBe(true);
    step(jensen, world, 12);
    expect(log.drops).toBe(RESIGN_GPUS);
    expect(log.pitches).toEqual([]);
    expect(log.giveaways).toBe(0);
    expect(jensen.gone).toBe(true);
  });

  it('walks away from Sam while the GPUs fall out of the box', () => {
    const { world, player } = makeWorld();
    const jensen = new Jensen('resign', { x: player.pos.x + 150, y: player.pos.y });
    step(jensen, world, 4);
    expect(dist(jensen.pos, player.pos)).toBeGreaterThan(220);
  });
});
