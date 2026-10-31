# 專題格式檢查器（網頁 MVP）

純瀏覽器端檢查 docx 是否符合 `ref/巨人高中專題格式.rules.json`。

## 本機預覽

### Windows 快速測試
直接雙擊執行 `checker/test_local.bat`（或 `checker/start_local.bat`），將會自動：
1. 切換至專案根目錄（確保 `ref/` 規則檔可被伺服器讀取）
2. 啟動 HTTP 伺服器（預設 Port `8765`）
3. 自動以預設瀏覽器開啟 <http://127.0.0.1:8765/checker/>

若要自訂連接埠，可在命令列帶入參數執行：
```cmd
test_local.bat 8888
```

### 命令列手動啟動
在專案根目錄執行：

```bash
python -m http.server 8765
```

瀏覽器開啟 <http://127.0.0.1:8765/checker/>。

## 檔案

| 檔案 | 說明 |
|------|------|
| `test_local.bat` | Windows 本機一鍵測試批次檔（自動啟動伺服器並開瀏覽器） |
| `start_local.bat` | 快速啟動別名檔 |
| `index.html` | 入口（繁中 UI、RWD） |
| `styles.css` | 響應式樣式 |
| `app.js` | 上傳／報告 UI |
| `docx-parser.js` | docx OOXML 解析（瀏覽器／Node 共用） |
| `rules-engine.js` | 規則引擎（瀏覽器／Node 共用） |
| `vendor/jszip.min.js` | JSZip |

## GitHub Pages

啟用 Pages 指向 repo 根目錄後，網址為 `/checker/`（或 `/TSSH_Project/checker/`）。
