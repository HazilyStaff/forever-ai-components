// One place that decides which security headers each kind of response gets.
// Used by the Cloudflare Pages middleware (production) and the Vite dev server (local).

const COMPONENT_PATHS = ['/infinite/', '/preview/'];

/** Component files are untrusted: they run without an origin and cannot call back to the site. */
export const COMPONENT_CSP = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com data:',
  'img-src data: blob:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ');

/** The dashboard itself: only its own files, no inline script, cannot be framed. */
export const APP_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Addresses handled by the dashboard itself (it reads the address and shows the right page). */
export function isAppRoute(pathname) {
  return (
    ['/favourites', '/collections', '/compare', '/settings'].includes(pathname.replace(/\/+$/, '')) ||
    pathname.startsWith('/collections/') ||
    pathname.startsWith('/c/')
  );
}

export function isComponentPath(pathname) {
  return COMPONENT_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * @param {string} pathname
 * @param {{ appCsp?: boolean }} [options] appCsp is switched off for the Vite dev server only.
 * @returns {Record<string, string>}
 */
export function securityHeadersFor(pathname, options = {}) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (isComponentPath(pathname)) {
    headers['Content-Security-Policy'] = COMPONENT_CSP;
    // Addresses carry the file's fingerprint (?v=…), so a changed component gets a new address.
    headers['Cache-Control'] = 'private, max-age=604800';
    return headers;
  }
  if (options.appCsp !== false) headers['Content-Security-Policy'] = APP_CSP;
  headers['X-Frame-Options'] = 'DENY';
  headers['Cache-Control'] = pathname.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'private, no-cache';
  return headers;
}
