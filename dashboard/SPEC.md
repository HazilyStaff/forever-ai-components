# Forever Components dashboard — behaviour and architecture

Authority for how the dashboard behaves. User-facing guides are in `docs/`.

## Shape

Static single-page app (Vite + React 18 + TypeScript, react-router, MiniSearch) on Cloudflare
Pages. One Pages Function (`functions/_middleware.js`) gates every request. No database, no
server state. Upstream collection (`../infinite`, `../catalog.json`, …) is read-only input.

## Build pipeline (`npm run build`)

1. `scripts/build-catalogue.mjs` → `public/data/catalogue.json` (generated, git-ignored).
   Source: `infinite/components.index.json` + each tile's embedded `forever-agent-meta` block
   + `catalog.json` `retired[]` + `data/catalogue-snapshot.json` `removed[]`.
2. `tsc --noEmit`, `vite build` → `dist/`.
3. `scripts/copy-components.mjs` → `dist/infinite/**` (byte-identical originals) and
   `dist/preview/**` (same file + `scripts/lib/preview-bridge.js` as first script).

## Hard contracts

- **Identity.** Component id = path under `infinite/` without `.html`
  (`buttons/02-gooey-liquid-toggle`). The upstream numeric `id` is an array position and is
  never used. Favourites, collections, compare, recent and `/c/<id>` links all key on this id.
- **Upstream files are never modified.** The bridge exists only in `dist/preview`.
- **Catalogue tolerance.** Missing file → listed with `status: "missing"`; empty/non-HTML →
  `"broken"`; duplicate index entries ignored; unindexed HTML files included; absent metadata
  defaults. The browser hydrator (`src/lib/catalogue.tsx`) drops junk records. Counts shown in
  the UI always come from the catalogue.
- **Fingerprint** = sha256 of the file with CRLF normalised to LF (same on Windows and CI).
- **Filters** are derived from metadata; a facet with fewer than two values is hidden. Unknown
  values get a tidied label, so new upstream values appear without code changes.
- **Preview isolation.** `<iframe sandbox="allow-scripts">` only, plus response CSP
  `sandbox allow-scripts; default-src 'none'; connect-src 'none'; …` on `/infinite/*` and
  `/preview/*` (`shared/security-headers.js`). Dashboard CSP forbids inline script and all
  third-party hosts. Parent↔frame traffic is `postMessage` only: `fc:pause`, `fc:resume`,
  `fc:bg`, upstream's own `forever:theme`; frame → parent `fc:ready`, `fc:error`.
- **Preview budget.** Only on-screen previews mount; cost budget 32 (14 on touch/low-core),
  heavy tiles cost 2, staggered starts, unmount ~0.9 s after leaving the viewport
  (`src/lib/previewManager.ts`). Gallery renders 96 cards at a time.
- **Access control fails closed.** Middleware verifies the Cloudflare Access RS256 JWT
  (issuer = team domain, audience = `ACCESS_AUD`, expiry, signature against the team JWKS) for
  every path on every hostname. Missing settings → 403. `LOCAL_DEV_NO_AUTH=true` is honoured
  only on `localhost`/`127.0.0.1`. Dashboard routes (`/c/*`, `/collections/*`, …) are served
  from `/` by the middleware; unknown paths return a real 404.
- **User data** (`src/store/userData.ts`): one versioned JSON document in `localStorage`
  (`fc.userdata.v1`) behind `StorageAdapter` (swap in a remote adapter for sync later).
  Display preferences are separate (`fc.prefs.v1`) and not part of backups. Imports keep an
  undo copy. Stored data is sanitised on load.
- **Copy for AI** (`src/lib/prompts.ts`): pure functions; quick/detailed × with/without source;
  size warning above 60k characters, "too large" above 150k.

## Routes

`/` library · `/favourites` · `/collections` · `/collections/:id` · `/compare?ids=a,b` ·
`/c/<component id>` · `/settings` (appearance, backup, AI defaults, health, updates).

## Tests

`tests/unit` (Vitest): catalogue + fixtures for damaged input, search/filters/prompts, user
data, JWT verification and middleware. `tests/e2e` (Playwright): desktop Chromium for the full
workflow and security; WebKit iPhone + iPad for layout and touch. Two local servers:
`:8788` (auth bypass on localhost) and `:8789` (auth enforced, as deployed).

## Known limits

- Reordering in a collection uses Earlier/Later buttons (no drag-and-drop).
- Microphone is denied in previews; audio visualisers run their built-in demo.
- No cross-device sync by design; export/import instead.
- One Access audience is accepted; a second hostname needs a second AUD.
