// Verifies the signed token that Cloudflare Access attaches to every authenticated request.
// Plain WebCrypto: runs in Cloudflare Pages Functions and in Node (for the tests).

const b64urlToBytes = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const decodeJson = (part) => JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));

/** Accepts "myteam", "myteam.cloudflareaccess.com" or a full https:// address. */
export function normaliseTeamDomain(value) {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!cleaned) return '';
  if (!/^[a-z0-9-]+(\.cloudflareaccess\.com)?$/.test(cleaned)) return '';
  return cleaned.endsWith('.cloudflareaccess.com') ? cleaned : `${cleaned}.cloudflareaccess.com`;
}

export function tokenFromRequest(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header.trim();
  const cookie = request.headers.get('Cookie') || '';
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return match ? match[1].trim() : '';
}

/**
 * @param {string} token
 * @param {{ teamDomain: string, aud: string, getKeys: (forceRefresh: boolean) => Promise<any[]>, now?: number }} options
 * @returns {Promise<{ ok: true, email: string } | { ok: false, reason: string }>}
 */
export async function verifyAccessJwt(token, options) {
  const fail = (reason) => ({ ok: false, reason });
  const teamDomain = normaliseTeamDomain(options.teamDomain);
  const aud = String(options.aud || '').trim();
  if (!teamDomain || !aud) return fail('not-configured');
  if (!token) return fail('no-token');

  const parts = token.split('.');
  if (parts.length !== 3) return fail('malformed');
  let header;
  let payload;
  let signature;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
    signature = b64urlToBytes(parts[2]);
  } catch {
    return fail('malformed');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return fail('unsupported-algorithm');

  let keys = await options.getKeys(false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await options.getKeys(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return fail('unknown-key');

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return fail('bad-signature');
  }
  if (!valid) return fail('bad-signature');

  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return fail('expired');
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return fail('not-yet-valid');
  if (payload.iss !== `https://${teamDomain}`) return fail('wrong-issuer');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) return fail('wrong-audience');

  return { ok: true, email: typeof payload.email === 'string' ? payload.email.toLowerCase() : '' };
}

/** Fetches and caches the Access signing keys for a team. */
export function createKeyLoader(teamDomainInput, fetchImpl = fetch) {
  const teamDomain = normaliseTeamDomain(teamDomainInput);
  let cached = [];
  let fetchedAt = 0;
  return async function getKeys(forceRefresh) {
    const age = Date.now() - fetchedAt;
    if (cached.length && !forceRefresh && age < 60 * 60 * 1000) return cached;
    if (cached.length && forceRefresh && age < 60 * 1000) return cached;
    const response = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`);
    if (!response.ok) throw new Error(`Could not load Access keys (${response.status}).`);
    const body = await response.json();
    cached = Array.isArray(body.keys) ? body.keys : [];
    fetchedAt = Date.now();
    return cached;
  };
}
