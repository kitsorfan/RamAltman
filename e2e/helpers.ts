import type { Locator, Page } from '@playwright/test';

/** Collects anything that would indicate a broken or leaky page. */
export function watchForProblems(page: Page): string[] {
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

export const canvas = (page: Page): Locator => page.locator('#game');

/** Converts game coordinates (960x640 logical canvas) to page coordinates. */
export async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('Game canvas is not visible');
  return { x: box.x + (x / 960) * box.width, y: box.y + (y / 640) * box.height };
}

/** The middle of an element, in page coordinates. */
export async function centerOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Element is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
