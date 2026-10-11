import { useEffect, useMemo } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ActionsProvider } from './components/Actions';
import { ComponentBrowser } from './components/ComponentBrowser';
import { Icon } from './components/Icon';
import { EmptyState, ToastProvider } from './components/ui';
import { CatalogueProvider, useCatalogue } from './lib/catalogue';
import type { CatalogueComponent } from './lib/types';
import { comparePath } from './lib/urls';
import { CollectionDetail, Collections } from './pages/Collections';
import { Compare } from './pages/Compare';
import { Settings } from './pages/Settings';
import { Viewer } from './pages/Viewer';
import { resolvedTheme, setPrefs, usePrefs } from './store/prefs';
import { userStore, useUserData } from './store/userData';

function Browse() {
  const { components, meta } = useCatalogue();
  useEffect(() => {
    document.title = meta.site.siteName;
  }, [meta.site.siteName]);
  return (
    <ComponentBrowser
      pool={components}
      title="Library"
      searchPlaceholder={`Search ${components.length.toLocaleString('en-GB')} components — try “toggle”, “loader” or “calm background”`}
      showRecent
    />
  );
}

function Favourites() {
  const { byId, removedById, meta } = useCatalogue();
  const data = useUserData();
  useEffect(() => {
    document.title = `Favourites · ${meta.site.siteName}`;
  }, [meta.site.siteName]);
  const ids = useMemo(
    () => Object.entries(data.favourites).sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id),
    [data.favourites],
  );
  const pool = useMemo(() => ids.map((id) => byId.get(id)).filter((c): c is CatalogueComponent => !!c), [ids, byId]);
  const gone = ids.filter((id) => !byId.has(id));
  return (
    <ComponentBrowser
      pool={pool}
      title="Favourites"
      searchPlaceholder="Search your favourites"
      intro={
        <>
          <p className="muted">
            Saved in this browser on this device only — not synced to your other devices.{' '}
            <Link to="/settings#backup">Back up or move them</Link>.
          </p>
          {gone.length > 0 && (
            <p className="notice">
              {gone.length} favourite{gone.length === 1 ? ' is' : 's are'} no longer in the library (
              {gone.map((id) => removedById.get(id)?.title ?? id).join(', ')}).{' '}
              <button type="button" className="link-btn" onClick={() => gone.forEach((id) => userStore.toggleFavourite(id))}>
                Remove {gone.length === 1 ? 'it' : 'them'}
              </button>
            </p>
          )}
        </>
      }
      emptyPool={
        <EmptyState
          icon="heart"
          title="No favourites yet"
          action={
            <Link className="btn btn-primary" to="/">
              Browse the library
            </Link>
          }
        >
          <p>
            Press the heart on any component to keep it here. Favourites are remembered in this browser, even after the library is updated.
          </p>
        </EmptyState>
      }
    />
  );
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState
        icon="alert"
        title="Page not found"
        action={
          <Link className="btn btn-primary" to="/">
            Go to the library
          </Link>
        }
      >
        <p>That address doesn’t match anything here.</p>
      </EmptyState>
    </div>
  );
}

function CompareTray() {
  const prefs = usePrefs();
  const { byId } = useCatalogue();
  const location = useLocation();
  if (!prefs.compare.length || location.pathname === '/compare') return null;
  return (
    <div className="tray" role="region" aria-label="Comparison selection" data-testid="compare-tray">
      <Icon name="compare" />
      <ul>
        {prefs.compare.map((id) => (
          <li key={id}>
            <span className="chip">
              {byId.get(id)?.title ?? 'Removed component'}
              <button
                type="button"
                aria-label={`Remove ${byId.get(id)?.title ?? id} from comparison`}
                onClick={() => setPrefs({ compare: prefs.compare.filter((c) => c !== id) })}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Link className="btn btn-primary btn-small" to={comparePath(prefs.compare)} data-testid="open-compare">
        {prefs.compare.length < 2 ? 'Add one more to compare' : `Compare ${prefs.compare.length}`}
      </Link>
      <button type="button" className="link-btn" onClick={() => setPrefs({ compare: [] })}>
        Clear
      </button>
    </div>
  );
}

function Shell() {
  const prefs = usePrefs();
  const data = useUserData();
  const { meta } = useCatalogue();
  const theme = resolvedTheme(prefs.theme);
  const favouriteCount = Object.keys(data.favourites).length;
  const nav = [
    { to: '/', label: 'Library', icon: 'grid', end: true, count: 0 },
    { to: '/favourites', label: 'Favourites', icon: 'heart', end: false, count: favouriteCount },
    { to: '/collections', label: 'Collections', icon: 'folder', end: false, count: data.collections.length },
    { to: comparePath(prefs.compare), label: 'Compare', icon: 'compare', end: false, count: prefs.compare.length },
    { to: '/settings', label: 'Settings', icon: 'settings', end: false, count: 0 },
  ];
  return (
    <ActionsProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label={`${meta.site.siteName} — home`}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{meta.site.siteName}</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.label} to={item.to} end={item.end} className="nav-link" title={item.label}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.count > 0 && <span className="count-pill">{item.count}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="icon-btn theme-toggle"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          data-testid="theme-toggle"
          onClick={() => setPrefs({ theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
      </header>
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/collections/:id" element={<CollectionDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/c/*" element={<Viewer />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <CompareTray />
    </ActionsProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <CatalogueProvider>
          <Shell />
        </CatalogueProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
