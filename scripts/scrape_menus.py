#!/usr/bin/env python3
"""Scrape real restaurant menus and images into data/restaurants.enriched.json."""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from playwright.sync_api import sync_playwright

from dish_images import resolve_dish_image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets" / "images"
RESTAURANTS_PATH = DATA_DIR / "restaurants.json"
TARGETS_PATH = DATA_DIR / "scrape_targets.json"
OUTPUT_PATH = DATA_DIR / "restaurants.enriched.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKC", name)
    text = re.sub(r"[®™（）()·\-－\s]", "", text)
    return text.lower()


def download_image(url: str, dest: Path, force: bool = False) -> bool:
    if not force and dest.exists() and dest.stat().st_size > 5000:
        return True
    headers: dict[str, str] = {}
    if "scene7.com" in url or "mcdonalds.com" in url:
        headers["Referer"] = "https://www.mcdonalds.com/"
    if "wikimedia.org" in url:
        headers["User-Agent"] = "FakeUberEatsDemo/1.0 (educational; contact@localhost)"
    try:
        resp = SESSION.get(url, timeout=30, headers=headers)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "image" not in content_type and not url.endswith((".jpg", ".png", ".webp", ".jpeg")):
            return False
        if len(resp.content) < 2000 and b"<html" in resp.content[:256].lower():
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(resp.content)
        return dest.stat().st_size > 5000
    except requests.RequestException:
        return False


def to_asset_path(full_path: Path) -> str:
    return str(full_path.relative_to(ROOT)).replace("\\", "/")


def scrape_mcdonalds_tw(menu_urls: list[str]) -> list[dict[str, str]]:
    products: list[dict[str, str]] = []
    seen: set[str] = set()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)

        for url in menu_urls:
            for attempt in range(3):
                try:
                    page.goto(url, timeout=60000, wait_until="domcontentloaded")
                    break
                except Exception as exc:
                    if attempt == 2:
                        print(f"    warn: failed to load {url}: {exc}")
                        continue
                    time.sleep(2)
            else:
                continue
            page.wait_for_timeout(3500)
            items = page.evaluate(
                """() => {
                const out = [];
                for (const el of document.querySelectorAll('a')) {
                    const img = el.querySelector('img[src*="scene7"]');
                    const text = el.innerText?.trim();
                    if (!img || !text) continue;
                    const name = text.split('\\n')[0].trim();
                    if (!name || name.length > 40) continue;
                    if (!el.href.includes('/product/')) continue;
                    out.push({ name, img: img.src, href: el.href });
                }
                return out;
            }"""
            )
            for item in items:
                key = normalize_name(item["name"])
                if key in seen:
                    continue
                seen.add(key)
                products.append(item)

        browser.close()

    return products


def fetch_wikimedia_image(query: str) -> str | None:
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}",
        "gsrnamespace": 6,
        "gsrlimit": 5,
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": 640,
        "format": "json",
    }
    for attempt in range(3):
        try:
            resp = SESSION.get(
                "https://commons.wikimedia.org/w/api.php",
                params=params,
                timeout=20,
                headers={"User-Agent": "FakeUberEatsDemo/1.0 (educational; contact@localhost)"},
            )
            if resp.status_code == 429:
                time.sleep(2 + attempt * 2)
                continue
            resp.raise_for_status()
            payload = resp.json()
            pages = payload.get("query", {}).get("pages", {})
            for page in pages.values():
                infos = page.get("imageinfo", [])
                if not infos:
                    continue
                url = infos[0].get("thumburl") or infos[0].get("url")
                if url:
                    return url
        except (requests.RequestException, ValueError):
            time.sleep(1)
    return None


def match_menu_item(menu_name: str, scraped: list[dict[str, str]]) -> dict[str, str] | None:
    target = normalize_name(menu_name)
    for item in scraped:
        if normalize_name(item["name"]) in target or target in normalize_name(item["name"]):
            return item
    for item in scraped:
        for keyword in re.findall(r"[\u4e00-\u9fffA-Za-z]{2,}", menu_name):
            if normalize_name(keyword) in normalize_name(item["name"]):
                return item
    return None


