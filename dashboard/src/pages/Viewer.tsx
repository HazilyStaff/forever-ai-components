import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions } from '../components/Actions';
import { ComponentCard } from '../components/ComponentCard';
import { Icon } from '../components/Icon';
import { LivePreview, type PreviewState } from '../components/LivePreview';
import { EmptyState, Segmented, useToast } from '../components/ui';
import { copyText, downloadText, fetchSource } from '../lib/browser';
import { useCatalogue } from '../lib/catalogue';
import { formatBytes, roleLabelSingular, valueHint, valueLabel } from '../lib/labels';
import type { CatalogueComponent, FacetKey } from '../lib/types';
import { githubUrl, originalUrl, rawUrl, repoPath, shareUrl } from '../lib/urls';
import { resolvedTheme, usePrefs } from '../store/prefs';
import { userStore, useUserData } from '../store/userData';

type ViewportKey = 'fit' | 'desktop' | 'tablet' | 'phone' | 'custom';

const VIEWPORTS: Record<Exclude<ViewportKey, 'fit' | 'custom'>, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
};

const BACKGROUNDS: { value: string | null; label: string }[] = [
  { value: null, label: 'Original' },
  { value: '#000000', label: 'Black' }, // style-ok: preview backdrop sent to the component
  { value: '#1f2937', label: 'Slate' }, // style-ok
  { value: '#9ca3af', label: 'Grey' }, // style-ok
  { value: '#ffffff', label: 'White' }, // style-ok
];

function Missing({ id }: { id: string }) {
  const { removedById } = useCatalogue();
  const data = useUserData();
  const navigate = useNavigate();
  const removed = removedById.get(id);
  const saved = id in data.favourites || data.collections.some((c) => c.items.some((i) => i.id === id));
  return (
    <div className="page">
      <EmptyState
        icon="alert"
        title={removed ? `“${removed.title}” is no longer in the library` : 'This component isn’t in the library'}
        action={
          <>
            <Link className="btn btn-primary" to="/">
              Browse the library
            </Link>
            {saved && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (id in data.favourites) userStore.toggleFavourite(id);
                  for (const c of data.collections) userStore.removeFromCollection(c.id, id);
                  navigate('/');
                }}
              >
                Remove it from my saved items
              </button>
            )}
          </>
        }
      >
        <p>
          {removed
            ? 'It was removed from the original collection, so there is nothing to show. Your other saved components are not affected.'
            : 'The link may be mistyped, or the component was removed or renamed in the original collection.'}
        </p>
        <p className="muted small">
          Reference: <code>{id}</code>
        </p>
      </EmptyState>
    </div>
  );
}

function Fact({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {children}
        {hint && <small>{hint}</small>}
      </dd>
    </div>
  );
}

const facetList = (key: FacetKey, values: string[]) => values.map((v) => valueLabel(key, v)).join(', ');

function CopyField({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const toast = useToast();
  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <code title={value}>{value}</code>
      <button
        type="button"
        className="btn btn-small"
        data-testid={testId}
        onClick={async () => {
          const ok = await copyText(value);
          toast(ok ? `${label} copied.` : 'Copying was blocked by the browser.', { tone: ok ? 'success' : 'error' });
        }}
      >
        <Icon name="copy" size={14} /> Copy
      </button>
    </div>
  );
}

