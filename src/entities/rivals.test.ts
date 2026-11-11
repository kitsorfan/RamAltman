import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../audio/engine';
import { Sfx } from '../audio/sfx';
import { FURY_TIME, STUN_TIME } from '../config';
import { Effects } from '../fx/effects';
import { dist, length } from '../math';
import { Pickup } from './pickup';
import { Player } from './player';
import { Dario, Elon, SWARM_NAMES, SwarmBot, allTeams, createTeams, spawnRivals, type Rival, type RivalWorld } from './rivals';

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

  it('can start with no Chinese Labs models on the field (in a game they drop in later)', () => {
    const rivals = spawnRivals(createTeams(), 0);
    expect(rivals).toHaveLength(3);
    expect(rivals.some((r) => r instanceof SwarmBot)).toBe(false);
  });

  it('names the models in the order they drop', () => {
    const bots = spawnRivals(createTeams(), SWARM_NAMES.length).filter((r) => r instanceof SwarmBot);
    expect(bots.map((b) => b.label)).toEqual([...SWARM_NAMES]);
  });

  it('a model that drops in later joins the same swarm', () => {
    const teams = createTeams();
    const flock: SwarmBot[] = [];
    const first = new SwarmBot(teams.china, 'DeepSeek', { x: 500, y: 500 }, flock);
    const second = new SwarmBot(teams.china, 'Qwen', { x: 900, y: 500 }, flock);
    first.hit({ x: 1, y: 0 });
    expect(second.furious).toBe(true);
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

describe('distractions (tweets, panics, summits)', () => {
  it('a distracted rival stops, collects nothing, and leaves Sam alone', () => {
    const { world, pickups } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.vel = { x: 150, y: 0 };
    dario.distract('phone', 2);
    expect(dario.distracted).toBe('phone');
    expect(dario.busy).toBe(true);
    pickups.push(new Pickup('ram', { x: 505, y: 500 }));
    step(dario, world, 1);
    expect(length(dario.vel)).toBeLessThan(5);
    expect(pickups[0]?.alive).toBe(true);
  });

  it('goes back to playing once it ends', () => {
    const { world, pickups } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.distract('panic', 1);
    pickups.push(new Pickup('ram', { x: 505, y: 500 }));
    step(dario, world, 1.2);
    expect(dario.distracted).toBeNull();
    expect(dario.busy).toBe(false);
    expect(pickups[0]?.alive).toBe(false);
  });

  it('walks to the summit before sitting down', () => {
    const { world } = makeWorld();
    const gemini = spawnRivals(createTeams()).find((r) => r.team.id === 'gemini');
    expect(gemini).toBeDefined();
    if (!gemini) return;
    gemini.pos = { x: 500, y: 500 };
    const seat = { x: 800, y: 500 };
    gemini.distract('summit', 8, { goTo: seat });
    step(gemini, world, 5);
    expect(dist(gemini.pos, seat)).toBeLessThan(60);
    expect(gemini.distracted).toBe('summit');
  });

  it('a quick tweet does not cut a long summit short', () => {
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.distract('lecture', 9);
    dario.distract('phone', 2);
    expect(dario.distracted).toBe('lecture');
  });

  it('a shove snaps a rival out of it', () => {
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.distract('phone', 2);
    dario.hit({ x: 1, y: 0 });
    expect(dario.distracted).toBeNull();
    expect(dario.stunned).toBe(true);
  });

  it('pauses fury instead of forgetting it', () => {
    const { world } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    dario.enrage(5);
    dario.distract('phone', 2);
    step(dario, world, 2.1);
    expect(dario.furious).toBe(true);
    expect(dario.fury).toBeCloseTo(5, 0);
  });

  it('a lawsuit can make Elon furious for longer than a shove would', () => {
    const elon = new Elon(createTeams().elon, { x: 500, y: 500 });
    elon.enrage(FURY_TIME + 3);
    expect(elon.fury).toBe(FURY_TIME + 3);
  });

  it("Elon's dash is called off when he stops to read", () => {
    const { world, player } = makeWorld();
    player.ram = 5;
    const elon = new Elon(createTeams().elon, { x: player.pos.x + 200, y: player.pos.y });
    for (let t = 0; t < 10 && length(elon.vel) < 400; t += 1 / 60) {
      if (length(elon.vel) < 300) elon.pos = { x: player.pos.x + 200, y: player.pos.y };
      elon.update(1 / 60, world);
    }
    expect(length(elon.vel)).toBeGreaterThan(400);
    elon.distract('phone', 2);
    step(elon, world, 0.5);
    expect(length(elon.vel)).toBeLessThan(100);
  });

  it('nobody can grab RAM that is still falling', () => {
    const { world, pickups } = makeWorld();
    const dario = new Dario(createTeams().dario, { x: 500, y: 500 });
    const drop = new Pickup('ram', { x: 505, y: 500 });
    drop.z = 600;
    pickups.push(drop);
    dario.update(1 / 60, world);
    expect(drop.alive).toBe(true);
  });
});
