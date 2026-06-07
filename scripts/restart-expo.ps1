# scripts/restart-expo.ps1
# RECOVER from a dead Expo / ngrok / cloudflared session.
# When Phone shows "endpoint XXXX-anonymous-8081.exp.direct is offline" or
# "Could not connect to server exp://127.0.0.1:8081", run this script.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\restart-expo.ps1
# Flags:
#   -Tunnel       Use ngrok tunnel instead of LAN mode.
#   -Port <int>   Force a specific Metro port (default: auto-pick).
[CmdletBinding()]
param(
    [switch]$Tunnel,
    [int]$Port = 0
)
$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile'
function Section($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "[ok]   $t" -ForegroundColor Green }
function Info($t)    { Write-Host "[info] $t" -ForegroundColor Gray  }
function Warn($t)    { Write-Host "[warn] $t" -ForegroundColor Yellow }
function Fail($t)    { Write-Host "[fail] $t" -ForegroundColor Red   }
function Test-PortFree {
    param([int]$P)
    $busy = Get-NetTCPConnection -LocalPort $P -State Listen -ErrorAction SilentlyContinue
    return -not $busy
}
# 1. Best-effort kill of stale processes
Section '1. Kill stale Expo / tunnel processes (best-effort)'
foreach ($p in @(8081, 8082, 19000, 19001, 19002)) {
    $busy = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $busy) {
        try {
            $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                Info ("port {0} held by PID {1} ({2}) - killing" -f $p, $proc.Id, $proc.ProcessName)
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
}
# taskkill returns non-zero on admin-owned processes; suppress so script does not abort.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
cmd.exe /c "taskkill /F /T /IM node.exe        >nul 2>&1"
cmd.exe /c "taskkill /F /T /IM ngrok.exe       >nul 2>&1"
cmd.exe /c "taskkill /F /T /IM cloudflared.exe >nul 2>&1"
$ErrorActionPreference = $prevEAP
Start-Sleep -Seconds 2
$survivors = Get-Process node -ErrorAction SilentlyContinue
if ($survivors) {
    Warn ("{0} node process(es) survived (admin-owned):" -f $survivors.Count)
    $survivors | ForEach-Object { Info ("  PID {0}  Started {1}" -f $_.Id, $_.StartTime) }
    Warn 'Routing around them by picking a port they are not using.'
} else {
    Ok 'All node/ngrok processes terminated cleanly.'
}
# 2. Pick a free Metro port
Section '2. Pick a free Metro port'
$candidates = @()
if ($Port -gt 0) { $candidates += $Port }
$candidates += @(19000, 8081, 19001, 8082, 19002, 19003)
$Port = $null
foreach ($p in $candidates) { if (Test-PortFree -P $p) { $Port = $p; break } }
if (-not $Port) { Fail 'No free Metro port found - reboot Windows.'; exit 1 }
Ok ("Using Metro port {0}" -f $Port)
# 3. Verify backend
Section '3. Verify backend on http://127.0.0.1:4000'
$apiOk = $false
try { $h = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 3; if ($h.ok) { $apiOk = $true } } catch { }
if (-not $apiOk) {
    Warn 'API not responding. docker compose up -d ...'
    Push-Location $root
    try {
        & docker compose up -d *>&1 | Out-Host
        for ($i = 0; $i -lt 30; $i++) {
            try { $h = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 2; if ($h.ok) { $apiOk = $true; break } } catch { Start-Sleep -Seconds 2 }
        }
    } finally { Pop-Location }
    if (-not $apiOk) { Fail 'Backend never came up. docker compose logs --tail=80 api'; exit 1 }
}
Ok 'API healthy on http://127.0.0.1:4000/api/health'
# 4. Detect LAN IP and sync mobile/.env
Section '4. Detect LAN IP & sync mobile/.env'
$lan = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.PrefixOrigin -in @('Dhcp','Manual') -and
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.*' -and
        $_.InterfaceAlias -notlike '*WSL*' -and
        $_.InterfaceAlias -notlike '*Loopback*' -and
        $_.InterfaceAlias -notlike '*vEthernet*' -and
        $_.InterfaceAlias -notlike '*Hyper-V*' -and
        $_.InterfaceAlias -notlike '*Docker*'
    } |
    Sort-Object -Property @{Expression={ if ($_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*') { 0 } else { 1 } }} |
    Select-Object -First 1
if (-not $lan) { Fail 'Could not detect a LAN IP - is Wi-Fi connected?'; exit 1 }
$lanIp  = $lan.IPAddress
$apiUrl = "http://${lanIp}:4000"
Ok ("LAN IP: {0} (interface: {1})" -f $lanIp, $lan.InterfaceAlias)
try { $h = Invoke-RestMethod "$apiUrl/api/health" -TimeoutSec 3; if ($h.ok) { Ok "API reachable on ${apiUrl}/api/health (firewall ok)" } } catch {
    Warn "API NOT reachable on $apiUrl from this PC. Run as Admin: scripts\fix-firewall.ps1"
}
$envFile = Join-Path $mobile '.env'
$envContents = @("API_URL=$apiUrl", "SOCKET_URL=$apiUrl", "DEV_SKIP_OTP=true", '') -join "`r`n"
Set-Content -Path $envFile -Value $envContents -Encoding utf8
Ok "Wrote $envFile"
Get-Content $envFile | ForEach-Object { Info "  $_" }
# 5. Generate the .cmd wrapper - bullet-proof env vars
Section '5. Generate start-lan.cmd wrapper'
$cmdFile = Join-Path $mobile 'start-lan.cmd'
$mode    = if ($Tunnel) { '--tunnel' } else { '--lan' }
$cmdLines = @(
    '@echo off',
    'REM Auto-generated by scripts/restart-expo.ps1 - do not edit by hand.',
    "cd /d ""$mobile""",
    'set EXPO_NO_TELEMETRY=1',
    "set REACT_NATIVE_PACKAGER_HOSTNAME=$lanIp",
    "set EXPO_PACKAGER_HOSTNAME=$lanIp",
    'set EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0',
    'echo ------------------------------------------------------------',
    " echo  Metro will advertise:  exp://${lanIp}:$Port",
    ' echo  REACT_NATIVE_PACKAGER_HOSTNAME = %REACT_NATIVE_PACKAGER_HOSTNAME%',
    'echo ------------------------------------------------------------',
    "call npx --no-install expo start $mode --port $Port --clear",
    'echo.',
    'echo (Expo exited. Press any key to close this window.)',
    'pause >nul'
)
Set-Content -Path $cmdFile -Value $cmdLines -Encoding ascii
Ok "Wrote $cmdFile"
# 6. Launch in a new console
Section '6. Launch fresh Expo session'
Start-Process -FilePath $cmdFile -WorkingDirectory $mobile | Out-Null
Ok 'Expo launched in a new window. Waiting for Metro to come up...'
# 7. Verify Metro is up on the LAN IP
Section '7. Verify Metro is up on the LAN IP'
$metroUp = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try { $r = Invoke-WebRequest -Uri "http://${lanIp}:$Port/status" -TimeoutSec 2 -UseBasicParsing; if ($r.Content -match 'packager-status:running') { $metroUp = $true; break } } catch {}
    try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 2 -UseBasicParsing; if ($r.Content -match 'packager-status:running') { $metroUp = $true; break } } catch {}
}
if ($metroUp) {
    Ok ("Metro is UP on port {0}" -f $Port)
    try { $r = Invoke-WebRequest -Uri "http://${lanIp}:$Port/status" -TimeoutSec 3 -UseBasicParsing; if ($r.StatusCode -eq 200) { Ok ("Metro responds on the LAN IP. Phone QR target: exp://{0}:{1}" -f $lanIp, $Port) } } catch {
        Warn "Metro is bound to localhost only. Run scripts\fix-firewall.ps1 as Admin so the phone can reach it."
    }
} else {
    Warn 'Metro did not come up within 2 minutes - check the new window for errors.'
}
Write-Host ''
Write-Host '====================================================' -ForegroundColor Green
Write-Host ' EXPO RESTARTED'                                      -ForegroundColor Green
Write-Host '====================================================' -ForegroundColor Green
Write-Host ''
Write-Host ("LAN URL the phone should load:  exp://{0}:{1}" -f $lanIp, $Port) -ForegroundColor White
Write-Host ("API URL the app will hit:       {0}" -f $apiUrl)                 -ForegroundColor White
Write-Host ''
Write-Host 'Steps on the phone:' -ForegroundColor White
Write-Host '  1. Open Expo Go. Phone must be on the SAME Wi-Fi as this PC.'   -ForegroundColor White
Write-Host '  2. Tap "Enter URL manually" in Expo Go and paste:'              -ForegroundColor White
Write-Host ("       exp://{0}:{1}" -f $lanIp, $Port) -ForegroundColor Yellow
Write-Host '     OR scan the new QR shown in the Expo window.'                -ForegroundColor White
Write-Host ''
if ($survivors) {
    Write-Host 'NOTE: Old admin-owned node processes are still alive but'  -ForegroundColor Yellow
    Write-Host '      we routed around them by using a different port.'    -ForegroundColor Yellow
    Write-Host '      Reboot Windows when convenient to clean them out.'   -ForegroundColor Yellow
    Write-Host ''
}