function ViewerContent({ component }: { component: CatalogueComponent }) {
  const { meta, components } = useCatalogue();
  const actions = useActions();
  const toast = useToast();
  const prefs = usePrefs();
  const data = useUserData();
  const site = meta.site;

  const [theme, setTheme] = useState<'dark' | 'light'>(() => resolvedTheme(prefs.theme));
  const [viewport, setViewport] = useState<ViewportKey>('fit');
  const [custom, setCustom] = useState({ width: 640, height: 480 });
  const [background, setBackground] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [restart, setRestart] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewState>('loading');
  const [source, setSource] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    userStore.markViewed(component.id);
    document.title = `${component.title} · ${site.siteName}`;
    setPaused(false);
    setBackground(null);
    setViewport('fit');
    setSource(null);
    setSourceError('');
    setShowSource(false);
    window.scrollTo(0, 0);
    if (component.status !== 'ok') return;
    let cancelled = false;
    fetchSource(component)
      .then((text) => !cancelled && setSource(text))
      .catch((error: Error) => !cancelled && setSourceError(error.message));
    return () => {
      cancelled = true;
    };
  }, [component, site.siteName]);

  const favourite = component.id in data.favourites;
  const comparing = prefs.compare.includes(component.id);
  const inCollections = data.collections.filter((c) => c.items.some((i) => i.id === component.id));
  const virtual = viewport === 'fit' ? undefined : viewport === 'custom' ? custom : VIEWPORTS[viewport];
  const similar = useMemo(
    () =>
      components
        .filter((c) => c.id !== component.id && c.status === 'ok' && (c.themeSlug === component.themeSlug || c.role === component.role))
        .sort((a, b) => Number(b.themeSlug === component.themeSlug) + Number(b.role === component.role) - (Number(a.themeSlug === component.themeSlug) + Number(a.role === component.role)))
        .slice(0, 6),
    [components, component],
  );
  const fileName = component.file.split('/').pop() ?? 'component.html';

  const withSource = async (run: (text: string) => void | Promise<void>) => {
    try {
      await run(source ?? (await fetchSource(component)));
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The source could not be loaded.', { tone: 'error' });
    }
  };

  return (
    <div className="page viewer">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Library</Link>
        <Icon name="right" size={12} />
        <Link to={`/?theme=${encodeURIComponent(component.themeSlug)}`}>{component.theme}</Link>
      </nav>

      <header className="viewer-head">
        <div>
          <h1 data-testid="viewer-title">{component.title}</h1>
          <p className="eyebrow">
            {roleLabelSingular(component.role)} · {component.theme}
            {component.kind === 'interactive' && <span className="pill">Interactive</span>}
          </p>
        </div>
        <div className="viewer-actions">
          <button
            type="button"
            className="btn"
            aria-pressed={favourite}
            data-testid="viewer-favourite"
            onClick={() => actions.toggleFavourite(component)}
          >
            <Icon name="heart" filled={favourite} /> {favourite ? 'Favourited' : 'Favourite'}
          </button>
          <button type="button" className="btn" onClick={() => actions.addToCollection(component.id)} data-testid="viewer-collect">
            <Icon name="folder" /> Add to collection
            {inCollections.length > 0 && <span className="count-pill">{inCollections.length}</span>}
          </button>
          <button type="button" className="btn" aria-pressed={comparing} onClick={() => actions.toggleCompare(component)}>
            <Icon name="compare" /> {comparing ? 'In comparison' : 'Compare'}
          </button>
          <button
            type="button"
            className="btn"
            title="Copy a link that opens this page"
            data-testid="copy-link"
            onClick={async () => {
              const ok = await copyText(shareUrl(component.id));
              toast(ok ? 'Link copied. It always opens this exact component.' : 'Copying was blocked by the browser.', {
                tone: ok ? 'success' : 'error',
              });
            }}
          >
            <Icon name="link" /> Copy link
          </button>
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-primary btn-ai"
              data-testid="copy-for-ai"
              disabled={component.status !== 'ok'}
              onClick={() => actions.copyForAi(component)}
            >
              <Icon name="copy" /> COPY FOR AI
            </button>
            <button
              type="button"
              className="btn btn-primary btn-ai"
              aria-label="Copy for AI options"
              title="Choose quick or detailed instructions, and whether to include the source code"
              data-testid="copy-for-ai-options"
              disabled={component.status !== 'ok'}
              onClick={() => actions.copyOptions(component.id)}
            >
              <Icon name="chevron" />
            </button>
          </div>
        </div>
      </header>

      <section className="stage-wrap" aria-label="Live preview">
        <div className="stage-toolbar">
          <div className="stage-group">
            <button type="button" className="btn btn-small" onClick={() => { setPaused(false); setRestart((n) => n + 1); }} data-testid="restart">
              <Icon name="restart" size={14} /> Restart
            </button>
            <button
              type="button"
              className="btn btn-small"
              aria-pressed={paused}
              disabled={previewState !== 'ready'}
              data-testid="pause"
              onClick={() => setPaused((p) => !p)}
            >
              <Icon name={paused ? 'play' : 'pause'} size={14} /> {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <Segmented<ViewportKey>
            label="Preview size"
            value={viewport}
            onChange={setViewport}
            options={[
              { value: 'fit', label: 'Fit', icon: 'expand', title: 'Fill the available space' },
              { value: 'desktop', label: 'Desktop', icon: 'desktop', title: 'Desktop screen (1280 × 800)' },
              { value: 'tablet', label: 'Tablet', icon: 'tablet', title: 'Tablet (820 × 1180)' },
              { value: 'phone', label: 'Phone', icon: 'phone', title: 'Phone (390 × 844)' },
              { value: 'custom', label: 'Custom', icon: 'edit', title: 'Choose your own width and height' },
            ]}
          />
          {viewport === 'custom' && (
            <div className="stage-group">
              <label className="size-input">
                W
                <input
                  type="number"
                  min={120}
                  max={2560}
                  value={custom.width}
                  aria-label="Preview width in pixels"
                  onChange={(e) => setCustom((c) => ({ ...c, width: Math.max(120, Math.min(2560, Number(e.target.value) || 120)) }))}
                />
              </label>
              <label className="size-input">
                H
                <input
                  type="number"
                  min={120}
                  max={2560}
                  value={custom.height}
                  aria-label="Preview height in pixels"
                  onChange={(e) => setCustom((c) => ({ ...c, height: Math.max(120, Math.min(2560, Number(e.target.value) || 120)) }))}
                />
              </label>
            </div>
          )}
          <Segmented<'dark' | 'light'>
            label="Component colour mode"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark', icon: 'moon', title: 'Show the component’s dark version' },
              {
                value: 'light',
                label: 'Light',
                icon: 'sun',
                title: component.lightReady ? 'Show the component’s light version' : 'This component has no light version',
              },
            ]}
          />
          <div className="stage-group" role="group" aria-label="Preview background">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.label}
                type="button"
                className="bg-swatch"
                aria-pressed={background === b.value}
                aria-label={`Background: ${b.label}`}
                title={`Background: ${b.label}`}
                style={b.value ? { background: b.value } : undefined}
                data-original={b.value === null ? '' : undefined}
                onClick={() => setBackground(b.value)}
              />
            ))}
            <label className="bg-swatch bg-custom" title="Pick any background colour">
              <input
                type="color"
                value={background ?? '#101014'} // style-ok
                aria-label="Custom background colour"
                onChange={(e) => setBackground(e.target.value)}
              />
            </label>
          </div>
          <a className="btn btn-small" href={originalUrl(component)} target="_blank" rel="noopener noreferrer" data-testid="open-original">
            <Icon name="external" size={14} /> Open original
          </a>
        </div>
        {theme === 'light' && !component.lightReady && (
          <p className="notice">This component only has a dark version, so the light setting has no effect. Try a background colour instead.</p>
        )}
        <div className="stage" data-viewport={viewport} data-testid="stage">
          <LivePreview
            component={component}
            theme={theme}
            mode="always"
            fit="contain"
            virtual={virtual}
            paused={paused}
            background={background}
            restartKey={restart}
            onStateChange={setPreviewState}
          />
        </div>
        <p className="stage-caption muted small">
          {virtual ? `Simulating a ${virtual.width} × ${virtual.height} screen. ` : ''}
          This is the real component running in a locked-down frame: it cannot see this site, your saved data or your sign-in.
          {component.microphone && ' Microphone features are switched off here.'}
        </p>
      </section>

      <div className="viewer-columns">
        <section className="panel">
          <h2>About this component</h2>
          {component.description ? <p className="lead">{component.description}</p> : <p className="muted">No description is available.</p>}
          {component.adapt.useWhen.length > 0 && (
            <>
              <h3>Good for</h3>
              <ul className="plain-list">{component.adapt.useWhen.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          )}
          {component.adapt.avoidWhen.length > 0 && (
            <>
              <h3>Think twice when</h3>
              <ul className="plain-list">{component.adapt.avoidWhen.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          )}
          {component.tags.length > 0 && (
            <>
              <h3>Tags</h3>
              <ul className="tags">
                {component.tags.map((tag) => (
                  <li key={tag}>
                    <Link className="tag tag-link" to={`/?q=${encodeURIComponent(tag)}`}>
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <h2>At a glance</h2>
          <dl className="facts">
            <Fact label="Type">{roleLabelSingular(component.role)}</Fact>
            <Fact label="Category">{component.theme}</Fact>
            {component.useCases.length > 0 && <Fact label="Intended uses">{facetList('useCases', component.useCases)}</Fact>}
            <Fact label="Interaction">
              {component.interaction.length ? facetList('interaction', component.interaction) : 'Not specified'}
            </Fact>
            {component.perf && (
              <Fact label="Performance" hint={valueHint('perf', component.perf)}>
                {valueLabel('perf', component.perf)}
              </Fact>
            )}
            {(component.motion || component.intensity) && (
              <Fact label="Animation">
                {[component.motion && valueLabel('motion', component.motion), component.intensity && `${valueLabel('intensity', component.intensity)} energy`]
                  .filter(Boolean)
                  .join(' · ')}
              </Fact>
            )}
            {component.style.length > 0 && <Fact label="Visual style">{facetList('style', component.style)}</Fact>}
            {component.mood.length > 0 && <Fact label="Mood">{component.mood.map((m) => valueLabel('mood', m)).join(', ')}</Fact>}
            {(component.bg || component.accent) && (
              <Fact label="Colours">
                <span className="colour-row">
                  {[component.bg, component.accent, ...component.colors]
                    .filter((v, i, list) => v && list.indexOf(v) === i)
                    .slice(0, 6)
                    .map((colour) => (
                      <span key={colour} className="colour-dot" style={{ background: colour }} title={colour} />
                    ))}
                  {component.scheme && <span>{valueLabel('scheme', component.scheme)}</span>}
                </span>
              </Fact>
            )}
            <Fact label="Accessibility">
              {[
                component.a11y.reducedMotion ? 'Respects “reduce motion”' : 'No reduced-motion support',
                component.a11y.keyboard ? 'keyboard-friendly' : 'not keyboard-operable as supplied',
                component.a11y.ariaLabeled ? 'labelled for screen readers' : 'no screen-reader label',
              ].join(' · ')}
            </Fact>
            <Fact label="Needs">
              {component.externalFonts || component.deps.length
                ? `Loads ${component.deps.length ? facetList('labels', component.deps) : 'Google Fonts'} from the internet`
                : 'Nothing extra — one self-contained file'}
            </Fact>
            {component.technique.length > 0 && <Fact label="Built with">{facetList('technique', component.technique)}</Fact>}
          </dl>
        </section>
      </div>

      {(component.adapt.editableAreas.length > 0 ||
        component.adapt.preserveElements.length > 0 ||
        component.adapt.knownLimitations.length > 0 ||
        component.adapt.agentPrompt) && (
        <section className="panel">
          <h2>Implementation notes</h2>
          <p className="muted small">
            Guidance from the component’s author. “Copy for AI” passes these on to your AI agent automatically — you don’t need to act on them
            yourself.
          </p>
          <div className="notes-grid">
            {component.adapt.editableAreas.length > 0 && (
              <div>
                <h3>Safe to change</h3>
                <ul className="plain-list">{component.adapt.editableAreas.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
            {component.adapt.preserveElements.length > 0 && (
              <div>
                <h3>Must be kept</h3>
                <ul className="plain-list">{component.adapt.preserveElements.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
            {component.adapt.knownLimitations.length > 0 && (
              <div>
                <h3>Known limitations</h3>
                <ul className="plain-list">{component.adapt.knownLimitations.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
          </div>
          {component.adapt.agentPrompt && (
            <details className="advanced">
              <summary>Author’s example change request</summary>
              <p>{component.adapt.agentPrompt}</p>
            </details>
          )}
        </section>
      )}

      <section className="panel" aria-label="Source">
        <h2>Source</h2>
        <div className="source-actions">
          <button
            type="button"
            className="btn"
            data-testid="copy-source"
            disabled={component.status !== 'ok'}
            onClick={() =>
              withSource(async (text) => {
                const ok = await copyText(text);
                toast(ok ? 'Source code copied.' : 'Copying was blocked by the browser.', { tone: ok ? 'success' : 'error' });
              })
            }
          >
            <Icon name="copy" /> Copy source code
          </button>
          <button
            type="button"
            className="btn"
            data-testid="download-source"
            disabled={component.status !== 'ok'}
            onClick={() => withSource((text) => downloadText(fileName, text, 'text/html'))}
          >
            <Icon name="download" /> Download original HTML
          </button>
          <a className="btn" href={githubUrl(component, site)} target="_blank" rel="noopener noreferrer">
            <Icon name="external" /> View on GitHub
          </a>
        </div>
        <CopyField label="File path" value={repoPath(component, site)} testId="copy-path" />
        <CopyField label="Raw source URL" value={rawUrl(component, site)} testId="copy-raw-url" />
        <p className="muted small">
          {formatBytes(component.bytes)}
          {component.loc ? ` · about ${component.loc} lines` : ''} · fingerprint {component.hash || '—'}
        </p>
        {sourceError && <p className="notice notice-error">{sourceError}</p>}
        <details className="advanced" open={showSource} onToggle={(e) => setShowSource((e.target as HTMLDetailsElement).open)}>
          <summary>
            <Icon name="code" size={14} /> View the source code (advanced)
          </summary>
          {showSource && <pre className="source-code" tabIndex={0}>{source ?? (sourceError ? 'Unavailable.' : 'Loading…')}</pre>}
        </details>
      </section>

      {similar.length > 0 && (
        <section aria-label="Similar components">
          <h2 className="section-title">Similar components</h2>
          <div className="grid" data-density="comfortable">
            {similar.map((c) => (
              <ComponentCard
                key={c.id}
                component={c}
                density="comfortable"
                theme={resolvedTheme(prefs.theme)}
                favourite={c.id in data.favourites}
                comparing={prefs.compare.includes(c.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function Viewer() {
  const { byId } = useCatalogue();
  const id = useParams()['*'] ?? '';
  const component = byId.get(id.replace(/\/+$/, '').replace(/\.html$/i, ''));
  if (!component) return <Missing id={id} />;
  return <ViewerContent component={component} />;
}
