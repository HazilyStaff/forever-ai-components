import { defineConfig, devices } from '@playwright/test';

// Two copies of the built site run locally:
//   8788  sign-in check switched off (allowed on localhost only) — used to test the app itself
//   8789  sign-in check enforced, exactly as deployed — used to prove nothing is served without it
export const OPEN_URL = 'http://127.0.0.1:8788';
export const LOCKED_URL = 'http://127.0.0.1:8789';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  workers: 3,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: OPEN_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /(library|workflow|security)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] },
    },
    { name: 'iphone-webkit', testMatch: /mobile\.spec\.ts/, use: { ...devices['iPhone 14'] } },
    { name: 'ipad-webkit', testMatch: /mobile\.spec\.ts/, use: { ...devices['iPad (gen 7)'] } },
  ],
  webServer: [
    {
      command: 'npx wrangler pages dev dist --port 8788 --ip 127.0.0.1 --binding LOCAL_DEV_NO_AUTH=true',
      url: OPEN_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npx wrangler pages dev dist --port 8789 --ip 127.0.0.1 --binding LOCAL_DEV_NO_AUTH=false',
      url: `${LOCKED_URL}/favicon.svg`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
