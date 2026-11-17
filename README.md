# Smart Wardrobe v0.3.5.0 — Gemini AI 訂單匯入測試版

保留 v0.3.4.4 的全部功能，新增 Gemini 2.5 Flash-Lite + Cloudflare Worker 自動匯入。

## 安裝
1. GitHub Pages：只上傳根目錄的 `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, `icons/`。**不要把 Worker 或 API Key 放到公開網站**。
2. 到 https://aistudio.google.com/apikey 建立 Gemini API Key；確認所選模型有可用免費額度及你接受其資料處理條款。
3. Cloudflare Workers 建立 Worker，使用 `cloudflare-worker/worker.js` 內容部署。
4. Worker Settings → Variables and Secrets：新增加密 Secret `GEMINI_API_KEY`；新增一般變數 `ALLOWED_ORIGIN` 值 `https://y1ee.github.io`（不含最後 `/`）。
5. 取得 `https://xxx.workers.dev` 網址，貼到 Smart Wardrobe → 衣櫃 → 匯入訂單的 Worker 網址欄。
6. 選擇截圖，點「AI 分析並自動加入衣櫃」。

## 注意
- 訂單截圖會經 Cloudflare Worker 傳至 Google Gemini；請遮住個資。
- 只有信心 ≥0.85、欄位完整、非重複的單件商品才自動新增；其他商品保留待確認。
- 「復原上一次 AI 匯入」只刪除上次自動新增的商品。
- 圖片不會自動從品牌官網抓取；衣物先以示意圖呈現，可之後補上純衣物照片。
- Worker CORS 限制僅限制瀏覽器來源，**不是身份驗證或防濫用機制**；公開 Workers 網址可能被其他用戶端呼叫。正式長期使用前應加入身份驗證、伺服端配額與成本防護。
- 免費額度及資料政策可能變動，以 Google 官方控制台為準。
- 已執行語法檢查，但尚未在 iPhone 上實測。
