import { normalize, type Vec } from './math';

const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/** Keyboard state: `isDown` for held keys, `wasPressed` for this frame's new presses. */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Normalized movement direction from WASD / arrow keys. */
  axis(): Vec {
    const x = (this.isDown('ArrowRight', 'KeyD') ? 1 : 0) - (this.isDown('ArrowLeft', 'KeyA') ? 1 : 0);
    const y = (this.isDown('ArrowDown', 'KeyS') ? 1 : 0) - (this.isDown('ArrowUp', 'KeyW') ? 1 : 0);
    return normalize({ x, y });
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
