import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useActions } from '../components/Actions';
import { Icon } from '../components/Icon';
import { LivePreview } from '../components/LivePreview';
import { EmptyState, Segmented } from '../components/ui';
import { useCatalogue } from '../lib/catalogue';
import { formatBytes, roleLabelSingular, valueLabel } from '../lib/labels';
import type { CatalogueComponent, FacetKey } from '../lib/types';
import { comparePath, viewerPath } from '../lib/urls';
import { COMPARE_LIMIT, resolvedTheme, setPrefs, usePrefs } from '../store/prefs';
import { useUserData } from '../store/userData';

type SizeKey = 'small' | 'medium' | 'large';
const SIZES: Record<SizeKey, { width: number; height: number }> = {
  small: { width: 320, height: 240 },
  medium: { width: 480, height: 360 },
  large: { width: 720, height: 540 },
};

const list = (key: FacetKey, values: string[]) => (values.length ? values.map((v) => valueLabel(key, v)).join(', ') : '—');

const ROWS: { label: string; value: (c: CatalogueComponent) => string }[] = [
  { label: 'Type', value: (c) => roleLabelSingular(c.role) },
  { label: 'Category', value: (c) => c.theme },
  { label: 'Interaction', value: (c) => list('interaction', c.interaction) },
  { label: 'Performance', value: (c) => (c.perf ? valueLabel('perf', c.perf) : '—') },
  { label: 'Animation', value: (c) => (c.motion ? valueLabel('motion', c.motion) : '—') },
  { label: 'Energy', value: (c) => (c.intensity ? valueLabel('intensity', c.intensity) : '—') },
  { label: 'Visual style', value: (c) => list('style', c.style) },
  { label: 'Built with', value: (c) => list('technique', c.technique) },
  { label: 'Light version', value: (c) => (c.lightReady ? 'Yes' : 'No') },
  { label: 'Keyboard-friendly', value: (c) => (c.a11y.keyboard ? 'Yes' : 'No') },
  { label: 'Needs', value: (c) => (c.externalFonts || c.deps.length ? 'Google Fonts' : 'Nothing extra') },
  { label: 'File size', value: (c) => formatBytes(c.bytes) },
];

export function Compare() {
  const { byId, meta } = useCatalogue();
  const prefs = usePrefs();
  const data = useUserData();
  const actions = useActions();
  const [params, setParams] = useSearchParams();
  const [size, setSize] = useState<SizeKey>('medium');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => resolvedTheme(prefs.theme));
  const [paused, setPaused] = useState(false);
  const [restart, setRestart] = useState(0);

  // A shared link (?ids=…) replaces the current selection; otherwise the address follows it.
  const fromUrl = params.get('ids');
  useEffect(() => {
    if (fromUrl !== null) {
      const ids = [...new Set(fromUrl.split(',').map(decodeURIComponent).filter(Boolean))].slice(0, COMPARE_LIMIT);
      if (ids.join(',') !== prefs.compare.join(',')) setPrefs({ compare: ids });
    } else if (prefs.compare.length) {
      setParams({ ids: prefs.compare.join(',') }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl]);

  useEffect(() => {
    document.title = `Compare · ${meta.site.siteName}`;
  }, [meta.site.siteName]);

  const ids = prefs.compare;
  const items = useMemo(() => ids.map((id) => ({ id, component: byId.get(id) })), [ids, byId]);
  const present = items.filter((i): i is { id: string; component: CatalogueComponent } => !!i.component);

  const remove = (id: string) => {
    const next = ids.filter((x) => x !== id);
    setPrefs({ compare: next });
    setParams(next.length ? { ids: next.join(',') } : {}, { replace: true });
  };

  if (ids.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>Compare</h1>
        </header>
        <EmptyState
          icon="compare"
          title="Nothing to compare yet"
          action={
            <Link className="btn btn-primary" to="/">
              Browse the library
            </Link>
          }
        >
          <p>
            Choose two to four components to see them running side by side — for example three toggle switches or a few loaders. Use the{' '}
            <strong>⋯</strong> menu on any card and pick <strong>Add to comparison</strong>.
          </p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="muted">
            {ids.length === 1
              ? 'Add at least one more component to compare.'
              : `Comparing ${ids.length} components at the same size. Add up to ${COMPARE_LIMIT}.`}
          </p>
        </div>
        <div className="viewer-actions">
          <Link className="btn" to="/">
            <Icon name="plus" /> Add another
          </Link>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPrefs({ compare: [] });
              setParams({}, { replace: true });
            }}
            data-testid="clear-compare"
          >
            Clear all
          </button>
        </div>
      </header>

      <div className="stage-toolbar">
        <Segmented<SizeKey>
          label="Preview size (applies to all)"
          value={size}
          onChange={setSize}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
        />
        <Segmented<'dark' | 'light'>
          label="Colour mode (applies to all)"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark', icon: 'moon' },
            { value: 'light', label: 'Light', icon: 'sun' },
          ]}
        />
        <div className="stage-group">
          <button type="button" className="btn btn-small" onClick={() => { setPaused(false); setRestart((n) => n + 1); }}>
            <Icon name="restart" size={14} /> Restart all
          </button>
          <button type="button" className="btn btn-small" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            <Icon name={paused ? 'play' : 'pause'} size={14} /> {paused ? 'Resume all' : 'Pause all'}
          </button>
        </div>
      </div>

      <div className="compare-grid" data-count={ids.length} data-testid="compare-grid">
        {items.map(({ id, component }) =>
          component ? (
            <article key={id} className="compare-col" data-testid="compare-item">
              <div className="compare-preview">
                <LivePreview
                  component={component}
                  theme={theme}
                  mode="always"
                  virtual={SIZES[size]}
                  paused={paused}
                  restartKey={restart}
                />
              </div>
              <div className="compare-head">
                <h2>
                  <Link to={viewerPath(component.id)}>{component.title}</Link>
                </h2>
                <div className="compare-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-pressed={component.id in data.favourites}
                    aria-label={component.id in data.favourites ? 'Remove from favourites' : 'Add to favourites'}
                    title={component.id in data.favourites ? 'Remove from favourites' : 'Add to favourites'}
                    onClick={() => actions.toggleFavourite(component)}
                  >
                    <Icon name="heart" filled={component.id in data.favourites} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Add to collection"
                    title="Add to collection"
                    onClick={() => actions.addToCollection(component.id)}
                  >
                    <Icon name="folder" />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Copy for AI" title="Copy for AI" onClick={() => actions.copyForAi(component)}>
                    <Icon name="copy" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${component.title} from comparison`}
                    title="Remove from comparison"
                    onClick={() => remove(id)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
              {component.description && <p className="compare-description">{component.description}</p>}
              <dl className="compare-facts">
                {ROWS.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value(component)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ) : (
            <article key={id} className="compare-col" data-testid="compare-item">
              <div className="preview" data-state="unavailable">
                <div className="preview-message">
                  <Icon name="alert" />
                  <strong>No longer in the library</strong>
                  <span>{id}</span>
                  <button type="button" className="btn btn-small" onClick={() => remove(id)}>
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
      {present.length > 1 && (
        <p className="muted small">
          Share or bookmark this comparison: <code>{`${window.location.origin}${comparePath(ids)}`}</code>
        </p>
      )}
    </div>
  );
}
