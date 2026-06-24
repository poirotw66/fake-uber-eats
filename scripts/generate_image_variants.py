#!/usr/bin/env python3
"""Resize local WebP assets for feed/menu display and reduce deploy size."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets" / "images"

RESTAURANT_MAX_WIDTH = 560
MENU_MAX_WIDTH = 280
WEBP_QUALITY = 78


def resize_webp(path: Path, max_width: int) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path) as image:
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        if image.width > max_width:
            height = max(1, round(image.height * max_width / image.width))
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        image.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
    return before, path.stat().st_size


def process_folder(folder: Path, max_width: int) -> dict[str, int]:
    stats = {"files": 0, "before": 0, "after": 0, "resized": 0}
    if not folder.is_dir():
        return stats

    for path in sorted(folder.glob("*.webp")):
        with Image.open(path) as probe:
            needs_resize = probe.width > max_width
        before, after = resize_webp(path, max_width)
        stats["files"] += 1
        stats["before"] += before
        stats["after"] += after
        if needs_resize:
            stats["resized"] += 1
    return stats


def main() -> None:
    restaurant_stats = process_folder(ASSETS_DIR / "restaurants", RESTAURANT_MAX_WIDTH)
    menu_stats = process_folder(ASSETS_DIR / "menu", MENU_MAX_WIDTH)

    total_before = restaurant_stats["before"] + menu_stats["before"]
    total_after = restaurant_stats["after"] + menu_stats["after"]
    saved_pct = ((total_before - total_after) / total_before * 100) if total_before else 0

    print(f"Restaurants: {restaurant_stats['files']} files, resized {restaurant_stats['resized']}")
    print(f"Menu: {menu_stats['files']} files, resized {menu_stats['resized']}")
    print(
        f"Total: {total_before / 1024 / 1024:.1f} MB -> {total_after / 1024 / 1024:.1f} MB "
        f"({saved_pct:.1f}% smaller)"
    )


if __name__ == "__main__":
    main()
