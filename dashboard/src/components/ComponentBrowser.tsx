// The searchable, filterable gallery. Used by the main library page and the Favourites page.
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { FACETS, FACET_BY_KEY, valueLabel } from '../lib/labels';
import { activeFilterCount, facetCounts, LibrarySearch, matchesFilters, sortComponents } from '../lib/search';
import type { CatalogueComponent, Density, FacetKey, FilterState, SortKey } from '../lib/types';
import { viewerPath } from '../lib/urls';
import { resolvedTheme, setPrefs, usePrefs } from '../store/prefs';
import { userStore, useUserData } from '../store/userData';
import { ComponentCard } from './ComponentCard';
import { FilterPanel } from './FilterPanel';
import { Icon } from './Icon';
import { SearchBox } from './SearchBox';
import { Dialog, EmptyState, Segmented } from './ui';

const PAGE_SIZE = 96;

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'default', label: 'Library order' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'category', label: 'Category' },
  { value: 'type', label: 'Component type' },
  { value: 'lightest', label: 'Lightest first' },
  { value: 'recent', label: 'Recently viewed first' },
];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function readFilters(params: URLSearchParams): FilterState {
  const filters: FilterState = {};
  for (const facet of FACETS) {
    const raw = params.get(facet.key);
    if (raw) filters[facet.key] = raw.split(',').filter(Boolean);
  }
  return filters;
}

interface Props {
  /** The components this page may show (everything, or just favourites). */
  pool: CatalogueComponent[];
  title: string;
  searchPlaceholder: string;
  /** Shown instead of the gallery when the pool itself is empty. */
  emptyPool?: ReactNode;
  showRecent?: boolean;
  intro?: ReactNode;
}

