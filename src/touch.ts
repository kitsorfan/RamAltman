import { stickAxis, type Input } from './input';
import type { Vec } from './math';

/** An on-screen button and the key it stands in for. */
interface TouchButton {
  /** CSS hook: `.touch-<name>`. */
  name: string;
  code: string;
  label: string;
  /** Inner SVG markup for a 24x24 icon. */
  icon: string;
}

const ICONS = {
  shove: '<path class="solid" d="M12 1.5l2.3 5.9 5.8-2.6-2.4 5.9 5.8 2.2-5.8 2.3 2.4 5.9-5.8-2.7L12 22.5l-2.3-6.1-5.8 2.7 2.4-5.9-5.8-2.3 5.8-2.2-2.4-5.9 5.8 2.6z"/>',
  sprint: '<path d="M5 5l7 7-7 7M12 5l7 7-7 7"/>',
  sonar:
    '<circle class="solid" cx="12" cy="12" r="2.4"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
  tweet: '<path d="M3.5 4.5h17v11h-9l-5 4v-4h-3z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
  solar:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  sound: '<path class="solid" d="M3.5 9h4l5-4.5v15l-5-4.5h-4z"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.8 6.2a8.5 8.5 0 0 1 0 11.6"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle class="solid" cx="6.5" cy="18" r="2.6"/><circle class="solid" cx="17.5" cy="16" r="2.6"/>',
  rotate:
    '<rect x="6.5" y="2" width="11" height="20" rx="2"/><path d="M10.5 18.5h3"/>',
} as const;

/** Right thumb, in the order they fan out around SHOVE. */
const ACTIONS: readonly TouchButton[] = [
  { name: 'shove', code: 'KeyJ', label: 'SHOVE', icon: ICONS.shove },
  { name: 'sprint', code: 'ShiftLeft', label: 'SPRINT', icon: ICONS.sprint },
  { name: 'tweet', code: 'KeyT', label: 'TWEET', icon: ICONS.tweet },
  { name: 'sonar', code: 'KeyE', label: 'SONAR', icon: ICONS.sonar },
  { name: 'solar', code: 'KeyR', label: 'SOLAR', icon: ICONS.solar },
];
const PAUSE: TouchButton = { name: 'pause', code: 'KeyP', label: 'PAUSE', icon: ICONS.pause };
const MENU: readonly TouchButton[] = [
  { name: 'sound', code: 'KeyM', label: 'SOUND', icon: ICONS.sound },
  { name: 'music', code: 'KeyN', label: 'MUSIC', icon: ICONS.music },
];

/** Portrait on a phone: the 3:2 game would be too small to play. (Portrait tablets are wide enough.) */
const PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 600px)';

const ZERO: Vec = { x: 0, y: 0 };

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/** A button that holds its key down for as long as a finger is on it. */
function button(b: TouchButton, input: Input): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `touch-btn touch-${b.name}`;
  el.tabIndex = -1; // keyboard players have the real keys
  el.setAttribute('aria-label', b.label);
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${b.icon}</svg><span>${b.label}</span>`;
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    el.classList.add('down');
    input.press(b.code);
  });
  const up = (): void => {
    el.classList.remove('down');
    input.release(b.code);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  return el;
}

/**
 * Floating stick: wherever the left thumb lands, the stick centers there, and it follows the
 * thumb if it drifts past the edge. While no thumb is on it, a faint stick rests in the corner.
 */
function stick(input: Input): HTMLElement {
  const zone = div('touch-stick-zone touch-play');
  const base = div('touch-stick');
  const knob = div('touch-knob');
  base.append(knob);
  zone.append(base);

  let finger: number | null = null;
  let origin: Vec = ZERO;
  let corner: Vec = ZERO;
  let reach = 1;

  const drag = (e: PointerEvent): void => {
    let dx = e.clientX - corner.x - origin.x;
    let dy = e.clientY - corner.y - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > reach) {
      const pull = 1 - reach / d;
      origin = { x: origin.x + dx * pull, y: origin.y + dy * pull };
      dx -= dx * pull;
      dy -= dy * pull;
    }
    base.style.left = `${origin.x}px`;
    base.style.top = `${origin.y}px`;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.setStick(stickAxis(dx, dy, reach));
  };
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== finger) return;
    finger = null;
    input.setStick(ZERO);
    base.classList.remove('active');
    base.style.left = '';
    base.style.top = '';
    knob.style.transform = '';
  };

  zone.addEventListener('pointerdown', (e) => {
    if (finger !== null) return;
    finger = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = zone.getBoundingClientRect();
    corner = { x: r.left, y: r.top };
    origin = { x: e.clientX - r.left, y: e.clientY - r.top };
    reach = base.offsetWidth / 2;
    base.classList.add('active');
    drag(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === finger) drag(e);
  });
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
  return zone;
}

function rotateNotice(): HTMLElement {
  const el = div('touch-rotate');
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.rotate}</svg><p>Turn your phone sideways</p><small>Ram Altman plays in landscape</small>`;
  return el;
}

