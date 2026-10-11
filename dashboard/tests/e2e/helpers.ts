import { expect, type Frame, type Locator, type Page } from '@playwright/test';

export const TOGGLE = { id: 'buttons/02-gooey-liquid-toggle', title: 'Gooey Liquid Toggle', path: 'infinite/buttons/02-gooey-liquid-toggle.html' };

export async function catalogue(page: Page): Promise<{ components: any[]; meta: any }> {
  const response = await page.request.get('/data/catalogue.json');
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function openLibrary(page: Page, query = '') {
  await page.goto(`/${query}`);
  await expect(page.getByTestId('gallery')).toBeVisible();
}

export async function openViewer(page: Page, id: string) {
  await page.goto(`/c/${id}`);
  await expect(page.locator('.stage .preview')).toHaveAttribute('data-state', 'ready');
}

/** The running component inside a preview box. */
export async function previewFrame(scope: Locator | Page): Promise<Frame> {
  const handle = await scope.locator('iframe.preview-frame').first().elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error('The preview frame is not available.');
  return frame;
}

export const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

export async function resultCount(page: Page): Promise<number> {
  const text = (await page.getByTestId('result-count').locator('strong').textContent()) ?? '';
  return Number(text.replace(/[^\d]/g, ''));
}

export async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement!;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(1);
}
