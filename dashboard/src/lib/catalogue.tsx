import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Catalogue, CatalogueComponent, RemovedComponent } from './types';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; catalogue: Catalogue };

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** Tolerates missing or odd fields so one bad record can never break the gallery. */
export function hydrateComponent(raw: Record<string, unknown>, order: number): CatalogueComponent | null {
  const id = text(raw.id);
  const file = text(raw.file);
  if (!id || !file) return null;
  const a11y = (raw.a11y ?? {}) as Record<string, unknown>;
  const adapt = (raw.adapt ?? {}) as Record<string, unknown>;
  const interaction = arr(raw.interaction);
  const status = raw.status === 'missing' || raw.status === 'broken' ? raw.status : 'ok';
  return {
    id,
    file,
    title: text(raw.title, id),
    theme: text(raw.theme, 'Uncategorised'),
    themeSlug: text(raw.themeSlug, 'uncategorised'),
    role: text(raw.role, 'other') || 'other',
    description: text(raw.description),
    technique: arr(raw.technique),
    style: arr(raw.style),
    motion: text(raw.motion),
    intensity: text(raw.intensity),
    interaction,
    perf: text(raw.perf),
    scheme: text(raw.scheme),
    tone: text(raw.tone),
    bg: text(raw.bg),
    accent: text(raw.accent),
    colors: arr(raw.colors),
    deps: arr(raw.deps),
    useCases: arr(raw.useCases),
    mood: arr(raw.mood),
    labels: arr(raw.labels),
    tags: arr(raw.tags),
    a11y: {
      reducedMotion: a11y.reducedMotion === true,
      keyboard: a11y.keyboard === true,
      ariaLabeled: a11y.ariaLabeled === true,
      seizureSafe: a11y.seizureSafe !== false,
    },
    loc: typeof raw.loc === 'number' ? raw.loc : 0,
    bytes: typeof raw.bytes === 'number' ? raw.bytes : 0,
    hash: text(raw.hash),
    status,
    issues: arr(raw.issues),
    indexed: raw.indexed !== false,
    lightReady: raw.lightReady === true,
    externalFonts: raw.externalFonts === true,
    microphone: raw.microphone === true,
    adapt: {
      useWhen: arr(adapt.useWhen),
      avoidWhen: arr(adapt.avoidWhen),
      agentPrompt: text(adapt.agentPrompt),
      editableAreas: arr(adapt.editableAreas),
      preserveElements: arr(adapt.preserveElements),
      knownLimitations: arr(adapt.knownLimitations),
    },
    kind: interaction.some((i) => i !== 'autonomous') ? 'interactive' : 'passive',
    order,
  };
}

export function hydrateCatalogue(data: any): Catalogue {
  const components: CatalogueComponent[] = [];
  const byId = new Map<string, CatalogueComponent>();
  const list: unknown[] = Array.isArray(data?.components) ? data.components : [];
  list.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const component = hydrateComponent(raw as Record<string, unknown>, index);
    if (!component || byId.has(component.id)) return;
    byId.set(component.id, component);
    components.push(component);
  });
  const removed: RemovedComponent[] = (Array.isArray(data?.removed) ? data.removed : [])
    .filter((r: any) => r && typeof r.id === 'string')
    .map((r: any) => ({ id: r.id, title: text(r.title, r.id), removedAt: text(r.removedAt) }));
  return {
    meta: data.meta,
    themes: data.themes ?? {},
    components,
    removed,
    byId,
    removedById: new Map(removed.map((r) => [r.id, r])),
  };
}

const CatalogueContext = createContext<Catalogue | null>(null);

export function useCatalogue(): Catalogue {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error('Catalogue is not loaded yet.');
  return value;
}

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch('/data/catalogue.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`The library list could not be loaded (error ${response.status}).`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', catalogue: hydrateCatalogue(data) });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'The library list could not be loaded.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state.status === 'loading') {
    return (
      <div className="boot" role="status" aria-live="polite">
        <div className="boot-mark" aria-hidden="true" />
        <p>Loading your library…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="boot" role="alert">
        <h1>Couldn’t load the library</h1>
        <p>{state.message}</p>
        <p className="muted">Check your connection, then try again. If you were signed out, reloading will ask you to sign in.</p>
        <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }
  return <CatalogueContext.Provider value={state.catalogue}>{children}</CatalogueContext.Provider>;
}
