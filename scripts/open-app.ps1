# scripts/open-app.ps1
# One-shot launcher — preflight checks the backend, configures the mobile .env
# with your real LAN IP, ensures the firewall is open, then starts Expo.
#
# Usage:   powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
# Stop:    Ctrl+C in the window that opens

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $root 'mobile'

function Section($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "[ok]  $t" -ForegroundColor Green }
function Warn($t)    { Write-Host "[warn] $t" -ForegroundColor Yellow }
function Fail($t)    { Write-Host "[fail] $t" -ForegroundColor Red }

# --- 1. Detect LAN IP -------------------------------------------------------
Section '1. Detect your LAN IP'
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

if (-not $lan) {
    Fail 'Could not auto-detect your LAN IP. Edit mobile\.env manually.'
    exit 1
}
$ip = $lan.IPAddress
Ok ("Using {0} (interface: {1})" -f $ip, $lan.InterfaceAlias)

# --- 2. Check backend is running -------------------------------------------
Section '2. Verify backend is reachable'
$apiUrl = "http://${ip}:4000"
try {
    $h = Invoke-RestMethod -Uri "$apiUrl/api/health" -TimeoutSec 5
    Ok "API responded: $($h | ConvertTo-Json -Compress)"
} catch {
    Fail "Could not reach $apiUrl/api/health"
    Fail "Start the backend first:  docker compose up --build -d"
    Fail "Then re-run this script."
    exit 1
}

# --- 3. Update mobile\.env --------------------------------------------------
Section '3. Configure mobile/.env'
$envFile = Join-Path $mobile '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $mobile '.env.example') $envFile
    Ok 'Created mobile\.env from template'
}
$lines = Get-Content $envFile
$lines = $lines | ForEach-Object {
    if ($_ -match '^API_URL=')    { "API_URL=http://${ip}:4000" }
    elseif ($_ -match '^SOCKET_URL=') { "SOCKET_URL=http://${ip}:4000" }
    else { $_ }
}
$lines | Set-Content $envFile -Encoding utf8
Ok "API_URL and SOCKET_URL set to http://${ip}:4000"

# --- 4. Firewall rules ------------------------------------------------------
Section '4. Firewall (needs admin to add rules)'
$adminCheck = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($adminCheck) {
    # Open a *range* for Metro because Expo auto-shifts to 8082/8083/... when 8081 is busy.
    foreach ($pair in @(
        @{ Name='multiptabwatsap-api-4000';   Port=4000  },
        @{ Name='expo-metro-8081-8090';       Port='8081-8090' },
        @{ Name='expo-dev-19000-19006';       Port='19000-19006' }
    )) {
        $exists = (netsh advfirewall firewall show rule name="$($pair.Name)" 2>$null) -match $pair.Name
        if (-not $exists) {
            netsh advfirewall firewall add rule name="$($pair.Name)" dir=in action=allow protocol=TCP localport="$($pair.Port)" | Out-Null
            Ok "Added firewall rule: $($pair.Name)"
        } else {
            Ok "Rule already exists: $($pair.Name)"
        }
    }
    # Best-effort cleanup of the old single-port rule from previous script versions
    $legacy = (netsh advfirewall firewall show rule name='expo-metro-8081' 2>$null) -match 'expo-metro-8081$'
    if ($legacy) {
        netsh advfirewall firewall delete rule name='expo-metro-8081' | Out-Null
        Ok "Removed legacy rule: expo-metro-8081 (replaced by 8081-8090 range)"
    }
} else {
    Warn 'Not running as administrator — skipping firewall rule creation.'
    Warn 'If your phone cannot connect, re-run this script in an elevated PowerShell:'
    Warn '   Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File $($PSCommandPath)"'
}

# --- 5. Verify mobile deps --------------------------------------------------
Section '5. Verify mobile dependencies'
if (-not (Test-Path (Join-Path $mobile 'node_modules'))) {
    Warn 'node_modules missing — running npm install (this takes a minute)...'
    Push-Location $mobile
    npm install
    Pop-Location
}
Ok 'node_modules present'

# --- 6. Launch Expo ---------------------------------------------------------
Section '6. Launch Expo dev server'
Write-Host ''
Write-Host 'Once the QR code appears:' -ForegroundColor White
Write-Host '  1. Install "Expo Go" on your phone (Play Store / App Store)' -ForegroundColor White
Write-Host '  2. Make sure your phone is on the SAME Wi-Fi as this PC' -ForegroundColor White
Write-Host '  3. Open Expo Go and scan the QR code'
Write-Host '  4. The app will download (~3 MB) and open on your phone'
Write-Host ''
Write-Host 'Inside the dev server window you can also press:' -ForegroundColor White
Write-Host '  a   open on Android emulator'
Write-Host '  i   open on iOS simulator (macOS only)'
Write-Host '  w   open in web browser (limited)'
Write-Host '  s   switch to Expo Go (if it accidentally went to dev-build mode)'
Write-Host '  r   reload    j   open js debugger    Ctrl+C   stop'
Write-Host ''

Push-Location $mobile
$env:EXPO_NO_TELEMETRY = '1'
# Pin the hostname Metro embeds in the QR code. Without this, Expo's adapter
# auto-detection on a Windows box with WSL / Hyper-V / vEthernet adapters
# often picks a virtual interface (or falls back to 127.0.0.1) and the phone
# then can't reach Metro. Override is documented at:
# https://docs.expo.dev/more/expo-cli/#metro-bundler
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
$env:EXPO_PACKAGER_HOSTNAME = $ip
Ok ("Forcing Metro hostname = {0}" -f $ip)
npx --yes expo start --lan --clear
Pop-Location

