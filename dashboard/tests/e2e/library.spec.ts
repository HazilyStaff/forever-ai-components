import { expect, test } from '@playwright/test';
import { catalogue, clipboard, openLibrary, openViewer, previewFrame, resultCount, TOGGLE } from './helpers';

test.describe('gallery', () => {
  test('opens with live previews and a count taken from the catalogue', async ({ page }) => {
    const { components } = await catalogue(page);
    await openLibrary(page);
    expect(await resultCount(page)).toBe(components.length);
    await expect(page.getByTestId('component-card').first()).toBeVisible();
    await expect(page.locator('.card .preview[data-state="ready"]').first()).toBeVisible();
    // The real component is running, not a screenshot.
    const frame = await previewFrame(page.getByTestId('component-card').first());
    expect(await frame.evaluate(() => document.querySelectorAll('script').length)).toBeGreaterThan(0);
  });

  test('never starts hundreds of previews at once, and stops the ones that scroll away', async ({ page }) => {
    await openLibrary(page);
    await page.getByRole('button', { name: 'Compact' }).click();
    await expect(page.locator('.card .preview[data-state="ready"]').first()).toBeVisible();
    const rendered = await page.getByTestId('component-card').count();
    expect(rendered).toBeGreaterThan(60);
    await page.waitForTimeout(3000);
    const running = await page.locator('iframe.preview-frame').count();
    expect(running).toBeGreaterThan(0);
    expect(running).toBeLessThanOrEqual(34);
    expect(running).toBeLessThan(rendered);

    const firstCard = page.getByTestId('component-card').first();
    await expect(firstCard.locator('iframe')).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 6000));
    await expect(firstCard.locator('iframe')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(firstCard.locator('.preview')).toHaveAttribute('data-state', 'ready');
  });

  test('remembers the gallery size and the theme', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByTestId('gallery')).toHaveAttribute('data-density', 'comfortable');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Large' }).click();
    await page.getByTestId('theme-toggle').click();
    await expect(page.getByTestId('gallery')).toHaveAttribute('data-density', 'large');
    await page.reload();
    await expect(page.getByTestId('gallery')).toHaveAttribute('data-density', 'large');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('search and filters', () => {
  test('searches as you type, forgives typos and offers suggestions', async ({ page }) => {
    await openLibrary(page);
    const total = await resultCount(page);
    await page.keyboard.press('/');
    await expect(page.getByTestId('search-input')).toBeFocused();
    await page.keyboard.type('toggle');
    await expect.poll(() => resultCount(page)).toBeLessThan(total);
    expect(await resultCount(page)).toBeGreaterThan(0);
    await expect(page.getByTestId('component-card').first().locator('.card-title')).toContainText(/toggle/i);
    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();

    await page.getByTestId('search-input').fill('togle swich');
    await expect.poll(() => resultCount(page)).toBeGreaterThan(0);

    await page.getByTestId('search-input').fill('zzzzqqqq');
    await expect(page.getByText('No components match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search and filters' }).click();
    await expect.poll(() => resultCount(page)).toBe(total);
  });

  test('combines filters, shows counts, and clears them', async ({ page }) => {
    const { components } = await catalogue(page);
    const loaders = components.filter((c) => c.role === 'loader');
    const lightLoaders = loaders.filter((c) => c.perf === 'cheap');
    await openLibrary(page);
    const panel = page.getByTestId('filter-panel');

    await panel.getByText('Loaders', { exact: true }).click();
    await expect.poll(() => resultCount(page)).toBe(loaders.length);
    await expect(page).toHaveURL(/role=loader/);

    await panel.getByText('Lightweight', { exact: true }).click();
    await expect.poll(() => resultCount(page)).toBe(lightLoaders.length);
    await expect(page.getByRole('list', { name: 'Active filters' }).getByRole('button', { name: /Loaders/ })).toBeVisible();

    // The filtered view survives a reload, because it lives in the address.
    await page.reload();
    await expect.poll(() => resultCount(page)).toBe(lightLoaders.length);

    await page.getByTestId('clear-filters').click();
    await expect.poll(() => resultCount(page)).toBe(components.length);
  });

  test('sorts by name', async ({ page }) => {
    await openLibrary(page, '?role=button');
    await page.getByTestId('sort-select').selectOption('name');
    const titles = await page.locator('.card-title a').allTextContents();
    expect(titles.length).toBeGreaterThan(3);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });
});

test.describe('component viewer', () => {
  test('opens from the gallery, shows details, and records it as recently viewed', async ({ page }) => {
    await openLibrary(page, '?q=gooey liquid toggle');
    await page.getByRole('link', { name: TOGGLE.title, exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/c/${TOGGLE.id}$`));
    await expect(page.getByTestId('viewer-title')).toHaveText(TOGGLE.title);
    await expect(page.getByRole('heading', { name: 'About this component' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'At a glance' })).toBeVisible();
    await expect(page.getByText(TOGGLE.path, { exact: true })).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Recently viewed' }).getByRole('link', { name: TOGGLE.title })).toBeVisible();
  });

  test('the preview is interactive: clicking the toggle switches it', async ({ page }) => {
    await openViewer(page, TOGGLE.id);
    await page.getByTestId('pause').click(); // stop its self-running demo so only our click changes it
    const frame = await previewFrame(page.locator('.stage'));
    const button = frame.locator('button[aria-pressed]');
    const before = await button.getAttribute('aria-pressed');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  });

  test('pause, resume and restart control the animation', async ({ page }) => {
    await openViewer(page, 'kinetic-type/01-weight-morph-wave');
    let frame = await previewFrame(page.locator('.stage'));
    await frame.evaluate(() => {
      const w = window as any;
      w.__frames = 0;
      w.__marker = 'before-restart';
      const loop = () => {
        w.__frames++;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const frames = () => frame.evaluate(() => (window as any).__frames as number);
    await expect.poll(frames).toBeGreaterThan(3);

    await page.getByTestId('pause').click();
    await page.waitForTimeout(300);
    const held = await frames();
    await page.waitForTimeout(500);
    expect(await frames()).toBe(held);

    await page.getByTestId('pause').click();
    await expect.poll(frames).toBeGreaterThan(held);

    await page.getByTestId('restart').click();
    await expect(page.locator('.stage .preview')).toHaveAttribute('data-state', 'ready');
    frame = await previewFrame(page.locator('.stage'));
    expect(await frame.evaluate(() => (window as any).__marker)).toBeUndefined();
  });

  test('size, colour mode and background controls reach the component', async ({ page }) => {
    await openViewer(page, 'inputs-switches/01-liquid-toggle');
    const frame = await previewFrame(page.locator('.stage'));
    const rootTheme = () => frame.evaluate(() => document.documentElement.getAttribute('data-theme'));

    await page.getByRole('group', { name: 'Component colour mode' }).getByRole('button', { name: 'Light' }).click();
    await expect.poll(rootTheme).toBe('light');
    await page.getByRole('group', { name: 'Component colour mode' }).getByRole('button', { name: 'Dark' }).click();
    await expect.poll(rootTheme).toBe('dark');

    await page.getByRole('button', { name: 'Background: White' }).click();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
    await page.getByRole('button', { name: 'Background: Original' }).click();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(255, 255, 255)');

    await page.getByRole('group', { name: 'Preview size' }).getByRole('button', { name: 'Phone' }).click();
    await expect.poll(() => frame.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([390, 844]);
    await expect(page.getByTestId('open-original')).toHaveAttribute('href', /^\/infinite\/inputs-switches\/01-liquid-toggle\?v=/);
  });

  test('a bookmarked link opens the same component; an unknown one explains itself', async ({ page }) => {
    await page.goto(`/c/${TOGGLE.id}`);
    await expect(page.getByTestId('viewer-title')).toHaveText(TOGGLE.title);
    await page.getByTestId('copy-link').click();
    expect(await clipboard(page)).toBe(`http://127.0.0.1:8788/c/${TOGGLE.id}`);

    await page.goto('/c/buttons/99-never-existed');
    await expect(page.getByRole('heading', { name: 'This component isn’t in the library' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});

test.describe('copy for AI and source', () => {
  test('COPY FOR AI puts ready-to-paste instructions for this component on the clipboard', async ({ page }) => {
    await openViewer(page, TOGGLE.id);
    await page.getByTestId('copy-for-ai').click();
    await expect(page.getByText(/Copied for AI/)).toBeVisible();
    const text = await clipboard(page);
    expect(text).toContain(`Component: ${TOGGLE.title}`);
    expect(text).toContain(`Original file: ${TOGGLE.path}`);
    expect(text).toContain(`https://raw.githubusercontent.com/HazilyStaff/forever-ai-components/main/${TOGGLE.path}`);
    expect(text).toContain('Do not introduce unnecessary dependencies.');
  });

  test('detailed and self-contained options work and are remembered', async ({ page }) => {
    await openViewer(page, TOGGLE.id);
    await page.getByTestId('copy-for-ai-options').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Detailed' }).click();
    await expect(dialog.getByTestId('prompt-text')).toContainText('## Expected behaviour');
    await dialog.getByText('Include the complete source code', { exact: true }).click();
    await expect(dialog.getByTestId('prompt-text')).toContainText('BEGIN ORIGINAL SOURCE');
    await dialog.getByRole('button', { name: 'Copy for AI' }).click();
    const text = await clipboard(page);
    expect(text).toContain('## Testing');
    expect(text).toContain('<!doctype html>');
    expect(text).toContain('c02-goo__btn');
    expect(text).not.toContain('data-fc-bridge');

    await page.reload();
    await page.getByTestId('copy-for-ai').click();
    await expect(page.getByText(/Copied for AI: Detailed instructions with full source/)).toBeVisible();
  });

  test('copies the file path, the raw URL and the original source, and downloads the original file', async ({ page }) => {
    await openViewer(page, TOGGLE.id);
    await page.getByTestId('copy-path').click();
    expect(await clipboard(page)).toBe(TOGGLE.path);
    await page.getByTestId('copy-raw-url').click();
    expect(await clipboard(page)).toBe(`https://raw.githubusercontent.com/HazilyStaff/forever-ai-components/main/${TOGGLE.path}`);

    await page.getByTestId('copy-source').click();
    await expect(page.getByText('Source code copied.')).toBeVisible();
    const source = await clipboard(page);
    expect(source.trimStart().toLowerCase()).toMatch(/^<!doctype html>/);
    expect(source).toContain('forever-agent-meta');
    expect(source).not.toContain('data-fc-bridge');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-source').click()]);
    expect(download.suggestedFilename()).toBe('02-gooey-liquid-toggle.html');
  });
});
