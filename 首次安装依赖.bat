@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
title 智学通首次安装依赖

set "ROOT=%~dp0"
set "BACKEND=%ROOT%eduagent\backend"
set "FRONTEND=%ROOT%eduagent\frontend"
set "VENV=%ROOT%.venv"
set "CONDA_ENV=%ROOT%.conda-env"
set "PROJECT_PYTHON="
set "BASE_PYTHON="
set "CONDA_CMD="
set "NO_PAUSE="
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"

echo ========================================
echo   智学通首次安装依赖
echo ========================================
echo 项目目录：%ROOT%
echo.

call :check_project || goto fail
call :ensure_python_env || goto fail
call :install_backend || goto fail
call :install_frontend || goto fail

echo.
echo ========================================
echo   安装完成
echo   以后直接双击“启动智学通.bat”即可打开项目。
echo ========================================
if not defined NO_PAUSE pause
exit /b 0

:fail
echo.
echo ========================================
echo   安装没有完成，请根据上面的错误提示处理。
echo ========================================
if not defined NO_PAUSE pause
exit /b 1

:check_project
if not exist "%BACKEND%\requirements.txt" (
  echo [错误] 没找到：%BACKEND%\requirements.txt
  echo 请确认当前目录是完整的 dasai 项目文件夹。
  exit /b 1
)

if not exist "%FRONTEND%\package.json" (
  echo [错误] 没找到：%FRONTEND%\package.json
  echo 请确认当前目录是完整的 dasai 项目文件夹。
  exit /b 1
)
exit /b 0

:ensure_python_env
if exist "%VENV%\Scripts\python.exe" (
  set "PROJECT_PYTHON=%VENV%\Scripts\python.exe"
  goto python_ready
)

if exist "%CONDA_ENV%\python.exe" (
  set "PROJECT_PYTHON=%CONDA_ENV%\python.exe"
  goto python_ready
)

echo [准备] 创建项目本地 Python 环境...
call :find_compatible_python
if defined BASE_PYTHON (
  echo [Python] 使用 !BASE_PYTHON! 创建 .venv
  !BASE_PYTHON! -m venv "%VENV%"
  if errorlevel 1 (
    echo [错误] 创建 .venv 失败。
    exit /b 1
  )
  set "PROJECT_PYTHON=%VENV%\Scripts\python.exe"
  goto python_ready
)

call :find_conda
if defined CONDA_CMD (
  echo [Python] 未找到 Python 3.10/3.11，检测到 conda，创建 .conda-env
  call !CONDA_CMD! create -y -p "%CONDA_ENV%" python=3.10 pip
  if errorlevel 1 (
    echo [错误] conda 创建本地环境失败。
    exit /b 1
  )
  set "PROJECT_PYTHON=%CONDA_ENV%\python.exe"
  goto python_ready
)

echo [错误] 没找到可用的 Python 3.10/3.11，也没有检测到 conda。
echo 请安装 Python 3.10/3.11（安装时勾选 Add Python to PATH）或安装 Anaconda/Miniconda。
exit /b 1

:python_ready
"%PROJECT_PYTHON%" -c "import sys; raise SystemExit(0 if sys.version_info[:2] in [(3,10),(3,11)] else 1)" >nul 2>nul
if errorlevel 1 (
  echo [错误] 项目 Python 环境版本不符合要求，需要 Python 3.10 或 3.11。
  "%PROJECT_PYTHON%" --version
  exit /b 1
)
echo [Python] 使用：%PROJECT_PYTHON%
"%PROJECT_PYTHON%" --version
exit /b 0

:find_compatible_python
set "BASE_PYTHON="
call :try_python "py -3.11"
call :try_python "py -3.10"
call :try_python "python"
exit /b 0

:try_python
if defined BASE_PYTHON exit /b 0
set "TRY_PYTHON=%~1"
!TRY_PYTHON! -c "import sys; raise SystemExit(0 if sys.version_info[:2] in [(3,10),(3,11)] else 1)" >nul 2>nul
if not errorlevel 1 set "BASE_PYTHON=!TRY_PYTHON!"
exit /b 0

:find_conda
set "CONDA_CMD="
where conda.bat >nul 2>nul
if not errorlevel 1 (
  set "CONDA_CMD=conda.bat"
  exit /b 0
)
where conda >nul 2>nul
if not errorlevel 1 (
  set "CONDA_CMD=conda"
  exit /b 0
)
exit /b 0

:install_backend
echo.
echo [1/2] 检查后端 Python 依赖...
cd /d "%BACKEND%"
"%PROJECT_PYTHON%" -c "import fastapi, uvicorn, chromadb, langchain, sqlalchemy, pydantic" >nul 2>nul
if not errorlevel 1 (
  echo [后端] 核心依赖已存在，跳过 pip install。
  goto ensure_backend_env
)

echo [后端] 安装/更新 Python 依赖...
"%PROJECT_PYTHON%" -m pip install --upgrade pip
if errorlevel 1 (
  echo [错误] pip 升级失败。
  exit /b 1
)

"%PROJECT_PYTHON%" -m pip install -r "%BACKEND%\requirements.txt"
if errorlevel 1 (
  echo [错误] 后端依赖安装失败。
  exit /b 1
)

:ensure_backend_env
if not exist "%BACKEND%\.env" (
  if exist "%BACKEND%\.env.example" (
    copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
    echo [配置] 已从 .env.example 生成 .env
  )
)
exit /b 0

:install_frontend
echo.
echo [2/2] 检查前端 Node 依赖...
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js / npm。
  echo 请安装 Node.js LTS 版本后重新运行本脚本。
  exit /b 1
)

cd /d "%FRONTEND%"
if exist "%FRONTEND%\node_modules\.bin\vite.cmd" (
  echo [前端] 核心依赖已存在，跳过 npm install。
  exit /b 0
)

echo [前端] 安装/更新 Node 依赖...
npm.cmd install
if errorlevel 1 (
  echo [错误] 前端依赖安装失败。
  exit /b 1
)
exit /b 0
