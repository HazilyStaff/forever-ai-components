// Favourites, collections, notes and recently viewed.
//
// Everything is kept in this browser only (localStorage). The data is tiny — ids, names and
// notes — so one small JSON document is the best fit. All reads and writes go through the
// StorageAdapter interface, so a cloud-backed adapter can be added later for cross-device
// sync without touching the rest of the app.
import { useSyncExternalStore } from 'react';

export interface CollectionItem {
  id: string;
  note: string;
  addedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: CollectionItem[];
}

export interface UserData {
  version: 1;
  updatedAt: string;
  /** component id → date it was favourited */
  favourites: Record<string, string>;
  collections: Collection[];
  /** most recent first */
  recent: string[];
}

export interface BackupFile {
  app: 'forever-components';
  kind: 'backup';
  version: 1;
  exportedAt: string;
  data: Pick<UserData, 'favourites' | 'collections'>;
}

export interface StorageAdapter {
  load(): UserData | null;
  save(data: UserData): void;
  /** Keeps one copy of the data as it was before an import, so the import can be undone. */
  saveUndo(data: UserData): void;
  loadUndo(): UserData | null;
  clearUndo(): void;
  /** Calls back when another tab (or, in future, another device) changes the data. */
  subscribe(onExternalChange: () => void): () => void;
}

export const STORAGE_KEY = 'fc.userdata.v1';
const UNDO_KEY = 'fc.userdata.v1.before-import';
const RECENT_LIMIT = 24;
export const COLLECTION_NAME_LIMIT = 80;
export const NOTE_LIMIT = 2000;

const nowIso = () => new Date().toISOString();

