@echo off
chcp 65001 >nul
setlocal EnableExtensions
title 启动智学通

set "ROOT=%~dp0"
set "BACKEND=%ROOT%eduagent\backend"
set "FRONTEND=%ROOT%eduagent\frontend"
set "VENV=%ROOT%.venv"
set "CONDA_ENV=%ROOT%.conda-env"
set "BACKEND_RUN=%ROOT%tools\run-backend.bat"
set "FRONTEND_RUN=%ROOT%tools\run-frontend.bat"
set "WAIT_URL=%ROOT%tools\wait-url.ps1"
set "PROJECT_PYTHON="
set "PYTHONUTF8=1"

echo ========================================
echo   智学通启动器
echo ========================================
echo 项目目录：%ROOT%
echo.

call :check_project || goto fail
call :resolve_python
if errorlevel 1 (
  echo [提示] 未检测到项目本地 Python 环境，正在先安装依赖...
  call "%ROOT%首次安装依赖.bat" --no-pause
  if errorlevel 1 goto fail
  call :resolve_python || goto fail
)

if not exist "%FRONTEND%\node_modules" (
  echo [提示] 未检测到前端依赖，正在先安装依赖...
  call "%ROOT%首次安装依赖.bat" --no-pause
  if errorlevel 1 goto fail
)

"%PROJECT_PYTHON%" -c "import fastapi, uvicorn, chromadb" >nul 2>nul
if errorlevel 1 (
  echo [提示] 后端依赖不完整，正在重新安装依赖...
  call "%ROOT%首次安装依赖.bat" --no-pause
  if errorlevel 1 goto fail
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js / npm，请安装 Node.js LTS 版本。
  goto fail
)

if not exist "%BACKEND%\.env" (
  if exist "%BACKEND%\.env.example" (
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo [配置] 已从 .env.example 生成 .env
  )
)

echo [1/2] 正在启动后端服务：http://127.0.0.1:8001
call :wait_url "http://127.0.0.1:8001/health" 2 >nul 2>nul
if errorlevel 1 (
  start "智学通 Backend" "%BACKEND_RUN%"
  echo 等待后端启动...
  call :wait_url "http://127.0.0.1:8001/health" 60
  if errorlevel 1 (
    echo [错误] 后端 60 秒内没有启动成功，请查看 Backend 黑色窗口中的错误信息。
    goto fail
  )
) else (
  echo [提示] 后端已经在运行。
)

echo [2/2] 正在启动前端页面：http://127.0.0.1:5173
call :wait_url "http://127.0.0.1:5173/learning" 2 >nul 2>nul
if errorlevel 1 (
  start "智学通 Frontend" "%FRONTEND_RUN%"
  echo 等待前端启动...
  call :wait_url "http://127.0.0.1:5173/learning" 60
  if errorlevel 1 (
    echo [错误] 前端 60 秒内没有启动成功，请查看 Frontend 黑色窗口中的错误信息。
    goto fail
  )
) else (
  echo [提示] 前端已经在运行。
)

echo 正在打开浏览器...
start "" http://127.0.0.1:5173/learning

echo.
echo ========================================
echo   启动完成
echo   后端：http://127.0.0.1:8001
echo   前端：http://127.0.0.1:5173/learning
echo ========================================
echo.
echo 注意：弹出的 Backend 和 Frontend 两个黑窗口不要关闭。
pause
exit /b 0

:fail
echo.
echo ========================================
echo   启动失败，请根据上面的错误提示处理。
echo ========================================
pause
exit /b 1

:check_project
if not exist "%BACKEND%\app\main.py" (
  echo [错误] 没找到后端目录：%BACKEND%
  echo 请确认当前目录是完整的 dasai 项目文件夹。
  exit /b 1
)

if not exist "%FRONTEND%\package.json" (
  echo [错误] 没找到前端目录：%FRONTEND%
  echo 请确认当前目录是完整的 dasai 项目文件夹。
  exit /b 1
)
exit /b 0

:resolve_python
if exist "%VENV%\Scripts\python.exe" (
  set "PROJECT_PYTHON=%VENV%\Scripts\python.exe"
  exit /b 0
)

if exist "%CONDA_ENV%\python.exe" (
  set "PROJECT_PYTHON=%CONDA_ENV%\python.exe"
  exit /b 0
)
exit /b 1

:wait_url
powershell -NoProfile -ExecutionPolicy Bypass -File "%WAIT_URL%" -Url %~1 -Seconds %~2
exit /b %errorlevel%
