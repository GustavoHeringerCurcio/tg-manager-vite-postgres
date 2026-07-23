# Botflix Load Test Runner
# Usage: .\scripts\run-load-test.ps1 -Scenario mixed -Vus 20 -Duration 4m
# Or just: .\scripts\run-load-test.ps1  (runs smoke test)

param(
  [string]$Scenario = "smoke",
  [int]$Vus = 0,
  [string]$Duration = "",
  [switch]$SkipSetup = $false,
  [switch]$SkipReset = $false
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root "server"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Botflix Load Test Runner" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not $SkipSetup) {
  Write-Host "[1/4] Setting up test bot..." -ForegroundColor Yellow
  Set-Location -LiteralPath $serverDir
  npx tsx ../scripts/setup-test-bot.ts
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Test bot setup failed." -ForegroundColor Red
    exit 1
  }
  Set-Location -LiteralPath $root
}

if (-not $SkipReset) {
  Write-Host "[2/4] Resetting test data..." -ForegroundColor Yellow
  Set-Location -LiteralPath $serverDir
  npx tsx ../scripts/reset-test-db.ts
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Test DB reset failed." -ForegroundColor Red
    exit 1
  }
  Set-Location -LiteralPath $root
}

Write-Host "[3/4] Checking k6 installation..." -ForegroundColor Yellow
$k6Version = & {
  try { k6 version 2>&1 } catch { "" }
}
if (-not $k6Version -or $k6Version -notmatch "k6") {
  Write-Host ""
  Write-Host "k6 is not installed. Install it first:" -ForegroundColor Red
  Write-Host "  Windows: winget install k6" -ForegroundColor White
  Write-Host "  Or: choco install k6" -ForegroundColor White
  Write-Host "  Docs: https://grafana.com/docs/k6/latest/set-up/install-k6/" -ForegroundColor White
  exit 1
}
Write-Host "  $($k6Version.Trim())" -ForegroundColor Green
Write-Host ""

$botId = $env:TEST_BOT_ID
if (-not $botId) { $botId = "test-bot-load" }
$appUrl = $env:TEST_APP_URL
if (-not $appUrl) { $appUrl = "http://localhost:3000" }

Write-Host "[4/4] Running load test..." -ForegroundColor Yellow
Write-Host "  Scenario : $Scenario" -ForegroundColor White
Write-Host "  Target   : $appUrl/webhook/$botId" -ForegroundColor White
Write-Host "  Bot ID   : $botId" -ForegroundColor White
Write-Host ""

$env:TEST_BOT_ID = $botId
$env:TEST_APP_URL = $appUrl

Set-Location -LiteralPath $serverDir

$k6Args = @("run")

switch ($Scenario) {
  "start"   { $k6Args += "tests/load/scenarios/start-message.ts" }
  "callback" { $k6Args += "tests/load/scenarios/callback-query.ts" }
  "mixed"   { $k6Args += "tests/load/scenarios/mixed.ts" }
  "smoke"   {
    $k6Args += "tests/load/scenarios/mixed.ts"
    $k6Args += "--vus"; $k6Args += "2"
    $k6Args += "--duration"; $k6Args += "15s"
  }
  default { $k6Args += "tests/load/scenarios/mixed.ts" }
}

if ($Vus -gt 0) {
  $k6Args += "--vus"; $k6Args += "$Vus"
}
if ($Duration) {
  $k6Args += "--duration"; $k6Args += $Duration
}

Write-Host "  Command: k6 $($k6Args -join ' ')" -ForegroundColor DarkGray
Write-Host ""

& k6 @k6Args

Set-Location -LiteralPath $root
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Load test complete." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
