// Generates public/data/catalogue.json from the upstream collection.
//   node scripts/build-catalogue.mjs            build
//   node scripts/build-catalogue.mjs --check    build and print the health report
//   node scripts/build-catalogue.mjs --strict   also fail when any reference is broken
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalogue, DASHBOARD_ROOT, REPO_ROOT, readSiteConfig } from './lib/catalogue.mjs';

const args = new Set(process.argv.slice(2));
const config = readSiteConfig();

function currentCommit() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function readOptional(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  } catch {
    return null;
  }
}

const catalogue = buildCatalogue({ componentsDir: config.componentsDir, commit: currentCommit() });
const { health } = catalogue.meta;

// Components that used to exist stay nameable, so old bookmarks and favourites can explain themselves.
const snapshot = readOptional(join(DASHBOARD_ROOT, 'data', 'catalogue-snapshot.json'));
const known = new Set(catalogue.components.map((c) => c.id));
const removed = new Map();
for (const r of [...(snapshot?.removed || []), ...catalogue.retired]) {
  if (r && r.id && !known.has(r.id) && !removed.has(r.id)) removed.set(r.id, r);
}
const output = {
  meta: {
    ...catalogue.meta,
    version: readOptional(join(DASHBOARD_ROOT, 'package.json'))?.version || '',
    site: config,
    lastSync: readOptional(join(DASHBOARD_ROOT, 'data', 'last-sync.json')),
  },
  themes: catalogue.themes,
  facets: catalogue.facets,
  components: catalogue.components,
  removed: [...removed.values()],
};

const outDir = join(DASHBOARD_ROOT, 'public', 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'catalogue.json'), JSON.stringify(output));

const line = (label, value) => console.log(`  ${label.padEnd(34)} ${value}`);
console.log('Catalogue health');
line('Components in the upstream index', health.indexed);
line('Components listed in the library', health.listed);
line('Valid component files', health.validFiles);
line('Missing files', health.missing.length);
line('Broken files', health.broken.length);
line('Duplicate entries ignored', health.duplicates.length);
line('Files not in the index (included)', health.unindexed.length);
line('Categories', health.categories);
line('Component types', health.types);
line('Built', health.builtAt);
for (const w of health.warnings) console.warn(`  warning: ${w}`);
for (const f of [...health.missing, ...health.broken]) console.warn(`  problem file: ${f}`);

if (health.fatal.length) {
  for (const f of health.fatal) console.error(`  FATAL: ${f}`);
  process.exit(1);
}
if (args.has('--strict') && !health.ok) {
  console.error('Strict check failed: the catalogue has broken references.');
  process.exit(1);
}
