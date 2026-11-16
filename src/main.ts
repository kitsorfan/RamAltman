// Self-hosted pixel font (bundled at build time, so no third-party font requests).
import '@fontsource/press-start-2p';
import './style.css';

import { AudioEngine } from './audio/engine';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Game } from './game';
import { Input } from './input';
import { mountTouchControls } from './touch';

const stage = document.querySelector<HTMLElement>('#stage');
const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!stage || !canvas) throw new Error('Game stage or canvas not found');

// The canvas only sees fonts that are loaded, so request the pixel font up front.
void document.fonts.load('16px "Press Start 2P"');

const audio = new AudioEngine();
const unlockAudio = (): void => audio.unlock();
// Some mobile browsers only count a tap as a gesture once the finger lifts.
for (const type of ['keydown', 'pointerdown', 'pointerup', 'touchend']) window.addEventListener(type, unlockAudio);

const input = new Input(window);
const game = new Game(canvas, input, audio, new Sfx(audio), new Music(audio));
mountTouchControls(stage, canvas, input, () => game.pause());
game.start();

if (import.meta.env.DEV) {
  // Dev only (stripped from production builds): poke at the game from the console, e.g. `game.player.ram = 11`.
  (window as unknown as { game: Game }).game = game;
}
