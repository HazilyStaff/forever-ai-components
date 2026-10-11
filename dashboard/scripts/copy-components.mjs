// Copies the component collection into the built site:
//   dist/infinite/…  the untouched originals (download, copy source, open standalone)
//   dist/preview/…   the same files plus the preview bridge (used by the live previews)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DASHBOARD_ROOT, REPO_ROOT, readSiteConfig } from './lib/catalogue.mjs';
import { withBridge } from './lib/bridge.mjs';

const config = readSiteConfig();
const dist = join(DASHBOARD_ROOT, 'dist');
const cataloguePath = join(dist, 'data', 'catalogue.json');
if (!existsSync(cataloguePath)) {
  console.error('dist/data/catalogue.json is missing. Run the site build first.');
  process.exit(1);
}
const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8'));
const source = join(REPO_ROOT, config.componentsDir);

for (const dir of ['infinite', 'preview']) rmSync(join(dist, dir), { recursive: true, force: true });

let copied = 0;
for (const component of catalogue.components) {
  if (component.status === 'missing') continue;
  const from = join(source, component.file);
  const original = join(dist, 'infinite', component.file);
  const preview = join(dist, 'preview', component.file);
  mkdirSync(dirname(original), { recursive: true });
  mkdirSync(dirname(preview), { recursive: true });
  cpSync(from, original);
  writeFileSync(preview, withBridge(readFileSync(from, 'utf8')));
  copied++;
}
console.log(`Copied ${copied} components (originals + preview copies) into dist/.`);
