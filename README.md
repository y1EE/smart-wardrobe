Smart Wardrobe v0.3.6.8

更新：商品分享文字即使沒有網址，也能依商品編號配對；支援多個【商品】區塊；未取得網址時提供官網搜尋，不會假造商品頁 URL。

部署：以此 ZIP 內容覆蓋 GitHub Pages 專案前端檔案。Cloudflare Worker 不需修改。

Smart Wardrobe v0.3.6.7 — 剪貼簿支援

新增使用者點擊的剪貼簿讀取（text/plain / text/html）、貼上時嘗試從 HTML 連結補回官方網址；保留多項商品分享文字解析。iOS 支援程度視 Safari/PWA 與權限而定。Worker 不需更新。

Smart Wardrobe v0.3.6.5

- App 分享文字可一次貼上多件商品，逐一解析官方網址與商品編號，優先配對待匯入商品，未配對才新增。
- 修正「顯示購物候選」勾選框與文字垂直對齊。
- 僅需部署 GitHub Pages 前端；Cloudflare Worker 不變。

# Smart Wardrobe v0.3.6.0 — 官方商品照片候選搜尋

- 保留 v0.3.5.1 的 Gemini 訂單辨識、所有商品待確認、錯誤診斷。
- 每筆待確認商品新增「搜尋官方照片」、「開啟官方搜尋」、「官方商品頁網址」、「讀取官方商品照片」與手動上傳。
- Worker 新增 `/official-photo`，只嘗試官方網站；不提供任意 URL 代理。
- 自動搜尋採盡力方式：官方搜尋頁可能不公開商品照片、需 JavaScript、封鎖機器人，或商品已下架。找不到時會提供官方網站搜尋入口；使用者可貼上官方商品頁網址再嘗試讀取圖片。
- 候選圖片必須由使用者核對款式和顏色；不保證與訂單完全一致。照片在確認匯入時才存入 IndexedDB。
- 保留 Cloudflare Worker Placement 的 GCP asia-east1 設定；部署新版 Worker 程式不應更改 Placement。
- 更新 GitHub Pages 根目錄檔案，並在 Cloudflare 部署 `cloudflare-worker/worker.js`。不要上傳任何 API Key。
- 現有本機衣櫃資料不會被此更新清空。


## v0.3.6.1 App 分享文字匯入
- 在「匯入購物訂單」貼上 GU／UNIQLO App 分享文字（含官方商品網址），按「解析分享文字並加入待確認清單」。
- 本地解析名稱、商品編號、品牌及網址；不呼叫 Gemini。
- 在待確認商品中確認顏色與尺寸，按「讀取官方商品照片」嘗試取得候選圖，再確認儲存。
- 品牌官網可能限制讀取圖片；此功能不保證每個商品都有照片。
- Cloudflare Worker 沿用 v0.3.6.0，無需重新部署或更動 Placement。


## v0.3.6.2 GPT 優先辨識
- Cloudflare Worker 新增 `OPENAI_API_KEY` Secret（不可寫進 GitHub）。
- `OPENAI_MODEL` 可選填；預設 `gpt-6-luna`，必須確認帳戶實際有權限且支援圖片輸入與 Chat Completions；不支援時可改用帳戶可用的視覺模型，例如 `gpt-4.1-mini`。
- OpenAI 請求失敗時回退原 Gemini；回傳 `provider`、`model`、`usage` 用於診斷。
- 僅須更新 Cloudflare Worker；前端沿用 v0.3.6.1，Worker 的 `/official-photo` 未修改。
- OpenAI API 依實際用量計費，請在 OpenAI 平台關閉自動儲值並設定用量提醒。


## v0.3.6.3 GPT request compatibility fix
- Replace max_tokens with max_completion_tokens in OpenAI Chat Completions request.
- Remove temperature parameter to avoid unsupported parameter errors on reasoning models.
- Only Cloudflare Worker deployment is needed; GitHub Pages frontend remains unchanged.


v0.3.6.6：實際修正 index.html 匯入訂單排版，移除 Worker URL 欄位，將分享文字區塊移至待匯入商品下方。前端版本與 PWA 快取已更新。
