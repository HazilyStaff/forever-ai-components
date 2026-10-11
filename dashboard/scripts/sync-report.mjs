// Compares the collection as it is now with the last recorded snapshot and reports what
// was added, changed or removed. Run by the weekly sync workflow after merging upstream.
//
//   node scripts/sync-report.mjs                      print the report, change nothing
//   node scripts/sync-report.mjs --write              also update data/catalogue-snapshot.json and data/last-sync.json
//   node scripts/sync-report.mjs --init               record the first snapshot (no "last sync" entry)
//   --upstream-commit <sha>   --report <file.md>      optional details for the workflow
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalogue, DASHBOARD_ROOT, diffSnapshots, readSiteConfig, snapshotOf } from './lib/catalogue.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : '');

const dataDir = join(DASHBOARD_ROOT, 'data');
const snapshotPath = join(dataDir, 'catalogue-snapshot.json');
const lastSyncPath = join(dataDir, 'last-sync.json');
const config = readSiteConfig();

const previous = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, 'utf8')) : { components: {}, removed: [] };
const catalogue = buildCatalogue({ componentsDir: config.componentsDir });
const { health } = catalogue.meta;
const current = snapshotOf(catalogue);
const firstRun = !existsSync(snapshotPath) || flag('--init');
const changes = firstRun ? { added: [], modified: [], deleted: [] } : diffSnapshots(previous.components, current);
const now = new Date().toISOString();
const upstreamCommit = option('--upstream-commit');

// Removed components are remembered by name so old bookmarks and favourites can explain themselves.
const stillRemoved = (previous.removed || []).filter((r) => !current[r.id]);
const removed = [...stillRemoved, ...changes.deleted.map((d) => ({ id: d.id, title: d.title, removedAt: now.slice(0, 10) }))];

const list = (items) => (items.length ? items.map((i) => `- ${i.title} (\`${i.id}\`)`).join('\n') : '_None._');
const total = changes.added.length + changes.modified.length + changes.deleted.length;
const report = [
  `## Library update report`,
  '',
  `| | |`,
  `|---|---|`,
  `| New components | **${changes.added.length}** |`,
  `| Changed components | **${changes.modified.length}** |`,
  `| Removed components | **${changes.deleted.length}** |`,
  `| Components after this update | ${health.listed} (${health.validFiles} with a working file) |`,
  `| Missing or broken files | ${health.missing.length + health.broken.length} |`,
  `| Categories | ${health.categories} |`,
  upstreamCommit ? `| Upstream version | \`${upstreamCommit.slice(0, 12)}\` |` : '',
  '',
  `### New`,
  list(changes.added),
  '',
  `### Changed`,
  list(changes.modified),
  '',
  `### Removed`,
  list(changes.deleted),
  changes.deleted.length
    ? '\nRemoved components disappear from the gallery. Any favourites or collection entries that point to them are kept and shown as "no longer in the library".'
    : '',
  health.missing.length + health.broken.length
    ? `\n### Problem files\n${[...health.missing, ...health.broken].map((f) => `- \`${f}\``).join('\n')}\nThese stay listed but show "Preview unavailable".`
    : '',
  health.warnings.length ? `\n### Warnings\n${health.warnings.map((w) => `- ${w}`).join('\n')}` : '',
]
  .filter((line) => line !== '')
  .join('\n');

console.log(report);
if (option('--report')) writeFileSync(option('--report'), report + '\n');

if (health.fatal.length) {
  console.error(`\nFATAL: ${health.fatal.join(' ')}`);
  process.exit(1);
}

if (flag('--write') || flag('--init')) {
  mkdirSync(dataDir, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(snapshotPath, JSON.stringify({ generatedAt: now, upstreamCommit, components: sorted, removed }, null, 1) + '\n');
  if (!firstRun) {
    writeFileSync(lastSyncPath, JSON.stringify({ checkedAt: now, upstreamCommit, ...changes }, null, 1) + '\n');
  }
  console.error(`\nSnapshot written (${Object.keys(current).length} components${firstRun ? ', first run' : `, ${total} change${total === 1 ? '' : 's'}`}).`);
}

if (process.env.GITHUB_OUTPUT) {
  const title =
    total === 0
      ? 'Library update: upstream housekeeping (no component changes)'
      : `Library update: ${changes.added.length} new, ${changes.modified.length} changed, ${changes.deleted.length} removed`;
  writeFileSync(process.env.GITHUB_OUTPUT, `title=${title}\ntotal=${total}\n`, { flag: 'a' });
}
