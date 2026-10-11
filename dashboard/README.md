# Forever Components — private library

A private website for browsing the [Forever AI Components](https://github.com/isas1/forever-ai-components)
collection: see every component running live, search and filter, save favourites, group them
into collections, compare them side by side, and copy ready-made instructions for Claude Code
or Codex.

**Live site:** https://forever-components.pages.dev (sign-in required)

This folder (`dashboard/`) is the website. Everything outside it — `infinite/`, `catalog.json`,
`README.md` and so on — is the original collection and is never edited here.

## Guides

| I want to… | Read |
|---|---|
| Use the site, Copy for AI, back up my saved items, fix a problem | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) |
| Understand hosting, sign-in and how to check it is private | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Understand how new components arrive from the original collection | [docs/UPDATES.md](docs/UPDATES.md) |
| See how it is built (for AI agents and developers) | [SPEC.md](SPEC.md) |

## Run it on this computer

You need [Node.js](https://nodejs.org) 20 or newer. In a terminal, inside the `dashboard` folder:

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. Changes to the code appear straight away.

To run the site exactly as it is deployed (with the security rules applied):

```bash
npm run build
```

```bash
npm run preview
```

Then open http://127.0.0.1:8788. Local preview skips sign-in only because the file `.dev.vars`
says so, and that switch is ignored on any address other than `localhost`.

## Checks

| Command | What it does |
|---|---|
| `npm run validate` | Rebuilds the catalogue and prints the health report |
| `npm test` | Unit tests (catalogue, search, prompts, saved data, sign-in check) |
| `npm run test:e2e` | Browser tests: desktop Chrome, iPhone and iPad (WebKit) |
| `node scripts/verify-live.mjs https://forever-components.pages.dev` | Proves the live site refuses visitors who are not signed in |

First time only, the browser tests need their browsers: `npx playwright install chromium webkit`.

## What is where

```
dashboard/
  src/            the website (React + TypeScript)
  scripts/        catalogue builder, sync report, live privacy check
  functions/      the gate that runs before every request (Cloudflare Pages)
  shared/         sign-in verification and security headers
  data/           snapshot used to report what changed between updates
  tests/          unit and browser tests
  docs/           the guides above
.github/workflows/
  deploy.yml          test, then publish every change to main
  upstream-sync.yml   weekly check for new components
```
