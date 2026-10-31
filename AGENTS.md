# Antigravity Agent Rules (pstack discipline)

## 1. 嚴禁無依據推測 (Reproduce First)
- 在看見錯誤或需求時，**嚴禁直接修改原始碼**。
- 必須先透過終端機執行測試指令、復現腳本或 curl/API 呼叫，取得明確的失敗輸出（Fail Logs）。

## 2. 最小變動原則 (Minimal Surface Area)
- 每次修復僅修改最少行數，禁止隨意重構、重新命名無關變數或調整程式碼風格。
- 修改完成後，必須自行檢視 `git diff`，確認無多餘更動。

## 3. 明確的完成定義 (Definition of Done)
- 任務完成的定義是：原本失敗的指令/測試已能綠燈通過（Exit code 0），且未造成其他測試退化（No Regression）。
- 回覆結案時必須附上實質終端機執行通過的日誌，禁止僅回報「已修復完畢」。