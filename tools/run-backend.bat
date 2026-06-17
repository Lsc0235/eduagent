@echo off
chcp 65001 >nul
setlocal EnableExtensions
title 智学通 Backend

for %%I in ("%~dp0..") do set "ROOT=%%~fI\"
set "BACKEND=%ROOT%eduagent\backend"
set "VENV=%ROOT%.venv"
set "CONDA_ENV=%ROOT%.conda-env"
set "PROJECT_PYTHON="
set "PYTHONUTF8=1"

if exist "%VENV%\Scripts\python.exe" set "PROJECT_PYTHON=%VENV%\Scripts\python.exe"
if not defined PROJECT_PYTHON if exist "%CONDA_ENV%\python.exe" set "PROJECT_PYTHON=%CONDA_ENV%\python.exe"

if not defined PROJECT_PYTHON (
  echo [错误] 未找到项目本地 Python 环境，请先运行“首次安装依赖.bat”。
  pause
  exit /b 1
)

cd /d "%BACKEND%"
echo Backend: http://127.0.0.1:8001
"%PROJECT_PYTHON%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001

echo.
echo [提示] 后端进程已退出。
pause
