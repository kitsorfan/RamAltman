import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = Boolean(process.env['CI']);

/**
 * End-to-end smoke tests against the real production build.
 * Uses Playwright's bundled Chromium (`npx playwright install chromium`), or an installed
 * browser via PW_CHANNEL, e.g. `PW_CHANNEL=msedge npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env['PW_CHANNEL'] },
    },
  ],
  webServer: {
    // CI builds in an earlier step; locally, build first so tests always run the latest code.
    command: `${isCI ? '' : 'npm run build && '}npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
