import { expect, test } from '@playwright/test';
import { LOCKED_URL } from '../../playwright.config';
import { openLibrary, openViewer, previewFrame, TOGGLE } from './helpers';

test.describe('component previews are isolated from the dashboard', () => {
  test('a running component cannot reach the site, its storage, its cookies or the network', async ({ page, context }) => {
    await context.addCookies([{ name: 'CF_Authorization', value: 'secret-session', url: 'http://127.0.0.1:8788' }]);
    await openViewer(page, TOGGLE.id);
    await page.evaluate(() => localStorage.setItem('private-note', 'only the dashboard may read this'));

    await expect(page.locator('.stage iframe')).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(page.locator('.stage iframe')).toHaveAttribute('referrerpolicy', 'no-referrer');

    const frame = await previewFrame(page.locator('.stage'));
    const probe = await frame.evaluate(async () => {
      const attempt = async (run: () => unknown) => {
        try {
          return { ok: true, value: String(await run()) };
        } catch (error) {
          return { ok: false, value: (error as Error).name };
        }
      };
      return {
        origin: window.origin,
        parentDocument: await attempt(() => window.parent.document.title),
        parentStorage: await attempt(() => (window.parent as any).localStorage.getItem('private-note')),
        ownStorage: await attempt(() => localStorage.getItem('private-note')),
        cookie: await attempt(() => document.cookie),
        fetchCatalogue: await attempt(async () => (await fetch('/data/catalogue.json')).status),
        fetchElsewhere: await attempt(async () => (await fetch('https://example.com/', { mode: 'no-cors' })).type),
        navigateTop: await attempt(() => {
          window.top!.location.href = 'https://example.com/';
        }),
      };
    });

    expect(probe.origin).toBe('null');
    expect(probe.parentDocument.ok).toBe(false);
    expect(probe.parentStorage.ok).toBe(false);
    // Its own "storage" is an empty in-memory stand-in, never the dashboard's.
    expect(probe.ownStorage).toEqual({ ok: true, value: 'null' });
    expect(probe.cookie.ok === false || probe.cookie.value === '').toBe(true);
    expect(probe.fetchCatalogue.ok).toBe(false);
    expect(probe.fetchElsewhere.ok).toBe(false);
    await page.waitForTimeout(300);
    expect(page.url()).toContain(`/c/${TOGGLE.id}`);
  });

  test('gallery previews use the same sandbox', async ({ page }) => {
    await openLibrary(page);
    await expect(page.locator('.card .preview[data-state="ready"]').first()).toBeVisible();
    const sandboxes = await page.locator('iframe.preview-frame').evaluateAll((frames) => frames.map((f) => f.getAttribute('sandbox')));
    expect(sandboxes.length).toBeGreaterThan(0);
    expect(new Set(sandboxes)).toEqual(new Set(['allow-scripts']));
  });

  test('opening an original file directly still has no access to the site', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('private-note', 'secret'));
    const response = await page.goto(`/infinite/${TOGGLE.id}`);
    expect(response!.headers()['content-security-policy']).toContain('sandbox allow-scripts');
    const result = await page.evaluate(() => {
      try {
        return { origin: window.origin, note: localStorage.getItem('private-note') };
      } catch (error) {
        return { origin: window.origin, note: `blocked:${(error as Error).name}` };
      }
    });
    expect(result.origin).toBe('null');
    expect(result.note).toBe('blocked:SecurityError');
  });

  test('the dashboard sends strict headers and cannot be framed', async ({ request }) => {
    for (const path of ['/', '/settings', `/c/${TOGGLE.id}`]) {
      const headers = (await request.get(path)).headers();
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['content-security-policy']).toContain("script-src 'self'");
      expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(headers['x-robots-tag']).toContain('noindex');
      expect(headers['referrer-policy']).toBe('no-referrer');
    }
  });

  test('the dashboard loads nothing from other websites', async ({ page }) => {
    const external = new Set<string>();
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.protocol.startsWith('http') && url.host !== '127.0.0.1:8788' && !r.frame().parentFrame()) external.add(url.host);
    });
    await openLibrary(page);
    await page.goto('/settings');
    expect([...external]).toEqual([]);
  });
});

