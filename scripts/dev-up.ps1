# scripts/dev-up.ps1
# ----------------------------------------------------------------------------
# One-shot DEV starter for MultiTabWatsap.
#
# What it does, in order:
#   1.  Stops any stale `multiptabwatsap-api` / `multiptabwatsap-mongo`
#       container that Docker auto-restarted after a host reboot.
#   2.  Brings the backend stack up via docker compose, waits until
#       /api/health returns 200.
#   3.  Starts a Cloudflare Quick Tunnel pointed at localhost:4000 in a
#       new PowerShell window and waits until the tunnel URL is printed.
#   4.  Rewrites mobile/.env so API_URL / SOCKET_URL point at that tunnel
#       URL and DEV_SKIP_OTP=true is set.
#   5.  Starts Expo's --tunnel mode in another new PowerShell window so
#       you can scan the QR with Expo Go from any network.
#
# Re-run this every time you reboot, every time the Cloudflare URL
# rotates, or whenever the phone says "Network error" / "Aborted".
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
#
# Flags:
#   -SkipExpo       — only do steps 1-4 (useful when Expo is already up).
#   -SkipTunnel     — skip Cloudflare; use http://<LAN-IP>:4000 instead.
#   -Recreate       — force docker compose to recreate the API container
#                     (use after editing docker-compose.yml or .env).
# ----------------------------------------------------------------------------

[CmdletBinding()]
param(
    [switch]$SkipExpo,
    [switch]$SkipTunnel,
    [switch]$Recreate
)

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile'

function Section($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "[ok]   $t" -ForegroundColor Green }
function Info($t)    { Write-Host "[info] $t" -ForegroundColor Gray  }
function Warn($t)    { Write-Host "[warn] $t" -ForegroundColor Yellow }
function Fail($t)    { Write-Host "[fail] $t" -ForegroundColor Red   }

# Run a native command (e.g. docker) without PowerShell 5.1 treating its
# stderr output as a script-fatal NativeCommandError. Docker BuildKit
# writes progress to stderr even on success, which crashes the script
# under `$ErrorActionPreference = 'Stop'`. We merge streams, print them,
# and only fail when the real exit code is non-zero.
function Invoke-Native {
    param(
        [Parameter(Mandatory)] [string] $File,
        [Parameter(ValueFromRemainingArguments=$true)] [string[]] $Rest
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $File @Rest 2>&1 | ForEach-Object { Write-Host $_ }
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prev }
    if ($code -ne 0) {
        throw "$File $($Rest -join ' ') exited with code $code"
    }
}

# ---------------------------------------------------------------------------
# 0. Sanity checks
# ---------------------------------------------------------------------------
Section '0. Prerequisite check'
foreach ($cmd in @('docker','node','npm')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Fail "$cmd is not on PATH. Install it first (see docs/dev-startup.md)."
        exit 1
    }
    Ok ("{0}: {1}" -f $cmd, ((& $cmd --version) -join ' '))
}

if (-not (Test-Path (Join-Path $root '.env'))) {
    Fail 'Missing repo-root .env file. Copy .env.example -> .env and set JWT_SECRET, then re-run.'
    exit 1
}
Ok '.env found in repo root'

if (-not $SkipTunnel) {
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Warn 'cloudflared not on PATH. If you just installed it, close this window and reopen PowerShell.'
        Warn 'Falling back to LAN mode (use -SkipTunnel to silence this message).'
        $SkipTunnel = $true
    }
}

# ---------------------------------------------------------------------------
# 1. Clean any stale auto-restarted containers, then bring the stack up
# ---------------------------------------------------------------------------
Section '1. Bring up backend (docker compose)'
Push-Location $root
try {
    if ($Recreate) {
        Info 'Force-recreating API container (you passed -Recreate)...'
        # Build first (streams build progress), then up -d (returns fast).
        # Splitting these avoids a PowerShell pipe-buffering hang we hit when
        # newer docker compose (v29+) streams container healthcheck logs from
        # `up -d --build` while waiting for `start_period`.
        Invoke-Native docker compose build api
        Invoke-Native docker compose up -d --force-recreate api
    } else {
        $apiState = (docker inspect multiptabwatsap-api --format '{{.State.Status}} {{.State.Restarting}}' 2>$null)
        if ($LASTEXITCODE -eq 0 -and $apiState -match 'restarting') {
            Warn 'Existing API container is in a restart loop. Recreating it...'
            Invoke-Native docker compose build api
            Invoke-Native docker compose up -d --force-recreate api
        } elseif ($LASTEXITCODE -eq 0 -and $apiState -match 'running') {
            Info 'API container already running — skipping rebuild.'
        } else {
            Invoke-Native docker compose build
            Invoke-Native docker compose up -d
        }
    }

    # wait up to 60s for /api/health
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $h = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 2
            if ($h.ok) { $ok = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ok) {
        Fail 'API never became healthy. Inspect with:  docker compose logs --tail=80 api'
        Pop-Location; exit 1
    }
    Ok 'API responding on http://127.0.0.1:4000/api/health'
} finally { Pop-Location }

# ---------------------------------------------------------------------------
# 2. Cloudflare Quick Tunnel for the API (or LAN fallback)
# ---------------------------------------------------------------------------
$apiUrl = $null

