# Isaac Thumbnail Studio

A fast, local-first thumbnail editor for _The Binding of Isaac_ creators. Compose a
character, collectibles, trinkets, wiki room backdrops, and headline text on a real
1280 × 720 canvas, then export a production-ready PNG. No account, paid API key, database,
or AI image service is required. Artwork is streamed live from the verified wiki catalog;
no game images are stored in this repository.

---

## What it does

- **Real 16:9 editor** at a fixed logical 1280 × 720 with responsive fit/zoom, drag,
  resize, rotation, snapping, multi-select, layer ordering, lock/hide, and precise numeric
  transforms.
- **Artwork library** backed by a verified wiki.gg metadata catalog of 1,613 files, with
  live MediaWiki search, favorites, recently used, category filters, pagination, image
  retry states, and local uploads.
- **Wiki background selector** with a transparent-canvas option, 27 room backdrops from
  the verified catalog, upload support, fit/opacity, dim, and vignette controls. Transparent
  compositions export with a real alpha channel.
- **Image effects**: outline silhouettes, drop shadow, glow, opacity, flip, rotation, and
  pixel-art-friendly nearest-neighbor scaling. Outline width scales down with the layer
  from the size where you set it, and is capped at 6% of the layer's shorter side so
  small sprites do not receive an oversized border.
- **Text layers**: five bundled fonts, size/weight/color/alignment/line-height/letter
  spacing, stroke, shadow, glow, and four original headline treatments.
- **Six composition presets** with item scale, spacing, character scale, and text position
  controls. Presets rearrange existing layers and are undoable.
- **Undo/redo** (60 steps), keyboard nudging, shortcuts, autosave, and local project
  management (new, open, rename, duplicate, delete).
- **Independent PNG export renderer** driven by the same scene data as the canvas. It
  renders off-screen at exactly 1280 × 720 with no editor UI, verifies the PNG header, and
  blocks incomplete exports instead of silently producing a broken thumbnail.
- **Portable projects**: export/import a versioned JSON file, optionally embedding uploaded
  images so projects can move between browsers.
- **Accessible, responsive UI**: keyboard-operable controls, Radix-based dialogs, visible
  focus, ARIA labels, reduced-motion support, and mobile sheets. The main screen passes an
  axe-core WCAG 2 A/AA scan with no violations.

---

## Quick start

Tested with **Node 22.21.1** and **npm 11.11.1** on Windows. Vite 7 requires Node
20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>). The first launch creates a
blank transparent 1280 × 720 project. Pick a wiki backdrop or start composing immediately.

### Production build

```bash
npm run build
npm run preview
```

`npm run build` runs the strict TypeScript check and emits a static site into `dist/`.