def enrich_restaurant(restaurant: dict[str, Any], target: dict[str, Any]) -> dict[str, Any]:
    enriched = {**restaurant}
    restaurant_id = restaurant["id"]
    scraped_products: list[dict[str, str]] = []

    if target.get("source") == "mcdonalds_tw":
        scraped_products = list(target.get("curated_products", []))
        if target.get("menu_urls"):
            print(f"  [mcdonalds] scraping {restaurant['name']}...")
            live_products = scrape_mcdonalds_tw(target.get("menu_urls", []))
            print(f"  live scrape found {len(live_products)} products")
            seen = {normalize_name(p["name"]) for p in scraped_products}
            for product in live_products:
                key = normalize_name(product["name"])
                if key not in seen:
                    scraped_products.append(product)
                    seen.add(key)
        print(f"  total mcd products {len(scraped_products)}")

    cover_path = ASSETS_DIR / "restaurants" / f"{restaurant_id}.jpg"
    if target.get("cover_image") and target.get("source") == "mcdonalds_tw":
        if download_image(target["cover_image"], cover_path, force=True):
            enriched["coverImage"] = to_asset_path(cover_path)
            print(f"  cover saved: {enriched['coverImage']}")
    elif target.get("cover_query"):
        cover_url = fetch_wikimedia_image(target["cover_query"])
        if cover_url and download_image(cover_url, cover_path):
            enriched["coverImage"] = to_asset_path(cover_path)
            print(f"  cover saved: {enriched['coverImage']}")

    menu_queries: dict[str, str] = target.get("menu_queries", {})
    curated_images: dict[str, str] = target.get("curated_menu_images", {})
    updated_menu = []

    for item in restaurant.get("menu", []):
        menu_item = {**item}
        image_path = ASSETS_DIR / "menu" / f"{restaurant_id}-{item['id']}.jpg"
        image_saved = False

        matched_url = resolve_dish_image(item["name"], item["id"], restaurant.get("category", ""))
        if matched_url:
            image_saved = download_image(matched_url, image_path, force=True)
            if scraped_products:
                matched = match_menu_item(item["name"], scraped_products)
                if matched:
                    if not menu_item.get("desc"):
                        menu_item["desc"] = f"來自麥當勞官網 · {matched['name']}"
                    menu_item["sourceUrl"] = matched.get("href")

        if not image_saved and item["name"] in menu_queries:
            query = menu_queries[item["name"]]
            print(f"  [wikimedia] {item['name']} <- {query}")
            url = fetch_wikimedia_image(query)
            if url:
                image_saved = download_image(url, image_path)
            time.sleep(0.3)

        if not image_saved and image_path.exists() and image_path.stat().st_size > 5000:
            image_saved = True

        if image_saved:
            menu_item["image"] = to_asset_path(image_path)
        updated_menu.append(menu_item)

    if scraped_products and not enriched.get("coverImage"):
        first = scraped_products[0]
        cover_path = ASSETS_DIR / "restaurants" / f"{restaurant_id}.jpg"
        if download_image(first["img"], cover_path):
            enriched["coverImage"] = to_asset_path(cover_path)

    if not enriched.get("coverImage"):
        hero_item = next(
            (m for m in updated_menu if m.get("badge") == "人氣" and m.get("image")),
            next((m for m in updated_menu if m.get("image")), None),
        )
        if hero_item:
            enriched["coverImage"] = hero_item["image"]
        else:
            cover_url = resolve_dish_image(restaurant.get("name", ""), 0, restaurant.get("category", ""))
            if cover_url and download_image(cover_url, cover_path, force=True):
                enriched["coverImage"] = to_asset_path(cover_path)

    enriched["menu"] = updated_menu
    enriched["scrapedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    enriched["dataSource"] = target.get("source", "manual")
    return enriched


def main() -> int:
    restaurants = load_json(RESTAURANTS_PATH)
    targets = load_json(TARGETS_PATH)

    enriched_list = []
    existing = {}
    if OUTPUT_PATH.exists():
        existing = {r["id"]: r for r in load_json(OUTPUT_PATH)}

    for restaurant in restaurants:
        restaurant_id = restaurant["id"]
        target = targets.get(restaurant_id, {"source": "auto"})

        print(f"enriching {restaurant['name']} ({restaurant_id})...")
        try:
            enriched_list.append(enrich_restaurant(restaurant, target))
        except Exception as exc:
            print(f"  error: {exc}; keeping previous data if available")
            enriched_list.append(existing.get(restaurant_id, restaurant))

    save_json(OUTPUT_PATH, enriched_list)
    print(f"\nWrote {OUTPUT_PATH}")
    print(f"Images in {ASSETS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
