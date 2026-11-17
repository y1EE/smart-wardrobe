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