### Tests and checks

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run format:check     # Prettier
npm run validate:assets  # catalog manifest, URLs, duplicate IDs, no bundled art
npm run test             # Vitest + React Testing Library (69 tests)
npm run test:e2e         # Playwright + axe (9 browser tests)
npm run check            # typecheck + lint + format + assets + unit tests + build
```

Playwright needs its browser once:

```bash
npx playwright install chromium
```

`npm run test:e2e` starts the Vite dev server on port 4173 automatically (or reuses one
already running). Unit tests never touch the network.

---

## Feature walkthrough

1. In **Design → Background**, choose **Transparent** or one of the wiki room backdrops.
   You can also upload your own background.
2. Choose a character, then search and add collectibles, active items, trinkets, cards,
   pills, bosses, or room screenshots.
3. Drag artwork from the library onto the canvas, or click a card. Uploaded cards can also
   be set as a background; wiki backdrops live in the Design → Background selector.
4. Transform layers on the canvas or type exact values in **Design**. Use **Layers** to
   reorder, lock, hide, duplicate, or delete.
5. Add a headline with **T**. Apply a style preset or tune typography and effects.
6. Use **Presets** to reflow the existing composition, then fine-tune.
7. Press **Preview** to render the final PNG (including transparency) without editor UI.
8. Press **Export** to download `isaac-thumbnail-YYYY-MM-DD.png` at 1280 × 720.
9. Projects autosave locally. Use the project menu for JSON export/import or to manage
   projects.

### Keyboard shortcuts

| Shortcut                           | Action                            |
| ---------------------------------- | --------------------------------- |
| `Ctrl/⌘ + Z`                       | Undo                              |
| `Ctrl/⌘ + Shift + Z` or `Ctrl + Y` | Redo                              |
| `Ctrl/⌘ + D`                       | Duplicate selected layers         |
| `Delete` / `Backspace`             | Delete selected layers            |
| Arrow keys                         | Nudge 1 px (`Shift` = 10 px)      |
| `T`                                | Add a text layer                  |
| `Ctrl/⌘ + S`                       | Save locally (works while typing) |
| `Ctrl/⌘ + E`                       | Open export                       |
| `Ctrl/⌘ + O`                       | Open project manager              |
| `P`                                | Preview                           |
| `+` / `−`                          | Zoom in/out                       |
| `0`                                | Fit canvas                        |
| `Esc`                              | Clear selection                   |
| `?`                                | Shortcut help                     |

Shortcuts are ignored inside text fields, except save. Shortcuts are disabled while a
dialog is open.

---

## Tech stack

| Area          | Choice                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| UI            | React 19.3, TypeScript 5.9 strict, Vite 7.3, Tailwind CSS 4.1                           |
| Canvas        | Konva 10.9, react-konva 19.3                                                            |
| State         | Zustand 5                                                                               |
| Validation    | Zod 4                                                                                   |
| Components    | Radix UI primitives, Lucide icons, custom shadcn-style components                       |
| Fonts         | `@fontsource` packages (Inter, Anton, Bebas Neue, Bangers, Press Start 2P), all SIL OFL |
| Local storage | `localStorage` for projects/preferences, IndexedDB (`idb-keyval`) for uploads           |
| Tests         | Vitest 3, React Testing Library, jsdom, Playwright 1.64, axe-core                       |

No router, analytics, authentication, remote database, or AI service is included.

---

## Architecture

```
src/
  components/
    editor/          Canvas stage, inspector, layers, presets, effects, dialogs
    library/         Asset library, cards, search UI
    projects/        Project manager
    export/          Export and preview dialogs
    layout/          Top bar, mobile bar, brand
    ui/              Accessible primitives (buttons, modal, sheet, controls, toasts…)
  features/
    assets/          Asset model, provider adapters, catalog, image registry, uploads
    editor/          Scene types, Zustand store, operations, presets, schema, shortcuts
    export/          Scene preflight, detached Konva renderer, PNG/filename helpers
    projects/        Serialization, localStorage, project session/autosave
  hooks/             Media-query hook
  lib/               Small utilities
