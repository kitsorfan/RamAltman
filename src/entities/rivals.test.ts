import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../audio/engine';
import { Sfx } from '../audio/sfx';
import { STUN_TIME } from '../config';
import { Effects } from '../fx/effects';
import { length } from '../math';
import { Pickup } from './pickup';
import { Player } from './player';
import { Dario, Elon, SwarmBot, allTeams, createTeams, spawnRivals, type Rival, type RivalWorld } from './rivals';

/** A tiny stand-in for the Game: records what rivals do to Sam. */
function makeWorld() {
  const player = new Player();
  const pickups: Pickup[] = [];
  const log = { stolen: 0, distilled: 0, knocks: 0, collected: [] as Pickup[] };
  const world: RivalWorld = {
    player,
    pickups,
    fx: new Effects(),
    sfx: new Sfx(new AudioEngine()), // no AudioContext in tests: every sound is a no-op
    level: 1,
    rivalCollect(rival, pickup) {
      pickup.alive = false;
      if (pickup.kind === 'ram') rival.team.ram++;
      log.collected.push(pickup);
    },
    stealRam(rival, amount) {
      const n = Math.min(amount, player.ram);
      player.ram -= n;
      rival.team.ram += n;
      log.stolen += n;
      return n;
    },
    distill() {
      log.distilled++;
    },
    knockPlayer() {
      log.knocks++;
    },
  };
  return { world, player, pickups, log };
}

function step(rival: Rival, world: RivalWorld, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) rival.update(dt, world);
}

describe('teams', () => {
  it('gives each competitor its own market share', () => {
    const teams = allTeams(createTeams());
    expect(teams.map((t) => t.name)).toEqual(['Sam (you)', 'Dario', 'Elon', 'Gemini', 'Chinese Labs']);
    expect(new Set(teams.map((t) => t.id)).size).toBe(teams.length);
    expect(teams.every((t) => t.ram === 0 && t.gpus === 0)).toBe(true);
  });

  it('spawns four strategies, with the Chinese Labs as a swarm of three sharing one team', () => {
    const teams = createTeams();
    const rivals = spawnRivals(teams);
    expect(rivals).toHaveLength(6);
    const bots = rivals.filter((r) => r instanceof SwarmBot);
    expect(bots).toHaveLength(3);
    expect(bots.every((b) => b.team === teams.china)).toBe(true);
  });
});

describe('rival behavior', () => {
  it('collects pickups it touches', () => {
    const { world, pickups } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    pickups.push(new Pickup('ram', { x: 505, y: 500 }));
    step(dario, world, 0.1);
    expect(pickups[0]?.alive).toBe(false);
    expect(dario.team.ram).toBe(1);
  });

  it('cannot collect anything while stunned', () => {
    const { world, pickups } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.hit({ x: 1, y: 0 });
    dario.vel = { x: 0, y: 0 };
    pickups.push(new Pickup('ram', { ...dario.pos }));
    step(dario, world, STUN_TIME * 0.5);
    expect(dario.stunned).toBe(true);
    expect(pickups[0]?.alive).toBe(true);
  });

  it('comes back furious after a shove and takes revenge on contact', () => {
    const { world, player, log } = makeWorld();
    player.ram = 3;
    const dario = new Dario(createTeams().dario, { x: player.pos.x + 400, y: player.pos.y });
    dario.hit({ x: 1, y: 0 });
    expect(dario.furious).toBe(false); // stunned first...
    step(dario, world, STUN_TIME + 0.1);
    expect(dario.furious).toBe(true); // ...then out for revenge

    dario.handleContact(world);
    expect(log.stolen).toBe(1);
    expect(player.ram).toBe(2);
    expect(dario.furious).toBe(false);
  });

  it('Dario never steals on ordinary contact', () => {
    const { world, player, log } = makeWorld();
    player.ram = 5;
    const dario = new Dario(createTeams().dario, { x: player.pos.x + 20, y: player.pos.y });
    dario.handleContact(world);
    expect(log.stolen).toBe(0);
    expect(log.knocks).toBe(1);
  });

  it('Elon charges at Sam when Sam carries RAM, and a dash steals 2', () => {
    const { world, player, log } = makeWorld();
    player.ram = 5;
    const elon = new Elon(createTeams().elon, { x: player.pos.x + 200, y: player.pos.y });
    let dashed = false;
    for (let t = 0; t < 10 && !dashed; t += 1 / 60) {
      if (length(elon.vel) < 300) elon.pos = { x: player.pos.x + 200, y: player.pos.y }; // keep him in range until he commits
      elon.update(1 / 60, world);
      dashed = length(elon.vel) > 400;
    }
    expect(dashed).toBe(true);
    elon.handleContact(world);
    expect(log.stolen).toBe(2);
  });

  it('hitting one Chinese Labs bot sends the whole swarm after Sam', () => {
    const bots = spawnRivals(createTeams()).filter((r) => r instanceof SwarmBot);
    const [hitBot, ...others] = bots;
    hitBot?.hit({ x: 1, y: 0 });
    expect(hitBot?.stunned).toBe(true);
    expect(others.every((b) => b.furious)).toBe(true);
  });

  it('the swarm distills energy instead of stealing RAM', () => {
    const { world, player, log } = makeWorld();
    player.ram = 4;
    const bot = spawnRivals(createTeams()).find((r) => r instanceof SwarmBot);
    bot?.handleContact(world);
    expect(log.distilled).toBe(1);
    expect(log.stolen).toBe(0);
  });

  it('an energy cell gives a temporary speed boost', () => {
    const { world } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.energize();
    expect(dario.boost).toBeGreaterThan(0);
    step(dario, world, 5);
    expect(dario.boost).toBe(0);
  });
});
