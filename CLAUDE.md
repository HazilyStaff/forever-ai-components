# Forever Components — project rulebook

Fork of `isas1/forever-ai-components` plus a private dashboard. Baton: `dashboard/EXISTING.md`.
Behaviour/architecture: `dashboard/SPEC.md`. User guides: `dashboard/docs/`.

## Boundaries

- **Never edit upstream files**: `infinite/**`, `catalog.json`, `agents.json`, `llms.txt`,
  root `README.md`, `ROADMAP.md`, `NOTICE.md`, `LICENSE`, root `.gitignore`. They change only
  through the upstream sync pull request.
- All custom work lives in `dashboard/` and `.github/`. Root `CLAUDE.md`/`AGENTS.md` are ours.
- The repository is **public** (a fork cannot be private). Never commit secrets, the user's
  email, or the shared private AI rules bundle (`.claude/shared/`) here.

## Commands (run inside `dashboard/`)

`npm run dev` · `npm run build` · `npm test` · `npm run test:e2e` · `npm run validate` ·
`node scripts/verify-live.mjs https://forever-components.pages.dev`

## Hard contracts (detail in SPEC.md)

- Component id = path under `infinite/` without `.html`. Never positions or upstream `id`.
- Previews: `sandbox="allow-scripts"` only; component CSP stays `connect-src 'none'`.
- Access gate fails closed on every hostname; no auth bypass except the localhost-only switch.
- Any change to `functions/`, `shared/` or preview isolation is full-risk: run unit + e2e.
- User data schema changes need a version bump and a migration; never drop saved items.

## Release

Branch → PR → merge to `main`; `.github/workflows/deploy.yml` tests, publishes to Cloudflare
Pages project `forever-components` and checks the live site still refuses anonymous visitors.
Live: https://forever-components.pages.dev (Cloudflare Access, policy "Only Me").
