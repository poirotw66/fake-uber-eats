# Uber Eats Not!!

> 看起來能點，實際上不能 · 餐點不會到 · 錢不會少 · 多巴胺會到

**All the appetite, none of the delivery.**

A static Uber Eats–style demo: browse real-looking restaurant feeds, build a cart, fake checkout, and watch an animated driver on the map. Not affiliated with Uber Eats. No food will arrive.

**[Live demo](http://www.bloss0m.com/fake-uber-eats/)**

## Features

- Restaurant feed with search, sort, filters, and infinite scroll
- Lazy-loaded menus (`restaurants.feed.json` + per-store JSON)
- Address geocoding (ArcGIS + Photon) with draggable map pin
- Fake checkout and live-style delivery tracking (OSRM routes)
- WebP images and a slim GitHub Pages deploy artifact

## Quick start

```bash
npm ci
npm run build
python -m http.server 8080
```

Open `http://localhost:8080`. After editing `js/*.js`, run `npm run build` again.

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | App shell |
| `js/app.bundle.js` | Vite-built IIFE bundle (production) |
| `js/main.js` | ESM entry; imports feature modules |
| `js/core.js` | Config, state, shared utils |
| `js/feed.js` | Home feed, search, menus |
| `js/geocode.js` | Address sheet and geocoding |
| `js/cart.js` | Cart and checkout |
| `js/tracking.js` | Delivery map and celebration |
| `js/router.js` | Hash routing |
| `js/app.js` | Init and event wiring |
| `css/*.css` | Split stylesheets (base, home, restaurant, checkout, tracking, responsive) |
| `data/restaurants.feed.json` | Lightweight feed index |
| `data/menus/*.json` | Per-restaurant menus |
| `assets/images/` | Local WebP covers and menu photos |

## Refresh restaurant data

Requires Python 3, Playwright, and a `.env` with scrape settings (see `scripts/requirements.txt`).

```bash
pip install -r scripts/requirements.txt
playwright install chromium
./scripts/run_scrape.sh          # full scrape + feed index
./scripts/scrape_menus_only.sh   # menus only (faster)
```

After scraping, images are stored as WebP. `scripts/build_feed_index.py` splits enriched data into the feed index and menu files.

## Development

```bash
npm ci
npm run build                  # js/app.bundle.js (minified IIFE)
node scripts/smoke_test.mjs    # verify bundle exports
bash scripts/prepare_pages_deploy.sh   # build slim _site/ artifact
node scripts/split_styles.mjs  # re-split styles.css into css/*.css
```

CI runs `verify.yml` on push/PR (build + smoke test). `deploy.yml` builds the bundle and publishes `_site/` to GitHub Pages.

## Disclaimer

This is a parody / UI demo for education and entertainment. Restaurant names, menus, and images may come from public Uber Eats listings via scraping scripts. Do not use for production ordering or impersonation.
