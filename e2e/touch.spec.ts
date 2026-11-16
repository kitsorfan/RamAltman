import { expect, test, type Page } from '@playwright/test';
import { canvas, centerOf, toPage, watchForProblems } from './helpers';

// Runs in the "phone" project (a touch phone held sideways); see playwright.config.ts.

const ACTIONS = ['shove', 'sprint', 'sonar', 'tweet', 'solar'] as const;

async function tap(page: Page, point: { x: number; y: number }): Promise<void> {
  await page.touchscreen.tap(point.x, point.y);
}

async function startGame(page: Page): Promise<void> {
  await page.goto('./');
  await tap(page, await toPage(page, 480, 260));
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
}

test('a phone gets "tap" prompts and touch controls that show only while playing', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-input', 'touch');
  await expect(page.locator('.touch-shove')).toBeHidden();

  await tap(page, await toPage(page, 480, 260));
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
  for (const name of [...ACTIONS, 'pause']) await expect(page.locator(`.touch-${name}`)).toBeVisible();
  expect(problems).toEqual([]);
});

test('survives two-thumb play: the stick held while hammering every button', async ({ page, context }) => {
  const problems = watchForProblems(page);
  await startGame(page);
  const buttons = await Promise.all(ACTIONS.map((name) => centerOf(page.locator(`.touch-${name}`))));
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('No viewport');

  // Raw multi-touch: finger 1 drives the stick, finger 2 taps the buttons.
  const cdp = await context.newCDPSession(page);
  const stick = { x: 100, y: viewport.height - 100, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [stick] });
  for (let i = 0; i < 20; i++) {
    const angle = i * 0.9;
    const thumb = { ...stick, x: stick.x + Math.cos(angle) * 45, y: stick.y + Math.sin(angle) * 45 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [thumb] });
    const button = buttons[i % buttons.length];
    if (!button) continue;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb, { ...button, id: 2 }] });
    await page.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [thumb] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('.touch-stick')).not.toHaveClass(/active/);
  expect(problems).toEqual([]);
});

test('the pause button pauses, sound toggles on the pause screen, and a tap resumes', async ({ page }) => {
  await startGame(page);
  await tap(page, await centerOf(page.locator('.touch-pause')));
  await expect(canvas(page)).toHaveAttribute('data-state', 'paused');
  await expect(page.locator('.touch-pause')).toBeHidden();

  await expect(canvas(page)).toHaveAttribute('data-sound', 'on');
  await tap(page, await centerOf(page.locator('.touch-sound')));
  await expect(canvas(page)).toHaveAttribute('data-sound', 'off');
  await tap(page, await centerOf(page.locator('.touch-music')));
  await expect(canvas(page)).toHaveAttribute('data-music', 'off');
  await expect(canvas(page)).toHaveAttribute('data-state', 'paused'); // toggles don't resume

  await tap(page, await toPage(page, 480, 200));
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
});

test('turning the phone upright pauses the game behind a "turn sideways" notice', async ({ page }) => {
  await startGame(page);
  const landscape = page.viewportSize();
  if (!landscape) throw new Error('No viewport');
  const notice = page.getByText('Turn your phone sideways');
  await expect(notice).toBeHidden();

  await page.setViewportSize({ width: landscape.height, height: landscape.width });
  await expect(notice).toBeVisible();
  await expect(canvas(page)).toHaveAttribute('data-state', 'paused');

  await page.setViewportSize(landscape);
  await expect(notice).toBeHidden();
  await expect(canvas(page)).toHaveAttribute('data-state', 'paused'); // waits for a tap to resume
});

test('plugging in a keyboard switches back to keys and hides the touch controls', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('KeyW');
  await expect(page.locator('html')).toHaveAttribute('data-input', 'keys');
  await expect(page.locator('.touch-shove')).toBeHidden();
  await tap(page, await toPage(page, 480, 200));
  await expect(page.locator('html')).toHaveAttribute('data-input', 'touch');
  await expect(page.locator('.touch-shove')).toBeVisible();
});
