# Deploying Toronto Life

The app is **entirely static**. There is no server, no database and no API —
player saves live in the browser's `localStorage`. `npm run build` produces three
files totalling ~220 KB (68 KB gzipped), and they can be hosted anywhere that
serves files.

```bash
npm ci
npm run build     # → dist/  (index.html + assets/)
```

`vite.config.js` sets `base: './'`, so assets resolve correctly whether the site
is served from a domain root or from a sub-path like `username.github.io/repo/`.

## Option 1 — Netlify Drop (no account setup, no CLI, ~60 seconds)

1. Go to <https://app.netlify.com/drop>
2. Drag the **`dist`** folder onto the page
3. You get a live `*.netlify.app` URL immediately

## Option 2 — Vercel (CLI)

```bash
npm i -g vercel
vercel            # first run: log in, accept the Vite preset
vercel --prod     # production URL
```

Vercel auto-detects Vite: build command `npm run build`, output directory `dist`.

## Option 3 — GitHub Pages (free, permanent, tied to a repo)

### 1. Put the project in a git repo

```bash
cd toronto-life
git init
git add -A
git commit -m "Toronto Life"
git branch -M main
```

`node_modules` and `dist` are generated, so add a `.gitignore` first if you don't
want them tracked (the zip ships without them, but your local copy has both).

### 2. Create an empty repo on GitHub and push

Create a **new, empty** repository on github.com — do not add a README or
license, or the push will be rejected. Then:

```bash
git remote add origin https://github.com/<username>/toronto-life.git
git push -u origin main
```

### 3. Turn on Pages — source must be "GitHub Actions"

Repo → **Settings → Pages** → *Build and deployment* → **Source: GitHub Actions**.

Do **not** pick "Deploy from a branch". The included workflow uses
`actions/deploy-pages`, which uploads a build artifact through the Pages OIDC
token; it never creates a `gh-pages` branch. Choosing branch mode here is the
single most common reason this setup appears to do nothing.

### 4. Watch it deploy

Repo → **Actions** tab. The first run starts automatically from your push. Green
check after ~1 minute, and the `deploy` job prints the live URL. Your site is at:

```
https://<username>.github.io/toronto-life/
```

Every later push to `main` redeploys. You can also trigger a run manually —
the workflow has `workflow_dispatch`.

### If it fails

- **403 on the deploy job** → Pages source is still "Deploy from a branch".
- **Site loads but CSS/JS 404** → `base` in `vite.config.js` was changed away
  from `'./'`. Sub-path hosting requires the relative base.
- **Blank page, no 404** → check the browser console; usually the same cause.

## Option 4 — Any static host

Upload the contents of `dist/` to Cloudflare Pages, Surge, Render, S3, or a plain
nginx/Apache box. Nothing else is required.

## Things worth knowing before you share a link

- **No SPA fallback needed.** The app has no client-side router — everything
  renders at `/`, so a 404 on unknown paths is harmless.
- **Saves are per-browser.** `localStorage` means a player's progress lives on
  their own device and browser. Clearing site data wipes their life, and it does
  not carry across devices or browsers. Multiplayer and cloud saves would need a
  real backend, which is the main thing Lagos Life has that this does not.
- **The dev server config is preview-specific.** `server.allowedHosts: true` and
  `hmr.clientPort: 443` exist so the sandboxed live preview works. They have no
  effect on the production build.
