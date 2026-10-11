// Proves that a deployed copy of the site gives nothing away to a visitor who is not signed in.
//
//   node scripts/verify-live.mjs https://forever-components.pages.dev [more addresses…]
//
// For every address it requests the home page, the catalogue, an original component file, a
// preview copy and the app's own script WITHOUT any sign-in, and fails unless each one is
// refused: either Cloudflare Access redirects to its sign-in page, or the site answers 403.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DASHBOARD_ROOT } from './lib/catalogue.mjs';

const sites = process.argv.slice(2).map((s) => s.replace(/\/+$/, ''));
if (!sites.length) {
  console.error('Usage: node scripts/verify-live.mjs <site address> [more addresses…]');
  process.exit(2);
}

// Use real file names from the last build when available, so the check hits files that exist.
const paths = ['/', '/settings', '/data/catalogue.json', '/theme-init.js', '/favicon.svg'];
const cataloguePath = join(DASHBOARD_ROOT, 'dist', 'data', 'catalogue.json');
const indexPath = join(DASHBOARD_ROOT, 'dist', 'index.html');
if (existsSync(cataloguePath)) {
  const first = JSON.parse(readFileSync(cataloguePath, 'utf8')).components.find((c) => c.status === 'ok');
  if (first) paths.push(`/infinite/${first.id}`, `/infinite/${first.file}`, `/preview/${first.id}`, `/c/${first.id}`);
} else {
  paths.push('/infinite/buttons/01-magnetic-button', '/preview/buttons/01-magnetic-button');
}
if (existsSync(indexPath)) {
  for (const match of readFileSync(indexPath, 'utf8').matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) paths.push(match[1]);
}

const PRIVATE_MARKERS = ['fc-app-root', 'forever-agent-meta', '"components":[', 'Forever Components dashboard'];
let failures = 0;

for (const site of sites) {
  console.log(`\n${site}`);
  for (const path of paths) {
    let verdict;
    try {
      const response = await fetch(site + path, { redirect: 'manual', headers: { 'User-Agent': 'forever-components-access-check' } });
      const location = response.headers.get('location') || '';
      const body = response.status >= 300 && response.status < 400 ? '' : await response.text();
      const leaked = PRIVATE_MARKERS.find((marker) => body.includes(marker));
      if (leaked) verdict = { ok: false, text: `LEAK: private content served (status ${response.status}, found "${leaked}")` };
      else if (response.status >= 300 && response.status < 400 && /cloudflareaccess\.com/.test(location)) verdict = { ok: true, text: 'sign-in required (Cloudflare Access)' };
      else if (response.status === 401 || response.status === 403) verdict = { ok: true, text: `refused (${response.status})` };
      else if (response.status >= 300 && response.status < 400) verdict = { ok: false, text: `unexpected redirect to ${location || '(nowhere)'}` };
      else verdict = { ok: false, text: `NOT PROTECTED: status ${response.status}` };
    } catch (error) {
      verdict = { ok: false, text: `could not connect (${error.cause?.code || error.message})` };
    }
    if (!verdict.ok) failures++;
    console.log(`  ${verdict.ok ? 'ok  ' : 'FAIL'} ${path.padEnd(52)} ${verdict.text}`);
  }
}

if (failures) {
  console.error(`\n${failures} address${failures === 1 ? '' : 'es'} did not behave as a private site should.`);
  process.exit(1);
}
console.log('\nAll checked addresses refuse visitors who are not signed in.');
