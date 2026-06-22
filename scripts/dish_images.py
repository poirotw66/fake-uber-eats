"""Resolve menu item names to semantically matching food image URLs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "data" / "dish_image_rules.json"
ITEM_IMAGES_PATH = ROOT / "data" / "item_images.json"

_RULES_CACHE: dict[str, Any] | None = None
_ITEM_IMAGES_CACHE: dict[str, str] | None = None


def load_rules() -> dict[str, Any]:
    global _RULES_CACHE
    if _RULES_CACHE is None:
        with RULES_PATH.open(encoding="utf-8") as handle:
            _RULES_CACHE = json.load(handle)
    return _RULES_CACHE


def load_item_images() -> dict[str, str]:
    global _ITEM_IMAGES_CACHE
    if _ITEM_IMAGES_CACHE is None:
        with ITEM_IMAGES_PATH.open(encoding="utf-8") as handle:
            raw = json.load(handle)
        _ITEM_IMAGES_CACHE = {str(key): value for key, value in raw.items()}
    return _ITEM_IMAGES_CACHE


def resolve_dish_image(item_name: str, item_id: int, shop_category: str = "") -> str | None:
    item_images = load_item_images()
    explicit = item_images.get(str(item_id))
    if explicit:
        return explicit

    rules = load_rules()
    mcd_map: dict[str, str] = rules.get("mcd_scene7", {})
    for key, url in mcd_map.items():
        if key in item_name:
            return url

    sorted_rules = sorted(
        rules.get("rules", []),
        key=lambda rule: max(len(keyword) for keyword in rule.get("keywords", [""])),
        reverse=True,
    )
    for rule in sorted_rules:
        keywords: list[str] = rule.get("keywords", [])
        if not any(keyword in item_name for keyword in keywords):
            continue
        images: list[str] = rule.get("images", [])
        if not images:
            continue
        return images[item_id % len(images)]

    category_fallbacks = {
        "中式": "https://images.pexels.com/photos/7282337/pexels-photo-7282337.jpeg?auto=compress&cs=tinysrgb&w=640",
        "炸物": "https://images.pexels.com/photos/60616/fried-chicken-chicken-fried-crunchy-60616.jpeg?auto=compress&cs=tinysrgb&w=640",
        "飲料": "https://images.pexels.com/photos/3026810/pexels-photo-3026810.jpeg?auto=compress&cs=tinysrgb&w=640",
        "日式": "https://www.themealdb.com/images/media/meals/ip5xtp1769779958.jpg",
        "披薩": "https://images.pexels.com/photos/1146760/pexels-photo-1146760.jpeg?auto=compress&cs=tinysrgb&w=640",
        "咖啡": "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=640",
    }
    return category_fallbacks.get(shop_category)
