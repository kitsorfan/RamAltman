/** The only thing the game persists: the best score, in this browser only. */
const HIGH_SCORE_KEY = 'ram-altman.highscore';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage, or null where it's unavailable (blocked cookies, sandboxed frames, Node). */
function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads the saved high score; anything missing, malformed or tampered with counts as 0. */
export function loadHighScore(store: KeyValueStore | null = browserStore()): number {
  try {
    const value = Number(store?.getItem(HIGH_SCORE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Saves a high score; invalid values are ignored and storage failures never break the game. */
export function saveHighScore(score: number, store: KeyValueStore | null = browserStore()): void {
  if (!Number.isSafeInteger(score) || score < 0) return;
  try {
    store?.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // Storage full or unavailable (e.g. private mode): the score just won't persist.
  }
}
