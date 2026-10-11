import MiniSearch from 'minisearch';
import { FACETS, FACET_BY_KEY, roleLabelSingular, valueLabel } from './labels';
import type { CatalogueComponent, FacetKey, FilterState, SortKey } from './types';

interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  category: string;
  type: string;
  description: string;
  uses: string;
  traits: string;
  guidance: string;
}

const PERF_ORDER: Record<string, number> = { cheap: 0, medium: 1, heavy: 2 };

function toDoc(c: CatalogueComponent): SearchDoc {
  const labelled = (key: FacetKey, values: string[]) => values.map((v) => `${valueLabel(key, v)} ${v}`).join(' ');
  return {
    id: c.id,
    title: c.title,
    tags: c.tags.join(' '),
    category: `${c.theme} ${c.themeSlug}`,
    type: `${roleLabelSingular(c.role)} ${valueLabel('role', c.role)} ${c.role}`,
    description: c.description,
    uses: labelled('useCases', c.useCases),
    traits: [
      labelled('interaction', c.interaction),
      valueLabel('kind', c.kind),
      labelled('style', c.style),
      labelled('motion', c.motion ? [c.motion] : []),
      labelled('intensity', c.intensity ? [c.intensity] : []),
      labelled('perf', c.perf ? [c.perf] : []),
      labelled('scheme', c.scheme ? [c.scheme] : []),
      labelled('technique', c.technique),
      labelled('labels', c.labels),
      c.mood.join(' '),
      c.tone,
    ].join(' '),
    guidance: [...c.adapt.useWhen, ...c.adapt.avoidWhen].join(' '),
  };
}

export interface Suggestion {
  kind: 'component' | 'filter';
  label: string;
  detail: string;
  id?: string;
  facet?: FacetKey;
  value?: string;
}

export class LibrarySearch {
  private readonly index: MiniSearch<SearchDoc>;
  private readonly components: CatalogueComponent[];
  private readonly themes: Record<string, string>;

  constructor(components: CatalogueComponent[], themes: Record<string, string>) {
    this.components = components;
    this.themes = themes;
    this.index = new MiniSearch<SearchDoc>({
      fields: ['title', 'tags', 'category', 'type', 'description', 'uses', 'traits', 'guidance'],
      storeFields: [],
      searchOptions: {
        boost: { title: 5, tags: 3, category: 2.5, type: 2.5, uses: 1.5, description: 1.5, traits: 1 },
        prefix: true,
        fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      },
    });
    this.index.addAll(components.map(toDoc));
  }

  /** Returns a relevance score per component id, or null when there is no search text. */
  scores(query: string): Map<string, number> | null {
    const q = query.trim();
    if (!q) return null;
    let results = this.index.search(q, { combineWith: 'AND' });
    // Forgiving fallback: if no component matches every word, accept any word.
    if (!results.length) results = this.index.search(q, { combineWith: 'OR' });
    return new Map(results.map((r) => [r.id as string, r.score]));
  }

  suggest(query: string, limit = 6): Suggestion[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Suggestion[] = [];
    for (const facet of FACETS) {
      const seen = new Set<string>();
      for (const c of this.components) {
        for (const value of facet.pick(c)) {
          if (seen.has(value)) continue;
          seen.add(value);
          const label = valueLabel(facet.key, value, this.themes);
          if (label.toLowerCase().includes(q) || value.toLowerCase().includes(q)) {
            out.push({ kind: 'filter', label, detail: `Filter · ${facet.label}`, facet: facet.key, value });
          }
        }
      }
    }
    const filters = out
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)))
      .slice(0, 3);
    const byId = new Map(this.components.map((c) => [c.id, c]));
    const titles: Suggestion[] = [];
    for (const r of this.index.search(q, { fields: ['title', 'tags'], prefix: true, fuzzy: 0.2, combineWith: 'AND' })) {
      const c = byId.get(r.id as string);
      if (c) titles.push({ kind: 'component', label: c.title, detail: c.theme, id: c.id });
      if (titles.length >= limit) break;
    }
    return [...filters, ...titles];
  }
}

export function matchesFilters(c: CatalogueComponent, filters: FilterState, except?: FacetKey): boolean {
  for (const key of Object.keys(filters) as FacetKey[]) {
    if (key === except) continue;
    const wanted = filters[key];
    if (!wanted || !wanted.length) continue;
    const facet = FACET_BY_KEY.get(key);
    if (!facet) continue;
    const values = facet.pick(c);
    if (!wanted.some((w) => values.includes(w))) return false;
  }
  return true;
}

export interface FacetCount {
  value: string;
  count: number;
}

/** Counts for each filter value, given the other filters and the search already applied. */
export function facetCounts(pool: CatalogueComponent[], filters: FilterState): Record<FacetKey, FacetCount[]> {
  const result = {} as Record<FacetKey, FacetCount[]>;
  for (const facet of FACETS) {
    const counts = new Map<string, number>();
    for (const c of pool) {
      if (!matchesFilters(c, filters, facet.key)) continue;
      for (const v of facet.pick(c)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const selected of filters[facet.key] ?? []) if (!counts.has(selected)) counts.set(selected, 0);
    let list = [...counts.entries()].map(([value, count]) => ({ value, count }));
    if (facet.order) {
      const order = facet.order;
      const rank = (v: string) => (order.includes(v) ? order.indexOf(v) : order.length);
      list.sort((a, b) => rank(a.value) - rank(b.value) || b.count - a.count);
    } else if (facet.key === 'theme') {
      list.sort((a, b) => a.value.localeCompare(b.value));
    } else {
      list = list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    }
    result[facet.key] = list;
  }
  return result;
}

export function sortComponents(
  list: CatalogueComponent[],
  sort: SortKey,
  scores: Map<string, number> | null,
  recent: string[],
): CatalogueComponent[] {
  const out = [...list];
  const byName = (a: CatalogueComponent, b: CatalogueComponent) => a.title.localeCompare(b.title);
  switch (sort) {
    case 'relevance':
      if (scores) return out.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.order - b.order);
      return out.sort((a, b) => a.order - b.order);
    case 'name':
      return out.sort(byName);
    case 'category':
      return out.sort((a, b) => a.theme.localeCompare(b.theme) || a.file.localeCompare(b.file));
    case 'type':
      return out.sort(
        (a, b) => roleLabelSingular(a.role).localeCompare(roleLabelSingular(b.role)) || byName(a, b),
      );
    case 'lightest':
      return out.sort((a, b) => (PERF_ORDER[a.perf] ?? 1) - (PERF_ORDER[b.perf] ?? 1) || a.bytes - b.bytes);
    case 'recent': {
      const rank = new Map(recent.map((id, i) => [id, i]));
      return out.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || a.order - b.order);
    }
    default:
      return out.sort((a, b) => a.order - b.order);
  }
}

export function activeFilterCount(filters: FilterState): number {
  return Object.values(filters).reduce((n, v) => n + (v?.length ?? 0), 0);
}
