@echo off
chcp 65001 >nul
setlocal
title 打包智学通给队友

set "ROOT=%~dp0"
set "PACK_SCRIPT=%ROOT%tools\package-portable.ps1"

if not exist "%PACK_SCRIPT%" (
  echo [错误] 没找到打包脚本：%PACK_SCRIPT%
  pause
  exit /b 1
)

echo ========================================
echo   打包智学通给队友
echo ========================================
echo.
echo 正在生成干净压缩包...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PACK_SCRIPT%" -Root "%ROOT%."
if errorlevel 1 (
  echo.
  echo [错误] 打包失败。
  pause
  exit /b 1
)

echo.
echo 可以把刚生成的 dasai-portable-*.zip 发给队友。
pause
