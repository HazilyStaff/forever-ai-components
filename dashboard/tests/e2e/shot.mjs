// Developer helper: takes screenshots of the running site for a visual check.
//   node tests/e2e/shot.mjs <output-dir> [base-url]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'test-results/shots';
const base = process.argv[3] || 'http://127.0.0.1:8788';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const problems = [];

async function capture(name, contextOptions, steps) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  await steps(page);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await context.close();
}

const desktop = { viewport: { width: 1440, height: 900 } };
const phone = { ...devices['iPhone 14'] };

await capture('01-library-dark', desktop, async (page) => {
  await page.goto(base + '/');
  await page.waitForSelector('.preview[data-state="ready"]');
  await page.waitForTimeout(2500);
});
await capture('02-library-light-compact', desktop, async (page) => {
  await page.goto(base + '/');
  await page.getByTestId('theme-toggle').click();
  await page.getByRole('button', { name: 'Compact' }).click();
  await page.waitForTimeout(3500);
});
await capture('03-viewer', desktop, async (page) => {
  await page.goto(base + '/c/inputs-switches/01-liquid-toggle');
  await page.waitForSelector('.stage .preview[data-state="ready"]');
  await page.waitForTimeout(800);
});
await capture('04-viewer-lower', desktop, async (page) => {
  await page.goto(base + '/c/inputs-switches/01-liquid-toggle');
  await page.waitForSelector('.stage .preview[data-state="ready"]');
  await page.evaluate(() => window.scrollTo(0, 760));
  await page.waitForTimeout(500);
});
await capture('05-quick-preview', desktop, async (page) => {
  await page.goto(base + '/?q=toggle');
  await page.getByTestId('quick-preview-button').first().click({ force: true });
  await page.waitForSelector('.quick .preview[data-state="ready"]');
});
await capture('06-copy-dialog', desktop, async (page) => {
  await page.goto(base + '/c/inputs-switches/01-liquid-toggle');
  await page.getByTestId('copy-for-ai-options').click();
  await page.waitForTimeout(600);
});
await capture('07-settings', desktop, async (page) => {
  await page.goto(base + '/settings');
  await page.waitForTimeout(400);
});
await capture('08-phone-library', phone, async (page) => {
  await page.goto(base + '/');
  await page.waitForSelector('.preview[data-state="ready"]');
  await page.waitForTimeout(1500);
});
await capture('09-phone-viewer', phone, async (page) => {
  await page.goto(base + '/c/inputs-switches/01-liquid-toggle');
  await page.waitForSelector('.stage .preview[data-state="ready"]');
});
await capture('10-phone-filters', phone, async (page) => {
  await page.goto(base + '/');
  await page.getByTestId('filters-toggle').click();
  await page.waitForTimeout(400);
});

await browser.close();
console.log(problems.length ? `Console problems:\n${problems.join('\n')}` : 'No console errors.');
