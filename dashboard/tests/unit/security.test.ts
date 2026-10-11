import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/_middleware.js';
import { normaliseTeamDomain, verifyAccessJwt } from '../../shared/access-jwt.js';
import { APP_CSP, COMPONENT_CSP, isAppRoute, securityHeadersFor } from '../../shared/security-headers.js';

const TEAM = 'myteam.cloudflareaccess.com';
const AUD = 'a'.repeat(64);

const b64url = (input: ArrayBuffer | string) =>
  Buffer.from(typeof input === 'string' ? Buffer.from(input) : Buffer.from(input)).toString('base64url');

let keyPair: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };
let otherPair: CryptoKeyPair;

async function sign(payload: Record<string, unknown>, options: { key?: CryptoKey; kid?: string; alg?: string } = {}) {
  const header = b64url(JSON.stringify({ alg: options.alg ?? 'RS256', kid: options.kid ?? 'key-1', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', options.key ?? keyPair.privateKey, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(signature)}`;
}

const validClaims = (overrides: Record<string, unknown> = {}) => ({
  iss: `https://${TEAM}`,
  aud: [AUD],
  email: 'Me@Example.com',
  exp: Math.floor(Date.now() / 1000) + 600,
  nbf: Math.floor(Date.now() / 1000) - 10,
  ...overrides,
});

beforeAll(async () => {
  const algorithm = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  keyPair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  otherPair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  jwk = { ...(await crypto.subtle.exportKey('jwk', keyPair.publicKey)), kid: 'key-1' };
});

const getKeys = async () => [jwk];
const check = (token: string, overrides: Record<string, unknown> = {}) =>
  verifyAccessJwt(token, { teamDomain: TEAM, aud: AUD, getKeys, ...overrides });

describe('Cloudflare Access token check', () => {
  it('accepts a correctly signed token for this site', async () => {
    expect(await check(await sign(validClaims()))).toEqual({ ok: true, email: 'me@example.com' });
  });

  it.each([
    ['no token', async () => '', 'no-token'],
    ['garbage', async () => 'abc.def', 'malformed'],
    ['expired', async () => sign(validClaims({ exp: Math.floor(Date.now() / 1000) - 5 })), 'expired'],
    ['another site’s audience', async () => sign(validClaims({ aud: ['b'.repeat(64)] })), 'wrong-audience'],
    ['another team', async () => sign(validClaims({ iss: 'https://evil.cloudflareaccess.com' })), 'wrong-issuer'],
    ['signed by someone else', async () => sign(validClaims(), { key: otherPair.privateKey }), 'bad-signature'],
    ['unknown key id', async () => sign(validClaims(), { kid: 'nope' }), 'unknown-key'],
    ['unsigned "none" algorithm', async () => sign(validClaims(), { alg: 'none' }), 'unsupported-algorithm'],
  ])('rejects: %s', async (_name, make, reason) => {
    expect(await check(await make())).toEqual({ ok: false, reason });
  });

  it('rejects a token whose contents were altered after signing', async () => {
    const [h, , s] = (await sign(validClaims())).split('.');
    const forged = `${h}.${b64url(JSON.stringify(validClaims({ email: 'attacker@example.com' })))}.${s}`;
    expect(await check(forged)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('refuses to work when the settings are missing', async () => {
    const token = await sign(validClaims());
    expect(await check(token, { aud: '' })).toEqual({ ok: false, reason: 'not-configured' });
    expect(await check(token, { teamDomain: '' })).toEqual({ ok: false, reason: 'not-configured' });
  });

  it('understands the different ways a team name can be written', () => {
    expect(normaliseTeamDomain('MyTeam')).toBe(TEAM);
    expect(normaliseTeamDomain(`https://${TEAM}/`)).toBe(TEAM);
    expect(normaliseTeamDomain('evil.example.com')).toBe('');
    expect(normaliseTeamDomain('')).toBe('');
  });
});

describe('site gate (runs before every request)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const context = (url: string, env: Record<string, unknown>, headers: Record<string, string> = {}) => {
    const served: string[] = [];
    const page = () => new Response('PRIVATE CONTENT', { headers: { 'Content-Type': 'text/html' } });
    return {
      served,
      ctx: {
        request: new Request(url, { headers }),
        env: {
          ...env,
          ASSETS: {
            fetch: async (request: Request) => {
              served.push(new URL(request.url).pathname);
              return page();
            },
          },
        },
        next: async () => {
          served.push('next');
          return page();
        },
      },
    };
  };
  const configured = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
  const stubKeys = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }))));

  it.each(['/', '/data/catalogue.json', '/infinite/buttons/01-magnetic-button', '/preview/buttons/01-magnetic-button', '/assets/index.js', '/c/x/y'])(
    'stays locked when sign-in has not been configured: %s',
    async (path) => {
      const { ctx, served } = context(`https://forever-components.pages.dev${path}`, {});
      const response = await onRequest(ctx);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('PRIVATE CONTENT');
      expect(served).toEqual([]);
    },
  );

  it('refuses visitors without a token, including on preview-deployment hostnames', async () => {
    stubKeys();
    for (const host of ['forever-components.pages.dev', 'abc123.forever-components.pages.dev', 'components.example.com']) {
      const { ctx, served } = context(`https://${host}/data/catalogue.json`, configured);
      const response = await onRequest(ctx);
      expect(response.status).toBe(403);
      expect(served).toEqual([]);
    }
  });

  it('refuses a forged token', async () => {
    stubKeys();
    const forged = await sign(validClaims(), { key: otherPair.privateKey });
    const { ctx, served } = context('https://forever-components.pages.dev/', configured, { 'Cf-Access-Jwt-Assertion': forged });
    expect((await onRequest(ctx)).status).toBe(403);
    expect(served).toEqual([]);
  });

  it('the local-development switch does nothing on a real hostname', async () => {
    const { ctx, served } = context('https://forever-components.pages.dev/', { LOCAL_DEV_NO_AUTH: 'true' });
    expect((await onRequest(ctx)).status).toBe(403);
    expect(served).toEqual([]);
  });

  it('serves a signed-in visitor, from the header or the cookie, with security headers', async () => {
    stubKeys();
    const token = await sign(validClaims());
    const viaHeader = context('https://forever-components.pages.dev/', configured, { 'Cf-Access-Jwt-Assertion': token });
    const response = await onRequest(viaHeader.ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('PRIVATE CONTENT');
    expect(response.headers.get('Content-Security-Policy')).toBe(APP_CSP);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');

    const viaCookie = context('https://forever-components.pages.dev/preview/a/b', configured, { Cookie: `x=1; CF_Authorization=${token}` });
    const preview = await onRequest(viaCookie.ctx);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('Content-Security-Policy')).toBe(COMPONENT_CSP);
  });

  it('honours the optional email allow-list', async () => {
    stubKeys();
    const token = await sign(validClaims());
    const headers = { 'Cf-Access-Jwt-Assertion': token };
    const denied = context('https://x.pages.dev/', { ...configured, ACCESS_ALLOWED_EMAILS: 'someone@else.com' }, headers);
    expect((await onRequest(denied.ctx)).status).toBe(403);
    const allowed = context('https://x.pages.dev/', { ...configured, ACCESS_ALLOWED_EMAILS: 'someone@else.com, ME@example.com' }, headers);
    expect((await onRequest(allowed.ctx)).status).toBe(200);
  });

  it('fails closed if the signing keys cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const token = await sign(validClaims());
    const { ctx, served } = context('https://unreachable-keys.pages.dev/', { ACCESS_TEAM_DOMAIN: 'otherteam', ACCESS_AUD: AUD }, { 'Cf-Access-Jwt-Assertion': token });
    expect((await onRequest(ctx)).status).toBe(503);
    expect(served).toEqual([]);
  });

  it('serves dashboard addresses from the single app page and everything else as a file', async () => {
    const local = { LOCAL_DEV_NO_AUTH: 'true' };
    const route = context('http://localhost:8788/c/buttons/01-magnetic-button', local);
    await onRequest(route.ctx);
    expect(route.served).toEqual(['/']);
    const file = context('http://127.0.0.1:8788/infinite/buttons/01-magnetic-button', local);
    await onRequest(file.ctx);
    expect(file.served).toEqual(['next']);
  });
});

