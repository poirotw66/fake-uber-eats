# fake-uber-eats

## AI-Driven Development Flow

- Workspace：Monorepo（預設）
- flow_mode：normal

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | 靜態 HTML / CSS / Vanilla JS |
| 資料 | JSON（`data/restaurants.enriched.json`）+ 本地圖片 `assets/images/` |
| 爬蟲 | Python 3.12、Playwright、requests |
| 部署 | GitHub Pages（GitHub Actions） |

## 專案指令

```bash
# Conda 環境（首次）
conda create --name uber-fake python=3.12 -y
conda activate uber-fake
pip install -r scripts/requirements.txt
playwright install chromium
# 或：conda env create -f environment.yml

# 首次登入（驗證碼，需手動在瀏覽器完成）
conda activate uber-fake
./scripts/login_once.sh

# 爬蟲（會重用 data/.ubereats-auth.json）
./scripts/run_scrape.sh

# 本地預覽
python3 -m http.server 8080

# 菜單圖片稽核（選用）
python3 scripts/audit_menu_images.py
```

## 測試策略

- 爬蟲：手動執行 + 檢查輸出 JSON 結構與圖片檔案
- 前端：瀏覽器手動驗收（feed → 餐廳 → 結帳 → 追蹤）
- 部署：GitHub Actions deploy workflow 成功 + Pages URL 可開

## Git 規範

- 文件：`docs: ...`
- 功能：`feat: ...`
- 修復：`fix: ...`
- 資料更新：`chore: refresh Uber Eats scraped data`
- 不 commit：`.env`、`data/.ubereats-auth.json`

## Skills

| Skill | 用途 |
|-------|------|
| `/vif-flow` | 流程總覽、routing |
| `/vif-spec` | 技術規劃 |
| `/vif-develop` | TDD 開發 |
| `/vif-verify` | 驗證 |
| `/vif-close` | 收尾 |
