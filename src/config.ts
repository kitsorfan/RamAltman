// Credits.
export const CREDIT_URL = 'https://www.kitsorfan.com';
export const CREDIT_TEXT = 'Created by www.kitsorfan.com';

// Viewport (logical pixels) and world size.
export const VIEW_W = 960;
export const VIEW_H = 640;
export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Player movement.
export const PLAYER_SPEED = 220;
export const PLAYER_RADIUS = 16;
export const SPRINT_MULT = 1.6;
export const LOW_POWER_MULT = 0.5;
export const START_LIVES = 3;
export const MAGNET_RADIUS = 45; // pickups within this range get pulled to you

// Shove: SPACE hits rivals in front of you. It works, but it costs you.
export const SHOVE_COOLDOWN = 1.0;
export const SHOVE_ACTIVE = 0.15; // seconds the hit can connect
export const SHOVE_RANGE = 58;
export const SHOVE_ARC = 1.3; // half-angle in radians (~75 degrees)
export const SHOVE_LUNGE = 280;
export const SHOVE_ENERGY = 8; // spent on every shove, hit or miss
export const SHOVE_HEAT = 5;
export const SHOVE_BAD_PRESS = 0.025; // each landed hit inflates the AI bubble
export const SHOVE_DROP = 2; // RAM knocked loose per hit
export const SHOVE_POINTS = 50;
export const STUN_TIME = 1.6;
export const FURY_TIME = 6; // after the stun, the victim hunts you down
export const FURY_SPEED = 1.3;

// Heat (0-100). Hitting 100 costs a life. Water cools you down.
export const HEAT_BASE = 2.2; // per second, level 1
export const HEAT_PER_LEVEL = 0.35;
export const HEAT_SPRINT = 5.5;
export const HEAT_GPU = 7; // GPUs run hot
export const COOL_RATE = 45; // while standing in water

// Energy (0-100). Drains over time; refill from energy cells. At 0 you crawl.
export const POWER_DRAIN = 1.4;
export const POWER_SPRINT = 8;
export const PING_COST = 12;
export const ENERGY_POWER = 30; // per energy cell
export const ENERGY_ON_FIELD = 5;
export const ENERGY_SPAWN_INTERVAL = 4;

// Water sources dry up as you use them, then reappear somewhere else.
export const WATER_CAPACITY = 100;
export const WATER_DRAIN = 20;
export const WATER_RESPAWN_DELAY = 4;

// Rivals.
export const RIVAL_SPEED_SCALE = 1.0;
export const RIVAL_BOOST_TIME = 4; // speed boost after a rival grabs an energy cell

// People out in the desert with idle RAM in their PCs. Stand next to one and Sam pools it to the cloud.
// The price: you have to stay put while it uploads, and every take is bad press for the bubble.
export const CIVILIANS_ON_FIELD = 3;
export const CIVILIAN_RESPAWN = 18; // seconds before someone new shows up
export const POOL_RANGE = 48;
export const POOL_TIME = 1.4;
export const POOL_BAD_PRESS = 0.03;

// Jensen drops by now and then: a keynote that throws free GPUs around (rivals race you for them),
// or a loan to buy his chips. The loan is a circular deal, so it inflates the AI bubble.
export const JENSEN_FIRST_VISIT: readonly [number, number] = [12, 18]; // seconds into a level
export const JENSEN_INTERVAL: readonly [number, number] = [26, 38]; // between visits
export const JENSEN_GIVEAWAY_GPUS = 3;
export const LOAN_GPUS = 3;
export const LOAN_BUBBLE = 0.08;
export const LOAN_OFFER_TIME = 7; // seconds to decide before the offer expires

// Scoring.
export const COMBO_WINDOW = 2.5;
export const COMBO_MAX = 8;
export const RAM_POINTS = 100;
export const GPU_POINTS = 1000;
export const TIME_BONUS_PER_SEC = 50;
export const LEADER_BONUS = 2500;
export const GPU_ON_FIELD = 3;
export const RAM_SPAWN_INTERVAL = 0.4; // seconds between RAM respawns (when below the field cap)

// Per-level tuning.
export const levelTarget = (level: number): number => 14 + 5 * (level - 1);
export const bubbleDuration = (level: number): number => Math.max(60, 105 - 7 * (level - 1));
export const waterCount = (level: number): number => Math.max(2, 5 - Math.floor((level - 1) / 2));
export const ramOnField = (level: number): number => 30 + 2 * level;

/** Level 1 = Series A, 2 = Series B, ... */
export const seriesName = (level: number): string =>
  level <= 26 ? String.fromCharCode(64 + level) : `Z+${level - 26}`;
