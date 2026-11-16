# Smart Wardrobe v0.2.1

以 v0.1 為基礎的增量更新。新增真人照片 2D 穿搭工作室。

## 更新方式
1. 先在舊版「設定」匯出 JSON 備份，另存私人位置。
2. 將此資料夾中的所有檔案（包含 icons）上傳 GitHub Repository 根目錄，覆蓋同名檔案。
3. 等待 GitHub Pages 部署，重新開啟或重新啟動 PWA。
4. 在「推薦」頁面點選「自由搭配工作室」，或首頁按「自由搭配工作室」。

## 說明
- IndexedDB 名稱維持 smart-wardrobe-v01；升級 schema 版本 1 → 2，保留原本 items/history 資料，新增 studio store。
- 全身照片儲存於 IndexedDB；選取的圖層位置暫存於 localStorage；衣物圖層引用原衣櫃照片。
- 備份 JSON 新增 studio 欄位（含全身照片）；舊版備份仍可匯入。
- 目前是手動 2D 疊圖，未提供去背、AI 推薦或 AI 試衣。
- 「儲存這套穿搭」會儲存衣物組合至穿搭紀錄，不會保存疊圖合成圖片。
- 需在同一個瀏覽器／同一個 PWA 儲存空間操作；不同裝置不會自動同步。
