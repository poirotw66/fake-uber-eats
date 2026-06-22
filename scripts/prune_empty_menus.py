#!/usr/bin/env python3
"""Remove restaurants with no menu items from scraped JSON files."""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from scrape_ubereats import (  # noqa: E402
    ENRICHED_PATH,
    META_PATH,
    OUTPUT_PATH,
    load_json,
    save_json,
)


def prune_restaurants_without_menus() -> int:
    source = ENRICHED_PATH if ENRICHED_PATH.exists() else OUTPUT_PATH
    if not source.exists():
        print(f"no data at {source}")
        return 1

    restaurants = load_json(source, [])
    if not isinstance(restaurants, list):
        print("invalid restaurant list")
        return 1

    kept = [store for store in restaurants if len(store.get("menu") or []) > 0]
    removed = len(restaurants) - len(kept)
    if removed == 0:
        print(f"nothing to prune ({len(kept)} stores, all have menus)")
        return 0

    archive_path = ROOT / "data" / "restaurants.removed-no-menu.json"
    removed_stores = [store for store in restaurants if len(store.get("menu") or []) == 0]
    save_json(archive_path, removed_stores)
    save_json(OUTPUT_PATH, kept)
    save_json(ENRICHED_PATH, kept)
    save_json(
        META_PATH,
        {
            "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "pruned-no-menu",
            "storeCount": len(kept),
            "removedCount": removed,
            "storesWithMenu": len(kept),
        },
    )
    print(f"kept {len(kept)} stores with menus")
    print(f"removed {removed} stores without menus")
    print(f"archive: {archive_path}")
    print(f"wrote {ENRICHED_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(prune_restaurants_without_menus())
