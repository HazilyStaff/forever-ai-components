import { describe, expect, it } from 'vitest';
import { buildCatalogue } from '../../scripts/lib/catalogue.mjs';
import { hydrateCatalogue } from '../../src/lib/catalogue';
import {
  buildCollectionPrompt,
  buildComponentPrompt,
  LARGE_PROMPT_CHARS,
  promptSize,
  TOO_LARGE_PROMPT_CHARS,
  triggerGuidance,
} from '../../src/lib/prompts';
import { facetCounts, LibrarySearch, matchesFilters, sortComponents } from '../../src/lib/search';
import type { SiteConfig } from '../../src/lib/types';
import { githubUrl, rawUrl, repoPath, viewerPath } from '../../src/lib/urls';

const site: SiteConfig = {
  siteName: 'Forever Components',
  repoOwner: 'HazilyStaff',
  repoName: 'forever-ai-components',
  branch: 'main',
  upstreamOwner: 'isas1',
  upstreamName: 'forever-ai-components',
  componentsDir: 'infinite',
  repoIsPrivate: false,
};

const catalogue = hydrateCatalogue(JSON.parse(JSON.stringify({ ...buildCatalogue(), removed: [] })));
const toggle = catalogue.byId.get('inputs-switches/01-liquid-toggle')!;
const search = new LibrarySearch(catalogue.components, catalogue.themes);

describe('search', () => {
  it('finds components by title, tag, category and plain-English type', () => {
    expect(search.scores('liquid toggle')!.has(toggle.id)).toBe(true);
    expect(search.scores('gooey')!.size).toBeGreaterThan(0);
    expect(search.scores('kinetic typography')!.size).toBeGreaterThan(5);
    expect(search.scores('loader')!.size).toBeGreaterThan(10);
    expect(search.scores('lightweight')!.size).toBeGreaterThan(10);
  });

  it('forgives typos and partial words', () => {
    expect(search.scores('togle')!.size).toBeGreaterThan(0);
    expect(search.scores('backgr')!.size).toBeGreaterThan(50);
  });

  it('falls back to any-word matching rather than showing nothing', () => {
    expect(search.scores('toggle zzzzqqq')!.size).toBeGreaterThan(0);
  });

  it('returns null for an empty query and suggests titles and filters', () => {
    expect(search.scores('   ')).toBeNull();
    const suggestions = search.suggest('load');
    expect(suggestions.some((s) => s.kind === 'filter' && s.facet === 'role' && s.value === 'loader')).toBe(true);
    expect(suggestions.some((s) => s.kind === 'component')).toBe(true);
  });

  it('is fast enough to feel instant', () => {
    const started = performance.now();
    for (const q of ['t', 'to', 'tog', 'togg', 'toggl', 'toggle', 'calm background', 'neon loader']) search.scores(q);
    expect(performance.now() - started).toBeLessThan(400);
  });
});

describe('filters', () => {
  it('combines filters: any value within a group, every group must match', () => {
    const filters = { role: ['loader', 'button'], perf: ['cheap'] };
    const matched = catalogue.components.filter((c) => matchesFilters(c, filters));
    expect(matched.length).toBeGreaterThan(0);
    for (const c of matched) {
      expect(['loader', 'button']).toContain(c.role);
      expect(c.perf).toBe('cheap');
    }
  });

  it('counts match what selecting the value would show', () => {
    const counts = facetCounts(catalogue.components, { perf: ['cheap'] });
    const loaders = counts.role.find((r) => r.value === 'loader')!;
    expect(loaders.count).toBe(catalogue.components.filter((c) => matchesFilters(c, { perf: ['cheap'], role: ['loader'] })).length);
    expect(counts.kind.map((k) => k.value)).toEqual(['interactive', 'passive']);
  });

  it('ignores unknown filter names and tolerates components with no metadata', () => {
    const bare = hydrateCatalogue({ meta: {}, components: [{ id: 'x/y', file: 'x/y.html' }] }).components;
    expect(matchesFilters(bare[0], { nonsense: ['a'] } as never)).toBe(true);
    expect(matchesFilters(bare[0], { style: ['minimal'] })).toBe(false);
    expect(() => facetCounts(bare, {})).not.toThrow();
    expect(() => new LibrarySearch(bare, {}).scores('anything')).not.toThrow();
  });

  it('sorts by name, category and lightest', () => {
    const sample = catalogue.components.slice(0, 60);
    const names = sortComponents(sample, 'name', null, []).map((c) => c.title);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const lightest = sortComponents(catalogue.components, 'lightest', null, []);
    expect(lightest[0].perf).toBe('cheap');
    expect(sortComponents(sample, 'recent', null, [sample[7].id])[0].id).toBe(sample[7].id);
  });
});

