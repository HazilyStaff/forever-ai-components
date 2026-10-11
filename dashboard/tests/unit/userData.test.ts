import { describe, expect, it } from 'vitest';
import { MemoryAdapter, parseBackup, sanitiseUserData, UserDataStore } from '../../src/store/userData';

const store = () => new UserDataStore(new MemoryAdapter());

describe('favourites', () => {
  it('toggles with one call and remembers across a reload of the same storage', () => {
    const adapter = new MemoryAdapter();
    const first = new UserDataStore(adapter);
    expect(first.toggleFavourite('a/1')).toBe(true);
    first.toggleFavourite('a/2');
    expect(first.toggleFavourite('a/2')).toBe(false);
    const reloaded = new UserDataStore(adapter);
    expect(Object.keys(reloaded.getSnapshot().favourites)).toEqual(['a/1']);
  });

  it('keeps favourites for components that are not in the library at the moment', () => {
    const s = store();
    s.toggleFavourite('removed/upstream');
    expect(s.isFavourite('removed/upstream')).toBe(true);
  });
});

describe('collections', () => {
  it('creates, renames, deletes and restores', () => {
    const s = store();
    const c = s.createCollection('  My Dashboard  ');
    expect(c.name).toBe('My Dashboard');
    s.renameCollection(c.id, 'Login Page Ideas');
    expect(s.getSnapshot().collections[0].name).toBe('Login Page Ideas');
    s.renameCollection(c.id, '   ');
    expect(s.getSnapshot().collections[0].name).toBe('Login Page Ideas');
    const removed = s.deleteCollection(c.id)!;
    expect(s.getSnapshot().collections).toHaveLength(0);
    s.restoreCollection(removed);
    expect(s.getSnapshot().collections[0].name).toBe('Login Page Ideas');
  });

  it('adds without duplicates, lets one component live in several collections, and removes', () => {
    const s = store();
    const a = s.createCollection('A');
    s.createCollection('B', 'x/1');
    s.addToCollection(a.id, 'x/1');
    s.addToCollection(a.id, 'x/1');
    s.addToCollection(a.id, 'x/2');
    const [ca, cb] = s.getSnapshot().collections;
    expect(ca.items.map((i) => i.id)).toEqual(['x/1', 'x/2']);
    expect(cb.items.map((i) => i.id)).toEqual(['x/1']);
    s.removeFromCollection(a.id, 'x/1');
    expect(s.getSnapshot().collections[0].items.map((i) => i.id)).toEqual(['x/2']);
    expect(s.getSnapshot().collections[1].items).toHaveLength(1);
  });

  it('stores a note per selection and reorders manually', () => {
    const s = store();
    const c = s.createCollection('Order');
    for (const id of ['a', 'b', 'c', 'd']) s.addToCollection(c.id, id);
    s.setNote(c.id, 'b', 'Use for the settings switch');
    s.moveItem(c.id, 'd', 0);
    s.moveItem(c.id, 'a', 99);
    s.moveItem(c.id, 'missing', 1);
    const items = s.getSnapshot().collections[0].items;
    expect(items.map((i) => i.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(items[1].note).toBe('Use for the settings switch');
  });

  it('tracks recently viewed, newest first, without repeats', () => {
    const s = store();
    for (const id of ['a', 'b', 'a', 'c']) s.markViewed(id);
    expect(s.getSnapshot().recent).toEqual(['c', 'a', 'b']);
  });
});

describe('backup and restore', () => {
  const filled = () => {
    const s = store();
    s.toggleFavourite('a/1');
    const c = s.createCollection('Buttons and Toggles', 'a/1');
    s.addToCollection(c.id, 'a/2');
    s.setNote(c.id, 'a/2', 'note two');
    return s;
  };

  it('round-trips through an exported file', () => {
    const source = filled();
    const file = JSON.stringify(source.exportBackup());
    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toEqual({ favourites: 1, collections: 1, items: 2 });
    const target = store();
    target.importBackup(parsed.data, 'replace');
    expect(target.getSnapshot().favourites).toHaveProperty('a/1');
    expect(target.getSnapshot().collections[0].items[1].note).toBe('note two');
  });

  it('merging keeps what was there and adds what is new', () => {
    const target = store();
    target.toggleFavourite('mine/1');
    const mine = target.createCollection('Buttons and Toggles', 'mine/1');
    const parsed = parseBackup(JSON.stringify(filled().exportBackup()));
    if (!parsed.ok) throw new Error('backup should parse');
    target.importBackup(parsed.data, 'merge');
    const data = target.getSnapshot();
    expect(Object.keys(data.favourites).sort()).toEqual(['a/1', 'mine/1']);
    expect(data.collections).toHaveLength(1);
    expect(data.collections[0].id).toBe(mine.id);
    expect(data.collections[0].items.map((i) => i.id)).toEqual(['mine/1', 'a/1', 'a/2']);
  });

  it('an import can be undone', () => {
    const target = store();
    target.toggleFavourite('keep/me');
    const parsed = parseBackup(JSON.stringify(filled().exportBackup()));
    if (!parsed.ok) throw new Error('backup should parse');
    target.importBackup(parsed.data, 'replace');
    expect(target.isFavourite('keep/me')).toBe(false);
    expect(target.undoImport()).toBe(true);
    expect(target.isFavourite('keep/me')).toBe(true);
    expect(target.undoImport()).toBe(false);
  });

  it('rejects files that are not backups, with a plain message', () => {
    for (const bad of ['not json', '{}', '{"app":"other","data":{}}', '[1,2,3]']) {
      const result = parseBackup(bad);
      expect(result.ok).toBe(false);
    }
    expect(parseBackup(JSON.stringify({ app: 'forever-components', version: 99, data: {} })).ok).toBe(false);
  });

  it('cleans up malformed stored data instead of crashing', () => {
    const data = sanitiseUserData({
      favourites: ['a/1', 5, ''],
      collections: [{ name: '', items: ['x', 'x', { id: 'y', note: 7 }, null] }, 'junk', { id: 'same' }, { id: 'same' }],
      recent: ['a', 1],
    });
    expect(Object.keys(data.favourites)).toEqual(['a/1']);
    expect(data.collections[0].name).toBe('Untitled collection');
    expect(data.collections[0].items.map((i) => i.id)).toEqual(['x', 'y']);
    expect(new Set(data.collections.map((c) => c.id)).size).toBe(3);
    expect(data.recent).toEqual(['a']);
    expect(sanitiseUserData(null).collections).toEqual([]);
  });
});