export function emptyUserData(): UserData {
  return { version: 1, updatedAt: nowIso(), favourites: {}, collections: [], recent: [] };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 300;

/** Accepts anything and returns well-formed data, dropping whatever is malformed. */
export function sanitiseUserData(input: unknown): UserData {
  const out = emptyUserData();
  if (!isRecord(input)) return out;
  if (isRecord(input.favourites)) {
    for (const [id, when] of Object.entries(input.favourites)) {
      if (isId(id)) out.favourites[id] = typeof when === 'string' ? when : nowIso();
    }
  } else if (Array.isArray(input.favourites)) {
    for (const id of input.favourites) if (isId(id)) out.favourites[id] = nowIso();
  }
  if (Array.isArray(input.collections)) {
    const usedIds = new Set<string>();
    for (const raw of input.collections) {
      if (!isRecord(raw)) continue;
      let id = typeof raw.id === 'string' && raw.id ? raw.id : newId();
      if (usedIds.has(id)) id = newId();
      usedIds.add(id);
      const seen = new Set<string>();
      const items: CollectionItem[] = [];
      for (const item of Array.isArray(raw.items) ? raw.items : []) {
        const itemId = isRecord(item) ? item.id : item;
        if (!isId(itemId) || seen.has(itemId)) continue;
        seen.add(itemId);
        items.push({
          id: itemId,
          note: isRecord(item) && typeof item.note === 'string' ? item.note.slice(0, NOTE_LIMIT) : '',
          addedAt: isRecord(item) && typeof item.addedAt === 'string' ? item.addedAt : nowIso(),
        });
      }
      out.collections.push({
        id,
        name: (typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled collection').slice(0, COLLECTION_NAME_LIMIT),
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
        items,
      });
    }
  }
  if (Array.isArray(input.recent)) out.recent = input.recent.filter(isId).slice(0, RECENT_LIMIT);
  if (typeof input.updatedAt === 'string') out.updatedAt = input.updatedAt;
  return out;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class LocalStorageAdapter implements StorageAdapter {
  private read(key: string): UserData | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? sanitiseUserData(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  load() {
    return this.read(STORAGE_KEY);
  }
  save(data: UserData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  saveUndo(data: UserData) {
    window.localStorage.setItem(UNDO_KEY, JSON.stringify(data));
  }
  loadUndo() {
    return this.read(UNDO_KEY);
  }
  clearUndo() {
    window.localStorage.removeItem(UNDO_KEY);
  }
  subscribe(onExternalChange: () => void) {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) onExternalChange();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

export class MemoryAdapter implements StorageAdapter {
  private data: UserData | null = null;
  private undo: UserData | null = null;
  load() {
    return this.data ? structuredClone(this.data) : null;
  }
  save(data: UserData) {
    this.data = structuredClone(data);
  }
  saveUndo(data: UserData) {
    this.undo = structuredClone(data);
  }
  loadUndo() {
    return this.undo ? structuredClone(this.undo) : null;
  }
  clearUndo() {
    this.undo = null;
  }
  subscribe() {
    return () => {};
  }
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  favourites: number;
  collections: number;
  items: number;
}

export function parseBackup(text: string): { ok: true; data: UserData; summary: ImportSummary } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file could not be read. Choose a backup file exported from this site.' };
  }
  if (!isRecord(parsed) || parsed.app !== 'forever-components' || !isRecord(parsed.data)) {
    return { ok: false, message: 'That file is not a Forever Components backup.' };
  }
  if (typeof parsed.version === 'number' && parsed.version > 1) {
    return { ok: false, message: 'That backup was made by a newer version of this site. Update the site, then try again.' };
  }
  const data = sanitiseUserData(parsed.data);
  return {
    ok: true,
    data,
    summary: {
      favourites: Object.keys(data.favourites).length,
      collections: data.collections.length,
      items: data.collections.reduce((n, c) => n + c.items.length, 0),
    },
  };
}

export function mergeUserData(current: UserData, incoming: UserData): UserData {
  const next: UserData = structuredClone(current);
  for (const [id, when] of Object.entries(incoming.favourites)) if (!next.favourites[id]) next.favourites[id] = when;
  for (const collection of incoming.collections) {
    const existing = next.collections.find((c) => c.id === collection.id) ?? next.collections.find((c) => c.name === collection.name);
    if (!existing) {
      next.collections.push(structuredClone(collection));
      continue;
    }
    for (const item of collection.items) {
      const mine = existing.items.find((i) => i.id === item.id);
      if (!mine) existing.items.push({ ...item });
      else if (!mine.note && item.note) mine.note = item.note;
    }
    existing.updatedAt = nowIso();
  }
  return next;
}

export class UserDataStore {
  private data: UserData;
  private readonly listeners = new Set<() => void>();
  private saveError: string | null = null;

  constructor(private readonly adapter: StorageAdapter) {
    this.data = adapter.load() ?? emptyUserData();
    adapter.subscribe(() => {
      this.data = adapter.load() ?? emptyUserData();
      this.emit();
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.data;
  getSaveError = () => this.saveError;

  private emit() {
    for (const l of this.listeners) l();
  }

  private commit(next: UserData) {
    next.updatedAt = nowIso();
    this.data = next;
    try {
      this.adapter.save(next);
      this.saveError = null;
    } catch {
      this.saveError = 'Your changes could not be saved in this browser. Storage may be full or blocked (for example in private browsing).';
    }
    this.emit();
  }

  private update(mutate: (draft: UserData) => void) {
    const draft = structuredClone(this.data);
    mutate(draft);
    this.commit(draft);
  }

  isFavourite(id: string) {
    return id in this.data.favourites;
  }

  toggleFavourite(id: string): boolean {
    const adding = !this.isFavourite(id);
    this.update((d) => {
      if (adding) d.favourites[id] = nowIso();
      else delete d.favourites[id];
    });
    return adding;
  }

  markViewed(id: string) {
    if (this.data.recent[0] === id) return;
    this.update((d) => {
      d.recent = [id, ...d.recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT);
    });
  }

  clearRecent() {
    this.update((d) => {
      d.recent = [];
    });
  }

  createCollection(name: string, firstItemId?: string): Collection {
    const collection: Collection = {
      id: newId(),
      name: name.trim().slice(0, COLLECTION_NAME_LIMIT) || 'Untitled collection',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      items: firstItemId ? [{ id: firstItemId, note: '', addedAt: nowIso() }] : [],
    };
    this.update((d) => {
      d.collections.push(collection);
    });
    return collection;
  }

  private withCollection(collectionId: string, mutate: (c: Collection) => void) {
    this.update((d) => {
      const c = d.collections.find((x) => x.id === collectionId);
      if (!c) return;
      mutate(c);
      c.updatedAt = nowIso();
    });
  }

  renameCollection(collectionId: string, name: string) {
    const trimmed = name.trim().slice(0, COLLECTION_NAME_LIMIT);
    if (!trimmed) return;
    this.withCollection(collectionId, (c) => {
      c.name = trimmed;
    });
  }

  deleteCollection(collectionId: string): Collection | undefined {
    const removed = this.data.collections.find((c) => c.id === collectionId);
    this.update((d) => {
      d.collections = d.collections.filter((c) => c.id !== collectionId);
    });
    return removed;
  }

  restoreCollection(collection: Collection) {
    this.update((d) => {
      if (!d.collections.some((c) => c.id === collection.id)) d.collections.push(structuredClone(collection));
    });
  }

  addToCollection(collectionId: string, componentId: string) {
    this.withCollection(collectionId, (c) => {
      if (!c.items.some((i) => i.id === componentId)) c.items.push({ id: componentId, note: '', addedAt: nowIso() });
    });
  }

  removeFromCollection(collectionId: string, componentId: string) {
    this.withCollection(collectionId, (c) => {
      c.items = c.items.filter((i) => i.id !== componentId);
    });
  }

  setNote(collectionId: string, componentId: string, note: string) {
    this.withCollection(collectionId, (c) => {
      const item = c.items.find((i) => i.id === componentId);
      if (item) item.note = note.slice(0, NOTE_LIMIT);
    });
  }

  /** Moves an item to a new position (0 = first). */
  moveItem(collectionId: string, componentId: string, toIndex: number) {
    this.withCollection(collectionId, (c) => {
      const from = c.items.findIndex((i) => i.id === componentId);
      if (from < 0) return;
      const target = Math.max(0, Math.min(c.items.length - 1, toIndex));
      const [item] = c.items.splice(from, 1);
      c.items.splice(target, 0, item);
    });
  }

  exportBackup(): BackupFile {
    return {
      app: 'forever-components',
      kind: 'backup',
      version: 1,
      exportedAt: nowIso(),
      data: { favourites: this.data.favourites, collections: this.data.collections },
    };
  }

  importBackup(incoming: UserData, mode: ImportMode) {
    this.adapter.saveUndo(this.data);
    const next = mode === 'replace' ? { ...structuredClone(incoming), recent: this.data.recent } : mergeUserData(this.data, incoming);
    this.commit(next);
  }

  canUndoImport() {
    return this.adapter.loadUndo() !== null;
  }

  undoImport(): boolean {
    const previous = this.adapter.loadUndo();
    if (!previous) return false;
    this.commit(previous);
    this.adapter.clearUndo();
    return true;
  }
}

function createDefaultAdapter(): StorageAdapter {
  try {
    const probe = '__fc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new LocalStorageAdapter();
  } catch {
    return new MemoryAdapter();
  }
}

export const storageIsPersistent = (() => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
})();

export const userStore = new UserDataStore(typeof window === 'undefined' ? new MemoryAdapter() : createDefaultAdapter());

export function useUserData(): UserData {
  return useSyncExternalStore(userStore.subscribe, userStore.getSnapshot);
}
