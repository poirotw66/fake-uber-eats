#!/usr/bin/env python3
"""Audit menu image semantic mapping and print a report."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dish_images import load_item_images

# Manual review flags: item_id -> issue description (only genuine mismatches)
KNOWN_ISSUES: dict[str, str] = {
    "108": "豆沙小籠包圖片仍偏甜點而非小籠",
}


def main() -> int:
    restaurants = json.loads((ROOT / "data/restaurants.enriched.json").read_text(encoding="utf-8"))
    item_images = load_item_images()
    url_to_items: dict[str, list[str]] = {}

    print("# 餐廳與菜單稽核報告\n")
    print(f"- 餐廳數：{len(restaurants)}")
    print(f"- 菜單品項：{sum(len(r['menu']) for r in restaurants)}")
    print(f"- 圖片對照表：{len(item_images)} 筆\n")

    issue_count = 0
    for restaurant in restaurants:
        print(f"## {restaurant['name']}")
        print(f"- 分類：{restaurant.get('category')} | 品項：{len(restaurant['menu'])}\n")
        for item in restaurant["menu"]:
            item_id = str(item["id"])
            url = item_images.get(item_id, "未設定")
            local = item.get("image", "")
            exists = (ROOT / local).exists() if local and not local.startswith("http") else False
            flags: list[str] = []
            if item_id in KNOWN_ISSUES:
                flags.append(f"⚠️ {KNOWN_ISSUES[item_id]}")
                issue_count += 1
            if not exists:
                flags.append("❌ 本地圖片缺失")
                issue_count += 1
            if url != "未設定":
                url_to_items.setdefault(url, []).append(f"{restaurant['name']}:{item['name']}")
            flag_text = " | ".join(flags) if flags else "✅"
            print(f"- **{item['name']}**（${item['price']}）— {flag_text}")
        print()

    dupes = {url: names for url, names in url_to_items.items() if len(names) > 2}
    if dupes:
        print("## 重複圖片（同一 URL 用於 3 項以上）\n")
        for url, names in sorted(dupes.items(), key=lambda x: -len(x[1])):
            print(f"- `{url[:60]}...` → {len(names)} 項")
            for name in names[:5]:
                print(f"  - {name}")
            if len(names) > 5:
                print(f"  - ...共 {len(names)} 項")
            issue_count += 1
        print()

    print(f"## 總計疑似問題：{issue_count} 項")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