shared/              Client-safe allowlist + server proxy core
netlify/functions/   Netlify Functions v2 asset proxy
scripts/             Catalog sync and asset validator
public/catalog/      Metadata-only wiki.gg snapshot (no images)
tests/               Vitest suites
e2e/                 Playwright flows and axe scan
```

### Scene model

A project is a versioned `ProjectFile` (`schemaVersion: 1`) containing:

- fixed logical canvas size;
- background (`transparent | image`, fit, opacity, dim, vignette);
- ordered layers (bottom → top), each with id, center position, width/height, rotation,
  opacity, visibility, lock, and effects;
- text-specific typography or image-specific asset reference/flip;
- optional `embeddedAssets` only in portable JSON.

Preview and export both read this data. Export clones the Konva background and content
layers into a detached 1280 × 720 stage, draws at `pixelRatio: 1`, and reads the resulting
PNG header to assert dimensions. Selection handles, guides, and panels live in a separate
UI layer and are never cloned.

### Assets

The normalized asset includes: `id`, `name`, `category`, `imageUrl`, `thumbnailUrl`,
`sourceUrl`, `sourceName`, `licenseStatus`, `attribution`, dimensions, tags, search terms,
and optional upload id. Rendering code does not know the source provider.

Supported categories: characters, collectibles, active items, trinkets, cards, pills,
backgrounds, bosses, uploads. Backgrounds are intentionally excluded from the artwork
library and are chosen in the Design panel instead.

Providers:

1. **Wiki.gg verified catalog** (`catalogProvider`) — metadata-only snapshot, lazy category
   files, compact search index, images streamed through the proxy.
2. **Wiki.gg live API** (`createWikiProvider`) — direct Action API queries with search,
   category traversal, continuation tokens, cancellation, caching, and error mapping.
3. **Fandom live API** — same adapter; API is verified but the image host frequently blocks
   hotlinking, so it is clearly labeled as experimental.
4. **Uploads** — IndexedDB blobs converted to in-session object URLs; never uploaded.

Category behavior, case-insensitive token search, favorites, recents, pagination, retry,
and image error states are implemented. Remote requests are debounced and aborted when
obsolete. No artwork is bundled with the application; if a provider is unavailable, uploads,
text, and transparent compositions remain usable.

---

## Asset source research (verified October 2026)

### wiki.gg — primary source

- Domain: `https://bindingofisaacrebirth.wiki.gg`
- API: `https://bindingofisaacrebirth.wiki.gg/api.php`
- MediaWiki 1.43.6. Action API accepts `origin=*` and returns
  `Access-Control-Allow-Origin: *` for successful anonymous requests.
- Verified queries: `action=query`, `format=json`, `formatversion=2`,
  `generator=categorymembers`, `generator=search`, `prop=imageinfo` with
  `iiprop=url|size|mime` and `iiurlwidth`.
- Verified category counts at sync time: **757** filtered collectible icons, **247**
  trinkets, **51** character files, **67** card icons, **28** pill icons, **436** boss
  images, **27** starting-room screenshots, **169** activated collectibles. The catalog
  index has **1,613 unique file IDs**.
- Images are full-resolution PNG/WebP files under `/images/`, with MediaWiki thumbnail
  URLs available. Entries are ordinary sprites, portraits, or room screenshots. The
  catalog filters out legacy/variant collectible and trinket icon files.
- Cloudflare may challenge automated browser traffic (observed HTTP 403 in headless
  Chromium). The metadata catalog was built to keep browsing/search usable in that case,
  and the live API remains selectable. Direct image fetches through the proxy succeeded.
- Per-file `imageinfo` does **not** expose a license field. `Template:License/game` states
  the files are **IN COPYRIGHT**, owned by Nicalis / Edmund McMillen.

### Fandom — secondary, images blocked

- Domain: `https://bindingofisaacrebirth.fandom.com`
- API: `https://bindingofisaacrebirth.fandom.com/api.php`
- MediaWiki 1.43.9, verified CORS with `origin=*`, same response shapes.
- `static.wikia.nocookie.net` returned **HTTP 403** to the proxy from this environment
  (hotlink/anti-bot protection). The source remains available for API-only experiments,
  but no claim is made that its images can be exported. Wiki.gg is the recommended source.

### tboi.com — not integrated

`https://www.tboi.com/` is the static _Isaac Cheat Sheet_ (Platinum God). It serves HTML,
CSS, and image files but exposes no documented API, no CORS headers, and no stable
machine-readable search. Scraping with brittle selectors was rejected. No access controls
were bypassed.

### Licensing and attribution

- Game artwork is **© Nicalis, Inc. / Edmund McMillen** and is marked **IN COPYRIGHT**
  (`https://rightsstatements.org/page/InC/1.0/`).
- This project does **not** bundle, download, or redistribute game images.
- Selecting a remote file stores its wiki file page URL and attribution in the project.
  Images are fetched at render time through a narrow proxy.
- The PNG cannot carry attribution metadata. Credit the source page in the video
  description and confirm your use qualifies as fair use or is otherwise permitted.
- No game artwork is bundled with the application. Background selection and the library
  reference the live wiki metadata catalog only.