if ($SkipTunnel) {
    Section '2. LAN mode (no Cloudflare tunnel)'
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
    if (-not $lan) { Fail 'Could not detect a LAN IP.'; exit 1 }
    $apiUrl = "http://$($lan.IPAddress):4000"
    $script:LanIp = $lan.IPAddress    # used later to pin Metro hostname
    Ok ("Using LAN URL {0} (interface: {1})" -f $apiUrl, $lan.InterfaceAlias)
} else {
    Section '2. Start Cloudflare Quick Tunnel'
    $logFile = Join-Path $env:TEMP "mtw-cloudflared-$([guid]::NewGuid().ToString('N')).log"
    Info "cloudflared output -> $logFile"

    # `--protocol http2` forces the tunnel data plane onto TCP/443 instead of
    # the default QUIC (UDP/7844). Many home routers, corporate firewalls,
    # and Windows Defender configurations will pass cloudflared's pre-checks
    # but then drop the long-lived QUIC datagram session, producing the
    # "failed to run the datagram handler / context canceled" loop.
    # HTTP/2 is slightly slower but works almost everywhere.
    $cfArgs = "tunnel --url http://localhost:4000 --protocol http2 --logfile `"$logFile`""
    Start-Process -FilePath 'cloudflared' -ArgumentList $cfArgs -WindowStyle Normal | Out-Null
    Ok 'cloudflared launched in a new window (--protocol http2). Leave it open!'

    # Poll the log file for the trycloudflare URL (printed within ~5-15 s)
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline -and -not $apiUrl) {
        Start-Sleep -Seconds 1
        if (Test-Path $logFile) {
            $match = Select-String -Path $logFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
                ForEach-Object { $_.Matches.Value } |
                Select-Object -First 1
            if ($match) { $apiUrl = $match }
        }
    }
    if (-not $apiUrl) {
        Fail 'Cloudflare tunnel did not publish a URL within 45 s. Check the cloudflared window.'
        exit 1
    }
    Ok ("Cloudflare URL: {0}" -f $apiUrl)

    # Verify it actually proxies to our API
    try {
        $h = Invoke-RestMethod "$apiUrl/api/health" -TimeoutSec 10
        if ($h.ok) { Ok 'Tunnel proxies /api/health correctly.' }
        else       { Warn 'Tunnel reachable but /api/health did not return ok=true.' }
    } catch {
        Warn 'Tunnel URL not reachable yet — sometimes takes 10-15 s extra. The phone will pick it up once it goes live.'
    }
}

# ---------------------------------------------------------------------------
# 3. Sync mobile/.env with the chosen URL + DEV_SKIP_OTP=true
# ---------------------------------------------------------------------------
Section '3. Update mobile/.env'
$envFile = Join-Path $mobile '.env'
$contents = @(
    "API_URL=$apiUrl",
    "SOCKET_URL=$apiUrl",
    "DEV_SKIP_OTP=true",
    ''
) -join "`r`n"
Set-Content -Path $envFile -Value $contents -Encoding utf8
Ok "Wrote $envFile"
Get-Content $envFile | ForEach-Object { Info "  $_" }

# ---------------------------------------------------------------------------
# 4. Start Expo in a new PowerShell window
# ---------------------------------------------------------------------------
if ($SkipExpo) {
    Section '4. Skipping Expo (--SkipExpo)'
    Info 'Start it manually with:   cd mobile ; npm run start:tunnel'
    exit 0
}

Section '4. Start Expo dev server'
$expoCmd =
    if ($SkipTunnel) { 'npm run start' }     # --lan
    else             { 'npm run start:tunnel' }

# In LAN mode we MUST pin the hostname Metro embeds in the QR code.
# Windows boxes with WSL / Hyper-V / vEthernet adapters confuse Expo's
# auto-detection and it often falls back to 127.0.0.1 — which makes
# the phone scan a QR pointing at itself ("Could not connect to
# server exp://127.0.0.1:8081"). Forcing the hostname via these two
# env vars makes Metro emit `exp://<your-LAN-IP>:8081` reliably.
$hostnamePin = ''
if ($SkipTunnel -and $script:LanIp) {
    $hostnamePin =
        "`$env:REACT_NATIVE_PACKAGER_HOSTNAME='$($script:LanIp)'; " +
        "`$env:EXPO_PACKAGER_HOSTNAME='$($script:LanIp)'; "
    Info ("Pinning Metro hostname to {0}" -f $script:LanIp)
}

# Build a one-liner the new powershell window will run
$inner = "Set-Location '$mobile'; `$env:EXPO_NO_TELEMETRY='1'; $hostnamePin$expoCmd; Read-Host 'Expo exited. Press Enter to close'"
Start-Process powershell -ArgumentList @('-NoExit','-Command', $inner) | Out-Null
Ok 'Expo launched in a new window. Watch it for the QR code.'

Write-Host ''
Write-Host '====================================================' -ForegroundColor Green
Write-Host ' DEV STACK IS UP'                                     -ForegroundColor Green
Write-Host '====================================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Next steps on your phone:' -ForegroundColor White
Write-Host '  1. Make sure Expo Go is installed (Play Store / App Store).' -ForegroundColor White
Write-Host '  2. Watch the new Expo window for the QR code.'               -ForegroundColor White
Write-Host '  3. Scan it with Expo Go (Android) or the Camera app (iOS).'  -ForegroundColor White
Write-Host '  4. The app opens to the Phone screen — paste any number'    -ForegroundColor White
Write-Host '     with country code (e.g. +15551112233) and Continue.'      -ForegroundColor White
Write-Host '     OTP is skipped (DEV_SKIP_OTP=true).'                       -ForegroundColor White
Write-Host ''
Write-Host 'Windows you must keep open:' -ForegroundColor Yellow
if (-not $SkipTunnel) { Write-Host '  - cloudflared (Cloudflare tunnel)' -ForegroundColor Yellow }
Write-Host '  - Expo (Metro bundler)' -ForegroundColor Yellow
Write-Host ''

