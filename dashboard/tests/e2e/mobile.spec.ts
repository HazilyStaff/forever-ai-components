// Runs in WebKit (the engine behind Safari) at iPhone and iPad sizes with touch input.
import { expect, test } from '@playwright/test';
import { noSidewaysScroll, openLibrary, openViewer, TOGGLE } from './helpers';

test('library fits the screen and previews run', async ({ page }) => {
  // CI machines have no graphics card and cannot paint a full tablet screen of live previews in
  // time, so there the check uses a short result list. Locally it uses the whole library.
  await openLibrary(page, process.env.CI ? '?q=gooey liquid toggle' : '');
  await expect(page.locator('.card .preview[data-state="ready"]').first()).toBeVisible();
  await noSidewaysScroll(page);
  for (const density of ['Compact', 'Large']) {
    await page.getByRole('button', { name: density }).click();
    await noSidewaysScroll(page);
  }
});

test('navigation is reachable and stays on screen', async ({ page, isMobile }) => {
  await openLibrary(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  const box = (await nav.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (viewport.width <= 760) {
    // Phones: a tab bar pinned to the bottom edge.
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    await page.evaluate(() => window.scrollTo(0, 2000));
    const after = (await nav.boundingBox())!;
    expect(Math.round(after.y + after.height)).toBe(viewport.height);
  } else {
    expect(box.y).toBeLessThan(60);
    // Tablets: every menu item fits, and none runs under the theme button.
    const toggle = (await page.getByTestId('theme-toggle').boundingBox())!;
    const last = (await nav.getByRole('link', { name: /Settings/ }).boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(toggle.x + 1);
    expect(toggle.x + toggle.width).toBeLessThanOrEqual(viewport.width);
  }
  expect(isMobile).toBe(true);
  await nav.getByRole('link', { name: /Collections/ }).tap();
  await expect(page.getByRole('heading', { name: 'Collections', level: 1 })).toBeVisible();
  await noSidewaysScroll(page);
  await nav.getByRole('link', { name: /Settings/ }).tap();
  await expect(page.getByTestId('health-report')).toBeVisible();
  await noSidewaysScroll(page);
});

test('filters open as a sheet and apply', async ({ page }) => {
  await openLibrary(page);
  const viewport = page.viewportSize()!;
  test.skip(viewport.width >= 1080, 'Wide screens show the filter panel in place.');
  await page.getByTestId('filters-toggle').tap();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await sheet.getByText('Loaders', { exact: true }).tap();
  await sheet.getByRole('button', { name: /^Show \d+ results?$/ }).tap();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/role=loader/);
  await expect(page.getByTestId('component-card').first()).toContainText('Loader');
});

test('tapping a card opens the quick preview; favourites persist', async ({ page }) => {
  await openLibrary(page, '?q=gooey liquid toggle');
  const card = page.getByTestId('component-card').first();
  await card.getByTestId('favourite-button').tap();
  await card.locator('.card-open').tap();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.preview')).toHaveAttribute('data-state', 'ready');
  await noSidewaysScroll(page);
  await dialog.getByRole('button', { name: 'Close' }).tap();
  await page.reload();
  await expect(page.getByTestId('component-card').first().getByTestId('favourite-button')).toHaveAttribute('aria-pressed', 'true');
});

test('viewer works with touch', async ({ page }) => {
  await openViewer(page, TOGGLE.id);
  await noSidewaysScroll(page);
  await expect(page.getByTestId('copy-for-ai')).toBeVisible();
  await page.getByTestId('pause').tap();
  // Centre the preview so the fixed tab bar is not on top of the spot being tapped.
  await page.locator('.stage').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const handle = await page.locator('.stage iframe').elementHandle();
  const frame = (await handle!.contentFrame())!;
  const button = frame.locator('button[aria-pressed]');
  const before = await button.getAttribute('aria-pressed');
  await button.tap();
  await expect(button).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await page.getByTestId('copy-for-ai-options').tap();
  await expect(page.getByRole('dialog').getByTestId('prompt-text')).toContainText(TOGGLE.title);
  await noSidewaysScroll(page);
});
