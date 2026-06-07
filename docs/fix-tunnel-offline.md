# Fix: "endpoint XXXX-anonymous-8081.exp.direct is offline" / `ERR_NGROK_3200`

## What this error means

```
There was a problem running the requested app.
HTTP response error 404: The endpoint ejvuusk-anonymous-8081.exp.direct is offline.
ERR_NGROK_3200
exp://ejvuusk-anonymous-8081.exp.direct
```

Your previous `expo start --tunnel` session **died**. The QR code you scanned points to an ngrok URL that no longer exists, so Expo Go gets a 404 and `ERR_NGROK_3200` from ngrok itself.

Tunnels go offline when:

- The Metro / PowerShell window was closed.
- Your laptop went to sleep.
- Wi-Fi dropped for more than ~30 s.
- The free ngrok session timed out.

The dead URL **cannot be revived** — you must start a new Metro session, which gets a fresh URL and prints a fresh QR code.

---

## 1-command fix (recommended)

```powershell
cd C:\Users\Public\multiptabwatsap
powershell -ExecutionPolicy Bypass -File scripts\restart-expo.ps1
```

This script:

1. Kills any leftover Metro / ngrok / cloudflared processes from the dead session.
   - **Survivors are OK** — if some processes are admin-owned and can't be killed, the script automatically picks a different port (e.g. 19000 instead of 8081) so you don't have to fight them.
2. Verifies the backend (Docker) is still up — starts it if not.
3. Detects your **current** Wi-Fi IP (your IP can change after a reboot or moving networks).
4. Rewrites `mobile/.env` so the app points at that IP.
5. Generates a small `mobile\start-lan.cmd` wrapper that bakes in `REACT_NATIVE_PACKAGER_HOSTNAME=<your-lan-ip>` (this is what makes Metro advertise the LAN IP instead of `127.0.0.1`).
6. Launches that wrapper in a **new** PowerShell window. The QR code in that window points at `exp://<your-lan-ip>:<port>`.
7. Polls Metro for ~2 minutes and confirms it actually responds on the LAN IP.

Then on your phone:

1. Make sure you're on the **same Wi-Fi** as the laptop.
2. Open Expo Go.
3. **Either** scan the QR in the new Expo window, **or** tap "Enter URL manually" and paste the URL the script printed (e.g. `exp://192.168.1.12:19000`).
4. **Ignore** any *old* PowerShell windows showing `exp://127.0.0.1:8081` — those are zombies the script worked around.

---

## When LAN mode also fails — use tunnel mode

If the phone times out on the LAN URL (e.g. you're on a guest Wi-Fi where devices can't see each other, or a corporate network with client isolation), force tunnel mode:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restart-expo.ps1 -Tunnel
```

> **Caveat:** ngrok tunnels go offline a lot — you'll keep needing to re-run this script every ~30 min. If you're hitting that, build the EAS APK once and stop using Expo Go. See `docs/install-mobile-app.md`.

---

## Troubleshooting matrix

| Phone shows | Cause | Fix |
|---|---|---|
| `endpoint XXXX-anonymous-8081.exp.direct is offline / ERR_NGROK_3200` | Tunnel died | `restart-expo.ps1` (LAN mode is more stable) |
| `Could not connect to server  exp://127.0.0.1:8081` | Metro picked the wrong network adapter (WSL/Hyper-V) | `restart-expo.ps1` — it pins `REACT_NATIVE_PACKAGER_HOSTNAME` |
| `Network request failed` after entering phone | Phone can reach Metro but not the API | Open `http://<lan-ip>:4000/api/health` in the phone browser. If it times out: run `scripts\fix-firewall.ps1` as Admin |
| `timeout 15000ms exceeded` on Continue | Same as above (firewall blocks port 4000) | `scripts\fix-firewall.ps1` as Admin |
| QR scans, app loads, login screen, then 404 on Continue | Backend is up but mobile/.env points at the wrong host (e.g. `localhost`) | `restart-expo.ps1` rewrites `.env` to your real LAN IP |
| `Project is incompatible with this version of Expo Go (SDK 51 vs 54)` | Mismatched SDK | Already fixed — repo is on Expo SDK 54. Just re-run `npm install` in `mobile/`. |
| Tunnel keeps dying every few minutes | Free ngrok session limit | Build the EAS preview APK and stop using Expo Go: see `docs/install-mobile-app.md` |

---

## Manual recovery (if the script can't run)

1. **Close** the dead Metro / cloudflared / ngrok windows. Kill any leftover `node.exe` or `ngrok.exe` from Task Manager.

2. Check the backend is alive:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:4000/api/health
   ```

   If it errors, start it:

   ```powershell
   cd C:\Users\Public\multiptabwatsap
   docker compose up -d
   ```

3. Find your LAN IP:

   ```powershell
   (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' }).IPAddress
   ```

   Suppose it's `192.168.1.12`.

4. Update `mobile/.env`:

   ```
   API_URL=http://192.168.1.12:4000
   SOCKET_URL=http://192.168.1.12:4000
   DEV_SKIP_OTP=true
   ```

5. Start Expo with the IP pinned:

   ```powershell
   cd C:\Users\Public\multiptabwatsap\mobile
   $env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.1.12'
   $env:EXPO_PACKAGER_HOSTNAME = '192.168.1.12'
   npx expo start --lan --clear
   ```

6. Scan the **new** QR code.

---

## Permanent fix: build the APK so you don't need a tunnel at all

Tunnels are only needed because Expo Go is a generic shell that loads your code from Metro on the fly. Once you build a real APK, the API URL is baked in and you don't need Metro running at all (you just need the backend up).

See `docs/install-mobile-app.md` and `docs/calls-mobile-runbook.md` Step 4 for the EAS preview build (~10 min, free).

