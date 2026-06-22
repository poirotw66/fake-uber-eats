#!/usr/bin/env python3
"""Scrape Uber Eats feed and store menus into data/restaurants.json."""

from __future__ import annotations

import hashlib
import json
import math
import os
import random
import re
import shutil
import sys
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, unquote

import requests
from playwright.sync_api import BrowserContext, Page, Response, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets" / "images"
AUTH_STATE_PATH = DATA_DIR / ".ubereats-auth.json"
OUTPUT_PATH = DATA_DIR / "restaurants.json"
ENRICHED_PATH = DATA_DIR / "restaurants.enriched.json"
META_PATH = DATA_DIR / "scrape_meta.json"
UUID_MAP_PATH = DATA_DIR / "store_uuid_map.json"
UBEREATS_API_BASE = "https://www.ubereats.com/_p/api"

DEFAULT_FEED_URL = (
    "https://www.ubereats.com/tw/feed?diningMode=DELIVERY&pl="
    "JTdCJTIyYWRkcmVzcyUyMiUzQSUyMiVFNSU5QyU4QiVFNiVCMyVCMCVFOSU4NyU5MSVFOCU5RSU4RCVFNCVCOCVBRCVFNSVCRiU4MyUyMiUyQyUyMnJlZmVyZW5jZSUyMiUzQSUyMkNoSUpVd2xHOExxclFqUVJqZlJnQmxzd0luUSUyMiUyQyUyMnJlZmVyZW5jZVR5cGUlMjIlM0ElMjJnb29nbGVfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0EyNS4wMzgyNDc3JTJDJTIybG9uZ2l0dWRlJTIyJTNBMTIxLjU2OTEwNTQ5OTk5OTk4JTdE"
)
DEFAULT_LOCATION = {
    "address": "國泰金融中心",
    "lat": 25.0382477,
    "lng": 121.5691055,
}
UBER_AUTH_BASE_URL = "https://auth.uber.com/v2/"
UBEREATS_FEED_HOME = "https://www.ubereats.com/tw/feed"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text)
    slug = re.sub(r"[^\w\u4e00-\u9fff]+", "-", normalized, flags=re.UNICODE)
    return slug.strip("-").lower()[:48] or "store"


def cents_to_ntd(amount: Any) -> int:
    if amount is None:
        return 0
    if isinstance(amount, dict):
        amount = amount.get("amount") or amount.get("value") or 0
    value = int(amount)
    if value <= 0:
        return 0
    # Uber Eats menu prices are in minor currency units (e.g. 20500 -> NT$205).
    return value // 100 if value >= 100 else value


def text_value(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("text") or value.get("name") or "").strip()
    return str(value or "").strip()


def extract_short_store_id(store_url: str) -> str:
    return store_url.rstrip("/").split("/")[-1]


def is_valid_jpeg(path: Path, min_bytes: int = 1500) -> bool:
    if not path.exists():
        return False
    try:
        if path.stat().st_size < min_bytes:
            return False
        return path.read_bytes()[:3] == b"\xff\xd8\xff"
    except OSError:
        return False


def download_image(
    url: str,
    dest: Path,
    http: requests.Session | None = None,
) -> bool:
    if not url or not url.startswith("http"):
        return False
    if is_valid_jpeg(dest, min_bytes=4000):
        return True
    if dest.exists() and not is_valid_jpeg(dest):
        dest.unlink(missing_ok=True)
    headers = {"Referer": "https://www.ubereats.com/"}
    session = http or SESSION
    try:
        response = session.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        content = response.content
        if len(content) < 1500 or content[:3] != b"\xff\xd8\xff":
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
        return is_valid_jpeg(dest, min_bytes=4000)
    except requests.RequestException:
        return False


def to_asset_path(full_path: Path) -> str:
    return str(full_path.relative_to(ROOT)).replace("\\", "/")


def is_valid_ubereats_store_url(url: str) -> bool:
    if "ubereats.com" not in url.lower():
        return False
    return bool(re.search(r"/store/[^/]+/[^/?#]+", url, re.IGNORECASE))


