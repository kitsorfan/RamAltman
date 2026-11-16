import { clamp, normalize, type Vec } from './math';

const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const ZERO: Vec = { x: 0, y: 0 };

/** On-screen stick, as fractions of its reach: ignore drags inside STICK_DEAD, full speed from STICK_FULL out. */
const STICK_DEAD = 0.2;
const STICK_FULL = 0.6;
/** Speed just past the dead zone, so the first nudge already walks. */
const STICK_MIN_SPEED = 0.4;

/**
 * Movement from an on-screen stick dragged `dx, dy` from its center. The dead zone stops a resting
 * thumb from stepping (which would pack up the solar panels); past that, speed ramps up to full.
 */
export function stickAxis(dx: number, dy: number, reach: number): Vec {
  const d = Math.hypot(dx, dy);
  const t = d / reach;
  if (t < STICK_DEAD) return ZERO;
  const speed = STICK_MIN_SPEED + (1 - STICK_MIN_SPEED) * clamp((t - STICK_DEAD) / (STICK_FULL - STICK_DEAD), 0, 1);
  return { x: (dx / d) * speed, y: (dy / d) * speed };
}

/**
 * Keyboard state: `isDown` for held keys, `wasPressed` for this frame's new presses.
 * On-screen touch controls feed the same state through `press`/`release` (as the keys they stand in for) and `setStick`.
 */
export class Input {
  /** True while the player is on the touch controls (they set it), so prompts say "tap" instead of naming keys. */
  touch = false;
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private stick: Vec = ZERO;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => {
      this.down.clear();
      this.stick = ZERO;
    });
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  /** An on-screen button went down: counts as pressing (and holding) the key it stands in for. */
  press(code: string): void {
    this.pressed.add(code);
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  /** Movement from the on-screen stick (see `stickAxis`); ZERO once it's let go. */
  setStick(axis: Vec): void {
    this.stick = axis;
  }

  /** Movement direction: WASD / arrow keys (normalized), or else the on-screen stick. */
  axis(): Vec {
    const x = (this.isDown('ArrowRight', 'KeyD') ? 1 : 0) - (this.isDown('ArrowLeft', 'KeyA') ? 1 : 0);
    const y = (this.isDown('ArrowDown', 'KeyS') ? 1 : 0) - (this.isDown('ArrowUp', 'KeyW') ? 1 : 0);
    return x !== 0 || y !== 0 ? normalize({ x, y }) : this.stick;
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