export function ComponentBrowser({ pool, title, searchPlaceholder, emptyPool, showRecent, intro }: Props) {
  const { themes, byId } = useCatalogue();
  const prefs = usePrefs();
  const data = useUserData();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery('(min-width: 1080px)');
  const [sheetOpen, setSheetOpen] = useState(false);

  const query = params.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const filters = useMemo(() => readFilters(params), [params]);
  const activeCount = activeFilterCount(filters);

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setQuery = useCallback(
    (value: string) => update((next) => (value ? next.set('q', value) : next.delete('q'))),
    [update],
  );
  const toggleFilter = useCallback(
    (key: FacetKey, value: string) =>
      update((next) => {
        const current = (next.get(key) ?? '').split(',').filter(Boolean);
        const values = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        if (values.length) next.set(key, values.join(','));
        else next.delete(key);
      }),
    [update],
  );
  const clearAll = useCallback(
    () =>
      update((next) => {
        next.delete('q');
        for (const facet of FACETS) next.delete(facet.key);
      }),
    [update],
  );

  const search = useMemo(() => new LibrarySearch(pool, themes), [pool, themes]);
  const scores = useMemo(() => search.scores(deferredQuery), [search, deferredQuery]);
  const searched = useMemo(() => (scores ? pool.filter((c) => scores.has(c.id)) : pool), [pool, scores]);
  const counts = useMemo(() => facetCounts(searched, filters), [searched, filters]);

  // "Best match" only means something while searching; otherwise fall back to the saved order.
  const sort: SortKey = scores ? (prefs.sort === 'default' ? 'relevance' : prefs.sort) : prefs.sort === 'relevance' ? 'default' : prefs.sort;
  const results = useMemo(
    () => sortComponents(searched.filter((c) => matchesFilters(c, filters)), sort, scores, data.recent),
    [searched, filters, sort, scores, data.recent],
  );

  // Render in pages so even thousands of components never build one enormous page at once.
  const [limit, setLimit] = useState(PAGE_SIZE);
  const resultKey = `${deferredQuery}|${params.toString()}|${sort}|${pool.length}`;
  useEffect(() => setLimit(PAGE_SIZE), [resultKey]);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE_SIZE);
      },
      { rootMargin: '900px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [results.length, limit]);

  const theme = resolvedTheme(prefs.theme);
  const chips = FACETS.flatMap((facet) => (filters[facet.key] ?? []).map((value) => ({ key: facet.key, value })));
  const recent = showRecent && !query && !activeCount ? data.recent.map((id) => byId.get(id)).filter((c): c is CatalogueComponent => !!c) : [];

  const panel = (
    <FilterPanel filters={filters} counts={counts} themes={themes} onToggle={toggleFilter} onClear={clearAll} activeCount={activeCount + (query ? 1 : 0)} />
  );

  if (!pool.length && emptyPool) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>{title}</h1>
        </header>
        {emptyPool}
      </div>
    );
  }

  return (
    <div className="page browser" data-filters={wide && prefs.filtersOpen ? 'open' : 'closed'}>
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {intro}
        </div>
      </header>

      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} search={search} onPickFilter={toggleFilter} placeholder={searchPlaceholder} />
        <div className="toolbar-controls">
          <button
            type="button"
            className="btn"
            aria-pressed={wide ? prefs.filtersOpen : sheetOpen}
            data-testid="filters-toggle"
            onClick={() => (wide ? setPrefs({ filtersOpen: !prefs.filtersOpen }) : setSheetOpen(true))}
          >
            <Icon name="filter" /> Filters{activeCount > 0 && <span className="count-pill">{activeCount}</span>}
          </button>
          <label className="select">
            <span className="visually-hidden">Sort by</span>
            <select
              value={sort}
              aria-label="Sort by"
              data-testid="sort-select"
              onChange={(event) => setPrefs({ sort: event.target.value as SortKey })}
            >
              {SORTS.filter((s) => s.value !== 'relevance' || scores).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={14} />
          </label>
          <Segmented<Density>
            label="Gallery size"
            value={prefs.density}
            onChange={(density) => setPrefs({ density })}
            options={[
              { value: 'compact', label: 'Compact', title: 'Compact: small previews, many at once' },
              { value: 'comfortable', label: 'Comfortable', title: 'Comfortable: medium cards' },
              { value: 'large', label: 'Large', title: 'Large: big previews for inspecting animation' },
            ]}
          />
        </div>
      </div>

      <div className="result-bar">
        <p className="result-count" role="status" aria-live="polite" data-testid="result-count">
          <strong>{results.length.toLocaleString('en-GB')}</strong>{' '}
          {results.length === pool.length ? `component${pool.length === 1 ? '' : 's'}` : `of ${pool.length.toLocaleString('en-GB')} components`}
        </p>
        {(chips.length > 0 || query) && (
          <ul className="chips" aria-label="Active filters">
            {query && (
              <li>
                <button type="button" className="chip" onClick={() => setQuery('')} title="Remove search text">
                  “{query}” <Icon name="close" size={12} />
                </button>
              </li>
            )}
            {chips.map(({ key, value }) => (
              <li key={`${key}:${value}`}>
                <button type="button" className="chip" onClick={() => toggleFilter(key, value)} title={`Remove filter: ${FACET_BY_KEY.get(key)?.label}`}>
                  {valueLabel(key, value, themes)} <Icon name="close" size={12} />
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="link-btn" onClick={clearAll}>
                Clear all
              </button>
            </li>
          </ul>
        )}
      </div>

      {recent.length > 0 && (
        <section className="recent" aria-label="Recently viewed">
          <h2>
            <Icon name="clock" size={14} /> Recently viewed
          </h2>
          <ul>
            {recent.slice(0, 10).map((c) => (
              <li key={c.id}>
                <Link className="recent-item" to={viewerPath(c.id)}>
                  <span className="swatch" style={{ background: c.bg || undefined, borderColor: c.accent || undefined }} />
                  {c.title}
                </Link>
              </li>
            ))}
            <li>
              <button type="button" className="link-btn" onClick={() => userStore.clearRecent()}>
                Clear
              </button>
            </li>
          </ul>
        </section>
      )}

      <div className="browser-body">
        {wide && prefs.filtersOpen && <aside className="browser-side">{panel}</aside>}
        <div className="browser-main">
          {results.length === 0 ? (
            <EmptyState
              icon="search"
              title="No components match"
              action={
                <button type="button" className="btn btn-primary" onClick={clearAll}>
                  Clear search and filters
                </button>
              }
            >
              <p>Try a different word, or remove a filter. Search is forgiving: a rough description such as “gooey toggle” or “calm background” works.</p>
            </EmptyState>
          ) : (
            <>
              <div className="grid" data-density={prefs.density} data-testid="gallery">
                {results.slice(0, limit).map((component) => (
                  <ComponentCard
                    key={component.id}
                    component={component}
                    density={prefs.density}
                    theme={theme}
                    favourite={component.id in data.favourites}
                    comparing={prefs.compare.includes(component.id)}
                  />
                ))}
              </div>
              {limit < results.length && (
                <div ref={sentinel} className="grid-more">
                  <button type="button" className="btn" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                    Show more ({(results.length - limit).toLocaleString('en-GB')} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!wide && sheetOpen && (
        <Dialog
          title="Filters"
          size="small"
          onClose={() => setSheetOpen(false)}
          footer={
            <button type="button" className="btn btn-primary" onClick={() => setSheetOpen(false)}>
              Show {results.length.toLocaleString('en-GB')} result{results.length === 1 ? '' : 's'}
            </button>
          }
        >
          {panel}
        </Dialog>
      )}
    </div>
  );
}