describe('addresses', () => {
  it('builds stable links from the component path', () => {
    expect(viewerPath(toggle.id)).toBe('/c/inputs-switches/01-liquid-toggle');
    expect(repoPath(toggle, site)).toBe('infinite/inputs-switches/01-liquid-toggle.html');
    expect(rawUrl(toggle, site)).toBe(
      'https://raw.githubusercontent.com/HazilyStaff/forever-ai-components/main/infinite/inputs-switches/01-liquid-toggle.html',
    );
    expect(githubUrl(toggle, site)).toBe(
      'https://github.com/HazilyStaff/forever-ai-components/blob/main/infinite/inputs-switches/01-liquid-toggle.html',
    );
  });
});

describe('Copy for AI', () => {
  const quick = buildComponentPrompt(toggle, { mode: 'quick', includeSource: false, site });
  const detailed = buildComponentPrompt(toggle, { mode: 'detailed', includeSource: false, site });
  const clicky = catalogue.components.find((c) => c.role === 'button' && c.interaction.includes('click'))!;
  const loader = catalogue.components.find((c) => c.role === 'loader')!;
  const ambient = catalogue.components.find((c) => c.role === 'background' && c.kind === 'passive')!;

  it('quick instructions contain the component’s own details and the standing rules', () => {
    expect(quick).toContain('Component: Liquid Toggle');
    expect(quick).toContain('Original file: infinite/inputs-switches/01-liquid-toggle.html');
    expect(quick).toContain(`Source: ${rawUrl(toggle, site)}`);
    expect(quick).toContain(toggle.description);
    expect(quick).toMatch(/project's own framework/);
    expect(quick).toMatch(/Reproduce the motion faithfully/);
    expect(quick).toMatch(/reduced-motion/);
    expect(quick).toMatch(/Do not introduce unnecessary dependencies/);
    expect(quick).toMatch(/Inspect my existing project before making changes/);
    expect(quick.length).toBeLessThan(5000);
  });

  it('by default asks for the essence and forbids carrying over the original colours and fonts', () => {
    for (const text of [quick, detailed]) {
      expect(text).toMatch(/ESSENCE of this component, not its skin/);
      expect(text).toMatch(/do not carry over the original's colours, gradients, fonts/);
      expect(text).toMatch(/must be strictly adhered to/);
      expect(text).toMatch(/Introduce no new colour values and no new fonts/);
      expect(text).not.toMatch(/overall visual appearance/);
    }
    expect(detailed).toMatch(/for orientation only, do NOT use them/);
    // The author's "must keep" list no longer pins the showcase theme switcher or colours.
    expect(toggle.adapt.preserveElements.some((p) => /theme hook/i.test(p))).toBe(true);
    expect(detailed).not.toMatch(/theme hook/i);
    expect(detailed).toContain('reduced-motion guard');
  });

  it('by default treats the self-playing preview as a demo and names the real trigger', () => {
    for (const text of [quick, detailed]) {
      expect(text).toMatch(/SHOWCASE DEMO/);
      expect(text).toMatch(/Delete every demo driver/);
      expect(text).toMatch(/at rest, nothing moves/i);
    }
    expect(quick).toMatch(/Trigger: the user's own action/);
    expect(buildComponentPrompt(clicky, { mode: 'quick', includeSource: false, site })).toMatch(/Trigger: the user's own action \(.*click or tap/);
    expect(triggerGuidance(loader)).toMatch(/only while a real loading or working state is active/);
    expect(triggerGuidance(ambient)).toMatch(/Do not start an endless loop by default/);
    expect(triggerGuidance(ambient)).toMatch(/ask me one short question/);
    expect(detailed).toMatch(/confirm nothing animates until the trigger happens/);
    // The author's note about keeping the idle demo cycle is not passed on as something to keep.
    const demoKeeper = catalogue.byId.get('buttons/02-gooey-liquid-toggle')!;
    expect(demoKeeper.adapt.preserveElements.some((p) => /idle demo cycle/.test(p))).toBe(true);
    expect(buildComponentPrompt(demoKeeper, { mode: 'quick', includeSource: false, site })).not.toMatch(/worth keeping.*idle demo cycle/);
    expect(buildComponentPrompt(demoKeeper, { mode: 'quick', includeSource: false, site, motion: 'continuous' })).toMatch(/idle demo cycle/);
  });

  it('either default can be switched off', () => {
    const keepLook = buildComponentPrompt(toggle, { mode: 'detailed', includeSource: false, site, look: 'original' });
    expect(keepLook).toMatch(/keep the original's colours, typography and proportions/);
    expect(keepLook).not.toMatch(/not its skin/);
    expect(keepLook).toMatch(/SHOWCASE DEMO/);
    const selfPlaying = buildComponentPrompt(toggle, { mode: 'detailed', includeSource: false, site, motion: 'continuous' });
    expect(selfPlaying).toMatch(/play by itself, as in the original preview/);
    expect(selfPlaying).not.toMatch(/SHOWCASE DEMO/);
    expect(selfPlaying).toMatch(/not its skin/);
  });

  it('detailed instructions add technical facts, behaviour and self-checks', () => {
    expect(detailed.length).toBeGreaterThan(quick.length * 1.3);
    for (const heading of ['## What I want from it', '## When it animates', '## How to build it', '## About the original', '## Expected behaviour', '## Check your own work']) {
      expect(detailed).toContain(heading);
    }
    expect(detailed).toContain(rawUrl(toggle, site));
  });

  it('the self-contained version carries the complete source and says not to rely on the link', () => {
    const source = '<!doctype html><html><body>SOURCE-MARKER</body></html>';
    const text = buildComponentPrompt(toggle, { mode: 'quick', includeSource: true, source, site });
    expect(text).toContain('SOURCE-MARKER');
    expect(text).toContain('BEGIN ORIGINAL SOURCE: infinite/inputs-switches/01-liquid-toggle.html');
    expect(text).toMatch(/do not rely on fetching the URL/);
  });

  it('never fails on a component with no metadata', () => {
    const bare = hydrateCatalogue({ meta: {}, components: [{ id: 'x/y', file: 'x/y.html' }] }).components[0];
    for (const mode of ['quick', 'detailed'] as const) {
      expect(buildComponentPrompt(bare, { mode, includeSource: false, site })).toContain('Original file: infinite/x/y.html');
    }
  });

  it('collection request lists every component with path, link, details and my notes', () => {
    const items = catalogue.components.slice(0, 5).map((component, i) => ({ component, note: i === 0 ? 'Use on the login page' : '' }));
    const text = buildCollectionPrompt(items, { name: 'My Dashboard', includeSource: false, site, missing: ['old/gone'] });
    expect(text).toContain('using the following five components from my "My Dashboard" collection');
    for (const { component } of items) {
      expect(text).toContain(component.title);
      expect(text).toContain(repoPath(component, site));
      expect(text).toContain(rawUrl(component, site));
    }
    expect(text).toContain('My note: Use on the login page');
    expect(text).toContain('My note: (none)');
    expect(text).toMatch(/rather than creating a new project/);
    expect(text).toMatch(/Preserve all existing functionality/);
    expect(text).toMatch(/ESSENCE of each component, not its skin/);
    expect(text).toMatch(/must be strictly adhered to/);
    expect(text).toMatch(/SHOWCASE DEMOS/);
    expect(text).toMatch(/Trigger: /);
    expect(text).toContain('old/gone');
  });

  it('collection request can include every source file', () => {
    const items = catalogue.components.slice(0, 2).map((component, i) => ({ component, note: '', source: `SRC-${i}` }));
    const text = buildCollectionPrompt(items, { name: 'Set', includeSource: true, site });
    expect(text).toContain('SRC-0');
    expect(text).toContain('SRC-1');
    expect(text.match(/BEGIN ORIGINAL SOURCE/g)).toHaveLength(2);
  });

  it('warns when the result is too large to paste', () => {
    expect(promptSize('x'.repeat(100)).level).toBe('ok');
    expect(promptSize('x'.repeat(LARGE_PROMPT_CHARS + 1)).level).toBe('large');
    expect(promptSize('x'.repeat(TOO_LARGE_PROMPT_CHARS + 1)).level).toBe('too-large');
  });
});