- Fonts are distributed under the SIL Open Font License by their respective authors.

To regenerate the metadata snapshot:

```bash
npm run sync:catalog
```

The script sleeps 1.2 s between API requests, retries throttled responses, stores **only**
names, dimensions, image URLs, and source pages, and writes `public/catalog/wikigg/*.json`.
Review the source wiki's terms before refreshing or increasing the request rate.

To validate the catalog manifest, duplicate IDs, category counts, URL allowlists, and the
absence of bundled artwork, and optionally probe remote URLs:

```bash
npm run validate:assets
npm run validate:assets -- --check-urls
```

---

## PNG export guarantees

- Exactly **1280 × 720**, regardless of zoom or window size.
- Same scene data as the editor; no DOM screenshot.
- Correct order, rotation, transparency, text, outlines, shadows, glow, and flips.
- Transparent or wiki-image background. Choosing **Transparent** keeps a real alpha channel
  through preview and export.
- Images and fonts are awaited before rendering.
- Missing/failed images and CORS-tainted images block export with an explanation, a retry
  action, and an option to remove the affected layers.
- The generated bytes are checked for the PNG signature and IHDR dimensions.
- Object URLs are revoked when previews/exports close or uploads are released.
- Filename: `isaac-thumbnail-YYYY-MM-DD.png`.

Remote artwork must reach the canvas through the same-origin proxy to avoid a tainted
canvas. If the proxy is offline, remote images may preview but export is blocked rather than
silently omitted.

---

## Local projects and privacy

- Up to **25 projects** in `localStorage`, autosaved after ~900 ms.
- The last active project reopens after reload.
- User images live in IndexedDB; project JSON references upload ids, and portable JSON can
  embed them (20 MB base64 limit).
- Browser quota and unavailable-storage errors are reported; export JSON is offered as
  recovery.
- Projects belong to **this browser**. There is no account or cloud sync.
- No analytics, tracking, or personal information is collected. Online artwork is only
  requested when the online library is enabled or the live source is selected.
- Clearing site data deletes local projects and uploads. Export JSON to keep them.

---

## Netlify deployment

The repository is ready for Netlify:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
```

`netlify.toml` also sets Node 22, cache headers, security headers (CSP, nosniff,
frame-ancestors, referrer policy), and an SPA fallback.

### Connect a Git repository

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In Netlify, choose **Add new site → Import an existing project** and select the repo.
3. Netlify reads `netlify.toml`; confirm build `npm run build`, publish `dist`.
4. Deploy. Every pull request gets a Deploy Preview automatically.
5. No environment variables or API keys are required.

The site works on any Netlify subdomain; no production hostname is hard-coded.

### CLI deployment (optional)

```bash
npm install -g netlify-cli
netlify login
netlify deploy --build          # draft URL
netlify deploy --build --prod   # production
```

### Serverless function

`netlify/functions/asset-proxy.ts` is a Netlify Functions v2 handler exposed at
`/api/asset-proxy`. It is required for cross-origin wiki images to be composited into a
canvas without tainting it. The same logic runs as Vite middleware in development and in `vite preview`.

The proxy:

- only allows HTTPS URLs on `bindingofisaacrebirth.wiki.gg/images/` and
  `static.wikia.nocookie.net/bindingofisaacre_gamepedia/images/`;
- rejects credentials, fragments, non-443 ports, and unapproved paths;
- follows at most two redirects, re-validating each target;
- accepts only PNG/JPEG/WebP/GIF responses, caps at 8 MB, and times out at 10 s;
- applies an in-memory 180 req/min rate limit and a 24 MB in-memory cache;
- adds CORS, `nosniff`, and cache headers; error responses are JSON and contain no internals.

There is no unrestricted URL proxy. If the function is unavailable, the app still works
with uploads, text, and transparent backgrounds; remote artwork export is disabled with an
explicit error.

### Environment variables

No secrets are needed. Optional branding:

```bash
VITE_APP_NAME="Isaac Thumbnail Studio"
VITE_APP_SHORT_NAME="ITS"
# VITE_ASSET_PROXY_URL=/api/asset-proxy
```

See `.env.example`. Changing `VITE_ASSET_PROXY_URL` to a cross-origin host requires
updating the production CSP `connect-src`/`img-src` accordingly.

---

## Security review

- **Imported projects** are parsed with a versioned Zod schema: bounded layer/text counts,
  validated colors, fonts, dimensions, asset URLs, source links, and embedded image types.
  Unknown shapes are rejected before touching the store.
- **No code execution**: no `eval`, `Function`, dynamic `<script>`, or
  `dangerouslySetInnerHTML`. Imported text is drawn to canvas, never injected as HTML.
- **URL controls**: scene images must be uploads, data/blob URLs, or allowlisted wiki
  hosts. Source links must be `https://`. Favorites read from local storage are
  shape-checked.
