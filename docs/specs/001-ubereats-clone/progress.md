# Spec-001: Uber Eats 克隆示範站 — Progress

## 設計文件

- [x] 不需要展開獨立設計文件 — 靜態前端 + JSON 資料契約，UI/API 規格已內嵌於 spec.md Section 4、6

## 測試策略

| 驗收條件 | 測試層級 | 理由 |
|---------|---------|------|
| AC-1 Feed 顯示 | 手動 E2E | 瀏覽器視覺與資料載入 |
| AC-2 菜單 | 手動 E2E | 互動流程 |
| AC-3 假結帳 | 手動 E2E | 多步驟 UI |
| AC-4 Pages 部署 | CI + 手動 | GitHub Actions 結果 |
| AC-5 憑證 | 手動 | git log / 檔案檢查 |
| 爬蟲輸出 | 手動 + 腳本 | JSON 結構與圖片存在 |

## 進度

- [x] Phase 1: Spec approved
- [ ] Phase 2: Develop
  - [x] Task 0: VIF 文件結構
  - [x] Task 9-10: Feed UI + 資料流（待本機驗證）
  - [x] Task 3-4: Conda 環境 uber-fake + Playwright
  - [ ] Task 5-6: 設定 .env + 執行爬蟲
  - [ ] Task 6-8: 本機預覽驗收
  - [ ] Task 11-12: 清理死碼（選用）
  - [ ] Task 13-16: Git + GitHub Pages
  - [ ] Task 17-19: 遠端爬蟲（選用）
- [ ] Phase 3: Verify
- [ ] Phase 4: Review
- [ ] Phase 5: Close

## 決策紀錄

### 2026-06-10: 靜態爬蟲單向資料流

- 考慮：即時 proxy API vs 預先爬取 JSON
- 決定：預先爬取 — GitHub Pages 無後端，且避免 CORS／登入問題

### 2026-06-10: 不展開 api-spec / ui-spec

- 考慮：完整 VIF 設計文件 vs 輕量 spec 內嵌任務
- 決定：內嵌 — 單 repo 靜態站，任務清單已足夠驅動開發
