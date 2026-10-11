# Hosting, sign-in and privacy

## The short version

- **Where it lives:** Cloudflare Pages, project `forever-components`, at
  https://forever-components.pages.dev. Free tier. No server to look after, no database.
- **Who can see it:** only people allowed by the Cloudflare Access application
  "Forever Components" (policy **Only Me**).
- **How it is published:** every change to the `main` branch on GitHub is tested and then
  published automatically by the workflow `.github/workflows/deploy.yml`.

## How privacy is enforced (two independent locks)

1. **Cloudflare Access** sits in front of `forever-components.pages.dev`. Anyone not signed in
   is sent to a Cloudflare sign-in page before a single file is served.
2. **The site's own gate** (`functions/_middleware.js`) runs before *every* request — pages,
   the catalogue, every component file, scripts, images. It checks the signed token that
   Access attaches and refuses with "403" if it is missing, forged, expired, or issued for a
   different site. If the settings are missing it **stays locked** rather than opening up.

Because of the second lock, addresses that Access does not cover are still closed:

| Address | What an outsider gets |
|---|---|
| `forever-components.pages.dev` (production) | Cloudflare sign-in page |
| `<random>.forever-components.pages.dev` (one per deployment) | 403 — always locked |
| Any future custom domain | 403 until an Access application is added for it |

Nothing relies on a hidden address, a JavaScript password box or `robots.txt`. No Cloudflare
API token or other secret is ever sent to the browser.

### What is *not* private

The **GitHub repository is public**, and has to be: it is a fork of a public repository, and
GitHub does not allow such forks to be made private. That means the dashboard's code and the
component files can be read on GitHub by anyone — but the components are already public in the
original repository under the MIT licence. Your **favourites, collections and notes never
leave your browser** and are not in the repository. Access to *your website* is what is private.

A side benefit: because the files are public on GitHub, the source links in "Copy for AI" work
for any AI agent without extra set-up.

If you ever want the code private too, the repository would have to be re-created as a
standalone private repository (not a fork). The weekly update check would still work. In that
case set `"repoIsPrivate": true` in `dashboard/site.config.json` so that "Copy for AI" includes
the full source by default.

## Check for yourself that it is private

**The simple way.** Open a private/incognito window and go to
https://forever-components.pages.dev/data/catalogue.json — you should get a Cloudflare sign-in
page, not a list of components. Try a deployment address from the Cloudflare dashboard too —
you should see "Sign-in required".

**The thorough way** (this is also run automatically after every deployment):

```bash
node scripts/verify-live.mjs https://forever-components.pages.dev
```

It requests the home page, the catalogue, original and preview component files and the app's
own script without signing in, and fails loudly if any of them is served.

The automated tests additionally run the site locally "exactly as deployed" and confirm that
missing, made-up and forged credentials are all refused (`tests/e2e/security.spec.ts`,
`tests/unit/security.test.ts`).

## Settings that make it work

Stored on Cloudflare (Workers & Pages → forever-components → Settings → Variables and Secrets):

| Name | What it is |
|---|---|
| `ACCESS_TEAM_DOMAIN` | Your Zero Trust team address, `red-bar-ff0c.cloudflareaccess.com` |
| `ACCESS_AUD` | The "Application Audience (AUD) Tag" of the Access application |
| `ACCESS_ALLOWED_EMAILS` | Optional extra lock: comma-separated emails. Not set. |

Stored on GitHub (repository → Settings → Secrets and variables → Actions):

| Name | Kind | What it is |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Lets the workflow publish to Cloudflare Pages |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Your Cloudflare account identifier |
| `SITE_URL` | Variable | `https://forever-components.pages.dev`, used for the after-deploy privacy check |

### Adding the publishing token (one-off)

Until `CLOUDFLARE_API_TOKEN` exists, changes are tested but **not** published automatically.

1. Cloudflare dashboard → profile icon (top right) → **My Profile** → **API Tokens** →
   **Create Token**.
2. **Create Custom Token** → name it `forever-components deploy` → Permissions:
   **Account → Cloudflare Pages → Edit** → **Continue to summary** → **Create Token** → **Copy**.
3. GitHub → `HazilyStaff/forever-ai-components` → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret** → Name `CLOUDFLARE_API_TOKEN` → paste → **Add secret**.
4. **Actions** tab → **Test and deploy the library** → **Run workflow**.

(The same token you use for your other Cloudflare Pages projects also works.)

## Common changes

**Let another email address in, or change who is allowed**
Cloudflare dashboard → **Zero Trust** → **Access controls** → **Policies** → **Only Me** → edit
the email list → **Save**. (This policy is shared with your other protected sites.)

**Stay signed in longer than 24 hours**
Zero Trust → Access controls → Applications → **Forever Components** → **Session Duration**.

**Use your own domain**
Add the domain to the Pages project, then create a second Access application for that
hostname with the same policy, and put its AUD tag… — ask Claude Code or Codex to do this; the
gate accepts one AUD at present and needs a two-line change to accept two.

**If the site says it is locked ("This site is locked")**
The two `ACCESS_…` settings are missing or were removed. Re-add them (table above) and
redeploy. The AUD tag is on the Access application's page in Zero Trust.

**If previews are blank on the live site but the page loads**
Zero Trust → Applications → Forever Components → Additional settings → cookie settings: make
sure **Same Site** is not set to *Strict*.

## Why this design

- **Cloudflare Pages + Access** was your preference and meets every requirement on the free
  tier (Access is free for up to 50 users).
- Cloudflare's one-click "Access policy" for Pages only covers preview addresses, and the
  documented workaround for the production address is fiddly. Rather than depend on getting
  that right, the site verifies the Access token itself on every hostname and fails closed.
- The site is otherwise completely static: no database, no accounts, nothing to patch.
- Component files are treated as untrusted. They run in sandboxed frames with no origin
  (`sandbox="allow-scripts"` only), and the server additionally sends them with a strict
  policy: no network requests, no access to cookies, storage or the surrounding page. The only
  outside resource they may load is Google Fonts, which about 40 components use.