- **Server proxy**: explicit host/path allowlist, redirect validation, response MIME/size
  caps, timeout, rate limit, and predictable JSON errors. No credentials are forwarded.
- **Uploads** remain in the browser (IndexedDB), are size/type checked, and are only
  embedded when the user explicitly exports portable JSON.
- **Headers**: CSP without `unsafe-eval`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, restrictive
  `Permissions-Policy`.
- **Privacy**: no analytics or accounts. Remote requests are limited to the selected
  artwork source and its image proxy.
- Third-party artwork rights remain the user's responsibility; see licensing above.

---

## Known limitations

- **Cloudflare**: the wiki.gg Action API can challenge headless/automated browsers. The
  verified catalog keeps the library usable; the live API source may need a normal browser
  session. This was observed during testing.
- **Fandom images**: their image CDN returned 403 to the proxy; image export from that
  source is not reliable. Use wiki.gg or uploads.
- **Snapshot freshness**: the catalog reflects October 25, 2026. Run `npm run sync:catalog`
  to refresh it; game updates after that date will be missing until then.
- **Attribution in PNG**: impossible. Credit file pages in the video description.
- **Upload management**: uploads are not listed for deletion in the UI. They remain in
  IndexedDB until site data is cleared; delete site data to reclaim space (this also removes
  local projects, so export JSON first).
- **Limits**: 8 MB per upload, 25 local projects, 120 layers, 24 MB project import,
  20 MB embedded uploads in portable JSON, 30 embedded uploads.
- **Animated GIFs** export as their first frame (canvas behavior).
- **Mobile** supports touch drag, resize, rotation, sheets, and zoom/fit buttons, but not
  pinch-to-zoom or touch multi-select. Precise numeric fields are available as an
  alternative.
- **Multi-select** is Shift-click; multi-drag is not implemented (the transformer can
  scale/rotate a multi-selection).
- **Cropping**: background images support cover/contain cropping. Individual sprite and
  text layers can be resized and flipped but do not have an inner crop rectangle.
- **Multiple tabs**: local projects use last-write-wins storage; concurrent browser tabs do
  not live-sync.
- **Browsers**: tested in Chromium. Modern Firefox/Safari should work, but Safari's
  IndexedDB/download behavior was not part of automated verification.
- The catalog metadata is local, but all wiki artwork (including background thumbnails) needs
  network access. There is no bundled fallback artwork. Uploads and transparent/text-only
  compositions work without a network connection.
- **No shipped backdrops**: the background picker is populated from the wiki room catalog.
  If its images cannot load, use Transparent or upload a background.
- **Legacy projects**: projects saved by earlier builds that referenced the removed bundled
  studio art are migrated on open. Those layers are dropped with a warning; text, wiki, and
  uploaded layers are preserved, and a bundled background becomes Transparent.

---

## Verification performed

Commands actually run in this environment:

