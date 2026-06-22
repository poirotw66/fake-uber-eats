#!/usr/bin/env python3
"""Open Uber Eats login in a browser; save session after manual OTP login."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from scrape_ubereats import (  # noqa: E402
    AUTH_STATE_PATH,
    DEFAULT_LOCATION,
    USER_AGENT,
    build_feed_url,
    debug_page_state,
    has_authenticated_session,
    is_guest_browsing,
    login_manual,
    save_auth_state,
    save_debug_screenshot,
)


def pause_before_close(message: str) -> None:
    print("")
    print(message)
    try:
        input("按 Enter 關閉瀏覽器…")
    except EOFError:
        pass


def main() -> int:
    email = os.environ.get("UBEREATS_EMAIL", "").strip()
    timeout_sec = int(os.environ.get("UBEREATS_LOGIN_TIMEOUT", "300"))
    fresh = os.environ.get("UBEREATS_FRESH_LOGIN", "1").strip() in ("1", "true", "yes")

    address = os.environ.get("UBEREATS_ADDRESS", DEFAULT_LOCATION["address"])
    lat = float(os.environ.get("UBEREATS_LAT", DEFAULT_LOCATION["lat"]))
    lng = float(os.environ.get("UBEREATS_LNG", DEFAULT_LOCATION["lng"]))
    feed_url = os.environ.get("UBEREATS_FEED_URL", "").strip() or build_feed_url(address, lat, lng)

    print("Uber Eats manual login (headed / 有視窗模式)")
    print("  auth: https://auth.uber.com/v2/")
    print(f"  email: {email or '(未設定)'}")
    print(f"  timeout: {timeout_sec}s")
    if fresh and AUTH_STATE_PATH.exists():
        AUTH_STATE_PATH.unlink()
        print(f"  removed old session: {AUTH_STATE_PATH}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=False,
            slow_mo=80,
            args=["--start-maximized"],
        )
        context = browser.new_context(
            user_agent=USER_AGENT,
            locale="zh-TW",
            viewport=None,
        )
        page = context.new_page()

        ok = login_manual(page, email, timeout_sec, return_url=feed_url)
        authenticated = has_authenticated_session(page) and not is_guest_browsing(page)

        if not ok or not authenticated:
            print("")
            print("登入未完成。目前狀態：")
            debug_page_state(page)
            save_debug_screenshot(page, "login-fail")
            print("")
            print("可能原因：")
            print("  - 帳號被停權 → 需換帳號")
            print("  - 驗證碼逾時 → 加大 UBEREATS_LOGIN_TIMEOUT")
            print("  - 仍為訪客 → header 同時有「登入」「註冊」")
            print(f"  - 截圖已存：data/debug-login-fail.png")
            pause_before_close("瀏覽器保持開啟，請檢查畫面後關閉。")
            browser.close()
            return 1

        save_auth_state(context)
        print("done — you can now run: ./scripts/run_scrape.sh")
        pause_before_close("登入成功！確認無誤後關閉瀏覽器。")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
