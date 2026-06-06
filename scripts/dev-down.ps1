# scripts/dev-down.ps1
# Stops every dev process started by `scripts\dev-up.ps1`.
# Safe to run multiple times.
#
#   powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Stopping Expo (node / metro) ===" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -match 'expo|metro|Metro|Expo' } |
    ForEach-Object {
        Write-Host ("  killing PID {0} - {1}" -f $_.Id, $_.MainWindowTitle)
        Stop-Process -Id $_.Id -Force
    }

Write-Host "=== Stopping cloudflared ===" -ForegroundColor Cyan
Get-Process cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  killing PID $($_.Id)"
    Stop-Process -Id $_.Id -Force
}

Write-Host "=== Stopping docker compose stack ===" -ForegroundColor Cyan
Push-Location $root
docker compose stop 2>&1 | Out-Host
Pop-Location

Write-Host ""
Write-Host "Dev stack stopped. (Mongo data is preserved on the named volume.)" -ForegroundColor Green
Write-Host "Next time, run:  powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1" -ForegroundColor Green

