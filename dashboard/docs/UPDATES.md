# How new components arrive

Your repository is a copy ("fork") of the original collection,
[isas1/forever-ai-components](https://github.com/isas1/forever-ai-components). The original keeps
growing. This is how its changes reach your library safely.

## What happens automatically

Every **Monday morning** (05:17 UTC) the workflow **Check for library updates** runs on GitHub:

1. It looks at the original collection.
2. **Nothing new?** It stops. Nothing changes.
3. **Something new?** It combines the new files with your repository on a separate branch,
   rebuilds the catalogue, runs the build and tests, and opens a **pull request** — a proposal —
   containing a plain-English report:
   - how many components are **new**, **changed** and **removed**, each listed by name;
   - whether any file is missing or broken;
   - whether the checks passed.

It **never** changes `main` by itself, never force-pushes, and never edits the dashboard's own
files. Your live site stays exactly as it was until you approve.

## What you do

You will get a GitHub notification/email. Open the pull request and read the title:

| Title starts with | Meaning | What to do |
|---|---|---|
| `Library update: 12 new, 3 changed, 0 removed` | Everything combined cleanly and passed its checks. | Press **Merge pull request**, then **Confirm merge**. The site redeploys itself in about five minutes. |
| `DO NOT MERGE YET — …` | The files combined, but the site build or tests failed with them. | Don't merge. Open Claude Code or Codex in this repository and say: *"Fix the failing upstream sync pull request."* |
| `NEEDS ATTENTION — …` | The original changed a file that your repository also changed (a conflict). | Don't merge. Say to your AI agent: *"Resolve the upstream sync pull request, keeping the dashboard's own files."* |

If the pull request shows a section **"Review carefully: upstream changed files that belong to
the dashboard"**, the original repository touched something outside the component collection
(for example added its own `dashboard/` folder or workflow). Have an AI agent check it first.

Not interested in an update? Just **close** the pull request. The next weekly run will propose
the newer state.

To check right now instead of waiting: GitHub → **Actions** → **Check for library updates** →
**Run workflow**. (The same link is under **Settings → Updates** on the site.)

## What stays safe

- **Your saved items.** Favourites and collections refer to components by their file path
  (e.g. `buttons/02-gooey-liquid-toggle`), never by position in a list, so new arrivals cannot
  shift them onto the wrong component.
- **Bookmarks.** A component's address stays the same for as long as upstream keeps the file.
- **Removed components.** They disappear from the gallery. Anything you saved that pointed to
  one is kept and labelled "no longer in the library", with a button to remove it. Their names
  are remembered in `dashboard/data/catalogue-snapshot.json`.
- **Renamed components.** If upstream renames a file, it counts as one removal plus one
  addition; re-favourite the new one.
- **The dashboard's code.** It lives in `dashboard/` and `.github/`, which the original
  repository does not use, so normal updates cannot collide with it.

## How "new / changed / removed" is worked out

`dashboard/data/catalogue-snapshot.json` records a fingerprint of every component file at the
last update. `scripts/sync-report.mjs` compares the current files to it: a path not seen before
is **new**, a path whose fingerprint differs is **changed**, a path that has gone is
**removed**. The pull request updates the snapshot, and `dashboard/data/last-sync.json` records
the result so the site can show it under **Settings → Updates**.

Every build also re-validates the whole catalogue (see **Settings → Library health**):
components listed in the upstream index but missing their file are flagged, duplicates are
ignored, and component files that exist but are not in the index are still included.

## Things that can stop it

| Symptom | Cause | Fix |
|---|---|---|
| No pull requests for months although the original has new components | GitHub pauses scheduled workflows in repositories with no activity for 60 days. | GitHub → Actions → Check for library updates → **Enable workflow**, then **Run workflow**. |
| The workflow fails at "Open the pull request" with a permissions message | Repository setting was switched off. | GitHub → Settings → Actions → General → Workflow permissions: **Read and write**, and tick **Allow GitHub Actions to create and approve pull requests**. |
| The workflow fails while pushing, mentioning "workflows permission" | The original repository added its own GitHub workflow files, which the automatic job is not allowed to copy. | Ask an AI agent: *"Merge upstream manually; the sync job cannot push workflow files."* |
| Merged, but the site did not change | The deploy needs the `CLOUDFLARE_API_TOKEN` secret. | See [DEPLOYMENT.md](DEPLOYMENT.md), "Adding the publishing token". |