test.describe('broken references fail gracefully', () => {
  test('missing and broken components show a clear message and the rest keeps working', async ({ page }) => {
    await page.route('**/data/catalogue.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.components.unshift(
        { id: 'ghost/01-file-vanished', file: 'ghost/01-file-vanished.html', title: 'Ghost With No File', status: 'ok', hash: 'ghost' },
        { id: 'ghost/02-known-missing', file: 'ghost/02-known-missing.html', title: 'Known Missing', status: 'missing', issues: ['The component file is missing.'] },
        { nonsense: true },
        null,
      );
      await route.fulfill({ response, json: data });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await openLibrary(page);
    const ghost = page.getByTestId('component-card').filter({ hasText: 'Ghost With No File' });
    await expect(ghost.getByText('Preview didn’t load')).toBeVisible();
    const missing = page.getByTestId('component-card').filter({ hasText: 'Known Missing' });
    await expect(missing.getByText('Preview unavailable')).toBeVisible();
    await expect(page.locator('.card .preview[data-state="ready"]').first()).toBeVisible();

    await page.goto('/c/ghost/02-known-missing');
    await expect(page.getByTestId('viewer-title')).toHaveText('Known Missing');
    await expect(page.locator('.stage').getByText('Preview unavailable')).toBeVisible();
    await expect(page.getByTestId('copy-for-ai')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('a favourite whose component was removed upstream is explained, not replaced', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem(
        'fc.userdata.v1',
        JSON.stringify({ version: 1, favourites: { 'gone/01-removed-upstream': '2026-01-01T00:00:00Z', 'buttons/02-gooey-liquid-toggle': '2026-01-02T00:00:00Z' }, collections: [], recent: [] }),
      ),
    );
    await page.goto('/favourites');
    await expect(page.getByTestId('component-card')).toHaveCount(1);
    await expect(page.getByText(/1 favourite is no longer in the library/)).toBeVisible();
    await page.goto('/c/gone/01-removed-upstream');
    await expect(page.getByRole('button', { name: 'Remove it from my saved items' })).toBeVisible();
  });

  test('an unknown address gives a real "not found", never the wrong page', async ({ request }) => {
    expect((await request.get('/preview/ghost/nothing')).status()).toBe(404);
    expect((await request.get('/infinite/ghost/nothing')).status()).toBe(404);
    expect((await request.get('/no-such-page')).status()).toBe(404);
  });
});

test.describe('access control (site running exactly as deployed)', () => {
  const PRIVATE_PATHS = [
    '/',
    '/index.html',
    '/settings',
    `/c/${TOGGLE.id}`,
    '/data/catalogue.json',
    `/infinite/${TOGGLE.id}`,
    `/infinite/${TOGGLE.id}.html`,
    `/preview/${TOGGLE.id}`,
    '/theme-init.js',
    '/favicon.svg',
    '/manifest.webmanifest',
  ];

  test('nothing is served without a Cloudflare Access sign-in', async ({ request, playwright }) => {
    // Find the real script and stylesheet names so they are checked too.
    const html = await (await request.get('/')).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    expect(assets.length).toBeGreaterThanOrEqual(2);

    const anonymous = await playwright.request.newContext({ baseURL: LOCKED_URL });
    for (const path of [...PRIVATE_PATHS, ...assets]) {
      const response = await anonymous.get(path, { maxRedirects: 0 });
      expect(response.status(), `${path} must be refused`).toBe(403);
      const body = await response.text();
      expect(body).not.toContain('fc-app-root');
      expect(body).not.toContain('forever-agent-meta');
      expect(body.length).toBeLessThan(2000);
    }
    await anonymous.dispose();
  });

  test('made-up credentials are refused', async ({ playwright }) => {
    const fake = 'eyJhbGciOiJub25lIiwia2lkIjoieCJ9.eyJlbWFpbCI6Im1lQGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.';
    const attacker = await playwright.request.newContext({
      baseURL: LOCKED_URL,
      extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': fake, Cookie: `CF_Authorization=${fake}`, 'Cf-Access-Authenticated-User-Email': 'me@example.com' },
    });
    for (const path of ['/', '/data/catalogue.json', `/infinite/${TOGGLE.id}`]) {
      expect((await attacker.get(path)).status()).toBe(403);
    }
    await attacker.dispose();
  });
});