/** Fullscreen (and landscape, where the browser allows locking it) to win back the room browser bars take. */
function enterFullscreen(): void {
  const root = document.documentElement;
  if (document.fullscreenElement || typeof root.requestFullscreen !== 'function') return; // e.g. iPhone Safari
  root
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };
      return orientation.lock?.('landscape');
    })
    .catch(() => {
      // Not allowed here; the game still fits the page.
    });
}

/**
 * On-screen controls for phones and tablets: a stick for the left thumb, action buttons for the right,
 * a pause button, and sound toggles on the pause screen. They show while the player is on touch (any key
 * press switches back to keyboard mode), and CSS shows each part only in the game states it belongs to.
 *
 * @param onPortrait called when a phone turns to portrait, so the game can pause behind the "turn your phone" notice.
 */
export function mountTouchControls(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  input: Input,
  onPortrait: () => void,
): void {
  const root = document.documentElement;
  const portrait = window.matchMedia(PORTRAIT_QUERY);
  const handheld = window.matchMedia('(pointer: coarse)');

  const checkOrientation = (): void => {
    const blocked = input.touch && portrait.matches;
    if (blocked && !root.hasAttribute('data-portrait')) onPortrait();
    root.toggleAttribute('data-portrait', blocked);
  };
  const setTouch = (on: boolean): void => {
    if (root.dataset['input'] && input.touch === on) return;
    input.touch = on;
    root.dataset['input'] = on ? 'touch' : 'keys';
    checkOrientation();
  };

  const actions = div('touch-actions touch-play');
  actions.append(...ACTIONS.map((b) => button(b, input)));
  const pause = button(PAUSE, input);
  pause.classList.add('touch-play');
  const menu = div('touch-menu touch-paused');
  menu.append(...MENU.map((b) => button(b, input)));
  stage.append(stick(input), actions, pause, menu, rotateNotice());
  // A long press is a held button, not a request for the browser's menu.
  stage.addEventListener('contextmenu', (e) => {
    if (input.touch) e.preventDefault();
  });

  // Phones and tablets start on touch; after that, follow whatever the player last used.
  setTouch(handheld.matches);
  portrait.addEventListener('change', checkOrientation);
  let tapState: string | undefined;
  window.addEventListener(
    'pointerdown',
    (e) => {
      setTouch(e.pointerType !== 'mouse');
      tapState = canvas.dataset['state'];
    },
    true,
  );
  // A real keyboard, that is: not the phone's volume or media buttons.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code && !/^(Audio|Media)/.test(e.code)) setTouch(false);
    },
    true,
  );
  // A menu tap on a phone (start, resume, next series) also goes fullscreen; taps mid-game never do.
  // Browsers only allow it on the finger lifting, by which time the tap may already have started a game.
  window.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'touch' && handheld.matches && tapState !== 'playing') enterFullscreen();
    },
    true,
  );
}
