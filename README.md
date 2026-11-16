# Smart Wardrobe v0.1

## GitHub Pages 部署
1. 在 GitHub 建立公開 Repository：`smart-wardrobe`（不要上傳私人衣物照片）。
2. 將此資料夾中的 `index.html`、`style.css`、`app.js`、`sw.js`、`manifest.webmanifest`、`icons/` 上傳到 Repository 根目錄。
3. 進入 Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save。
4. 等待部署完成，開啟 `https://你的帳號.github.io/smart-wardrobe/`。
5. iPhone Safari：分享 → 加入主畫面。

## 儲存與隱私
- 衣物資料和壓縮後照片存於瀏覽器 IndexedDB，偏好存於 localStorage。
- GitHub 上只有程式碼與示意圖示，不含私人衣物照片。
- 使用「設定 → 匯出完整 JSON 備份」定期備份。備份含私人照片，請妥善保管。
- 清除網站資料、私人瀏覽或換裝置都可能造成資料無法存取。尚無跨裝置同步。
- 本版本不提供即時天氣、AI API、帳號登入或雲端同步。

## 注意
- 初始資料為 13 件已擁有單品，尚未加入其他待整理衣物。
- 深灰 ZARA 掛脖洋裝仍是購物候選，未列入初始衣櫃。
- 推薦演算法為基礎規則，對腋下遮蔽僅能依文字備註保守判斷，請自行檢查。
