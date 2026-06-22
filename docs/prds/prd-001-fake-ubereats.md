# PRD-001: Fake Uber Eats 示範站

## Meta

- 狀態：approved
- 建立：2026-06-10
- 更新：2026-06-10

## 1. 問題定義

使用者想要一個 **視覺與內容貼近 Uber Eats 官網** 的外送示範站，但：

- 不下真單、不扣款（惡搞式完整體驗）
- 餐廳與菜單資料應來自 **真實 Uber Eats**（登入後爬蟲匯出），而非假資料或 OpenStreetMap 隨機菜單
- 最終部署到 **GitHub Pages** 作為靜態展示

## 2. 目標使用者

- 自己或朋友體驗「像真的在點 Uber Eats」
- 展示用（作品集、惡搞 demo）

## 3. 核心需求

| # | 需求 | 優先級 |
|---|------|--------|
| R1 | 首頁 feed 風格對齊 [Uber Eats TW feed](https://www.ubereats.com/tw/feed)（國泰金融中心區域） | P0 |
| R2 | Playwright 登入 Uber Eats，爬取 feed 餐廳列表 + 各店菜單 + 圖片 | P0 |
| R3 | 前端只讀本地 JSON / 圖片，不依賴即時爬蟲 API | P0 |
| R4 | 保留完整點餐流程：選店 → 菜單 → 結帳 → 外送追蹤 → 空袋結局 | P1 |
| R5 | GitHub Actions 自動部署 GitHub Pages | P0 |
| R6 | 可選：GitHub Actions 手動觸發遠端爬蟲更新資料 | P2 |

## 4. 非目標

- 真實付款、真實外送
- 後端 API 伺服器
- 使用者註冊 / 登入（官網按鈕可為裝飾）
- 違反 Uber Eats ToS 的公開商業用途

## 5. 成功指標

- 本機執行爬蟲後，feed 顯示 ≥ 8 家真實餐廳，每家 ≥ 8 個菜單品項（含圖片優先）
- GitHub Pages URL 可完整走過點餐流程
- 預設地址為「國泰金融中心」

## 6. Spec 展開

| Spec | 名稱 | 說明 |
|------|------|------|
| spec-001 | ubereats-clone | 爬蟲管線 + 前端對齊 + GitHub Pages 部署 |
