// Runs in front of EVERY request to the site, including component files and images.
// Nothing is served unless Cloudflare Access has signed the visitor in. If the two Access
// settings are missing, the site stays locked ("fail closed") instead of becoming public.
import { createKeyLoader, normaliseTeamDomain, tokenFromRequest, verifyAccessJwt } from '../shared/access-jwt.js';
import { isAppRoute, securityHeadersFor } from '../shared/security-headers.js';

const loaders = new Map();
function keyLoaderFor(teamDomain) {
  if (!loaders.has(teamDomain)) loaders.set(teamDomain, createKeyLoader(teamDomain));
  return loaders.get(teamDomain);
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function locked(status, title, detail) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>:root{color-scheme:dark light}body{margin:0;min-height:100vh;display:grid;place-items:center;background:Canvas;color:CanvasText;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:420px;padding:32px}h1{font-size:18px;margin:0 0 8px}p{margin:0;opacity:.7}</style></head><body><main><h1>${title}</h1><p>${detail}</p></main></body></html>`;
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}

async function authorise(request, env) {
  const url = new URL(request.url);
  if (env.LOCAL_DEV_NO_AUTH === 'true' && isLocalHost(url.hostname)) return { ok: true };

  const teamDomain = normaliseTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const aud = String(env.ACCESS_AUD || '').trim();
  if (!teamDomain || !aud) {
    return {
      ok: false,
      response: locked(
        403,
        'This site is locked',
        'Private sign-in has not been set up yet, so nothing can be shown. See the deployment guide.',
      ),
    };
  }

  let result;
  try {
    result = await verifyAccessJwt(tokenFromRequest(request), { teamDomain, aud, getKeys: keyLoaderFor(teamDomain) });
  } catch {
    return { ok: false, response: locked(503, 'Sign-in check unavailable', 'Please try again in a moment.') };
  }
  if (!result.ok) {
    return { ok: false, response: locked(403, 'Sign-in required', 'You need to sign in through Cloudflare Access to view this site.') };
  }

  const allowed = String(env.ACCESS_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(result.email)) {
    return { ok: false, response: locked(403, 'Not allowed', 'This account is not on the list for this site.') };
  }
  return { ok: true };
}

/**
 * @param {{ request: Request, env: Record<string, any>, next: () => Promise<Response> }} context
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const auth = await authorise(request, env);
  if (!auth.ok) return /** @type {Response} */ (auth.response);

  const url = new URL(request.url);
  const { pathname } = url;
  // Dashboard pages such as /c/buttons/01-magnetic-button are all served by the one app page.
  const upstream = isAppRoute(pathname) ? await env.ASSETS.fetch(new Request(new URL('/', url), request)) : await next();
  const response = new Response(upstream.body, upstream);
  for (const [name, value] of Object.entries(securityHeadersFor(pathname))) response.headers.set(name, value);
  return response;
}
