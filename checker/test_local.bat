@echo off
setlocal
chcp 65001 >nul
title 高中專題

echo ========================================================
echo   高中專題
echo   本機測試伺服器啟動程式
echo ========================================================
echo.

REM 取得專案根目錄路徑（checker 的上一層目錄）
cd /d "%~dp0.."
set "PROJECT_ROOT=%CD%"
echo [目錄] 專案根目錄: %PROJECT_ROOT%

REM 設定連接埠（預設 8765，若有傳入參數則使用自訂埠號）
set "PORT=8765"
if not "%~1"=="" set "PORT=%~1"
set "URL=http://localhost:%PORT%/checker/"

REM 檢查 Python 執行環境
set "PY_CMD="

python -c "import sys" >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=python"
    goto :start_server
)

py -c "import sys" >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=py"
    goto :start_server
)

python3 -c "import sys" >nul 2>nul
if %errorlevel% equ 0 (
    set "PY_CMD=python3"
    goto :start_server
)

echo [錯誤] 找不到可用的 Python 執行環境！
echo 請確認電腦已安裝 Python (建議 3.8 以上)，並於安裝時勾選「Add Python to PATH」。
echo.
pause
exit /b 1

:start_server
echo [環境] 偵測到 Python: %PY_CMD%
echo [網址] 測試網址: %URL%
echo.
echo ========================================================
echo   正在啟動伺服器... 瀏覽器將自動開啟測試頁面。
echo   若要停止伺服器，請在此視窗按下 [Ctrl + C]。
echo ========================================================
echo.

REM 自動開啟瀏覽器
start "" "%URL%"

REM 啟動 Python 內建 HTTP 伺服器
%PY_CMD% -m http.server %PORT%

if %errorlevel% neq 0 (
    echo.
    echo [提示] 伺服器已結束或發生錯誤（例如 Port %PORT% 已被其他程式使用）。
    echo 若埠號衝突，您可以使用指令帶入自訂埠號，例如：%~nx0 8766
    echo.
    pause
)

endlocal
