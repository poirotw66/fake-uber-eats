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

Serve the repo root with any static file server:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | App shell |
| `js/core.js` | Config, state, shared utils |
| `js/feed.js` | Home feed, search, menus |
| `js/geocode.js` | Address sheet and geocoding |
| `js/cart.js` | Cart and checkout |
| `js/tracking.js` | Delivery map and celebration |
| `js/router.js` | Hash routing |
| `js/app.js` | Init and event wiring |
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
node scripts/smoke_test.mjs      # load all js modules, check exports
bash scripts/prepare_pages_deploy.sh   # build slim _site/ artifact
```

CI runs `verify.yml` on push/PR (syntax check + smoke test). `deploy.yml` publishes `_site/` to GitHub Pages.

## Disclaimer

This is a parody / UI demo for education and entertainment. Restaurant names, menus, and images may come from public Uber Eats listings via scraping scripts. Do not use for production ordering or impersonation.
