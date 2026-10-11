# Baton — Forever Components dashboard

Sole handoff file. Budget 4,000 bytes. Original request (verbatim, cold): `docs/ORIGINAL-REQUEST.md`.

## State — 11/10/2026

**COMPLETE (v1.1.0), one user action outstanding.**
Live: https://forever-components.pages.dev — Cloudflare Access app "Forever Components",
policy "Only Me", 24 h session. Pages project `forever-components` (direct upload).
Observed live: anonymous requests refused on production and deployment hostnames;
signed-in session loads the app and previews.

## Outstanding

1. **USER:** add GitHub secret `CLOUDFLARE_API_TOKEN` (taps in `docs/DEPLOYMENT.md`,
   "Adding the publishing token"). Until then `deploy.yml` tests but skips publishing, so a
   merged library update will not reach the live site. Workaround for an AI session on this PC:
   `npm run build` then `npx wrangler pages deploy dist --project-name forever-components --branch main`.
2. Deferred, needs user authority: cloud bootstrap bundle (`.claude/shared/`) NOT added —
   this repository is public and the bundle carries the private shared rules.

## Next action

None required from an AI. When the user reports the token is added: run workflow
"Test and deploy the library" and confirm its live check is green. CONTINUE, this project.

## Request coverage (sections of the original request)

2–3 audit, upstream untouched: done · 4 design, dark default + light: done · 5 gallery,
densities, lazy previews: done · 6 search, filters, suggestions, sort, recent, `/` shortcut: done
(no scroll-based filter: metadata has none) · 7 viewer + controls + source: done · 8 Copy for AI
quick/detailed/self-contained + size warning: done · 9 favourites: done · 10 collections, notes,
reorder (Earlier/Later buttons, not drag), export/import: done · 11 collection prompt: done ·
12 compare 2–4: done · 13 stable ids, share links, missing state: done · 14 weekly sync PR
workflow: done · 15 performance/security: done · 16 Cloudflare Pages + Access, fail-closed:
done and observed live · 17 stack: done · 18 validation + health report: done · 19 QA: all 19
steps automated and executed · 20 UX: done · 21 docs: done · 22–24: done.

## Evidence

70 unit tests, 39 browser tests (29 desktop Chromium, 5 iPhone WebKit, 5 iPad WebKit) pass
locally. `scripts/verify-live.mjs` green against production.

## Gotchas for the next session

- The Claude desktop browser pane blocks iframes on `127.0.0.1`; use Playwright
  (`node tests/e2e/shot.mjs`) to look at previews locally. The live site works in the pane.
- Do not run browser tests in the same breath as `npm run build`: the local preview servers
  reload while `dist/` is rewritten and a few tests flake.
- `gh pr create` defaults to the upstream parent on a fork: always pass
  `--repo HazilyStaff/forever-ai-components`.
- Shell heredocs in this harness strip backslashes; write files with the file tools.

## AI trail

11/10/2026 Claude Opus 5.5 (v1.1.0): Copy for AI rewritten after user report that agents
copied the self-playing demo and the original colours. Defaults now: essence only, restyle to
the target project's design tokens, animate only on the real trigger; two remembered options
(Look, Animation) switch either off. Owner: `src/lib/prompts.ts`.

11/10/2026 Claude Opus 5.5: audit → app → tests → sync/deploy workflows → Cloudflare Pages +
Access live → docs.
