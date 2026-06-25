# Uber Eats Not!!

> 看起來能點，實際上不能 · 餐點不會到 · 錢不會少 · 多巴胺會到

**All the appetite, none of the delivery.**

A static Uber Eats–style demo: browse real-looking restaurant feeds, build a cart, fake checkout, and watch an animated driver on the map. Not affiliated with Uber Eats. No food will arrive.

**[Live demo](http://www.bloss0m.com/fake-uber-eats/)**

## Features

- Restaurant feed with search, sort, filters, and infinite scroll
- Lazy-loaded menus (`restaurants.feed.json` + per-store JSON under `data/menus/`)
- Address geocoding (ArcGIS + Photon) with draggable map pin
- Fake checkout and live-style delivery tracking (OSRM routes)
- WebP images with resized variants for faster loads
- Slim GitHub Pages deploy artifact (~100 MB)

## Prerequisites

| Task | Requirements |
|------|----------------|
| Run the site locally | Node.js 24+, npm |
| Refresh restaurant data | Python 3, Playwright, `.env` (see `scripts/requirements.txt`) |

## Quick start

```bash
npm ci
npm run build          # writes js/app.bundle.js (gitignored; built in CI too)
python -m http.server 8080
```

Open `http://localhost:8080`.

> **Note:** `index.html` loads the Vite-built bundle, not the ESM source files. After editing `js/*.js`, run `npm run build` again.

## Frontend architecture

Source modules use ES modules and share a single namespace via `js/app-ns.js` (`window.App`). Vite bundles them into one minified IIFE for production.

```
js/main.js          → entry (DOMContentLoaded → App.init())
js/app-ns.js        → shared App namespace
js/core.js          → config, state, utilities
js/feed.js          → home feed, search, menus
js/geocode.js       → address sheet and geocoding
js/cart.js          → cart and checkout
js/tracking.js      → delivery map and celebration
js/router.js        → hash routing
js/app.js           → init and event wiring
        ↓  npm run build (Vite)
js/app.bundle.js    → single script loaded by index.html
```

Styles are split by screen and breakpoint (edit these directly; `styles.css` is an optional `@import` aggregator):

| File | Scope |
|------|-------|
| `css/base.css` | Variables, reset, shared components |
| `css/home.css` | Home feed and hero |
| `css/restaurant.css` | Restaurant detail page |
| `css/checkout.css` | Checkout flow |
| `css/tracking.css` | Delivery tracking and reveal |
| `css/responsive.css` | Tablet and mobile `@media` rules |

External runtime dependencies (not bundled): [Leaflet](https://leafletjs.com/), `dish_images.js`.

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | App shell |
| `js/app.bundle.js` | Production bundle (build output, not committed) |
| `js/*.js` | ESM source modules |
| `css/*.css` | Split stylesheets |
| `data/restaurants.feed.json` | Lightweight feed index (~700 KB) |
| `data/menus/*.json` | Per-restaurant menus (lazy-loaded) |
| `assets/images/` | Local WebP covers and menu photos |
| `scripts/` | Scrape, image, build, and deploy helpers |
| `_site/` | Slim deploy artifact (`prepare_pages_deploy.sh`) |

## Refresh restaurant data

Requires Python 3, Playwright, and scrape settings in `.env`.

```bash
pip install -r scripts/requirements.txt
playwright install chromium
./scripts/run_scrape.sh          # full pipeline (see below)
./scripts/scrape_menus_only.sh   # menus only (faster)
```

Full scrape pipeline (`run_scrape.sh`):

1. `scrape_ubereats.py` — fetch listings, menus, images
2. `convert_images_to_webp.py` — convert JPEG/PNG sources to WebP
3. `generate_image_variants.py` — resize covers (560px) and menu thumbs (280px)
4. `build_feed_index.py` — split enriched data into feed index + per-store menu files

To rebuild only the feed index from existing enriched data:

```bash
python scripts/build_feed_index.py
python scripts/build_feed_index.py --slim-feed-only   # refresh feed.json without re-splitting menus
```

## Development

```bash
npm ci
npm run build
node scripts/smoke_test.mjs              # verify App exports on the bundle
bash scripts/prepare_pages_deploy.sh     # assemble slim _site/ for Pages preview
```

Maintenance scripts:

```bash
node scripts/split_styles.mjs    # re-split root styles.css → css/*.css
node scripts/convert_to_esm.mjs  # re-apply ESM wrapper after bulk edits (rare)
```

### CI and deploy

- **`verify.yml`** (push / PR): `npm ci` → `npm run build` → syntax check → smoke test
- **`deploy.yml`** (push to `main`): same verify steps, then `prepare_pages_deploy.sh` → GitHub Pages

The deploy artifact excludes dev-only files (raw JSON dumps, JPEG sources, ESM sources, `node_modules/`) and ships only `js/app.bundle.js` plus static assets.

## Disclaimer

This is a parody / UI demo for education and entertainment. Restaurant names, menus, and images may come from public Uber Eats listings via scraping scripts. Do not use for production ordering or impersonation.
