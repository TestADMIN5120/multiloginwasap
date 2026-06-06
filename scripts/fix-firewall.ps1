# scripts/fix-firewall.ps1
# ---------------------------------------------------------------------------
# Run as Administrator!
# Fixes the "phone can't reach laptop on 8081 / 4000" problem after a reboot.
#
#   1. Switches the active Wi-Fi profile from "Public" to "Private" so
#      Windows Firewall stops blocking inbound LAN connections.
#   2. Re-creates inbound firewall rules for our dev ports so they're
#      allowed regardless of the profile.
#
# Usage:
#   Right-click PowerShell -> "Run as Administrator"
#   cd C:\Users\Public\multiptabwatsap
#   powershell -ExecutionPolicy Bypass -File scripts\fix-firewall.ps1
# ---------------------------------------------------------------------------

[CmdletBinding()]
param()

function Section($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok($t)      { Write-Host "[ok]   $t" -ForegroundColor Green }
function Warn($t)    { Write-Host "[warn] $t" -ForegroundColor Yellow }
function Fail($t)    { Write-Host "[fail] $t" -ForegroundColor Red   }

# Must run as admin
$me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "This script must be run as Administrator."
    Fail "Right-click PowerShell -> 'Run as Administrator', then re-run."
    exit 1
}

# ---------------------------------------------------------------------------
Section "1. Wi-Fi profile -> Private (so Windows allows LAN inbound)"
$wifi = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -eq 'Internet' }
if (-not $wifi) {
    Warn "Could not detect an active network profile."
} else {
    foreach ($p in $wifi) {
        if ($p.NetworkCategory -eq 'Private') {
            Ok ("'{0}' is already Private." -f $p.Name)
        } else {
            try {
                Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private
                Ok ("Switched '{0}' to Private." -f $p.Name)
            } catch {
                Warn ("Could not change '{0}' to Private: $_" -f $p.Name)
            }
        }
    }
}

# ---------------------------------------------------------------------------
Section "2. Re-create inbound firewall rules"
$ruleSpecs = @(
    @{ Name = "multiptabwatsap-api-4000"; Port = 4000; Desc = "Backend API (Node, Docker)" },
    @{ Name = "expo-metro-8081";          Port = 8081; Desc = "Expo Metro bundler" },
    @{ Name = "expo-metro-8082";          Port = 8082; Desc = "Expo Metro bundler (alt port)" },
    @{ Name = "expo-dev-19000-19006";     Port = "19000-19006"; Desc = "Expo dev tools / DevTools" }
)

foreach ($spec in $ruleSpecs) {
    # Remove any old version of the rule first
    Get-NetFirewallRule -DisplayName $spec.Name -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction SilentlyContinue

    try {
        New-NetFirewallRule `
            -DisplayName $spec.Name `
            -Description $spec.Desc `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $spec.Port `
            -Profile Any `
            -Enabled True | Out-Null
        Ok ("rule added: {0} (port {1})" -f $spec.Name, $spec.Port)
    } catch {
        Fail ("Could not add rule {0}: $_" -f $spec.Name)
    }
}

# ---------------------------------------------------------------------------
Section "3. Sanity check"
$lan = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.PrefixOrigin -in @('Dhcp','Manual') -and
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.*' -and
        $_.InterfaceAlias -notlike '*WSL*' -and
        $_.InterfaceAlias -notlike '*vEthernet*' -and
        $_.InterfaceAlias -notlike '*Loopback*'
    } |
    Select-Object -First 1).IPAddress

if ($lan) {
    Ok ("LAN IP: {0}" -f $lan)
    foreach ($port in 4000, 8081) {
        $listening = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
        if ($listening) {
            Ok ("port {0} listening" -f $port)
        } else {
            Warn ("port {0} not listening yet (start backend / Expo)" -f $port)
        }
    }
}

Write-Host ""
Write-Host "===================================================="    -ForegroundColor Green
Write-Host " FIREWALL FIXED"                                          -ForegroundColor Green
Write-Host "===================================================="    -ForegroundColor Green
Write-Host ""
Write-Host "Now from your phone (same Wi-Fi 'SURYA 5G'):"             -ForegroundColor White
Write-Host "  - Browser test:  http://$lan:4000/api/health"           -ForegroundColor White
Write-Host "  - Expo Go scan QR -> exp://$lan:8081"                   -ForegroundColor White
Write-Host ""

