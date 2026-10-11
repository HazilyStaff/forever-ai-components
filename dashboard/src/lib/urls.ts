import type { CatalogueComponent, SiteConfig } from './types';

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
// Cloudflare Pages serves "name.html" at "/name", so the site's own addresses leave ".html" off.
const servedPath = (c: CatalogueComponent) => encodePath(c.file.replace(/\.html$/i, ''));

/** Address of a component's detail page inside the dashboard. */
export function viewerPath(id: string): string {
  return `/c/${encodePath(id)}`;
}

export function shareUrl(id: string): string {
  return `${window.location.origin}${viewerPath(id)}`;
}

/** Live preview copy (original + pause/colour bridge). The fingerprint keeps caches honest. */
export function previewUrl(c: CatalogueComponent, theme: 'dark' | 'light'): string {
  return `/preview/${servedPath(c)}?theme=${theme}&v=${c.hash}`;
}

/** The untouched original file. */
export function originalUrl(c: CatalogueComponent): string {
  return `/infinite/${servedPath(c)}?v=${c.hash}`;
}

export function repoPath(c: CatalogueComponent, site: SiteConfig): string {
  return `${site.componentsDir}/${c.file}`;
}

export function githubUrl(c: CatalogueComponent, site: SiteConfig): string {
  return `https://github.com/${site.repoOwner}/${site.repoName}/blob/${site.branch}/${encodePath(repoPath(c, site))}`;
}

export function rawUrl(c: CatalogueComponent, site: SiteConfig): string {
  return `https://raw.githubusercontent.com/${site.repoOwner}/${site.repoName}/${site.branch}/${encodePath(repoPath(c, site))}`;
}

export function comparePath(ids: string[]): string {
  return ids.length ? `/compare?ids=${ids.map(encodeURIComponent).join(',')}` : '/compare';
}
