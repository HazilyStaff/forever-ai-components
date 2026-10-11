// Small browser helpers: clipboard, downloads and fetching a component's original source.
import type { CatalogueComponent } from './types';
import { originalUrl } from './urls';

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the older method */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const sourceCache = new Map<string, Promise<string>>();

/** The complete, unmodified HTML of a component. Cached for the session. */
export function fetchSource(c: CatalogueComponent): Promise<string> {
  const key = `${c.id}@${c.hash}`;
  let pending = sourceCache.get(key);
  if (!pending) {
    pending = fetch(originalUrl(c)).then(async (response) => {
      const text = response.ok ? await response.text() : '';
      // A sign-in page or the site's own "not found" page is not component source.
      if (!response.ok || !text.trim() || text.includes('id="fc-app-root"')) {
        throw new Error(`The original file for “${c.title}” could not be loaded.`);
      }
      return text;
    });
    pending.catch(() => sourceCache.delete(key));
    sourceCache.set(key, pending);
  }
  return pending;
}

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches;
