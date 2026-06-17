param(
  [string]$Root
)

$ErrorActionPreference = "Stop"

if (-not $Root) {
  $Root = Split-Path -Parent $PSScriptRoot
}

$rootPath = (Resolve-Path -LiteralPath $Root).Path.TrimEnd("\")
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipPath = Join-Path $rootPath "dasai-portable-$stamp.zip"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("dasai-package-" + [guid]::NewGuid().ToString("N"))
$packageRoot = Join-Path $tempRoot "dasai"

$excludeDirs = @(
  ".git",
  ".venv",
  ".conda-env",
  "node_modules",
  "dist",
  "build",
  ".pytest_cache",
  "__pycache__",
  ".codex-checks"
)

$excludeFiles = @(
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  "*.pyc",
  "*.pyo",
  "*.log",
  "*.db",
  "*.sqlite",
  "*.sqlite3",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "dasai-portable-*.zip"
)

try {
  New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

  $robocopyArgs = @(
    $rootPath,
    $packageRoot,
    "/E",
    "/R:1",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP",
    "/XD"
  ) + $excludeDirs + @("/XF") + $excludeFiles

  & robocopy @robocopyArgs | Out-Null
  $robocopyExit = $LASTEXITCODE
  if ($robocopyExit -ge 8) {
    throw "robocopy failed with exit code $robocopyExit"
  }

  Get-ChildItem -LiteralPath $packageRoot -Force -Recurse -File -Filter ".env*" |
    Where-Object { $_.Name -ne ".env.example" } |
    Remove-Item -Force

  if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -Force
  Write-Host "Package created: $zipPath"
  Write-Host "Excluded local folders, caches, logs, databases, and private env files."
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
