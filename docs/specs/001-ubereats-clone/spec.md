# Spec-001: Uber Eats 克隆示範站（爬蟲 + 靜態前端 + Pages）

## Meta

- 類型：Refactor + Infra
- 狀態：approved
- PRD：prds/prd-001-fake-ubereats.md
- UI 來源：[Uber Eats TW Feed — 國泰金融中心](https://www.ubereats.com/tw/feed?diningMode=DELIVERY&pl=JTdCJTIyYWRkcmVzcyUyMiUzQSUyMiVFNSU5QyU4QiVFNiVCMyVCMCVFOSU4NyU5MSVFOCU5RSU4RCVFNCVCOCVBRCVFNSVCRiU4MyUyMiUyQyUyMnJlZmVyZW5jZSUyMiUzQSUyMkNoSUpVd2xHOExxclFqUVJqZlJnQmxzd0luUSUyMiUyQyUyMnJlZmVyZW5jZVR5cGUlMjIlM0ElMjJnb29nbGVfcGxhY2VzJTIyJTJDJTIybGF0aXR1ZGUlMjIlM0EyNS4wMzgyNDc3JTJDJTIybG9uZ2l0dWRlJTIyJTNBMTIxLjU2OTEwNTQ5OTk5OTk4JTdE)
- 依賴：無
- 建立：2026-06-10
- 更新：2026-06-10（approved）

## 1. 背景與目的

專案原為「假 Uber Eats」：部分假菜單、OpenStreetMap 合併、麥當勞/Wikimedia 補圖，與官網體驗差距大。

本 spec 目標：改為 **爬蟲匯出 → 靜態 JSON → GitHub Pages** 的單向資料流，UI 對齊官網 feed，保留惡搞結帳／追蹤流程。

## 2. 設計原則

- **靜態優先**：GitHub Pages 無後端；爬蟲只在開發機或 CI 執行，產物 commit 進 repo
- **單一資料來源**：執行期只讀 `data/restaurants.enriched.json`（fallback `data/restaurants.json`）
- **官網為準**：預設座標、地址、feed 版面以 Uber Eats 國泰金融中心為參考
- **憑證不入庫**：`.env`、`data/.ubereats-auth.json` 僅本機／GitHub Secrets

## 3. 不在範圍內

- 真實 Uber 帳號 OAuth 整合到前端
- 即時同步 Uber Eats 價格
- 多城市／多地址動態爬蟲（僅支援設定檔 + 環境變數覆寫）
- 單元測試覆蓋 Playwright 爬蟲（以手動 + JSON schema 驗證為主）

## 4. 涉及範圍

### 頁面清單

| 動作 | 頁面 | 說明 | 設計來源 | UISpec |
|------|------|------|---------|--------|
| 修改 | Feed 首頁 | 網格卡片、分類 pill、官網風 header | Uber Eats URL | —（規格內嵌 Section 6） |
| 參考 | 餐廳菜單頁 | 橫幅、分類導覽、人氣必點 | 既有 `index.html` | — |
| 參考 | 結帳頁 | 地址、載具、小費、付款 | 既有 | — |
| 參考 | 追蹤頁 | 地圖、時間軸、空袋結局 | 既有 | — |

### API 清單

本專案無後端 API。以下為 **靜態資料契約**（視同資料介面）：

| 動作 | 契約 | 路徑 | 說明 |
|------|------|------|------|
| 參考 | 站點設定 | `data/config.json` | 預設地址、座標 |
| 修改 | 餐廳資料 | `data/restaurants.enriched.json` | 爬蟲主輸出 |
| 新增 | 爬蟲 meta | `data/scrape_meta.json` | 爬取時間、店數 |

### DB 清單

無關聯式資料庫。JSON 餐廳結構：

```json
{
  "id": "ue-<uuid>",
  "name": "店名",
  "category": "菜系",
  "lat": 25.0382477,
  "lng": 121.5691055,
  "rating": 4.6,
  "deliveryMinutes": 25,
  "deliveryFee": 49,
  "coverImage": "assets/images/restaurants/ue-xxx.jpg",
  "menu": [
    {
      "id": 1,
      "name": "品項",
      "price": 160,
      "category": "分類",
      "desc": "描述",
      "image": "assets/images/menu/ue-xxx-1.jpg"
    }
  ],
  "dataSource": "ubereats",
  "scrapedAt": "ISO8601"
}
```

### 基礎建設

| 動作 | 項目 | 說明 | 路徑 |
|------|------|------|------|
| 新增 | Uber Eats 爬蟲 | 登入、feed、菜單、下載圖 | `scripts/scrape_ubereats.py` |
| 新增 | 爬蟲啟動腳本 | 讀 `.env`、裝依賴 | `scripts/run_scrape.sh` |
| 新增 | Pages 部署 | push 觸發 | `.github/workflows/deploy.yml` |
| 新增 | 遠端爬蟲（選用） | workflow_dispatch | `.github/workflows/scrape.yml` |
| 修改 | 前端資料流 | 移除 OSM 假餐廳合併 | `app.js` |
| 參考 | 舊麥當勞爬蟲 | 可保留或之後刪除 | `scripts/scrape_menus.py` |

## 5. 業務規則

- BR-1：進入餐廳／結帳前須有外送地址（預設載入國泰金融中心）
- BR-2：購物車、結帳、追蹤邏輯維持「假外送」行為（不扣款、空袋結局）
- BR-3：爬蟲失敗時不覆寫既有 `restaurants.json`（腳本已實作）
- BR-4：圖片優先本地路徑；遠端 URL 僅作爬蟲過渡
- BR-5：部署產物為 repo 根目錄靜態檔，含 `data/`、`assets/`、`.nojekyll`

## 6. 實作任務（依序執行）

> **請由上到下完成**。`[x]` 表示目前已部分完成，仍需你本機驗證後勾選。

### 階段 0：專案與文件（VIF）

```
task-0 → task-1
```

1. [x] 建立 VIF 結構（PRD、spec、specs-overview、CLAUDE.md）
2. [x] **你**：閱讀本 spec，回覆「approve spec-001」後將 Meta 狀態改為 `approved`，並更新 `specs-overview.md` 為 ✅

---

### 階段 1：開發環境

```
task-1 → task-2 → task-3
```

3. [x] 建立 Conda 環境 `uber-fake`（Python 3.12）
   ```bash
   conda create --name uber-fake python=3.12 -y
   # 或：conda env create -f environment.yml
   conda activate uber-fake
   ```
4. [x] 安裝爬蟲依賴
   ```bash
   pip install -r scripts/requirements.txt
   playwright install chromium
   ```
5. [ ] 設定憑證（台灣 Uber Eats 多為 **驗證碼登入**，不需密碼）
   ```bash
   cp .env.example .env
   # 編輯 UBEREATS_EMAIL
   # UBEREATS_MANUAL_LOGIN=1、UBEREATS_HEADLESS=0
   ```
6. [ ] **首次手動登入**（瀏覽器內輸入驗證碼）
   ```bash
   ./scripts/login_once.sh
   ```
   成功後會寫入 `data/.ubereats-auth.json`，之後爬蟲可重用 session。
   > 若帳號已被停權，需換新帳號；或略過登入嘗試訪客模式（資料可能較少）。

---

### 階段 2：資料爬取（核心）

```
task-3 → task-4 → task-5
```

7. [ ] 執行爬蟲
   ```bash
   ./scripts/run_scrape.sh
   # 或：python scripts/scrape_ubereats.py
   ```
8. [ ] 驗證輸出
   - `data/restaurants.enriched.json` 存在且 `length >= 8`
   - 每家 `menu.length >= 8`
   - `assets/images/restaurants/`、`assets/images/menu/` 有檔案
   - `data/scrape_meta.json` 有 `scrapedAt`
9. [ ] 若登入／解析失敗：將終端錯誤貼給 AI，調整 `scrape_ubereats.py` 選擇器或 API 解析（最多迭代 3 次）

---

### 階段 3：前端對齊與清理

```
task-5 → task-6 → task-7
```

9. [x] Feed UI：官網風 header、分類 pill、餐廳網格（`index.html`、`styles.css`）
10. [x] 資料流：預設國泰金融中心、只讀 JSON（`app.js`、`data/config.json`）
11. [ ] 本機預覽驗收
    ```bash
    python3 -m http.server 8080
    # 開 http://localhost:8080
    ```
    - Feed 顯示真實店名與圖片
    - 分類篩選有效
    - 點店 → 菜單 → 加入購物車 → 結帳 → 追蹤 → 空袋
12. [ ] 清理死碼（選用）
    - 移除 `app.js` 未使用的 `buildMenuFromTemplate`、`emojiForAmenity`
    - 封存或刪除 `scripts/scrape_menus.py`、`data/scrape_targets.json`（若不再使用）

---

### 階段 4：Git 與 GitHub Pages

```
task-7 → task-8 → task-9
```

13. [ ] 初始化 Git（若尚未）
    ```bash
    git init
    git add .
    git commit -m "feat: Uber Eats clone with scraper and static feed"
    ```
14. [ ] 推送到 GitHub
    ```bash
    git remote add origin <你的-repo-url>
    git branch -M main
    git push -u origin main
    ```
15. [ ] 啟用 GitHub Pages
    - Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**
    - 確認 Actions 中 `Deploy to GitHub Pages` workflow 成功
16. [ ] 開啟 `https://<user>.github.io/<repo>/` 重跑階段 3 驗收清單

---

### 階段 5：遠端爬蟲（選用）

```
task-9 → task-10
```

17. [ ] 在 GitHub Repo **Settings → Secrets** 新增：
    - `UBEREATS_EMAIL`
    - `UBEREATS_PASSWORD`
18. [ ] Actions → **Scrape Uber Eats data** → Run workflow
19. [ ] 確認 bot commit 更新 `data/restaurants.enriched.json` 後 Pages 自動重部署

---

### 階段 6：驗證與收尾

```
task-10 → task-11
```

20. [ ] 執行 `/vif-verify` 或手動對照下方驗收條件
21. [ ] 執行 `/vif-close`：更新 spec 狀態為 `done`、specs-overview 為 ✔️

## 7. 驗收條件

- [ ] **AC-1 Feed**  
  **Given** 已執行爬蟲且開啟首頁  
  **When** 使用者載入 feed  
  **Then** 顯示 ≥ 8 家餐廳卡片，含店名、評分、外送時間、封面圖，預設地址為國泰金融中心

- [ ] **AC-2 菜單**  
  **Given** 使用者點選任一家餐廳  
  **When** 進入菜單頁  
  **Then** 顯示 ≥ 8 個品項，價格為 NTD 整數，多數品項有圖片

- [ ] **AC-3 假結帳**  
  **Given** 購物車有品項  
  **When** 完成結帳流程  
  **Then** 出現追蹤動畫與「袋子是空的」結局，無真實扣款

- [ ] **AC-4 靜態部署**  
  **Given** 程式已 push 到 GitHub  
  **When** Pages workflow 成功  
  **Then** 公開 URL 可完成 AC-1～AC-3

- [ ] **AC-5 憑證安全**  
  **Given** 檢查 git 歷史  
  **When** 搜尋 `.env` 或密碼  
  **Then** 不得出現在 repo 中

## 8. 約束與限制

- Uber Eats 頁面結構可能變更，爬蟲需維護
- GitHub Pages 不執行 Python；爬蟲必須在本地或 CI 完成
- 僅供個人示範，注意 Uber 服務條款

## 9. 成功標準

- 驗收條件 AC-1～AC-5 全數通過
- 公開 Pages 連結可分享給他人體驗

## 10. 下一步（Spec approved 之後）

本專案為靜態站 + 腳本，**可不展開**獨立 api-spec / ui-spec，直接依 Section 6 任務開發。

若你希望更嚴謹：
- **A.** 直接開發 → `/vif-develop`（引用本 spec Section 6）
- **B.** 補 UI 細節 → `/vif-ui-spec`（模組：`ui-specs/feed/`）
- **C.** 全自動 → PRD 已 approved，可 `/vif-god`（小專案通常 overkill）
