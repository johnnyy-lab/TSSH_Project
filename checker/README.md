# 專題格式檢查器（網頁 MVP）

純瀏覽器端檢查 docx 是否符合 `ref/巨人高中專題格式.rules.json`。

## 本機預覽

在專案根目錄執行：

```bash
python3 -m http.server 8765
```

瀏覽器開啟 <http://127.0.0.1:8765/checker/>。

## 檔案

| 檔案 | 說明 |
|------|------|
| `index.html` | 入口（繁中 UI、RWD） |
| `styles.css` | 響應式樣式 |
| `app.js` | 上傳／報告 UI |
| `docx-parser.js` | docx OOXML 解析（瀏覽器／Node 共用） |
| `rules-engine.js` | 規則引擎（瀏覽器／Node 共用） |
| `vendor/jszip.min.js` | JSZip |

## GitHub Pages

啟用 Pages 指向 repo 根目錄後，網址為 `/checker/`（或 `/TSSH_Project/checker/`）。
