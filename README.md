# Smart Wardrobe v0.3.5.1 — AI 訂單匯入先確認版

## 修改
- Gemini 辨識結果全部加入「待匯入商品」，**不再自動儲存衣物**。
- 使用者可編輯／取消勾選／移除，最後點「確認加入衣櫃」才正式儲存。
- 排除非衣物及已存在衣櫃／待確認清單的重複項目。
- 手機 AI 失敗時在匯入視窗顯示 Worker 診斷 JSON（若 Worker 已部署新版）。
- 變更 PWA 快取版本，減少手機載入舊程式。

## GitHub Pages 部署
將根目錄的 `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest` 和 `icons/` 更新至 GitHub repository。`cloudflare-worker/` **不要放到 GitHub Pages 公開根目錄**；其 `worker.js` 請單獨貼到 Cloudflare Workers 編輯器部署。

## Cloudflare Worker 部署
1. 先備份 Cloudflare 現有程式，再用 `cloudflare-worker/worker.js` 更新並 Deploy。
2. 沿用 `GEMINI_API_KEY` Secret 和 `ALLOWED_ORIGIN=https://y1ee.github.io`。
3. `/health` 可直接在瀏覽器開啟；`/test-gemini` 只有在設有 `DIAGNOSTIC_TOKEN` Secret 並提供 `X-Diagnostic-Token` 標頭時才執行。
4. 重新開啟 iPhone Safari 的網站並執行一次 AI 匯入；錯誤時複製顯示的診斷資訊（請勿分享 API Key 或訂單個資）。

## 注意
- 電腦與手機的衣櫃資料目前存在各自的 IndexedDB，不會自動同步。
- 之前 v0.3.5.0 已自動匯入的商品不會被這次更新刪除；可在舊裝置使用「復原舊版 AI 自動匯入」或手動刪除。
- 地區限制錯誤尚未定位；此版新增診斷能力，**並未宣稱已修復**。
- CORS Origin 檢查不是使用者身分驗證，正式長期公開使用應加上身分驗證及額度限制。