| Command                                   | Result                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| `npm run typecheck`                       | Passed                                                    |
| `npm run lint`                            | Passed (0 errors, 0 warnings)                             |
| `npm run format:check`                    | Passed                                                    |
| `npm run validate:assets`                 | Passed — 1,613 catalog entries, no bundled artwork        |
| `npm run validate:assets -- --check-urls` | Passed — 6 remote image URLs sampled                      |
| `npm run test`                            | Passed - 69 tests in 7 files                              |
| `npm run build`                           | Passed — static build in `dist/`                          |
| `npm run test:e2e`                        | Passed — 9 Chromium tests                                 |
| `npx playwright test e2e/a11y.spec.ts`    | Passed - no axe WCAG A/AA violations in editor or dialogs |

Playwright coverage:

1. Blank transparent project → add a wiki character and two items → drag on canvas →
   add/edit text → save → export a 1280 × 720 PNG → verify bytes/dimensions → reload →
   verify layers, text, and moved position.
2. Upload a PNG → export with transparency (verify alpha 0) → export portable JSON with
   an embedded upload → import in a clean browser context → export successfully.
3. Shrink an outlined sprite → verify its rendered outline width scales down, the
   original width is retained as a reference, and the setting survives a reload.
4. Background selector: verify the Transparent option, load wiki backgrounds, switch
   between them, and return to Transparent.
5. Block the artwork proxy → attempt to export a remote layer → verify the export is
   blocked with a retry/recovery message.
6. Search the verified wiki.gg catalog for “Yum Heart”, add it, and verify source/license
   details.
7. Mobile viewport: verify sheets for Artwork/Layers and a usable canvas.
8. axe-core WCAG 2 A/AA scans of the main editor, export dialog, and project manager.

Live API caveat: wiki.gg returned a Cloudflare challenge to headless Chromium during
verification, so live API unit tests use deterministic fixtures and browser tests use the
catalog metadata. Direct image requests through the proxy succeeded; wiki artwork was
composited and exported at 1280 × 720.

---

## Scripts

| Script                                     | Purpose                                  |
| ------------------------------------------ | ---------------------------------------- |
| `npm run dev`                              | Vite dev server + asset proxy middleware |
| `npm run build`                            | Typecheck + production static build      |
| `npm run preview`                          | Preview the production build             |
| `npm run test` / `test:watch`              | Vitest                                   |
| `npm run test:e2e`                         | Playwright + axe                         |
| `npm run lint` / `format` / `format:check` | Code quality                             |
| `npm run validate:assets`                  | Catalog validator                        |
| `npm run sync:catalog`                     | Refresh wiki.gg metadata snapshot        |

---

## Troubleshooting

- **“The verified artwork catalog is missing”** — run `npm run sync:catalog`, then rebuild.
- **Online artwork unavailable / 403** — Cloudflare may be challenging the browser. Retry,
  switch the source, use uploads, or keep a transparent/text-only composition.
- **Export blocked with a CORS/taint error** — the proxy is offline or a direct remote URL
  was used. Start the dev server (or deploy the Netlify function), retry images, or upload
  the artwork locally.
- **Export blocked with missing images** — use Retry, replace with an upload, or remove the
  problem layers. The app never exports a silently incomplete PNG.
- **“Browser storage is full”** — open Projects, delete old projects, and export JSON first.
- **Fonts look wrong** — reload after the local fonts finish loading; text also redraws
  after `document.fonts.ready` before export.
- **Playwright browser missing** — `npx playwright install chromium`.

---

## Attribution and acknowledgements

- _The Binding of Isaac_ and its artwork are property of Nicalis, Inc. and Edmund McMillen.
  This is an unofficial fan tool and is not affiliated with or endorsed by them.
- Artwork metadata comes from
  [The Binding of Isaac: Rebirth Wiki (wiki.gg)](https://bindingofisaacrebirth.wiki.gg/) via
  the [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page). Wiki text is
  CC BY-SA 4.0; game files are IN COPYRIGHT and are not redistributed here.
- Built with React, Vite, Konva, Radix UI, Tailwind CSS, Zustand, Zod, Lucide, idb-keyval,
  Fontsource, Vitest, Testing Library, Playwright, and axe-core.
