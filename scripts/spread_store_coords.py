#!/usr/bin/env python3
"""Spread overlapping store coordinates around the delivery anchor for map display."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from scrape_ubereats import (  # noqa: E402
    ENRICHED_PATH,
    META_PATH,
    OUTPUT_PATH,
    assign_store_coordinates,
    load_json,
    save_json,
)

ANCHOR_LAT = 25.0382477
ANCHOR_LNG = 121.5691055


def main() -> int:
    meta = load_json(META_PATH, {})
    anchor_lat = float(meta.get("lat", ANCHOR_LAT))
    anchor_lng = float(meta.get("lng", ANCHOR_LNG))

    for path in (ENRICHED_PATH, OUTPUT_PATH):
        if not path.exists():
            continue
        restaurants = load_json(path, [])
        for store in restaurants:
            assign_store_coordinates(store, anchor_lat, anchor_lng)
        save_json(path, restaurants)
        print(f"updated coordinates in {path} ({len(restaurants)} stores)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
