# scripts/deploy-eas.ps1
# ----------------------------------------------------------------------------
# DEPLOY the latest mobile code to Expo Dev (EAS Build).
#
# Three modes:
#   -Mode lan      Phone must be on the same Wi-Fi as this PC.
#                  API URL = http://<your-lan-ip>:4000
#                  Fastest, no public exposure.
#
#   -Mode tunnel   Phone can be on ANY network as long as your laptop +
#                  cloudflared are running.
#                  Starts cloudflared in a new window, captures the
#                  trycloudflare.com URL, bakes it into eas.json.
#
#   -Mode custom -ApiUrl https://api.example.com
#                  You already deployed the backend somewhere.
#                  Bakes that URL into eas.json.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode lan
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode tunnel
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode custom `
#     -ApiUrl https://api.example.com
# ----------------------------------------------------------------------------
[CmdletBinding()]
param(
    [ValidateSet('lan','tunnel','custom')]
    [string]$Mode     = 'lan',
    [string]$ApiUrl   = '',
    [ValidateSet('preview','development','production')]
    [string]$Profile  = 'preview',
    [ValidateSet('android','ios')]
    [string]$Platform = 'android'
)
$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile'
function Section($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "[ok]   $t" -ForegroundColor Green }
function Info($t)    { Write-Host "[info] $t" -ForegroundColor Gray  }
function Warn($t)    { Write-Host "[warn] $t" -ForegroundColor Yellow }
function Fail($t)    { Write-Host "[fail] $t" -ForegroundColor Red   }
# 0. Pre-flight
Section '0. Pre-flight checks'
foreach ($cmd in @('eas','docker')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Fail "$cmd is not on PATH."
        if ($cmd -eq 'eas') { Fail 'Install with:  npm install -g eas-cli' }
        exit 1
    }
}
$easUser = (cmd /c "eas whoami 2>nul" | Select-Object -Last 1)
if (-not $easUser -or $easUser -match '^Not logged in') {
    Fail 'Not logged in to Expo.'
    Fail 'Run:  eas login'
    exit 1
}
Ok ("eas-cli logged in as: {0}" -f $easUser)
# Backend has to be running locally for lan/tunnel modes
if ($Mode -in @('lan','tunnel')) {
    try {
        $h = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 3
        if (-not $h.ok) { throw 'health not ok' }
        Ok 'Backend is healthy on http://127.0.0.1:4000'
    } catch {
        Fail 'Backend not running on http://127.0.0.1:4000'
        Fail 'Start it first:  docker compose up -d'
        exit 1
    }
}
# 1. Resolve API URL based on mode
Section ("1. Resolve API URL (mode: {0})" -f $Mode)
$resolvedUrl = $null
switch ($Mode) {
    'lan' {
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
            Sort-Object -Property @{Expression={ if ($_.InterfaceAlias -like '*Wi-Fi*') { 0 } else { 1 } }} |
            Select-Object -First 1
        if (-not $lan) { Fail 'Could not detect LAN IP.'; exit 1 }
        $resolvedUrl = "http://$($lan.IPAddress):4000"
        Warn 'LAN URL only works when the phone is on the SAME Wi-Fi as this PC.'
        Warn 'Use -Mode tunnel if the phone may be on a different network.'
    }
    'tunnel' {
        if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
            Fail 'cloudflared is not on PATH. Install with:'
            Fail '  winget install --id Cloudflare.cloudflared'
            exit 1
        }
        $logFile = Join-Path $env:TEMP "mtw-deploy-cf-$([guid]::NewGuid().ToString('N')).log"
        Info "cloudflared output -> $logFile"
        Info '(leave the cloudflared window open while users use the APK)'
        $cfArgs = "tunnel --url http://localhost:4000 --protocol http2 --logfile `"$logFile`""
        Start-Process -FilePath 'cloudflared' -ArgumentList $cfArgs -WindowStyle Normal | Out-Null
        Ok 'cloudflared launched in a new window.'
        $deadline = (Get-Date).AddSeconds(60)
        while ((Get-Date) -lt $deadline -and -not $resolvedUrl) {
            Start-Sleep -Seconds 1
            if (Test-Path $logFile) {
                $m = Select-String -Path $logFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
                    ForEach-Object { $_.Matches.Value } |
                    Select-Object -First 1
                if ($m) { $resolvedUrl = $m }
            }
        }
        if (-not $resolvedUrl) {
            Fail 'cloudflared did not publish a URL within 60 s.'
            Fail 'Check the cloudflared window for errors.'
            exit 1
        }
    }
    'custom' {
        if (-not $ApiUrl) {
            Fail '-Mode custom requires -ApiUrl <https://...>'
            exit 1
        }
        $resolvedUrl = $ApiUrl.TrimEnd('/')
    }
}
Ok ("API_URL for build: {0}" -f $resolvedUrl)
# Verify URL is reachable
Section '2. Verify URL serves /api/health'
$verifyOk = $false
for ($i = 0; $i -lt 6; $i++) {
    try {
        $h = Invoke-RestMethod "$resolvedUrl/api/health" -TimeoutSec 8
        if ($h.ok) { $verifyOk = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if ($verifyOk) {
    Ok "URL responds: $resolvedUrl/api/health -> ok=true"
} else {
    Warn ("URL did not respond to /api/health within 12 s.")
    Warn ("If you are sure the URL is correct, the phone may still reach it.")
    Warn ("Continuing anyway...")
}
# 3. Update mobile/eas.json for the chosen profile
Section ("3. Update mobile/eas.json - profile '{0}'" -f $Profile)
$easFile = Join-Path $mobile 'eas.json'
$easJson = Get-Content $easFile -Raw | ConvertFrom-Json
if (-not $easJson.build.$Profile) {
    Fail ("Profile '{0}' not found in eas.json" -f $Profile)
    exit 1
}
$easJson.build.$Profile.env.API_URL    = $resolvedUrl
$easJson.build.$Profile.env.SOCKET_URL = $resolvedUrl
if ($Profile -ne 'production') {
    $easJson.build.$Profile.env.DEV_SKIP_OTP = 'true'
}
($easJson | ConvertTo-Json -Depth 20) | Set-Content -Path $easFile -Encoding utf8
Ok ("Wrote {0}" -f $easFile)
Info ("  API_URL    = {0}" -f $resolvedUrl)
Info ("  SOCKET_URL = {0}" -f $resolvedUrl)
# 4. Run EAS build
Section ("4. eas build --profile {0} --platform {1}" -f $Profile, $Platform)
Info 'This runs in the cloud (~10-15 min). Build progress streams below.'
Info 'When done you will get a URL like:'
Info '  https://expo.dev/artifacts/eas/XXXXXXXXXX.apk'
Info ''
Push-Location $mobile
try {
    & cmd /c "eas build --profile $Profile --platform $Platform --non-interactive"
    $exit = $LASTEXITCODE
} finally { Pop-Location }
if ($exit -ne 0) {
    Fail ("eas build exited with code {0}" -f $exit)
    Fail 'Inspect logs at https://expo.dev/accounts/<your-account>/projects/multiptabwatsap/builds'
    exit $exit
}
Section 'DONE'
Write-Host ''
Write-Host '====================================================' -ForegroundColor Green
Write-Host ' BUILD QUEUED ON EAS'                                 -ForegroundColor Green
Write-Host '====================================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Watch progress (or grab the APK URL when done) at:'   -ForegroundColor White
Write-Host '  https://expo.dev/accounts/surya081983/projects/multiptabwatsap/builds' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Once the APK URL is printed in the eas-cli output:'   -ForegroundColor White
Write-Host '  1. Open it on your Android phone browser.'          -ForegroundColor White
Write-Host '  2. Tap Download, then tap the .apk to install.'     -ForegroundColor White
Write-Host '  3. Allow "Install from this source" if prompted.'   -ForegroundColor White
Write-Host '  4. Open MultiTabWatsap. Enter phone, Continue.'     -ForegroundColor White
Write-Host ''
if ($Mode -eq 'tunnel') {
    Write-Host 'IMPORTANT: keep the cloudflared window OPEN while testing.' -ForegroundColor Yellow
    Write-Host 'If you close it the APK will go back to seeing 404 errors.' -ForegroundColor Yellow
    Write-Host ''
}