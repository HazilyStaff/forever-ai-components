// Display preferences for this browser (theme, gallery density, sort order, AI handoff
// defaults and the current comparison selection). Kept apart from favourites and collections
// because they are device-specific and are not part of a backup.
import { useSyncExternalStore } from 'react';
import type { AiMode } from '../lib/prompts';
import type { Density, SortKey } from '../lib/types';

export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  density: Density;
  sort: SortKey;
  aiMode: AiMode;
  /** null = follow the site default (on when the repository is private). */
  aiIncludeSource: boolean | null;
  compare: string[];
  filtersOpen: boolean;
}

export const PREFS_KEY = 'fc.prefs.v1';
export const COMPARE_LIMIT = 4;

const DEFAULTS: Prefs = {
  theme: 'dark',
  density: 'comfortable',
  sort: 'default',
  aiMode: 'quick',
  aiIncludeSource: null,
  compare: [],
  filtersOpen: true,
};

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'system' ? p.theme : 'dark',
      density: p.density === 'compact' || p.density === 'large' ? p.density : 'comfortable',
      sort: (['default', 'name', 'category', 'type', 'lightest', 'recent', 'relevance'] as SortKey[]).includes(p.sort as SortKey)
        ? (p.sort as SortKey)
        : 'default',
      aiMode: p.aiMode === 'detailed' ? 'detailed' : 'quick',
      aiIncludeSource: typeof p.aiIncludeSource === 'boolean' ? p.aiIncludeSource : null,
      compare: Array.isArray(p.compare) ? p.compare.filter((x) => typeof x === 'string').slice(0, COMPARE_LIMIT) : [],
      filtersOpen: p.filtersOpen !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs: Prefs = typeof window === 'undefined' ? { ...DEFAULTS } : load();
const listeners = new Set<() => void>();

export function resolvedTheme(theme: Prefs['theme'] = prefs.theme): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolvedTheme());
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* preferences are a convenience; ignore storage failures */
  }
  if (patch.theme) applyTheme();
  for (const l of listeners) l();
}

export function getPrefs(): Prefs {
  return prefs;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs);
}

/** Adds or removes a component from the comparison. Returns what happened. */
export function toggleCompare(id: string): 'added' | 'removed' | 'full' {
  if (prefs.compare.includes(id)) {
    setPrefs({ compare: prefs.compare.filter((c) => c !== id) });
    return 'removed';
  }
  if (prefs.compare.length >= COMPARE_LIMIT) return 'full';
  setPrefs({ compare: [...prefs.compare, id] });
  return 'added';
}

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (prefs.theme === 'system') {
      applyTheme();
      for (const l of listeners) l();
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === PREFS_KEY) {
      prefs = load();
      applyTheme();
      for (const l of listeners) l();
    }
  });
}
