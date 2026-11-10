// Self-hosted pixel font (bundled at build time, so no third-party font requests).
import '@fontsource/press-start-2p';
import './style.css';

import { AudioEngine } from './audio/engine';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Game } from './game';
import { Input } from './input';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game not found');

// The canvas only sees fonts that are loaded, so request the pixel font up front.
void document.fonts.load('16px "Press Start 2P"');

const audio = new AudioEngine();
const unlockAudio = (): void => audio.unlock();
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

const game = new Game(canvas, new Input(window), audio, new Sfx(audio), new Music(audio));
game.start();

if (import.meta.env.DEV) {
  // Dev only (stripped from production builds): poke at the game from the console, e.g. `game.player.ram = 11`.
  (window as unknown as { game: Game }).game = game;
}
