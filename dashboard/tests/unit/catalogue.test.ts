import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withBridge } from '../../scripts/lib/bridge.mjs';
import { buildCatalogue, diffSnapshots, idFromFile, REPO_ROOT, snapshotOf } from '../../scripts/lib/catalogue.mjs';
import { hydrateCatalogue } from '../../src/lib/catalogue';

const html = (title: string) => `<!doctype html><html><head><title>${title}</title></head><body><div>${title}</div></body></html>`;

function fixture(index: unknown, files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'fc-fixture-'));
  mkdirSync(join(root, 'infinite'), { recursive: true });
  if (index !== undefined) writeFileSync(join(root, 'infinite', 'components.index.json'), typeof index === 'string' ? index : JSON.stringify(index));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(root, 'infinite', file, '..'), { recursive: true });
    writeFileSync(join(root, 'infinite', file), content);
  }
  return root;
}

describe('the real collection in this repository', () => {
  const catalogue = buildCatalogue();

  it('lists every indexed component with a working file', () => {
    const { health } = catalogue.meta;
    expect(health.listed).toBeGreaterThan(0);
    expect(health.listed).toBe(health.indexed + health.unindexed.length - health.duplicates.length - health.invalidEntries.length);
    expect(health.validFiles + health.missing.length + health.broken.length).toBe(health.listed);
    expect(health.fatal).toEqual([]);
  });

  it('gives every component a unique identity derived from its path, never a position', () => {
    const ids = catalogue.components.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of catalogue.components) {
      expect(c.id).toBe(c.file.replace(/\.html$/, ''));
      expect(c.id).not.toMatch(/^\d+$/);
    }
  });

  it('keeps the same identities when the index is reordered', () => {
    const index = JSON.parse(readFileSync(join(REPO_ROOT, 'infinite', 'components.index.json'), 'utf8'));
    const sample = index.components.slice(0, 5);
    const forward = buildCatalogue({ repoRoot: fixture({ components: sample }, {}) });
    const reversed = buildCatalogue({ repoRoot: fixture({ components: [...sample].reverse() }, {}) });
    expect(forward.components.map((c: { id: string }) => c.id).sort()).toEqual(reversed.components.map((c: { id: string }) => c.id).sort());
  });

  it('carries the author guidance embedded in each file', () => {
    const withGuidance = catalogue.components.filter((c: any) => c.adapt.useWhen.length || c.adapt.agentPrompt);
    expect(withGuidance.length).toBeGreaterThan(catalogue.components.length * 0.9);
  });
});

describe('damaged or unusual input', () => {
  it('flags missing files, ignores duplicates and unsafe paths, and includes files that are not indexed', () => {
    const root = fixture(
      {
        components: [
          { id: 0, file: 'set/01-good.html', title: 'Good', role: 'button', themeSlug: 'set', theme: 'Set' },
          { id: 1, file: 'set/02-gone.html', title: 'Gone' },
          { id: 2, file: 'set/01-good.html', title: 'Duplicate' },
          { id: 3, file: '../outside.html', title: 'Unsafe' },
          { id: 4, title: 'No file' },
          null,
          { id: 5, file: 'set/03-empty.html' },
        ],
      },
      { 'set/01-good.html': html('Good'), 'set/03-empty.html': '', 'set/04-new-arrival.html': html('New Arrival') },
    );
    const catalogue = buildCatalogue({ repoRoot: root });
    const byId = new Map<string, any>(catalogue.components.map((c: any) => [c.id, c]));
    expect(byId.get('set/01-good').status).toBe('ok');
    expect(byId.get('set/01-good').title).toBe('Good');
    expect(byId.get('set/02-gone').status).toBe('missing');
    expect(byId.get('set/03-empty').status).toBe('broken');
    expect(byId.get('set/04-new-arrival').status).toBe('ok');
    expect(byId.get('set/04-new-arrival').title).toBe('New Arrival');
    expect(byId.get('set/04-new-arrival').indexed).toBe(false);
    const { health } = catalogue.meta;
    expect(health.duplicates).toEqual(['set/01-good.html']);
    expect(health.missing).toEqual(['set/02-gone.html']);
    expect(health.broken).toEqual(['set/03-empty.html']);
    expect(health.unindexed).toEqual(['set/04-new-arrival.html']);
    expect(health.invalidEntries.length).toBe(3);
    expect(health.ok).toBe(false);
  });

  it('survives records with no metadata at all', () => {
    const catalogue = buildCatalogue({ repoRoot: fixture({ components: [{ file: 'a/01-bare.html' }] }, { 'a/01-bare.html': html('') }) });
    const [c] = catalogue.components;
    expect(c.title).toBe('Bare');
    expect(c.role).toBe('other');
    expect(c.tags).toEqual([]);
    expect(hydrateCatalogue(JSON.parse(JSON.stringify(catalogue))).components).toHaveLength(1);
  });

  it('still shows the files when the index itself is unreadable', () => {
    const catalogue = buildCatalogue({ repoRoot: fixture('{ not json', { 'a/01-x.html': html('X') }) });
    expect(catalogue.components).toHaveLength(1);
    expect(catalogue.meta.health.warnings.length).toBeGreaterThan(0);
  });

  it('reports a fatal problem when there is nothing at all', () => {
    expect(buildCatalogue({ repoRoot: fixture({ components: [] }, {}) }).meta.health.fatal.length).toBe(1);
  });

  it('hydrating in the browser skips junk records instead of crashing', () => {
    const catalogue = hydrateCatalogue({ meta: {}, components: [null, 5, {}, { id: 'a/b', file: 'a/b.html' }, { id: 'a/b', file: 'a/b.html' }] });
    expect(catalogue.components).toHaveLength(1);
    expect(catalogue.components[0].kind).toBe('passive');
  });
});

describe('change detection between syncs', () => {
  it('reports added, modified and deleted components by identity', () => {
    const before = { 'a/1': { hash: 'x', title: 'One' }, 'a/2': { hash: 'y', title: 'Two' }, 'a/3': { hash: 'z', title: 'Three' } };
    const after = { 'a/1': { hash: 'x', title: 'One' }, 'a/2': { hash: 'CHANGED', title: 'Two' }, 'a/4': { hash: 'n', title: 'Four' } };
    expect(diffSnapshots(before, after)).toEqual({
      added: [{ id: 'a/4', title: 'Four' }],
      modified: [{ id: 'a/2', title: 'Two' }],
      deleted: [{ id: 'a/3', title: 'Three' }],
    });
  });

  it('snapshots only valid components', () => {
    const root = fixture({ components: [{ file: 's/1.html' }, { file: 's/2.html' }] }, { 's/1.html': html('One') });
    expect(Object.keys(snapshotOf(buildCatalogue({ repoRoot: root })))).toEqual(['s/1']);
  });
});

describe('identity and preview bridge helpers', () => {
  it('derives ids from paths', () => {
    expect(idFromFile('kinetic-type/01-weight-morph-wave.html')).toBe('kinetic-type/01-weight-morph-wave');
    expect(idFromFile('\\a\\b.HTML')).toBe('a/b');
  });

  it('adds the bridge as the first script without altering the rest', () => {
    const original = '<!doctype html>\n<html><head><script>first()</script></head><body>x</body></html>';
    const bridged = withBridge(original);
    expect(bridged.indexOf('data-fc-bridge')).toBeLessThan(bridged.indexOf('first()'));
    expect(bridged.replace(/<script data-fc-bridge>[\s\S]*?<\/script>\n/, '').replace('<head>\n', '<head>')).toBe(original);
    expect(withBridge('<div>bare</div>')).toContain('data-fc-bridge');
  });
});
