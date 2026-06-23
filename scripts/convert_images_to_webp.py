#!/usr/bin/env python3
"""Convert assets/images JPEGs to WebP and rewrite JSON image paths."""

from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets" / "images"
DATA_DIR = ROOT / "data"

IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png")
JSON_GLOBS = (
    DATA_DIR / "restaurants.feed.json",
    DATA_DIR / "restaurants.enriched.json",
    DATA_DIR / "restaurants.json",
)
MENUS_DIR = DATA_DIR / "menus"

WEBP_QUALITY = 82


def convert_file(source: Path) -> Path:
    target = source.with_suffix(".webp")
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target

    with Image.open(source) as image:
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        image.save(target, "WEBP", quality=WEBP_QUALITY, method=6)
    return target


def convert_assets(delete_sources: bool = True) -> tuple[int, int]:
    converted = 0
    deleted = 0
    for suffix in IMAGE_SUFFIXES:
        for source in ASSETS_DIR.rglob(f"*{suffix}"):
            convert_file(source)
            converted += 1
            if delete_sources:
                source.unlink()
                deleted += 1
    return converted, deleted


def rewrite_image_path(value: str) -> str:
    return re.sub(r"\.(jpe?g|png)$", ".webp", value, flags=re.IGNORECASE)


def rewrite_json_object(node: object) -> object:
    if isinstance(node, dict):
        return {key: rewrite_json_object(value) for key, value in node.items()}
    if isinstance(node, list):
        return [rewrite_json_object(item) for item in node]
    if isinstance(node, str) and node.startswith("assets/images/"):
        return rewrite_image_path(node)
    return node


def rewrite_json_files() -> int:
    paths = [path for path in JSON_GLOBS if path.is_file()]
    paths.extend(sorted(MENUS_DIR.glob("*.json")))
    updated = 0
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        rewritten = rewrite_json_object(payload)
        new_text = json.dumps(rewritten, ensure_ascii=False, separators=(",", ":"))
        if path.name in {"restaurants.enriched.json", "restaurants.json"}:
            new_text = json.dumps(rewritten, ensure_ascii=False, indent=2) + "\n"
        path.write_text(new_text, encoding="utf-8")
        updated += 1
    return updated


def main() -> None:
    if not ASSETS_DIR.is_dir():
        raise SystemExit(f"Missing assets directory: {ASSETS_DIR}")

    converted, deleted = convert_assets(delete_sources=True)
    json_count = rewrite_json_files()

    webp_count = len(list(ASSETS_DIR.rglob("*.webp")))
    print(f"Converted {converted} raster files, deleted {deleted} sources")
    print(f"Rewrote image paths in {json_count} JSON files")
    print(f"WebP files under assets/images: {webp_count}")


if __name__ == "__main__":
    main()
