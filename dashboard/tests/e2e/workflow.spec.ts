import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { clipboard, openLibrary, openViewer } from './helpers';

const PICKS = [
  { id: 'buttons/02-gooey-liquid-toggle', title: 'Gooey Liquid Toggle' },
  { id: 'inputs-switches/01-liquid-toggle', title: 'Liquid Toggle' },
  { id: 'kinetic-type/01-weight-morph-wave', title: 'Weight Morph Wave' },
];

async function createCollection(page: Page, name: string) {
  await page.goto('/collections');
  await page.getByTestId('new-collection').click();
  await page.getByTestId('name-dialog-input').fill(name);
  await page.getByTestId('name-dialog-confirm').click();
  await expect(page.getByTestId('collection-title')).toHaveText(name);
}

async function addToCollection(page: Page, id: string, collection: string) {
  await openViewer(page, id);
  await page.getByTestId('viewer-collect').click();
  const dialog = page.getByRole('dialog', { name: 'Add to collection' });
  await dialog.getByText(collection, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();
}

const order = (page: Page) => page.getByTestId('collection-item').evaluateAll((items) => items.map((i) => i.getAttribute('data-id')));

test('favourites: one click, shown everywhere, searchable, kept after a refresh', async ({ page }) => {
  await openLibrary(page, '?q=toggle');
  const card = page.getByTestId('component-card').first();
  const title = (await card.locator('.card-title a').textContent())!;
  await card.hover();
  await card.getByTestId('favourite-button').click();
  await expect(card.getByTestId('favourite-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Favourites/ })).toContainText('1');

  await page.reload();
  await expect(page.getByTestId('component-card').first().getByTestId('favourite-button')).toHaveAttribute('aria-pressed', 'true');

  await page.goto('/favourites');
  await expect(page.getByTestId('component-card')).toHaveCount(1);
  await expect(page.locator('.card-title a')).toHaveText(title);
  await page.getByTestId('search-input').fill('zzzz-nothing');
  await expect(page.getByText('No components match')).toBeVisible();
  await page.getByTestId('search-input').fill('');

  // The viewer shows the same state, and one click removes it again.
  await page.locator('.card-title a').click();
  await expect(page.getByTestId('viewer-favourite')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('viewer-favourite').click();
  await page.goto('/favourites');
  await expect(page.getByRole('heading', { name: 'No favourites yet' })).toBeVisible();
});

test('collections: create, add several, notes, reorder, rename, copy for AI, refresh, delete', async ({ page }) => {
  await createCollection(page, 'My Dashboard');
  await expect(page.getByRole('heading', { name: 'This collection is empty' })).toBeVisible();
  for (const pick of PICKS) await addToCollection(page, pick.id, 'My Dashboard');

  // The same component can live in a second collection.
  await createCollection(page, 'Buttons and Toggles');
  await addToCollection(page, PICKS[0].id, 'Buttons and Toggles');

  await page.goto('/collections');
  await expect(page.getByTestId('collection-card')).toHaveCount(2);
  await page.getByTestId('collection-card').filter({ hasText: 'My Dashboard' }).click();
  await expect(page.getByTestId('collection-item')).toHaveCount(3);
  expect(await order(page)).toEqual(PICKS.map((p) => p.id));
  await expect(page.getByTestId('collection-item').first().locator('.preview')).toHaveAttribute('data-state', 'ready');

  await page.getByTestId('note-input').nth(0).fill('Use this for the dark-mode switch in Settings');
  await page.getByTestId('note-input').nth(0).blur();
  await page.getByTestId('move-down').nth(0).click();
  await expect.poll(() => order(page)).toEqual([PICKS[1].id, PICKS[0].id, PICKS[2].id]);

  await page.getByTestId('rename-collection').click();
  await page.getByTestId('name-dialog-input').fill('Login Page Ideas');
  await page.getByTestId('name-dialog-confirm').click();
  await expect(page.getByTestId('collection-title')).toHaveText('Login Page Ideas');

  // Everything is still there after a refresh.
  await page.reload();
  await expect(page.getByTestId('collection-title')).toHaveText('Login Page Ideas');
  expect(await order(page)).toEqual([PICKS[1].id, PICKS[0].id, PICKS[2].id]);
  await expect(page.getByTestId('note-input').nth(1)).toHaveValue('Use this for the dark-mode switch in Settings');

  // One consolidated request for the AI.
  await page.getByTestId('copy-collection').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('prompt-text')).toContainText('following three components from my "Login Page Ideas" collection');
  await dialog.getByRole('button', { name: 'Copy collection for AI' }).click();
  const concise = await clipboard(page);
  for (const pick of PICKS) {
    expect(concise).toContain(pick.title);
    expect(concise).toContain(`infinite/${pick.id}.html`);
  }
  expect(concise).toContain('My note: Use this for the dark-mode switch in Settings');
  expect(concise.indexOf(PICKS[1].title)).toBeLessThan(concise.indexOf(PICKS[0].title));
  expect(concise).not.toContain('BEGIN ORIGINAL SOURCE');

  await page.getByTestId('copy-collection').click();
  await page.getByRole('dialog').getByRole('button', { name: 'With complete source code' }).click();
  await expect(page.getByRole('dialog').getByTestId('prompt-text')).toContainText('BEGIN ORIGINAL SOURCE');
  await page.getByRole('dialog').getByRole('button', { name: 'Copy collection for AI' }).click();
  expect((await clipboard(page)).match(/BEGIN ORIGINAL SOURCE/g)).toHaveLength(3);

  await page.getByTestId('remove-item').nth(2).click();
  await expect(page.getByTestId('collection-item')).toHaveCount(2);

  await page.getByTestId('delete-collection').click();
  await page.getByRole('button', { name: 'Delete collection' }).click();
  await expect(page).toHaveURL(/\/collections$/);
  await expect(page.getByTestId('collection-card')).toHaveCount(1);
});

test('backup: export, lose everything, import, and it is all back', async ({ page }) => {
  await createCollection(page, 'Animations Worth Using');
  await addToCollection(page, PICKS[2].id, 'Animations Worth Using');
  await page.getByTestId('viewer-favourite').click();

  await page.goto('/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);
  expect(download.suggestedFilename()).toMatch(/^forever-components-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup.data.collections[0].name).toBe('Animations Worth Using');
  expect(Object.keys(backup.data.favourites)).toEqual([PICKS[2].id]);

  await page.evaluate(() => localStorage.clear());
  await page.goto('/collections');
  await expect(page.getByRole('heading', { name: 'No collections yet' })).toBeVisible();

  await page.goto('/settings');
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByRole('dialog', { name: 'Import backup' })).toContainText('1 favourite and 1 collection');
  await page.getByTestId('import-merge').click();
  await page.goto('/collections');
  await expect(page.getByTestId('collection-card')).toContainText('Animations Worth Using');
  await page.goto('/favourites');
  await expect(page.locator('.card-title a')).toHaveText(PICKS[2].title);

  // A file that is not a backup is refused with a plain message.
  await page.goto('/settings');
  await page.getByTestId('import-file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByText('That file is not a Forever Components backup.')).toBeVisible();
});

test('compare: pick from the gallery, see them side by side, save from the comparison', async ({ page }) => {
  await openLibrary(page, '?q=toggle');
  for (const index of [0, 1]) {
    const card = page.getByTestId('component-card').nth(index);
    await card.hover();
    await card.getByRole('button', { name: 'More actions' }).click();
    await card.getByRole('menuitem', { name: 'Add to comparison' }).click();
  }
  await expect(page.getByTestId('compare-tray')).toContainText('Compare 2');
  await page.getByTestId('open-compare').click();
  await expect(page).toHaveURL(/\/compare\?ids=/);
  await expect(page.getByTestId('compare-item')).toHaveCount(2);
  await expect(page.locator('.compare-col .preview[data-state="ready"]')).toHaveCount(2);

  // Sizes are synchronised.
  await page.getByRole('group', { name: /Preview size/ }).getByRole('button', { name: 'Small' }).click();
  const sizes = await page.locator('.compare-col iframe').evaluateAll((frames) => frames.map((f) => (f as HTMLElement).style.width));
  expect(sizes).toEqual(['320px', '320px']);
  await expect(page.locator('.compare-facts').first()).toContainText('Performance');

  await page.getByTestId('compare-item').first().getByRole('button', { name: 'Add to favourites' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Favourites/ })).toContainText('1');
  await page.getByTestId('compare-item').first().getByRole('button', { name: 'Add to collection' }).click();
  await expect(page.getByRole('dialog', { name: 'Add to collection' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  // A comparison link can be reopened later.
  const url = page.url();
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(page.getByTestId('compare-item')).toHaveCount(2);
});

test('quick preview opens from a card and leads to the full details', async ({ page }) => {
  await openLibrary(page, '?q=gooey liquid toggle');
  const card = page.getByTestId('component-card').first();
  await card.hover();
  await card.getByTestId('quick-preview-button').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.preview')).toHaveAttribute('data-state', 'ready');
  await expect(dialog.getByRole('button', { name: 'Copy for AI' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
