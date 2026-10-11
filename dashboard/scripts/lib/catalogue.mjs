// Builds the dashboard catalogue from the upstream metadata and component files.
// Pure Node, no dependencies. Used by the build, the dev server, the sync report and the tests.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DASHBOARD_ROOT = resolve(here, '..', '..');
export const REPO_ROOT = resolve(DASHBOARD_ROOT, '..');

export function readSiteConfig(dashboardRoot = DASHBOARD_ROOT) {
  return JSON.parse(readFileSync(join(dashboardRoot, 'site.config.json'), 'utf8'));
}

/** Stable identity: the component's path inside the collection, without ".html". */
export function idFromFile(file) {
  return String(file).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.html$/i, '');
}

const asArray = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const strings = (v) => asArray(v).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
const str = (v, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

function titleFromSlug(slug) {
  return slug
    .replace(/^\d+[-_]/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function readJson(path) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

function listHtmlFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.html$/i.test(entry.name)) out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

const META_RE = /<script[^>]*id=["']forever-agent-meta["'][^>]*>([\s\S]*?)<\/script>/i;

/** Reads the adaptation guidance that upstream embeds in every component file. */
export function extractAgentMeta(html) {
  const m = META_RE.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function inspectFile(absPath) {
  if (!existsSync(absPath)) return { status: 'missing', issues: ['The component file is missing.'] };
  let html;
  try {
    if (!statSync(absPath).isFile()) return { status: 'missing', issues: ['The path is not a file.'] };
    // Line endings are normalised so the fingerprint is the same on Windows and on the build server.
    html = readFileSync(absPath, 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
  } catch (error) {
    return { status: 'broken', issues: [`The file could not be read (${error.code || 'error'}).`] };
  }
  const issues = [];
  if (html.trim().length < 40) issues.push('The file is empty.');
  else if (!/<(html|body|svg|canvas|style|script|div)\b/i.test(html)) issues.push('The file does not look like HTML.');
  const meta = extractAgentMeta(html);
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return {
    status: issues.length ? 'broken' : 'ok',
    issues,
    html,
    meta,
    hasAgentMeta: !!meta,
    htmlTitle: titleMatch ? titleMatch[1].trim() : '',
    bytes: Buffer.byteLength(html),
    hash: createHash('sha256').update(html).digest('hex').slice(0, 16),
    usesExternalFonts: /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html),
    usesMicrophone: /getUserMedia/.test(html),
  };
}

function normaliseRecord(raw, file, info, themeNames) {
  const id = idFromFile(file);
  const themeSlug = str(raw.themeSlug, id.includes('/') ? id.split('/')[0] : 'uncategorised');
  const fileSlug = id.split('/').pop() || id;
  const palette = raw.palette && typeof raw.palette === 'object' && !Array.isArray(raw.palette) ? raw.palette : {};
  const a11y = raw.a11y && typeof raw.a11y === 'object' && !Array.isArray(raw.a11y) ? raw.a11y : {};
  const meta = info.meta || {};
  const labels = strings(raw.labels).length ? strings(raw.labels) : strings(meta.labels);
  return {
    id,
    file,
    title: str(raw.title, str(meta.title, info.htmlTitle || titleFromSlug(fileSlug))),
    theme: str(raw.theme, themeNames.get(themeSlug) || titleFromSlug(themeSlug)),
    themeSlug,
    role: str(raw.role, 'other'),
    description: str(raw.description, str(meta.description)),
    technique: strings(raw.technique),
    style: strings(raw.style),
    motion: str(raw.motion),
    intensity: str(raw.intensity),
    interaction: strings(raw.interaction),
    perf: str(raw.perfTier),
    scheme: str(palette.scheme),
    tone: str(palette.tone),
    bg: str(palette.bgHex),
    accent: str(palette.accentHex),
    colors: strings(palette.colors).slice(0, 8),
    deps: strings(raw.deps).filter((d) => d !== 'none'),
    useCases: strings(raw.useCases),
    mood: strings(raw.mood),
    labels,
    tags: strings(raw.tags).length ? strings(raw.tags) : strings(meta.tags),
    a11y: {
      reducedMotion: a11y.reducedMotion === true,
      keyboard: a11y.keyboard === true,
      ariaLabeled: a11y.ariaLabeled === true,
      seizureSafe: a11y.seizureSafe !== false,
    },
    loc: Number.isFinite(raw.loc) ? raw.loc : 0,
    bytes: info.bytes || 0,
    hash: info.hash || '',
    status: info.status,
    issues: info.issues,
    indexed: raw.__unindexed !== true,
    lightReady: labels.includes('light-ready'),
    externalFonts: !!info.usesExternalFonts,
    microphone: !!info.usesMicrophone,
    adapt: {
      useWhen: strings(meta.useWhen),
      avoidWhen: strings(meta.avoidWhen),
      agentPrompt: str(meta.agentPrompt),
      editableAreas: strings(meta.editableAreas),
      preserveElements: strings(meta.preserveElements),
      knownLimitations: strings(meta.knownLimitations),
    },
  };
}

function countFacet(components, pick) {
  const counts = {};
  for (const c of components) for (const v of asArray(pick(c))) if (v) counts[v] = (counts[v] || 0) + 1;
  return counts;
}

/**
 * @param {{repoRoot?: string, componentsDir?: string, now?: Date, commit?: string}} [options]
 */
export function buildCatalogue(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const componentsDir = options.componentsDir || 'infinite';
  const base = join(repoRoot, componentsDir);
  const warnings = [];
  const fatal = [];

  const indexRead = readJson(join(base, 'components.index.json'));
  let rawList = [];
  let indexMeta = {};
  if (!indexRead.ok) {
    warnings.push(`The upstream index (components.index.json) could not be read: ${indexRead.error}`);
  } else {
    const data = indexRead.data;
    rawList = Array.isArray(data) ? data : Array.isArray(data?.components) ? data.components : [];
    indexMeta = Array.isArray(data) ? {} : { schemaVersion: data?.schemaVersion, taxonomyVersion: data?.taxonomyVersion };
    if (!rawList.length) warnings.push('The upstream index contains no components.');
  }

  const facetsRead = readJson(join(base, 'facets.json'));
  const catalogRead = readJson(join(repoRoot, 'catalog.json'));
  const themeNames = new Map();
  for (const r of rawList) if (r && r.themeSlug && r.theme) themeNames.set(r.themeSlug, r.theme);

  const onDisk = listHtmlFiles(base).filter((f) => f.includes('/'));
  const onDiskSet = new Set(onDisk);
  const seen = new Map();
  const duplicates = [];
  const invalidEntries = [];
  const components = [];

  rawList.forEach((raw, position) => {
    if (!raw || typeof raw !== 'object' || typeof raw.file !== 'string' || !raw.file.trim()) {
      invalidEntries.push(`Entry ${position + 1} has no file path.`);
      return;
    }
    const file = raw.file.replace(/\\/g, '/').replace(/^\/+/, '');
    if (file.includes('..')) {
      invalidEntries.push(`Entry ${position + 1} has an unsafe path (${file}).`);
      return;
    }
    const id = idFromFile(file);
    if (seen.has(id)) {
      duplicates.push(file);
      return;
    }
    seen.set(id, true);
    const info = inspectFile(join(base, file));
    components.push(normaliseRecord(raw, file, info, themeNames));
  });

  // Files that exist but are not in the upstream index still appear, with whatever we can infer.
  const unindexed = onDisk.filter((f) => !seen.has(idFromFile(f)));
  for (const file of unindexed) {
    const info = inspectFile(join(base, file));
    seen.set(idFromFile(file), true);
    components.push(normaliseRecord({ __unindexed: true }, file, info, themeNames));
  }

  const missing = components.filter((c) => c.status === 'missing').map((c) => c.file);
  const broken = components.filter((c) => c.status === 'broken').map((c) => c.file);
  const valid = components.filter((c) => c.status === 'ok');
  const withoutGuidance = valid.filter((c) => !c.adapt.useWhen.length && !c.adapt.agentPrompt).length;

  const facets = {
    role: countFacet(components, (c) => c.role),
    theme: countFacet(components, (c) => c.themeSlug),
    interaction: countFacet(components, (c) => c.interaction),
    perf: countFacet(components, (c) => c.perf),
    style: countFacet(components, (c) => c.style),
    motion: countFacet(components, (c) => c.motion),
    intensity: countFacet(components, (c) => c.intensity),
    technique: countFacet(components, (c) => c.technique),
    scheme: countFacet(components, (c) => c.scheme),
    mood: countFacet(components, (c) => c.mood),
    useCases: countFacet(components, (c) => c.useCases),
    labels: countFacet(components, (c) => c.labels),
  };

  const facetsFileTotal = facetsRead.ok && Number.isFinite(facetsRead.data?.total) ? facetsRead.data.total : null;
  if (facetsFileTotal != null && facetsFileTotal !== rawList.length) {
    warnings.push(`facets.json reports ${facetsFileTotal} components but the index lists ${rawList.length}.`);
  }
  if (!components.length) fatal.push('No components were found. The catalogue cannot be built.');

  const retired = catalogRead.ok && Array.isArray(catalogRead.data?.retired) ? catalogRead.data.retired : [];
  const themes = {};
  for (const c of components) themes[c.themeSlug] = c.theme;

  const builtAt = (options.now || new Date()).toISOString();
  return {
    meta: {
      builtAt,
      commit: options.commit || '',
      upstreamSchemaVersion: indexMeta.schemaVersion ?? null,
      health: {
        builtAt,
        indexed: rawList.length,
        listed: components.length,
        validFiles: valid.length,
        filesOnDisk: onDiskSet.size,
        missing,
        broken,
        duplicates,
        unindexed,
        invalidEntries,
        withoutGuidance,
        categories: Object.keys(facets.theme).length,
        types: Object.keys(facets.role).length,
        warnings,
        fatal,
        ok: !fatal.length && !missing.length && !broken.length && !duplicates.length && !invalidEntries.length,
      },
    },
    themes,
    facets,
    components,
    retired: retired
      .filter((r) => r && typeof r.file === 'string')
      .map((r) => ({
        id: idFromFile(r.file.replace(new RegExp(`^${componentsDir}/`), '')),
        title: str(r.title),
        removedAt: str(r.retiredAt),
      }))
      .filter((r) => !seen.has(r.id)),
  };
}

/** Compact fingerprint of the collection, used to report what changed between syncs. */
export function snapshotOf(catalogue) {
  const components = {};
  for (const c of catalogue.components) {
    if (c.status === 'ok') components[c.id] = { hash: c.hash, title: c.title };
  }
  return components;
}

export function diffSnapshots(before, after) {
  const added = [];
  const modified = [];
  const deleted = [];
  for (const [id, entry] of Object.entries(after)) {
    if (!before[id]) added.push({ id, title: entry.title });
    else if (before[id].hash !== entry.hash) modified.push({ id, title: entry.title });
  }
  for (const [id, entry] of Object.entries(before)) {
    if (!after[id]) deleted.push({ id, title: entry.title });
  }
  const byId = (a, b) => a.id.localeCompare(b.id);
  return { added: added.sort(byId), modified: modified.sort(byId), deleted: deleted.sort(byId) };
}