describe('security headers', () => {
  it('locks component files into an origin-less sandbox with no network access', () => {
    for (const path of ['/infinite/a/b', '/preview/a/b']) {
      const csp = securityHeadersFor(path)['Content-Security-Policy'];
      expect(csp).toContain('sandbox allow-scripts;');
      expect(csp).not.toContain('allow-same-origin');
      expect(csp).toContain("connect-src 'none'");
      expect(csp).toContain("form-action 'none'");
    }
  });

  it('forbids inline script, framing and third-party hosts on the dashboard', () => {
    const headers = securityHeadersFor('/settings');
    expect(headers['Content-Security-Policy']).toContain("script-src 'self'");
    expect(headers['Content-Security-Policy']).not.toContain('unsafe-inline\'; script');
    expect(headers['Content-Security-Policy']).not.toMatch(/https?:/);
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Robots-Tag']).toContain('noindex');
    expect(headers['Cache-Control']).toContain('private');
  });

  it('knows which addresses belong to the dashboard', () => {
    for (const path of ['/favourites', '/collections', '/collections/abc', '/compare', '/settings', '/c/a/b']) expect(isAppRoute(path)).toBe(true);
    for (const path of ['/', '/infinite/a/b', '/preview/a/b', '/data/catalogue.json', '/assets/x.js', '/nope']) expect(isAppRoute(path)).toBe(false);
  });
});
