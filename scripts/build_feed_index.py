#!/usr/bin/env python3
"""Split restaurants.enriched.json into a lightweight feed index and per-store menus."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENRICHED = ROOT / "data" / "restaurants.enriched.json"
FEED_OUT = ROOT / "data" / "restaurants.feed.json"
MENUS_DIR = ROOT / "data" / "menus"

FEED_KEYS = (
    "id",
    "ueStoreId",
    "slug",
    "name",
    "category",
    "emoji",
    "address",
    "lat",
    "lng",
    "coordsSource",
    "rating",
    "deliveryMinutes",
    "deliveryFee",
    "tagline",
    "storeUrl",
    "coverImage",
)


def build_search_text(store: dict) -> str:
    """Store-level text only; dish names live in menuNames for search."""
    parts = [
        store.get("name", ""),
        store.get("tagline", ""),
        store.get("category", ""),
        store.get("address", ""),
    ]
    return " ".join(p for p in parts if p).lower()


def slim_feed_only() -> None:
    if not FEED_OUT.is_file():
        raise SystemExit(f"Missing {FEED_OUT}")

    feed = json.loads(FEED_OUT.read_text(encoding="utf-8"))
    for entry in feed:
        entry["searchText"] = build_search_text(entry)

    FEED_OUT.write_text(
        json.dumps(feed, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    feed_kb = FEED_OUT.stat().st_size / 1024
    print(f"Slimmed searchText for {len(feed)} stores in {FEED_OUT} ({feed_kb:.1f} KB)")


def main() -> None:
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--slim-feed-only":
        slim_feed_only()
        return

    if not ENRICHED.is_file():
        raise SystemExit(f"Missing {ENRICHED}")

    stores = json.loads(ENRICHED.read_text(encoding="utf-8"))
    MENUS_DIR.mkdir(parents=True, exist_ok=True)

    feed: list[dict] = []
    menu_count = 0

    for store in stores:
        menu = store.get("menu") or []
        if not menu:
            continue

        entry = {key: store[key] for key in FEED_KEYS if key in store}
        entry["menuCount"] = len(menu)
        entry["searchText"] = build_search_text(store)
        entry["menuNames"] = [item.get("name", "") for item in menu if item.get("name")]
        entry["previewItems"] = [
            {
                "image": item.get("image"),
                "emoji": item.get("emoji"),
                "name": item.get("name"),
            }
            for item in menu
            if item.get("image")
        ][:3]

        menu_path = MENUS_DIR / f"{store['id']}.json"
        menu_path.write_text(
            json.dumps(menu, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        feed.append(entry)
        menu_count += 1

    FEED_OUT.write_text(
        json.dumps(feed, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    feed_kb = FEED_OUT.stat().st_size / 1024
    print(f"Wrote {len(feed)} stores to {FEED_OUT} ({feed_kb:.1f} KB)")
    print(f"Wrote {menu_count} menu files under {MENUS_DIR}")


if __name__ == "__main__":
    main()