def filter_dom_stores(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    filtered: list[dict[str, Any]] = []
    for card in cards:
        store_url = card.get("storeUrl", "")
        if not is_valid_ubereats_store_url(store_url):
            continue
        if store_url in seen:
            continue
        seen.add(store_url)
        name = (card.get("name") or "").strip()
        if not name or name.lower() in {"android", "iphone", "ios"}:
            continue
        if len(name) > 80:
            continue
        filtered.append(card)
    return filtered


def looks_like_feed_store(node: dict[str, Any]) -> bool:
    """Distinguish feed restaurants from nested menu catalog items."""
    if node.get("catalogItems") or node.get("items") or node.get("entities"):
        return False
    if node.get("itemDescription") or node.get("hasCustomizations"):
        return False
    name = node.get("title") or node.get("name") or node.get("storeName")
    store_id = node.get("uuid") or node.get("storeUuid")
    if not name or not store_id:
        return False
    if node.get("price") and not node.get("rating") and not node.get("etaRange"):
        return False
    if node.get("storeUrl") or node.get("actionUrl"):
        return True
    if node.get("rating") or node.get("etaRange") or node.get("fareBadge"):
        return True
    if node.get("heroImageUrl") and node.get("slug"):
        return True
    return False


def extract_feed_stores_from_payload(payload: Any) -> list[dict[str, Any]]:
    stores: list[dict[str, Any]] = []
    if not isinstance(payload, dict):
        return stores

    data = payload.get("data")
    data_dict = data if isinstance(data, dict) else {}
    stores_map = (
        data_dict.get("storesMap")
        or payload.get("storesMap")
        or data_dict.get("feedItems")
    )
    if isinstance(stores_map, dict):
        stores.extend(stores_map.values())
    elif isinstance(stores_map, list):
        for item in stores_map:
            if isinstance(item, dict) and item.get("store"):
                stores.append(item["store"])
            elif looks_like_feed_store(item):
                stores.append(item)

    found: list[dict[str, Any]] = []
    for store in stores:
        if looks_like_feed_store(store):
            found.append(store)

    if found:
        return found

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if looks_like_feed_store(node):
                found.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    deduped: dict[str, dict[str, Any]] = {}
    for store in found:
        key = str(store.get("uuid") or store.get("storeUuid") or store.get("id"))
        deduped[key] = store
    return list(deduped.values())


def deep_find_menu_sections(payload: Any) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            title = node.get("title") or node.get("name")
            items = node.get("catalogItems") or node.get("items") or node.get("entities")
            if title and isinstance(items, list) and items:
                sections.append({"title": title, "items": items})
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return sections


def extract_store_coordinates(
    store: dict[str, Any],
    fallback_lat: float,
    fallback_lng: float,
) -> tuple[float, float]:
    for key in ("location", "mapMarker", "storeLocation"):
        block = store.get(key)
        if not isinstance(block, dict):
            continue
        lat = block.get("latitude", block.get("lat"))
        lng = block.get("longitude", block.get("lng"))
        if lat is not None and lng is not None:
            try:
                return float(lat), float(lng)
            except (TypeError, ValueError):
                continue
    return fallback_lat, fallback_lng


def spread_store_coordinates(
    store_id: str,
    anchor_lat: float,
    anchor_lng: float,
) -> tuple[float, float]:
    digest = int(hashlib.md5(f"ue-spread:{store_id}".encode()).hexdigest()[:8], 16)
    angle = (digest % 360) * math.pi / 180
    radius_km = 0.35 + (digest % 15) * 0.07
    lat_rad = math.radians(anchor_lat)
    dlat = radius_km / 111.0 * math.cos(angle)
    dlng = radius_km / (111.0 * math.cos(lat_rad)) * math.sin(angle)
    return anchor_lat + dlat, anchor_lng + dlng


def store_has_real_coords(
    store: dict[str, Any],
    anchor_lat: float,
    anchor_lng: float,
) -> bool:
    if store.get("coordsSource") == "api":
        return True
    lat = store.get("lat")
    lng = store.get("lng")
    if lat is None or lng is None:
        return False
    lat_f, lng_f = float(lat), float(lng)
    if abs(lat_f - anchor_lat) < 1e-6 and abs(lng_f - anchor_lng) < 1e-6:
        return False
    store_id = str(store.get("id") or store.get("ueStoreId") or store.get("name"))
    spread_lat, spread_lng = spread_store_coordinates(store_id, anchor_lat, anchor_lng)
    if abs(lat_f - spread_lat) < 1e-5 and abs(lng_f - spread_lng) < 1e-5:
        return False
    return True


def assign_store_coordinates(
    store: dict[str, Any],
    anchor_lat: float,
    anchor_lng: float,
) -> None:
    lat, lng = extract_store_coordinates(store, anchor_lat, anchor_lng)
    if abs(lat - anchor_lat) < 1e-6 and abs(lng - anchor_lng) < 1e-6:
        lat, lng = spread_store_coordinates(
            str(store.get("id") or store.get("ueStoreId") or store.get("name")),
            anchor_lat,
            anchor_lng,
        )
    store["lat"] = lat
    store["lng"] = lng


def extract_store_location_from_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    data = payload.get("data")
    if not isinstance(data, dict):
        return None
    location = data.get("location")
    if not isinstance(location, dict):
        lat, lng = extract_store_coordinates(data, 0.0, 0.0)
        if lat == 0.0 and lng == 0.0:
            return None
        return {"lat": lat, "lng": lng, "address": str(data.get("address") or "").strip()}
    lat = location.get("latitude", location.get("lat"))
    lng = location.get("longitude", location.get("lng"))
    if lat is None or lng is None:
        return None
    address = str(
        location.get("streetAddress")
        or location.get("address")
        or data.get("address")
        or ""
    ).strip()
    return {"lat": float(lat), "lng": float(lng), "address": address}


def apply_store_location_from_payload(store: dict[str, Any], payload: dict[str, Any]) -> bool:
    meta = extract_store_location_from_payload(payload)
    if not meta:
        return False
    store["lat"] = meta["lat"]
    store["lng"] = meta["lng"]
    if meta.get("address"):
        store["address"] = meta["address"]
    return True
def parse_store_card(store: dict[str, Any]) -> dict[str, Any] | None:
    store_id = store.get("uuid") or store.get("storeUuid") or store.get("id")
    name = store.get("title") or store.get("name") or store.get("storeName")
    if not store_id or not name:
        return None

    slug = store.get("slug") or slugify(str(name))
    rating_block = store.get("rating") or {}
    rating = rating_block.get("ratingValue") if isinstance(rating_block, dict) else rating_block
    if rating is None:
        rating = store.get("ratingValue") or 4.5

    eta = store.get("etaRange") or store.get("deliveryTime") or {}
    delivery_minutes = 25
    if isinstance(eta, dict):
        text = eta.get("text") or eta.get("displayString") or ""
        match = re.search(r"(\d+)", str(text))
        if match:
            delivery_minutes = int(match.group(1))
    elif isinstance(eta, str):
        match = re.search(r"(\d+)", eta)
        if match:
            delivery_minutes = int(match.group(1))

    fee_block = store.get("fareBadge") or store.get("deliveryFee") or {}
    delivery_fee = 49
    if isinstance(fee_block, dict):
        fee_text = fee_block.get("text") or fee_block.get("displayString") or ""
        match = re.search(r"(\d+)", str(fee_text))
        if match:
            delivery_fee = int(match.group(1))

    image = (
        store.get("heroImageUrl")
        or store.get("imageUrl")
        or store.get("image")
        or (store.get("heroImageUrls") or [None])[0]
    )
    store_url = store.get("storeUrl") or store.get("actionUrl")
    if not store_url:
        return None
    if store_url.startswith("/"):
        store_url = f"https://www.ubereats.com{store_url}"
    if not is_valid_ubereats_store_url(store_url):
        return None

    categories = store.get("categories") or store.get("cuisineList") or []
    category = categories[0] if categories else "美食"
    lat, lng = extract_store_coordinates(store, DEFAULT_LOCATION["lat"], DEFAULT_LOCATION["lng"])

    return {
        "id": f"ue-{store_id}",
        "ueStoreId": str(store_id),
        "slug": slug,
        "name": str(name).strip(),
        "category": str(category),
        "emoji": "🍽️",
        "address": store.get("location", {}).get("address") if isinstance(store.get("location"), dict) else "",
        "lat": lat,
        "lng": lng,
        "rating": round(float(rating), 1),
        "deliveryMinutes": delivery_minutes,
        "deliveryFee": delivery_fee,
        "tagline": store.get("meta") or store.get("description") or "Uber Eats 人氣餐廳",
        "coverImageUrl": image,
        "storeUrl": store_url,
        "menu": [],
    }


def parse_menu_item(item: dict[str, Any], index: int, category: str) -> dict[str, Any] | None:
    name = text_value(item.get("title") or item.get("name"))
    if not name:
        return None
    category = text_value(category) or "精選"
    price_block = item.get("price") or item.get("displayPrice") or {}
    price = cents_to_ntd(price_block.get("amount") if isinstance(price_block, dict) else price_block)
    if not price and isinstance(price_block, dict):
        price = cents_to_ntd(price_block.get("value"))
    image = item.get("imageUrl") or item.get("heroImageUrl")
    if isinstance(image, dict):
        image = image.get("url")
    desc = item.get("itemDescription") or item.get("description") or item.get("subtitle") or ""
    badge = None
    labels = item.get("labelPrimary") or item.get("badges") or []
    if isinstance(labels, list) and labels:
        badge = labels[0].get("text") if isinstance(labels[0], dict) else str(labels[0])
    return {
        "id": index,
        "name": str(name).strip(),
        "emoji": "🍽️",
        "price": price or 99,
        "category": category,
        "desc": str(desc).strip() or "Uber Eats 菜單品項",
        "badge": badge,
        "imageUrl": image,
        "soldCount": 100 + (index * 17) % 400,
    }


PLACEHOLDER_PASSWORDS = {"", "your-password", "changeme", "password"}


def effective_password(raw: str) -> str:
    value = raw.strip()
    if value.lower() in PLACEHOLDER_PASSWORDS:
        return ""
    return value


def build_auth_login_url(return_url: str | None = None) -> str:
    """Uber Eats TW uses auth.uber.com/v2 for OTP login."""
    target = return_url or UBEREATS_FEED_HOME
    override = os.environ.get("UBEREATS_AUTH_URL", "").strip()
    if override:
        return override
    encoded = quote(target, safe="")
    return f"{UBER_AUTH_BASE_URL}?next_url={encoded}"


def is_login_url(url: str) -> bool:
    lowered = url.lower()
    return (
        "/login" in lowered
        or "auth.uber.com" in lowered
        or "login.uber.com" in lowered
    )


def is_on_auth_flow(page: Page) -> bool:
    return is_login_url(page.url)


def read_login_signals(page: Page) -> dict[str, Any]:
    """DOM-only login probe. Cookies are unreliable for guest vs account."""
    try:
        return page.evaluate(
            """() => {
                const header = document.querySelector('header') || document.body;
                const headerText = (header?.innerText || '').slice(0, 800);
                const headerLabels = [...header.querySelectorAll('a, button')]
                    .map((el) => (el.textContent || '').trim())
                    .filter((t) => t && t.length < 40);

                const hasLogin = headerLabels.some((t) =>
                    ['登入', 'Sign in', 'Log in'].includes(t)
                );
                const hasSignup = headerLabels.some((t) =>
                    ['註冊', 'Sign up'].includes(t)
                );
                const hasAccountMenu = Boolean(
                    header.querySelector('[data-testid*="account"], [data-testid*="user-menu"]')
                );
                const hasOrdersLink = Boolean(
                    document.querySelector('a[href*="/orders"], a[href*="/account"]')
                );
                const hasProfile = headerLabels.some((t) =>
                    ['帳戶', 'Account', '個人資料', 'Profile'].includes(t)
                );

                return {
                    url: location.href,
                    hasLogin,
                    hasSignup,
                    hasAccountMenu,
                    hasOrdersLink,
                    hasProfile,
                    headerLabels: headerLabels.slice(0, 15),
                    headerSnippet: headerText.replace(/\\s+/g, ' ').slice(0, 200),
                };
            }"""
        )
    except Exception as exc:
        return {"error": str(exc)}


def is_guest_browsing(page: Page) -> bool:
    signals = read_login_signals(page)
    if signals.get("error"):
        return False
    return bool(signals.get("hasLogin") and signals.get("hasSignup"))


def has_authenticated_session(page: Page) -> bool:
    """Strict: guest header must be gone AND account UI must be visible."""
    if is_login_url(page.url):
        return False

    signals = read_login_signals(page)
    if signals.get("error"):
        return False

    if signals.get("hasLogin") and signals.get("hasSignup"):
        return False

    return bool(
        signals.get("hasAccountMenu")
        or signals.get("hasOrdersLink")
        or signals.get("hasProfile")
    )


def debug_page_state(page: Page) -> None:
    signals = read_login_signals(page)
    print(f"  URL: {signals.get('url', page.url)}")
    print(f"  header: {signals.get('headerLabels', [])}")
    print(
        "  signals:"
        f" login={signals.get('hasLogin')}"
        f" signup={signals.get('hasSignup')}"
        f" account={signals.get('hasAccountMenu')}"
        f" orders={signals.get('hasOrdersLink')}"
    )
    print(f"  => guest={is_guest_browsing(page)} authenticated={has_authenticated_session(page)}")


def prompt_user_confirms_login() -> bool:
    print("")
    print("若你已在瀏覽器完成登入（header 不再同時顯示「登入」「註冊」），請按 Enter 確認。")
    print("尚未完成請輸入 n 後 Enter：", end=" ", flush=True)
    try:
        answer = input().strip().lower()
    except EOFError:
        return False
    return answer not in {"n", "no", "否"}


def invalidate_stale_auth_state(page: Page) -> bool:
    """Return True if saved session is usable."""
    if is_guest_browsing(page):
        print("saved session is guest-only (not a real account login)")
        if AUTH_STATE_PATH.exists():
            AUTH_STATE_PATH.unlink()
            print(f"removed stale session: {AUTH_STATE_PATH}")
        return False
    if has_authenticated_session(page):
        return True
    return False


def save_debug_screenshot(page: Page, name: str) -> Path:
    path = DATA_DIR / f"debug-{name}.png"
    page.screenshot(path=str(path), full_page=True)
    print(f"  screenshot: {path}")
    return path


def page_looks_logged_in(page: Page) -> bool:
    return has_authenticated_session(page)


def fill_email_if_present(page: Page, email: str) -> None:
    if not email:
        return
    email_input = page.locator(
        'input[type="email"], input[name="email"], input[id*="email"], '
        'input[inputmode="email"], input[type="tel"], input[name="phoneNumber"], '
        'input[autocomplete="email"], input[autocomplete="username"]'
    ).first
    if email_input.count() == 0:
        print("  warn: email/phone input not found on page")
        debug_page_state(page)
        return
    email_input.fill(email)
    print(f"  filled email: {email}")
    continue_btn = page.locator(
        'button[type="submit"], button:has-text("繼續"), button:has-text("Continue"), button:has-text("下一步")'
    ).first
    if continue_btn.count() > 0:
        continue_btn.click()
        page.wait_for_timeout(1500)


def wait_for_manual_login(page: Page, timeout_sec: int) -> bool:
    print("")
    print("=" * 60)
    print("請在已開啟的瀏覽器視窗完成 Uber Eats 登入（驗證碼 / SMS / Email）")
    print("完成後腳本會自動偵測並繼續。")
    print("（訪客模式不算登入，必須完成帳號驗證）")
    print(f"最長等待 {timeout_sec} 秒…")
    print("=" * 60)
    print("")

    page.wait_for_timeout(3000)
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        current_url = page.url
        if has_authenticated_session(page):
            print("偵測到已登入帳號（header 無訪客按鈕 + 有帳戶特徵）")
            return True
        if is_on_auth_flow(page):
            print(f"  …請在 auth.uber.com 完成驗證碼登入 ({current_url[:70]}…)", flush=True)
        elif is_guest_browsing(page):
            print("  …仍為訪客（header 有登入+註冊），請完成驗證碼登入", flush=True)
        else:
            print(f"  …登入狀態未確認 ({current_url[:70]}…)", flush=True)
        page.wait_for_timeout(2000)

    print("自動偵測逾時")
    debug_page_state(page)
    if prompt_user_confirms_login():
        if is_guest_browsing(page):
            print("畫面仍為訪客模式，無法儲存登入 session")
            return False
        print("已依你的確認視為登入成功")
        return True
    return False


def login_with_password(page: Page, email: str, password: str) -> bool:
    page.goto(build_auth_login_url(), wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(2500)
    fill_email_if_present(page, email)

    password_input = page.locator('input[type="password"]').first
    try:
        password_input.wait_for(state="visible", timeout=15000)
    except Exception:
        print("未出現密碼欄位（可能改為驗證碼登入），請改用 UBEREATS_MANUAL_LOGIN=1")
        return False

    password_input.fill(password)
    page.locator(
        'button[type="submit"], button:has-text("登入"), button:has-text("Log in")'
    ).first.click()
    page.wait_for_timeout(5000)
    return page_looks_logged_in(page)


def login_manual(page: Page, email: str, timeout_sec: int, return_url: str | None = None) -> bool:
    auth_url = build_auth_login_url(return_url)
    print(f"  opening auth login: {auth_url}")
    page.goto(auth_url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3000)
    print(f"  opened: {page.url}")
    debug_page_state(page)
    fill_email_if_present(page, email)
    page.wait_for_timeout(2000)
    debug_page_state(page)
    return wait_for_manual_login(page, timeout_sec)


def ensure_authenticated(
    page: Page,
    feed_url: str,
    email: str,
    password: str,
    manual_login: bool,
    login_timeout_sec: int,
    *,
    force_manual: bool = False,
) -> bool:
    if force_manual:
        print("force manual login — opening auth.uber.com/v2")
        return login_manual(page, email, login_timeout_sec, return_url=feed_url)

    page.goto(feed_url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3000)

    if invalidate_stale_auth_state(page):
        print("authenticated session active")
        return True

    if is_guest_browsing(page):
        print("guest feed detected (header shows 登入 + 註冊)")

    if manual_login or (email and not password):
        print("starting manual login flow at auth.uber.com/v2 (OTP)")
        return login_manual(page, email, login_timeout_sec, return_url=feed_url)

    if email and password:
        print("trying password login…")
        if login_with_password(page, email, password):
            return True
        print("password login failed; retry with UBEREATS_MANUAL_LOGIN=1")
        return False

    print("no credentials configured; continuing as guest (feed may be limited)")
    return False


def save_auth_state(context: BrowserContext) -> None:
    context.storage_state(path=str(AUTH_STATE_PATH))
    print(f"saved auth state to {AUTH_STATE_PATH}")


def extract_dom_stores(page: Page) -> list[dict[str, Any]]:
    raw = page.evaluate(
        """() => {
        const cards = [];
        const storeRe = /\\/store\\/[^/]+\\/[^/?#]+/i;
        const seen = new Set();
        const selectors = [
            'a[href*="/tw/store/"]',
            'a[href*="ubereats.com/tw/store/"]',
            '[data-testid*="store-card"] a[href*="/store/"]',
        ];
        const root = document.querySelector('main') || document.body;
        const links = new Set();
        for (const sel of selectors) {
            for (const link of root.querySelectorAll(sel)) links.add(link);
        }
        for (const link of links) {
            const href = (link.href || '').split('?')[0];
            if (!href || !storeRe.test(href) || seen.has(href)) continue;
            seen.add(href);
            const card = link.closest('li, article, div[data-testid]') || link;
            const img = card.querySelector('img');
            const text = (card.innerText || link.innerText || '').trim();
            if (!text) continue;
            const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
            if (!lines.length) continue;
            let name = lines[0] || '';
            if (!name) name = (img && img.alt) ? img.alt.trim() : '';
            if (!name) name = (link.getAttribute('aria-label') || '').trim();
            if (!name || name.length > 80) continue;
            cards.push({
                storeUrl: href,
                name,
                meta: lines.slice(1, 4).join(' · '),
                imageUrl: img ? img.src : null,
            });
        }
        return cards;
    }"""
    )
    filtered = filter_dom_stores(raw)
    if not filtered and raw:
        print(f"  warn: {len(raw)} raw store links filtered out — relaxing name rules")
    return filtered if filtered else filter_dom_stores(
        [{**c, "name": c["name"][:80]} for c in raw if c.get("name")]
    )


def click_load_more_if_present(page: Page) -> bool:
    try:
        return bool(
            page.evaluate(
                """() => {
                const labels = ['顯示更多', '查看更多', 'Show more', 'See more', 'Load more'];
                for (const el of document.querySelectorAll('button, a[role="button"]')) {
                    const text = (el.textContent || '').trim();
                    if (!labels.some((l) => text.includes(l))) continue;
                    el.click();
                    return true;
                }
                return false;
            }"""
            )
        )
    except Exception:
        return False


def collect_api_payloads(page: Page, feed_url: str) -> tuple[list[Any], list[dict[str, Any]]]:
    payloads: list[Any] = []

    def on_response(response: Response) -> None:
        url = response.url
        if response.status != 200 or "ubereats.com" not in url:
            return
        if not any(token in url for token in ("feed", "graphql", "getFeed", "getCatalog", "getStoreV1", "store", "api")):
            return
        content_type = response.headers.get("content-type", "")
        if "json" not in content_type and "graphql" not in url:
            return
        try:
            payloads.append(response.json())
        except Exception:
            return

    page.on("response", on_response)
    page.goto(feed_url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(4000)
    try:
        page.wait_for_selector('a[href*="/tw/store/"]', timeout=45000)
        print("  feed store links detected")
    except Exception:
        print("  warn: no /tw/store/ links yet — saving debug screenshot")
        save_debug_screenshot(page, "feed-empty")

    store_map: dict[str, dict[str, Any]] = {}
    stale_rounds = 0
    prev_count = 0
    max_rounds = int(os.environ.get("UBEREATS_SCROLL_ROUNDS", "40"))

    for round_index in range(max_rounds):
        for card in extract_dom_stores(page):
            store_map[card["storeUrl"]] = card

        count = len(store_map)
        print(f"  feed scroll {round_index + 1}/{max_rounds}: {count} stores", flush=True)

        if click_load_more_if_present(page):
            page.wait_for_timeout(2000)
            stale_rounds = 0
            continue

        if round_index > 0 and count == prev_count:
            stale_rounds += 1
            if stale_rounds >= 4:
                print("  no new stores after scrolling — stopping")
                break
        else:
            stale_rounds = 0
        prev_count = count

        page.mouse.wheel(0, 2800)
        page.wait_for_timeout(1200)
        page.keyboard.press("End")
        page.wait_for_timeout(800)

    dom_stores = list(store_map.values())
    print(f"  total unique stores on feed: {len(dom_stores)}")
    if not dom_stores:
        sample = page.evaluate(
            """() => [...document.querySelectorAll('a[href*="/tw/store/"]')]
                .slice(0, 5)
                .map((a) => ({ href: a.href, text: (a.innerText || '').slice(0, 80) }))"""
        )
        print(f"  debug sample links: {sample}")
    return payloads, dom_stores


def collect_uuid_entries(payload: Any) -> dict[str, str]:
    """Map short store id (URL suffix) -> storeUuid from feed/search JSON."""
    mapping: dict[str, str] = {}

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            store_uuid = node.get("storeUuid")
            action_url = str(
                node.get("actionUrl") or node.get("shareUrl") or node.get("webUrl") or ""
            )
            if store_uuid and "/store/" in action_url:
                short_id = action_url.rstrip("/").split("/")[-1]
                if short_id and short_id not in mapping:
                    mapping[short_id] = str(store_uuid)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return mapping


def normalize_store_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKC", name).lower()
    normalized = re.sub(r"\s+", "", normalized)
    for token in ("餐點", "門市", "外帶", "外送", "專賣", "旗艦店"):
        normalized = normalized.replace(token, "")
    return normalized


def build_search_queries(store: dict[str, Any]) -> list[str]:
    name = str(store.get("name") or "").strip()
    queries: list[str] = []
    if name:
        queries.append(name)
        if " 餐點" in name:
            queries.append(name.split(" 餐點", maxsplit=1)[0].strip())
        if name.lower().startswith("parent"):
            queries.append(re.sub(r"^parent\s*[-–]?\s*", "", name, flags=re.IGNORECASE))
    store_url = str(store.get("storeUrl") or "")
    if "/store/" in store_url:
        slug = unquote(store_url.split("/store/", maxsplit=1)[1].rsplit("/", maxsplit=1)[0])
        queries.append(slug.replace("-", " ").replace("|", " "))
    seen: set[str] = set()
    unique: list[str] = []
    for query in queries:
        cleaned = query.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            unique.append(cleaned)
    return unique


def find_uuid_in_payload(payload: Any, store: dict[str, Any]) -> str | None:
    short_id = extract_short_store_id(store["storeUrl"])
    target = normalize_store_name(str(store.get("name") or ""))
    found: str | None = None

    def walk(node: Any) -> None:
        nonlocal found
        if found or not isinstance(node, dict):
            return
        store_uuid = node.get("storeUuid")
        if not store_uuid:
            return
        action_url = str(node.get("actionUrl") or node.get("shareUrl") or node.get("webUrl") or "")
        if short_id and (action_url.endswith(f"/{short_id}") or f"/{short_id}" in action_url):
            found = str(store_uuid)
            return
        title = normalize_store_name(text_value(node.get("title")))
        if title and target and (title == target or target in title or title in target):
            found = str(store_uuid)

    def traverse(node: Any) -> None:
        if isinstance(node, dict):
            walk(node)
            if found:
                return
            for value in node.values():
                traverse(value)
                if found:
                    return
        elif isinstance(node, list):
            for item in node:
                traverse(item)
                if found:
                    return

    traverse(payload)
    return found


def expand_uuid_map_from_feed(
    session: requests.Session,
    seed_payload: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Paginate getFeedV1 to collect short-id -> storeUuid mappings."""
    combined: dict[str, str] = {}
    payload = seed_payload if seed_payload and seed_payload.get("status") == "success" else None
    if payload is None:
        payload = api_post_session(session, "getFeedV1", {})
    if payload.get("status") != "success":
        return combined

    combined.update(collect_uuid_entries(payload))
    data = payload.get("data") or {}
    cache_key = data.get("cacheKey")
    meta = data.get("meta") or {}
    max_pages = int(os.environ.get("UBEREATS_FEED_PAGES", "12"))

    for _ in range(max_pages):
        if not cache_key or not meta.get("hasMore"):
            break
        page_payload = api_post_session(
            session,
            "getFeedV1",
            {
                "cacheKey": cache_key,
                "pageInfo": {"offset": meta.get("offset", 0), "pageSize": 80},
            },
        )
        if page_payload.get("status") != "success":
            break
        combined.update(collect_uuid_entries(page_payload))
        meta = (page_payload.get("data") or {}).get("meta") or {}
    return combined


def load_uuid_map() -> dict[str, str]:
    raw = load_json(UUID_MAP_PATH, {})
    if not isinstance(raw, dict):
        return {}
    return {str(key): str(value) for key, value in raw.items()}


def save_uuid_map(mapping: dict[str, str]) -> None:
    save_json(UUID_MAP_PATH, mapping)


def build_api_session_from_context(context: BrowserContext) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "x-csrf-token": "x",
            "Referer": "https://www.ubereats.com/tw/feed",
            "Origin": "https://www.ubereats.com",
        }
    )
    for cookie in context.cookies():
        session.cookies.set(
            cookie["name"],
            cookie["value"],
            domain=cookie.get("domain"),
            path=cookie.get("path", "/"),
        )
    return session


def clone_api_session(template: requests.Session) -> requests.Session:
    session = requests.Session()
    session.headers.update(dict(template.headers))
    session.cookies.update(template.cookies)
    return session


def api_post_session(session: requests.Session, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
    url = f"{UBEREATS_API_BASE}/{endpoint}?localeCode=tw"
    try:
        response = session.post(url, json=body, timeout=90)
        return response.json()
    except (requests.RequestException, json.JSONDecodeError):
        return {}


def warm_menu_api_session(
    feed_url: str,
    headless: bool,
) -> tuple[requests.Session, dict[str, str]]:
    """Bootstrap guest API session via Playwright, then reuse cookies in requests."""
    feed_payload: dict[str, Any] | None = None
    with sync_playwright() as playwright:
        launch_kwargs: dict[str, Any] = {"headless": headless}
        browser = playwright.chromium.launch(**launch_kwargs)
        use_auth = os.environ.get("UBEREATS_USE_AUTH", "auto").strip() not in ("0", "false", "no")
        context = new_browser_context(browser, use_auth=use_auth)
        page = context.new_page()
        uuid_map, feed_payload = warm_feed_session(page, feed_url)
        if use_auth and not feed_session_is_healthy(page):
            print("saved session unusable — retrying as guest", flush=True)
            context.close()
            context = new_browser_context(browser, use_auth=False)
            page = context.new_page()
            uuid_map, feed_payload = warm_feed_session(page, feed_url)
        api_session = build_api_session_from_context(context)
        context.close()
        browser.close()
    uuid_map.update(expand_uuid_map_from_feed(api_session, feed_payload))
    return api_session, uuid_map


def api_post(page: Page, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
    result = page.evaluate(
        """async ({ endpoint, body }) => {
            const response = await fetch(
                `https://www.ubereats.com/_p/api/${endpoint}?localeCode=tw`,
                {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "x-csrf-token": "x",
                    },
                    body: JSON.stringify(body),
                    credentials: "include",
                }
            );
            return await response.json();
        }""",
        {"endpoint": endpoint, "body": body},
    )
    return result if isinstance(result, dict) else {}


def feed_session_is_healthy(page: Page) -> bool:
    title = page.title().strip()
    return bool(title) and "ubereats" in page.url.lower()


def warm_feed_session(page: Page, feed_url: str) -> tuple[dict[str, str], dict[str, Any] | None]:
    """Open feed once so internal API cookies/session are ready."""
    mapping: dict[str, str] = {}
    captured: list[Any] = []

    def on_response(response: Response) -> None:
        if response.status != 200 or "getFeedV1" not in response.url:
            return
        try:
            captured.append(response.json())
        except Exception:
            return

    page.on("response", on_response)
    page.goto(feed_url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3500)

    if not captured and feed_session_is_healthy(page):
        feed_payload = api_post(page, "getFeedV1", {})
        if feed_payload.get("status") == "success":
            captured.append(feed_payload)

    feed_payload: dict[str, Any] | None = None
    for payload in captured:
        mapping.update(collect_uuid_entries(payload))
        if feed_payload is None and isinstance(payload, dict) and payload.get("status") == "success":
            feed_payload = payload
    return mapping, feed_payload


def new_browser_context(browser: Any, *, use_auth: bool) -> BrowserContext:
    context_kwargs: dict[str, Any] = {
        "user_agent": USER_AGENT,
        "locale": "zh-TW",
    }
    if use_auth and AUTH_STATE_PATH.exists():
        context_kwargs["storage_state"] = str(AUTH_STATE_PATH)
    return browser.new_context(**context_kwargs)


def resolve_store_uuid(
    page: Page,
    store: dict[str, Any],
    uuid_map: dict[str, str],
) -> str | None:
    existing = str(store.get("storeUuid") or "").strip()
    if existing:
        return existing

    short_id = extract_short_store_id(store["storeUrl"])
    if short_id in uuid_map:
        return uuid_map[short_id]

    for query in build_search_queries(store):
        payload = api_post(page, "getSearchFeedV1", {"userQuery": query})
        if payload.get("status") != "success":
            continue
        uuid_map.update(collect_uuid_entries(payload))
        if short_id in uuid_map:
            save_uuid_map(uuid_map)
            return uuid_map[short_id]
        matched = find_uuid_in_payload(payload, store)
        if matched:
            uuid_map[short_id] = matched
            save_uuid_map(uuid_map)
            return matched

    return None


def parse_menu_from_store_payload(payload: dict[str, Any], max_items: int) -> list[dict[str, Any]]:
    sections = deep_find_menu_sections(payload)
    menu: list[dict[str, Any]] = []
    item_id = 1
    for section in sections:
        category = text_value(section.get("title")) or "精選"
        for raw_item in section.get("items", []):
            parsed = parse_menu_item(raw_item, item_id, category)
            if not parsed:
                continue
            menu.append(parsed)
            item_id += 1
            if len(menu) >= max_items:
                return menu
    return menu


def resolve_store_uuid_session(
    session: requests.Session,
    store: dict[str, Any],
    uuid_map: dict[str, str],
    uuid_lock: threading.Lock,
) -> str | None:
    existing = str(store.get("storeUuid") or "").strip()
    if existing:
        return existing

    short_id = extract_short_store_id(store["storeUrl"])
    with uuid_lock:
        if short_id in uuid_map:
            return uuid_map[short_id]

    for query in build_search_queries(store):
        payload = api_post_session(session, "getSearchFeedV1", {"userQuery": query})
        if payload.get("status") != "success":
            continue
        with uuid_lock:
            uuid_map.update(collect_uuid_entries(payload))
            if short_id in uuid_map:
                return uuid_map[short_id]
            matched = find_uuid_in_payload(payload, store)
            if matched:
                uuid_map[short_id] = matched
                return matched
    return None


def fetch_store_payload_with_post(
    post: Callable[[str, dict[str, Any]], dict[str, Any]],
    store_uuid: str,
    log_prefix: str = "",
    rate_limiter: ApiRateLimiter | None = None,
) -> dict[str, Any]:
    max_retries = int(os.environ.get("UBEREATS_MENU_RETRIES", "8"))
    empty_retries = int(os.environ.get("UBEREATS_EMPTY_RETRIES", "3"))
    for attempt in range(max_retries):
        payload = post(
            "getStoreV1",
            {
                "storeUuid": store_uuid,
                "diningMode": "DELIVERY",
                "time": {"asap": True},
            },
        )
        if payload.get("status") == "success":
            return payload

        message = str((payload.get("data") or {}).get("message", "unknown"))
        empty_response = not payload or message == "unknown"
        if empty_response:
            if attempt >= empty_retries - 1:
                raise RuntimeError("getStoreV1 failed: empty response (session may be stale)")
            wait_sec = int(os.environ.get("UBEREATS_EMPTY_RETRY_WAIT", "45"))
            print(
                f"{log_prefix}empty API response — waiting {wait_sec}s "
                f"(retry {attempt + 2}/{empty_retries})",
                flush=True,
            )
        elif "too_many_requests" in message or message.startswith("bd.error"):
            if attempt >= max_retries - 1:
                raise RuntimeError(f"getStoreV1 failed: {message}")
            wait_sec = min(
                int(os.environ.get("UBEREATS_RATE_LIMIT_WAIT", "25")) * (attempt + 1),
                int(os.environ.get("UBEREATS_RATE_LIMIT_WAIT_MAX", "90")),
            )
            print(
                f"{log_prefix}rate limited ({message}) — waiting {wait_sec}s "
                f"(retry {attempt + 2}/{max_retries})",
                flush=True,
            )
        else:
            raise RuntimeError(f"getStoreV1 failed: {message}")

        if rate_limiter is not None:
            rate_limiter.backoff(wait_sec)
        else:
            time.sleep(wait_sec)
    return {}


def fetch_store_menu_with_post(
    post: Callable[[str, dict[str, Any]], dict[str, Any]],
    store_uuid: str,
    max_items: int,
    log_prefix: str = "",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = fetch_store_payload_with_post(post, store_uuid, log_prefix=log_prefix)
    return parse_menu_from_store_payload(payload, max_items), payload


def fetch_store_menu_via_api(
    page: Page,
    store_uuid: str,
    max_items: int,
) -> list[dict[str, Any]]:
    menu, _payload = fetch_store_menu_with_post(
        lambda endpoint, body: api_post(page, endpoint, body),
        store_uuid,
        max_items,
    )
    return menu


def fetch_store_menu_via_session(
    session: requests.Session,
    store_uuid: str,
    max_items: int,
    log_prefix: str = "",
) -> list[dict[str, Any]]:
    menu, _payload = fetch_store_menu_with_post(
        lambda endpoint, body: api_post_session(session, endpoint, body),
        store_uuid,
        max_items,
        log_prefix=log_prefix,
    )
    return menu


def scrape_store_menu(
    page: Page,
    store: dict[str, Any],
    max_items: int,
    uuid_map: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    if uuid_map is not None:
        store_uuid = resolve_store_uuid(page, store, uuid_map)
        if store_uuid:
            try:
                menu = fetch_store_menu_via_api(page, store_uuid, max_items)
                if menu:
                    store["storeUuid"] = store_uuid
                    return menu
            except Exception as exc:
                print(f"  warn: api menu failed: {exc}", flush=True)
        return []

    store_url = store["storeUrl"]
    menu_payloads: list[Any] = []

    def on_response(response: Response) -> None:
        if response.status != 200:
            return
        if not any(token in response.url for token in ("store", "catalog", "graphql", "menu")):
            return
        try:
            menu_payloads.append(response.json())
        except Exception:
            return

    page.on("response", on_response)
    page.goto(store_url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(4000)

    for _ in range(8):
        page.mouse.wheel(0, 1800)
        page.wait_for_timeout(700)

    sections: list[dict[str, Any]] = []
    for payload in menu_payloads:
        sections.extend(deep_find_menu_sections(payload))

    menu: list[dict[str, Any]] = []
    item_id = 1
    for section in sections:
        category = str(section.get("title") or "精選")
        for raw_item in section.get("items", []):
            parsed = parse_menu_item(raw_item, item_id, category)
            if not parsed:
                continue
            menu.append(parsed)
            item_id += 1
            if len(menu) >= max_items:
                return menu

    if menu:
        return menu

    dom_items = page.evaluate(
        """() => {
        const out = [];
        for (const row of document.querySelectorAll(
            '[data-testid*="store-item"], [data-testid*="catalog-item"], [data-test*="menu-item"], article li, li'
        )) {
            const nameEl = row.querySelector('h3, h4, [data-testid*="title"]');
            const priceEl = row.querySelector('[data-testid*="price"], span');
            const img = row.querySelector('img');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const priceText = priceEl ? priceEl.textContent.trim() : '';
            if (!name || name.length > 80) continue;
            if (!/\\d/.test(priceText)) continue;
            out.push({ name, priceText, imageUrl: img ? img.src : null });
        }
        return out.slice(0, 40);
    }"""
    )
    for raw in dom_items:
        match = re.search(r"(\d+)", raw.get("priceText", ""))
        price = int(match.group(1)) if match else 99
        menu.append(
            {
                "id": item_id,
                "name": raw["name"],
                "emoji": "🍽️",
                "price": price,
                "category": "精選",
                "desc": "Uber Eats 菜單品項",
                "imageUrl": raw.get("imageUrl"),
                "soldCount": 100 + (item_id * 13) % 300,
            }
        )
        item_id += 1
        if len(menu) >= max_items:
            break
    return menu


def enrich_assets(
    restaurant: dict[str, Any],
    http: requests.Session | None = None,
) -> dict[str, Any]:
    restaurant_id = restaurant["id"]
    cover_path = ASSETS_DIR / "restaurants" / f"{restaurant_id}.jpg"
    if restaurant.get("coverImageUrl"):
        if download_image(restaurant["coverImageUrl"], cover_path, http=http):
            restaurant["coverImage"] = to_asset_path(cover_path)
    restaurant.pop("coverImageUrl", None)

    updated_menu = []
    for item in restaurant.get("menu", []):
        menu_item = {**item}
        image_url = menu_item.pop("imageUrl", None)
        if image_url:
            image_path = ASSETS_DIR / "menu" / f"{restaurant_id}-{menu_item['id']}.jpg"
            if download_image(image_url, image_path, http=http):
                menu_item["image"] = to_asset_path(image_path)
        updated_menu.append(menu_item)
    restaurant["menu"] = updated_menu
    restaurant["dataSource"] = "ubereats"
    restaurant["scrapedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return restaurant


def has_local_cover(restaurant: dict[str, Any]) -> bool:
    cover = restaurant.get("coverImage")
    if not cover or str(cover).startswith("http"):
        return False
    cover_path = ROOT / str(cover)
    return is_valid_jpeg(cover_path, min_bytes=4000)


def copy_menu_image_to_cover(restaurant: dict[str, Any], menu_image_path: Path) -> bool:
    restaurant_id = restaurant["id"]
    cover_path = ASSETS_DIR / "restaurants" / f"{restaurant_id}.jpg"
    try:
        cover_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(menu_image_path, cover_path)
    except OSError:
        return False
    if not is_valid_jpeg(cover_path, min_bytes=1500):
        cover_path.unlink(missing_ok=True)
        return False
    restaurant["coverImage"] = to_asset_path(cover_path)
    return True


def backfill_cover_from_menu(restaurant: dict[str, Any]) -> bool:
    if has_local_cover(restaurant):
        return False
    for item in restaurant.get("menu", []):
        image = item.get("image")
        if not image or str(image).startswith("http"):
            continue
        image_path = ROOT / str(image)
        if is_valid_jpeg(image_path, min_bytes=1500):
            return copy_menu_image_to_cover(restaurant, image_path)
    return False


def normalize_restaurant_cover(restaurant: dict[str, Any]) -> bool:
    """Ensure coverImage points to a valid JPEG under assets/images/restaurants/."""
    cover = restaurant.get("coverImage")
    if cover and not str(cover).startswith("http"):
        cover_path = ROOT / str(cover)
        if is_valid_jpeg(cover_path, min_bytes=4000):
            expected = ASSETS_DIR / "restaurants" / f"{restaurant['id']}.jpg"
            if cover_path.resolve() != expected.resolve():
                return copy_menu_image_to_cover(restaurant, cover_path)
            return True
        if cover_path.exists():
            cover_path.unlink(missing_ok=True)
    return backfill_cover_from_menu(restaurant)


def repair_restaurant_covers(restaurants: list[dict[str, Any]]) -> dict[str, int]:
    repaired = 0
    still_missing = 0
    for restaurant in restaurants:
        if normalize_restaurant_cover(restaurant):
            repaired += 1
        elif not has_local_cover(restaurant):
            still_missing += 1
    return {"repaired": repaired, "still_missing": still_missing}


def extract_hero_image_url(store_data: dict[str, Any]) -> str | None:
    heroes = store_data.get("heroImageUrls") or []
    if heroes:
        best = max(
            heroes,
            key=lambda hero: int(hero.get("width") or 0) if isinstance(hero, dict) else 0,
        )
        if isinstance(best, dict):
            url = best.get("url")
            if url:
                return str(url)
    image = store_data.get("image")
    if isinstance(image, dict):
        return image.get("url")
    if isinstance(image, str) and image.startswith("http"):
        return image
    return None


def extract_cover_url_from_store_payload(payload: dict[str, Any]) -> str | None:
    data = payload.get("data") or {}
    hero_url = extract_hero_image_url(data)
    if hero_url:
        return hero_url
    for section in deep_find_menu_sections(payload):
        for item in section.get("items", []):
            image = item.get("imageUrl") or item.get("heroImageUrl")
            if isinstance(image, dict):
                image = image.get("url")
            if image and str(image).startswith("http"):
                return str(image)
    return None


def enrich_cover_asset(
    restaurant: dict[str, Any],
    http: requests.Session | None = None,
) -> dict[str, Any]:
    restaurant_id = restaurant["id"]
    cover_path = ASSETS_DIR / "restaurants" / f"{restaurant_id}.jpg"
    cover_url = restaurant.pop("coverImageUrl", None)
    if cover_url and download_image(str(cover_url), cover_path, http=http):
        restaurant["coverImage"] = to_asset_path(cover_path)
    elif not has_local_cover(restaurant):
        backfill_cover_from_menu(restaurant)
    return restaurant


@dataclass
class CoverJobResult:
    store_id: str
    name: str
    cover_image: str | None
    error: str | None = None


def scrape_cover_job(
    store: dict[str, Any],
    api_template: requests.Session,
    uuid_map: dict[str, str],
    uuid_lock: threading.Lock,
    rate_limiter: ApiRateLimiter,
) -> CoverJobResult:
    name = str(store.get("name", store["id"]))
    if has_local_cover(store) or backfill_cover_from_menu(store):
        return CoverJobResult(store_id=store["id"], name=name, cover_image=store.get("coverImage"))

    session = clone_api_session(api_template)
    log_prefix = f"  [{name}] "
    try:
        store_uuid = resolve_store_uuid_session(session, store, uuid_map, uuid_lock)
        if not store_uuid:
            return CoverJobResult(store_id=store["id"], name=name, cover_image=None)

        rate_limiter.wait()
        payload = api_post_session(
            session,
            "getStoreV1",
            {
                "storeUuid": store_uuid,
                "diningMode": "DELIVERY",
                "time": {"asap": True},
            },
        )
        if payload.get("status") != "success":
            message = str((payload.get("data") or {}).get("message", "unknown"))
            return CoverJobResult(store_id=store["id"], name=name, cover_image=None, error=message)

        cover_url = extract_cover_url_from_store_payload(payload)
        if not cover_url:
            for item in store.get("menu", []):
                if item.get("imageUrl"):
                    cover_url = str(item["imageUrl"])
                    break
        if not cover_url:
            return CoverJobResult(store_id=store["id"], name=name, cover_image=None)

        store_copy = dict(store)
        store_copy["coverImageUrl"] = cover_url
        if store.get("storeUuid"):
            store_copy["storeUuid"] = store["storeUuid"]
        else:
            store_copy["storeUuid"] = store_uuid
        enriched = enrich_cover_asset(store_copy, http=session)
        return CoverJobResult(
            store_id=store["id"],
            name=name,
            cover_image=enriched.get("coverImage"),
        )
    except Exception as exc:
        return CoverJobResult(
            store_id=store["id"],
            name=name,
            cover_image=None,
            error=str(exc),
        )


def run_covers_only(max_stores: int, headless: bool) -> int:
    source_path = ENRICHED_PATH if ENRICHED_PATH.exists() else OUTPUT_PATH
    if not source_path.exists():
        print(f"no restaurant list at {source_path}")
        return 1

    restaurants: list[dict[str, Any]] = load_json(source_path, [])
    restaurants = [store for store in restaurants if len(store.get("menu") or []) > 0]
    pending = [store for store in restaurants if not has_local_cover(store)]
    if max_stores > 0:
        pending = pending[:max_stores]

    menu_backfill = repair_restaurant_covers(restaurants)
    if menu_backfill["repaired"]:
        save_json(OUTPUT_PATH, restaurants)
        save_json(ENRICHED_PATH, restaurants)
        print(
            f"menu-image cover repair: {menu_backfill['repaired']} stores "
            f"({menu_backfill['still_missing']} still missing)",
            flush=True,
        )

    pending = [store for store in restaurants if not has_local_cover(store)]
    print(f"covers-only: {len(pending)} / {len(restaurants)} stores need API covers")
    if not pending:
        with_covers = sum(1 for store in restaurants if has_local_cover(store) or store.get("coverImage"))
        print(f"all stores have covers ({with_covers}/{len(restaurants)})")
        return 0

    feed_url = os.environ.get("UBEREATS_FEED_URL", DEFAULT_FEED_URL).strip()
    workers = int(os.environ.get("UBEREATS_MENU_WORKERS", "4"))
    checkpoint_every = int(os.environ.get("UBEREATS_CHECKPOINT_EVERY", "5"))
    api_interval = float(os.environ.get("UBEREATS_API_INTERVAL", "0.6"))
    restaurant_index = {store["id"]: index for index, store in enumerate(restaurants)}
    uuid_map = load_uuid_map()
    rate_limiter = ApiRateLimiter(api_interval)
    uuid_lock = threading.Lock()
    state_lock = threading.Lock()
    completed = 0

    print(f"parallel covers: {workers} workers, api interval {api_interval}s", flush=True)
    api_template, warmed_map = warm_menu_api_session(feed_url, headless)
    uuid_map.update(warmed_map)
    save_uuid_map(uuid_map)

    def apply_result(result: CoverJobResult, index: int, total: int) -> None:
        nonlocal completed
        print(f"[{index}/{total}] cover: {result.name}", flush=True)
        if result.error:
            print(f"  warn: {result.error}", flush=True)
        if result.cover_image:
            print(f"  -> {result.cover_image}", flush=True)
            with state_lock:
                restaurants[restaurant_index[result.store_id]]["coverImage"] = result.cover_image
                completed += 1
                if completed % checkpoint_every == 0:
                    save_json(OUTPUT_PATH, restaurants)
                    save_json(ENRICHED_PATH, restaurants)
                    print(f"  checkpoint saved ({completed} covers written)", flush=True)
        else:
            print("  -> no cover", flush=True)

    total = len(pending)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                scrape_cover_job,
                store,
                api_template,
                uuid_map,
                uuid_lock,
                rate_limiter,
            ): (index, store)
            for index, store in enumerate(pending, start=1)
        }
        for future in as_completed(futures):
            index, _store = futures[future]
            apply_result(future.result(), index, total)

    save_json(OUTPUT_PATH, restaurants)
    save_json(ENRICHED_PATH, restaurants)
    with_covers = sum(1 for store in restaurants if store.get("coverImage"))
    save_json(
        META_PATH,
        {
            "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "covers-only",
            "storeCount": len(restaurants),
            "storesWithCover": with_covers,
        },
    )
    print(f"wrote {ENRICHED_PATH} ({with_covers}/{len(restaurants)} stores with covers)", flush=True)
    return 0


def scrape_coords_job(
    store: dict[str, Any],
    api_template: requests.Session,
    uuid_map: dict[str, str],
    uuid_lock: threading.Lock,
    rate_limiter: ApiRateLimiter,
) -> CoordsJobResult:
    name = str(store.get("name", store["id"]))
    session = clone_api_session(api_template)
    log_prefix = f"  [{name}] "
    try:
        store_uuid = str(store.get("storeUuid") or "").strip()
        if not store_uuid:
            store_uuid = resolve_store_uuid_session(session, store, uuid_map, uuid_lock)
        if not store_uuid:
            return CoordsJobResult(
                store_id=store["id"],
                name=name,
                lat=None,
                lng=None,
                address=None,
                error="missing storeUuid",
            )

        rate_limiter.wait()
        payload = fetch_store_payload_with_post(
            lambda endpoint, body: api_post_session(session, endpoint, body),
            store_uuid,
            log_prefix=log_prefix,
            rate_limiter=rate_limiter,
        )
        location = extract_store_location_from_payload(payload)
        if not location:
            return CoordsJobResult(
                store_id=store["id"],
                name=name,
                lat=None,
                lng=None,
                address=None,
                store_uuid=store_uuid,
                error="no location in payload",
            )
        return CoordsJobResult(
            store_id=store["id"],
            name=name,
            lat=location["lat"],
            lng=location["lng"],
            address=location.get("address"),
            store_uuid=store_uuid,
        )
    except Exception as exc:
        return CoordsJobResult(
            store_id=store["id"],
            name=name,
            lat=None,
            lng=None,
            address=None,
            error=str(exc),
        )


def run_coords_only(max_stores: int, headless: bool) -> int:
    source_path = ENRICHED_PATH if ENRICHED_PATH.exists() else OUTPUT_PATH
    if not source_path.exists():
        print(f"no restaurant list at {source_path}")
        return 1

    restaurants: list[dict[str, Any]] = load_json(source_path, [])
    restaurants = [store for store in restaurants if len(store.get("menu") or []) > 0]
    anchor_lat = float(os.environ.get("UBEREATS_LAT", DEFAULT_LOCATION["lat"]))
    anchor_lng = float(os.environ.get("UBEREATS_LNG", DEFAULT_LOCATION["lng"]))
    skip_existing = os.environ.get("UBEREATS_COORDS_SKIP_EXISTING", "1") == "1"
    pending = list(restaurants)
    if skip_existing:
        before = len(pending)
        pending = [
            store
            for store in pending
            if not store_has_real_coords(store, anchor_lat, anchor_lng)
        ]
        skipped = before - len(pending)
        if skipped:
            print(
                f"coords-only: skipping {skipped} stores with real coordinates already",
                flush=True,
            )
    if max_stores > 0:
        pending = pending[:max_stores]

    feed_url = os.environ.get("UBEREATS_FEED_URL", DEFAULT_FEED_URL).strip()
    workers = int(os.environ.get("UBEREATS_MENU_WORKERS", "1"))
    checkpoint_every = int(os.environ.get("UBEREATS_CHECKPOINT_EVERY", "10"))
    api_interval = float(os.environ.get("UBEREATS_API_INTERVAL", "2.0"))
    restaurant_index = {store["id"]: index for index, store in enumerate(restaurants)}
    uuid_map = load_uuid_map()
    rate_limiter = ApiRateLimiter(api_interval)
    uuid_lock = threading.Lock()
    state_lock = threading.Lock()
    updated = 0
    failed = 0

    print(f"coords-only: updating {len(pending)} / {len(restaurants)} stores", flush=True)
    print(f"parallel coords: {workers} workers, api interval {api_interval}s", flush=True)

    session_refresh_every = int(os.environ.get("UBEREATS_SESSION_REFRESH_EVERY", "35"))
    retry_rounds = int(os.environ.get("UBEREATS_COORDS_RETRY_ROUNDS", "2"))
    api_template, warmed_map = warm_menu_api_session(feed_url, headless)
    uuid_map.update(warmed_map)
    save_uuid_map(uuid_map)
    stores_since_refresh = 0
    consecutive_failures = 0
    retry_queue: list[dict[str, Any]] = list(pending)

    def refresh_session(reason: str) -> None:
        nonlocal api_template, stores_since_refresh, consecutive_failures
        print(f"refreshing API session ({reason})...", flush=True)
        api_template, warmed = warm_menu_api_session(feed_url, headless)
        uuid_map.update(warmed)
        save_uuid_map(uuid_map)
        stores_since_refresh = 0
        consecutive_failures = 0
        rate_limiter.backoff(int(os.environ.get("UBEREATS_SESSION_REFRESH_PAUSE", "15")))

    def apply_result(result: CoordsJobResult, index: int, total: int) -> bool:
        nonlocal updated, failed, stores_since_refresh, consecutive_failures
        print(f"[{index}/{total}] coords: {result.name}", flush=True)
        if result.error:
            print(f"  warn: {result.error}", flush=True)
            failed += 1
            consecutive_failures += 1
            return False
        if result.lat is None or result.lng is None:
            print("  -> no coordinates", flush=True)
            failed += 1
            consecutive_failures += 1
            return False

        with state_lock:
            store_ref = restaurants[restaurant_index[result.store_id]]
            store_ref["lat"] = result.lat
            store_ref["lng"] = result.lng
            store_ref["coordsSource"] = "api"
            if result.address:
                store_ref["address"] = result.address
            if result.store_uuid:
                store_ref["storeUuid"] = result.store_uuid
            updated += 1
            if updated % checkpoint_every == 0:
                save_json(OUTPUT_PATH, restaurants)
                save_json(ENRICHED_PATH, restaurants)
                print(f"  checkpoint saved ({updated} coords written)", flush=True)
        print(f"  -> {result.lat:.5f}, {result.lng:.5f}", flush=True)
        if result.address:
            print(f"  -> {result.address[:80]}", flush=True)
        stores_since_refresh += 1
        consecutive_failures = 0
        return True

    for round_index in range(1, retry_rounds + 1):
        if not retry_queue:
            break
        if round_index > 1:
            print(
                f"coords retry round {round_index}/{retry_rounds} "
                f"({len(retry_queue)} stores)",
                flush=True,
            )
            refresh_session(f"retry round {round_index}")

        failed_this_round: list[dict[str, Any]] = []
        total = len(retry_queue)
        for index, store in enumerate(retry_queue, start=1):
            if consecutive_failures >= 2:
                refresh_session("consecutive failures")
            elif stores_since_refresh >= session_refresh_every:
                refresh_session(f"every {session_refresh_every} stores")

            result = scrape_coords_job(
                store,
                api_template,
                uuid_map,
                uuid_lock,
                rate_limiter,
            )
            if not apply_result(result, index, total):
                failed_this_round.append(store)

        retry_queue = failed_this_round
        if retry_queue and round_index < retry_rounds:
            save_json(OUTPUT_PATH, restaurants)
            save_json(ENRICHED_PATH, restaurants)

    save_json(OUTPUT_PATH, restaurants)
    save_json(ENRICHED_PATH, restaurants)
    save_json(
        META_PATH,
        {
            "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "coords-only",
            "storeCount": len(restaurants),
            "coordsUpdated": updated,
            "coordsFailed": failed,
        },
    )
    print(
        f"wrote {ENRICHED_PATH} ({updated} coords this run, {failed} failed, "
        f"{len(retry_queue)} still pending)",
        flush=True,
    )
    return 0 if not retry_queue else 1


@dataclass
class MenuJobResult:
    store_id: str
    name: str
    menu: list[dict[str, Any]]
    store_uuid: str | None
    short_id: str | None
    lat: float | None = None
    lng: float | None = None
    address: str | None = None
    error: str | None = None


@dataclass
class CoordsJobResult:
    store_id: str
    name: str
    lat: float | None
    lng: float | None
    address: str | None
    store_uuid: str | None = None
    error: str | None = None


class ApiRateLimiter:
    """Serialize API calls across workers and pause all workers on rate limits."""

    def __init__(self, min_interval: float) -> None:
        self.min_interval = min_interval
        self.lock = threading.Lock()
        self.last_call = 0.0
        self.pause_until = 0.0

    def backoff(self, seconds: float) -> None:
        with self.lock:
            self.pause_until = max(self.pause_until, time.time() + seconds)

    def wait(self) -> None:
        with self.lock:
            now = time.time()
            if now < self.pause_until:
                time.sleep(self.pause_until - now)
                now = time.time()
            jitter = random.uniform(0.0, self.min_interval * 0.25)
            elapsed = now - self.last_call
            gap = self.min_interval + jitter - elapsed
            if gap > 0:
                time.sleep(gap)
            self.last_call = time.time()


def build_feed_url(address: str, lat: float, lng: float) -> str:
    """Logged-in feed uses lat/lng query params (matches browser after auth redirect)."""
    return (
        f"https://www.ubereats.com/tw/feed?"
        f"diningMode=DELIVERY&effect=&lat={lat}&lng={lng}&ps=1"
    )


def scrape_menu_job(
    store: dict[str, Any],
    api_template: requests.Session,
    uuid_map: dict[str, str],
    uuid_lock: threading.Lock,
    rate_limiter: ApiRateLimiter,
    max_menu_items: int,
) -> MenuJobResult:
    name = str(store.get("name", store["id"]))
    short_id = extract_short_store_id(store["storeUrl"])
    session = clone_api_session(api_template)
    log_prefix = f"  [{name}] "

    try:
        store_uuid = resolve_store_uuid_session(session, store, uuid_map, uuid_lock)
        if not store_uuid:
            return MenuJobResult(
                store_id=store["id"],
                name=name,
                menu=[],
                store_uuid=None,
                short_id=short_id,
            )

        menu, payload = fetch_store_menu_with_post(
            lambda endpoint, body: (
                rate_limiter.wait(),
                api_post_session(session, endpoint, body),
            )[-1],
            store_uuid,
            max_menu_items,
            log_prefix=log_prefix,
        )
        location = extract_store_location_from_payload(payload)
        return MenuJobResult(
            store_id=store["id"],
            name=name,
            menu=menu,
            store_uuid=store_uuid,
            short_id=short_id,
            lat=location.get("lat") if location else None,
            lng=location.get("lng") if location else None,
            address=location.get("address") if location else None,
        )
    except Exception as exc:
        return MenuJobResult(
            store_id=store["id"],
            name=name,
            menu=[],
            store_uuid=store.get("storeUuid"),
            short_id=short_id,
            error=str(exc),
        )


def finalize_menu_scrape(
    restaurants: list[dict[str, Any]],
    with_menu_items: int,
) -> None:
    save_json(OUTPUT_PATH, restaurants)
    save_json(ENRICHED_PATH, restaurants)
    save_json(
        META_PATH,
        {
            "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "menus-only",
            "storeCount": len(restaurants),
            "storesWithMenu": with_menu_items,
        },
    )
    print(f"wrote {OUTPUT_PATH} ({with_menu_items} stores with menus)", flush=True)
    print(f"wrote {ENRICHED_PATH}", flush=True)


def run_menus_only_parallel(
    restaurants: list[dict[str, Any]],
    pending: list[dict[str, Any]],
    max_menu_items: int,
    headless: bool,
    feed_url: str,
) -> int:
    workers = int(os.environ.get("UBEREATS_MENU_WORKERS", "4"))
    checkpoint_every = int(os.environ.get("UBEREATS_CHECKPOINT_EVERY", "5"))
    api_interval = float(os.environ.get("UBEREATS_API_INTERVAL", "0.6"))
    restaurant_index = {store["id"]: index for index, store in enumerate(restaurants)}
    uuid_map = load_uuid_map()
    rate_limiter = ApiRateLimiter(api_interval)
    state_lock = threading.Lock()
    completed = 0

    print(f"parallel menus: {workers} workers, api interval {api_interval}s", flush=True)
    print("warming feed session for internal API access...", flush=True)
    api_template, warmed_map = warm_menu_api_session(feed_url, headless)
    uuid_map.update(warmed_map)
    save_uuid_map(uuid_map)
    print(f"uuid map: {len(uuid_map)} stores", flush=True)

    def apply_result(result: MenuJobResult, index: int, total: int) -> None:
        nonlocal completed
        if result.error:
            print(f"[{index}/{total}] menu: {result.name}", flush=True)
            print(f"  warn: {result.error}", flush=True)
            print("  -> 0 items", flush=True)
            return

        print(f"[{index}/{total}] menu: {result.name}", flush=True)
        print(f"  -> {len(result.menu)} items", flush=True)
        if not result.menu:
            return

        with state_lock:
            store_ref = restaurants[restaurant_index[result.store_id]]
            store_ref["menu"] = result.menu
            if result.store_uuid:
                store_ref["storeUuid"] = result.store_uuid
            if result.lat is not None and result.lng is not None:
                store_ref["lat"] = result.lat
                store_ref["lng"] = result.lng
            if result.address:
                store_ref["address"] = result.address
            if result.short_id and result.store_uuid:
                uuid_map[result.short_id] = result.store_uuid
            http = clone_api_session(api_template)
            restaurants[restaurant_index[result.store_id]] = enrich_assets(
                dict(store_ref),
                http=http,
            )
            completed += 1
            if completed % checkpoint_every == 0:
                save_json(OUTPUT_PATH, restaurants)
                save_json(ENRICHED_PATH, restaurants)
                save_uuid_map(uuid_map)
                print(f"  checkpoint saved ({completed} menus written)", flush=True)

    total = len(pending)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                scrape_menu_job,
                store,
                api_template,
                uuid_map,
                state_lock,
                rate_limiter,
                max_menu_items,
            ): (index, store)
            for index, store in enumerate(pending, start=1)
        }
        for future in as_completed(futures):
            index, _store = futures[future]
            result = future.result()
            apply_result(result, index, total)

    save_uuid_map(uuid_map)
    with_menu_items = sum(1 for store in restaurants if len(store.get("menu") or []) > 0)
    finalize_menu_scrape(restaurants, with_menu_items)
    return 0


def run_menus_only(max_stores: int, max_menu_items: int, headless: bool) -> int:
    source_path = ENRICHED_PATH if ENRICHED_PATH.exists() else OUTPUT_PATH
    if not source_path.exists():
        print(f"no restaurant list at {source_path}")
        return 1

    restaurants: list[dict[str, Any]] = load_json(source_path, [])
    pending = [
        store
        for store in restaurants
        if store.get("storeUrl") and len(store.get("menu") or []) == 0
    ]
    if max_stores > 0:
        pending = pending[:max_stores]

    print(f"menus-only: {len(pending)} / {len(restaurants)} stores need menus")
    if not pending:
        print("all stores already have menus")
        return 0

    feed_url = os.environ.get("UBEREATS_FEED_URL", DEFAULT_FEED_URL).strip()
    workers = int(os.environ.get("UBEREATS_MENU_WORKERS", "4"))
    if workers > 1:
        return run_menus_only_parallel(
            restaurants,
            pending,
            max_menu_items,
            headless,
            feed_url,
        )

    checkpoint_every = int(os.environ.get("UBEREATS_CHECKPOINT_EVERY", "5"))
    restaurant_index = {store["id"]: index for index, store in enumerate(restaurants)}
    uuid_map = load_uuid_map()

    with sync_playwright() as playwright:
        launch_kwargs: dict[str, Any] = {"headless": headless}
        if not headless:
            launch_kwargs["slow_mo"] = 50
            launch_kwargs["args"] = ["--start-maximized"]
        browser = playwright.chromium.launch(**launch_kwargs)
        use_auth = os.environ.get("UBEREATS_USE_AUTH", "auto").strip() not in ("0", "false", "no")
        if use_auth and AUTH_STATE_PATH.exists():
            print(f"loading saved session from {AUTH_STATE_PATH}", flush=True)
        context = new_browser_context(browser, use_auth=use_auth)
        page = context.new_page()

        print("warming feed session for internal API access...", flush=True)
        feed_payload: dict[str, Any] | None = None
        warmed_map, feed_payload = warm_feed_session(page, feed_url)
        uuid_map.update(warmed_map)
        if use_auth and not feed_session_is_healthy(page):
            print("saved session unusable — retrying as guest", flush=True)
            context.close()
            context = new_browser_context(browser, use_auth=False)
            page = context.new_page()
            warmed_map, feed_payload = warm_feed_session(page, feed_url)
            uuid_map.update(warmed_map)
        api_session = build_api_session_from_context(context)
        uuid_map.update(expand_uuid_map_from_feed(api_session, feed_payload))
        save_uuid_map(uuid_map)
        print(f"uuid map: {len(uuid_map)} stores", flush=True)

        for index, store in enumerate(pending, start=1):
            name = store.get("name", store["id"])
            print(f"[{index}/{len(pending)}] menu: {name}", flush=True)
            try:
                menu = scrape_store_menu(page, store, max_menu_items, uuid_map=uuid_map)
            except Exception as exc:
                print(f"  warn: menu scrape failed: {exc}", flush=True)
                menu = []
            print(f"  -> {len(menu)} items", flush=True)

            if menu:
                store["menu"] = menu
                if store.get("storeUuid"):
                    uuid_map[extract_short_store_id(store["storeUrl"])] = store["storeUuid"]
                enriched = enrich_assets(dict(store))
                restaurants[restaurant_index[store["id"]]] = enriched

            if index % checkpoint_every == 0:
                save_json(OUTPUT_PATH, restaurants)
                save_json(ENRICHED_PATH, restaurants)
                save_uuid_map(uuid_map)
                print(f"  checkpoint saved ({index}/{len(pending)})", flush=True)
            time.sleep(float(os.environ.get("UBEREATS_MENU_DELAY", "2.5")))

        context.close()
        browser.close()

    with_menu_items = sum(1 for store in restaurants if len(store.get("menu") or []) > 0)
    save_uuid_map(uuid_map)
    finalize_menu_scrape(restaurants, with_menu_items)
    return 0


def main() -> int:
    email = os.environ.get("UBEREATS_EMAIL", "").strip()
    password = effective_password(os.environ.get("UBEREATS_PASSWORD", ""))
    manual_login = os.environ.get("UBEREATS_MANUAL_LOGIN", "").strip() in ("1", "true", "yes")
    login_timeout_sec = int(os.environ.get("UBEREATS_LOGIN_TIMEOUT", "300"))
    feed_url = os.environ.get("UBEREATS_FEED_URL", DEFAULT_FEED_URL).strip()
    max_stores = int(os.environ.get("UBEREATS_MAX_STORES", "0"))
    max_menu_items = int(os.environ.get("UBEREATS_MAX_MENU_ITEMS", "16"))
    skip_menu = os.environ.get("UBEREATS_SKIP_MENU", "").strip() in ("1", "true", "yes")
    menus_only = os.environ.get("UBEREATS_MENUS_ONLY", "").strip() in ("1", "true", "yes")
    covers_only = os.environ.get("UBEREATS_COVERS_ONLY", "").strip() in ("1", "true", "yes")
    coords_only = os.environ.get("UBEREATS_COORDS_ONLY", "").strip() in ("1", "true", "yes")

    address = os.environ.get("UBEREATS_ADDRESS", DEFAULT_LOCATION["address"])
    lat = float(os.environ.get("UBEREATS_LAT", DEFAULT_LOCATION["lat"]))
    lng = float(os.environ.get("UBEREATS_LNG", DEFAULT_LOCATION["lng"]))
    if os.environ.get("UBEREATS_FEED_URL") is None:
        feed_url = build_feed_url(address, lat, lng)

    # Manual OTP login requires a visible browser
    headless_env = os.environ.get("UBEREATS_HEADLESS", "")
    if manual_login or (email and not password):
        headless = headless_env == "1"
    else:
        headless = headless_env != "0"

    if menus_only:
        return run_menus_only(max_stores, max_menu_items, headless)

    if covers_only:
        return run_covers_only(max_stores, headless)

    if coords_only:
        return run_coords_only(max_stores, headless)

    print(f"feed: {feed_url[:160]}...")
    restaurants: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        launch_kwargs: dict[str, Any] = {"headless": headless}
        if not headless:
            launch_kwargs["slow_mo"] = 50
            launch_kwargs["args"] = ["--start-maximized"]
        browser = playwright.chromium.launch(**launch_kwargs)
        context_kwargs: dict[str, Any] = {
            "user_agent": USER_AGENT,
            "locale": "zh-TW",
        }
        if AUTH_STATE_PATH.exists():
            context_kwargs["storage_state"] = str(AUTH_STATE_PATH)
            print(f"loading saved session from {AUTH_STATE_PATH}")
        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        if manual_login:
            logged_in = ensure_authenticated(
                page,
                feed_url,
                email,
                password,
                manual_login,
                login_timeout_sec,
            )
            if has_authenticated_session(page) and not is_guest_browsing(page):
                save_auth_state(context)
            else:
                print("manual login not completed (still guest or timed out); aborting")
                browser.close()
                return 1
        else:
            print("using saved session — scraping feed")

        print("loading feed...")
        payloads, dom_stores = collect_api_payloads(page, feed_url)

        parsed_stores: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        if dom_stores:
            print(f"  DOM feed stores: {len(dom_stores)}")
        for index, card in enumerate(dom_stores):
            store_url = card.get("storeUrl", "")
            if not is_valid_ubereats_store_url(store_url):
                continue
            store_id_match = re.search(r"/store/[^/]+/([^/?#]+)", store_url, re.IGNORECASE)
            if not store_id_match:
                continue
            store_id = store_id_match.group(1)
            record_id = f"ue-{store_id}"
            if record_id in seen_ids:
                continue
            seen_ids.add(record_id)
            parsed_stores.append(
                {
                    "id": record_id,
                    "ueStoreId": store_id,
                    "slug": slugify(card.get("name", f"store-{index}")),
                    "name": card.get("name", f"Store {index + 1}"),
                    "category": "美食",
                    "emoji": "🍽️",
                    "address": address,
                    "lat": lat,
                    "lng": lng,
                    "rating": 4.6,
                    "deliveryMinutes": 25,
                    "deliveryFee": 49,
                    "tagline": card.get("meta") or "Uber Eats",
                    "coverImageUrl": card.get("imageUrl"),
                    "storeUrl": store_url,
                    "menu": [],
                }
            )

        if not dom_stores:
            for payload in payloads:
                for raw_store in extract_feed_stores_from_payload(payload):
                    parsed = parse_store_card(raw_store)
                    if not parsed or parsed["id"] in seen_ids:
                        continue
                    seen_ids.add(parsed["id"])
                    parsed_stores.append(parsed)
            print(f"  API-only feed stores: {len(parsed_stores)}")

        deduped: dict[str, dict[str, Any]] = {}
        for store in parsed_stores:
            key = store.get("storeUrl") or store["id"]
            deduped[key] = store
        store_list = list(deduped.values())
        if max_stores > 0:
            store_list = store_list[:max_stores]
        if skip_menu:
            print(f"found {len(store_list)} stores (feed-only, skipping menus)")
        else:
            print(f"found {len(store_list)} stores (scraping menus for each)")

        for index, store in enumerate(store_list, start=1):
            if skip_menu:
                store["menu"] = []
            else:
                print(f"[{index}/{len(store_list)}] menu: {store['name']}")
                try:
                    store["menu"] = scrape_store_menu(page, store, max_menu_items)
                except Exception as exc:
                    print(f"  warn: menu scrape failed: {exc}")
                    store["menu"] = []
            if not store.get("address"):
                store["address"] = address
            assign_store_coordinates(store, lat, lng)
            restaurants.append(enrich_assets(store))
            if not skip_menu:
                time.sleep(1.2)

        browser.close()

    if not restaurants:
        print("no restaurants scraped; keeping existing data")
        if OUTPUT_PATH.exists():
            return 0
        return 1

    save_json(OUTPUT_PATH, restaurants)
    save_json(ENRICHED_PATH, restaurants)
    save_json(
        META_PATH,
        {
            "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "feedUrl": feed_url,
            "address": address,
            "lat": lat,
            "lng": lng,
            "storeCount": len(restaurants),
        },
    )
    print(f"wrote {OUTPUT_PATH}")
    print(f"wrote {ENRICHED_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
