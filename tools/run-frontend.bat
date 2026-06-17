@echo off
chcp 65001 >nul
setlocal EnableExtensions
title 智学通 Frontend

for %%I in ("%~dp0..") do set "ROOT=%%~fI\"
set "FRONTEND=%ROOT%eduagent\frontend"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js / npm，请安装 Node.js LTS 版本。
  pause
  exit /b 1
)

cd /d "%FRONTEND%"
echo Frontend: http://127.0.0.1:5173/learning
npm.cmd run dev -- --host 127.0.0.1 --strictPort

echo.
echo [提示] 前端进程已退出。
pause
