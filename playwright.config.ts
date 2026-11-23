// Playwright end-to-end configuration.
//
// Required environment variables (never hardcode or commit them):
//   E2E_EMAIL      email of the real church-admin account for the QA church
//   E2E_PASSWORD   password for that account
//
// Optional environment variables:
//   E2E_BASE_URL     default: https://app.worshipcenter.app
//   E2E_CHURCH_NAME  default: "ZZ Test Church (Cody QA)"
//
// A local Next.js web server is started only when E2E_BASE_URL points at
// localhost. The default (already-deployed) target does not need a build.
import { defineConfig, devices } from '@playwright/test';

const baseURL = (
  process.env.E2E_BASE_URL ?? 'https://app.worshipcenter.app'
).replace(/\/+$/, '');

const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
  baseURL
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
  // Off for the deployed default target; only used for a local Next server.
  webServer: isLocalTarget
    ? {
        command: `npm run dev -- -p ${new URL(baseURL).port || '3000'}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
