import { expect, test, type Page } from '@playwright/test';

/** Collects anything that would indicate a broken or leaky page. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return problems;
}

const canvas = (page: Page) => page.locator('#game');

/** Converts game coordinates (960x640 logical canvas) to page coordinates. */
async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('Game canvas is not visible');
  return { x: box.x + (x / 960) * box.width, y: box.y + (y / 640) * box.height };
}

test('title screen loads cleanly and never contacts third parties', async ({ page, baseURL }) => {
  const problems = watchForProblems(page);
  const thirdParty: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:')) thirdParty.push(url);
  });

  await page.goto('./');
  await expect(page).toHaveTitle('Ram Altman');
  await expect(canvas(page)).toHaveAttribute('data-state', 'title');
  await page.waitForTimeout(1500); // let the attract mode run (bubble, chase, ticker)

  expect(thirdParty).toEqual([]);
  expect(problems).toEqual([]);
});

test('ships a strict Content-Security-Policy with no unsafe sources', async ({ page }) => {
  await page.goto('./');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain('unsafe-');
});

test('Enter starts the game, P pauses and resumes', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto('./');
  await page.keyboard.press('Enter');
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
  await page.keyboard.press('KeyP');
  await expect(canvas(page)).toHaveAttribute('data-state', 'paused');
  await page.keyboard.press('KeyP');
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
  expect(problems).toEqual([]);
});

test('clicking the title screen starts the game', async ({ page }) => {
  await page.goto('./');
  const spot = await toPage(page, 480, 260);
  await page.mouse.click(spot.x, spot.y);
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
});

test('survives a burst of frantic play', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto('./');
  await page.keyboard.press('Enter');
  const moves = ['KeyW', 'KeyD', 'KeyS', 'KeyA'] as const;
  for (let i = 0; i < 16; i++) {
    const key = moves[i % moves.length] ?? 'KeyW';
    await page.keyboard.down(key);
    if (i % 3 === 0) await page.keyboard.down('ShiftLeft');
    await page.keyboard.press('Space'); // shove
    if (i % 5 === 0) await page.keyboard.press('KeyE'); // sonar
    if (i % 4 === 0) await page.keyboard.press('KeyT'); // hype tweet
    await page.waitForTimeout(250);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up(key);
  }
  await expect(canvas(page)).toHaveAttribute('data-state', 'playing');
  expect(problems).toEqual([]);
});

test('the credit badge opens the creator site in a new tab without leaving the title', async ({ page, context }) => {
  // Don't hit the real site from tests; just prove the link goes there.
  await context.route('https://www.kitsorfan.com/**', (route) => route.fulfill({ status: 200, body: 'ok' }));
  await page.goto('./');
  await page.waitForTimeout(300); // first frame draws the badge
  const badge = await toPage(page, 480, 597);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.mouse.click(badge.x, badge.y)]);
  expect(popup.url()).toBe('https://www.kitsorfan.com/');
  await expect(canvas(page)).toHaveAttribute('data-state', 'title');
});
