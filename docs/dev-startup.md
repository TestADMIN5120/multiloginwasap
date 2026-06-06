# Dev Startup Guide — Tunnel Mode

**Use this guide when:** you're testing on a physical phone over Expo Go, on **any** Wi-Fi network — including networks where the phone can't reach the dev machine over LAN (most public, hotel, hotspot, and corporate Wi-Fi).

This is the bulletproof setup we landed on after several rounds of LAN debugging. Two tunnels are involved:

| Tunnel | Exposes | Purpose |
| --- | --- | --- |
| **Cloudflare Quick Tunnel** | `localhost:4000` (Express API + Socket.io) | The phone hits this URL for `/api/...` and websocket events. |
| **Expo `--tunnel` (ngrok-based)** | `localhost:8081` (Metro JS bundler) | Expo Go fetches the JS bundle from this URL when you scan the QR. |

You will keep **3-4 PowerShell windows** open while developing. Each does one job.

---

## Prerequisites (one-time setup)

You only ever do these once on a machine.

### 1. Install Docker Desktop

Download from <https://www.docker.com/products/docker-desktop>. Start it once, accept the WSL2 prompt, leave it running in the tray.

### 2. Install Node 20 LTS

`winget install OpenJS.NodeJS.LTS` or download from <https://nodejs.org>.

```powershell
node -v   # must print v20.x.x or higher
npm -v
```

### 3. Install Cloudflared

```powershell
winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
```

**Close and reopen PowerShell** so the new PATH is picked up. Then verify:

```powershell
cloudflared --version
# cloudflared version 2026.x.x
```

If `cloudflared` is "not recognized" after restart, refresh PATH manually:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### 4. Install mobile app dependencies

```powershell
cd C:\Users\Public\multiptabwatsap\mobile
npm install
```

### 5. Install **Expo Go** on your phone

- Android: Play Store → "Expo Go" by Expo
- iOS: App Store → "Expo Go" by 650 Industries

Sign-in is **not required** for dev tunnels.

### 6. Verify env files exist

`C:\Users\Public\multiptabwatsap\.env` (repo root):

```dotenv
JWT_SECRET=any-long-random-string
OTP_DEV_RETURN=true
OTP_DEV_BYPASS=true
CORS_ORIGIN=*
```

`C:\Users\Public\multiptabwatsap\mobile\.env`:

```dotenv
API_URL=http://localhost:4000
SOCKET_URL=http://localhost:4000
DEV_SKIP_OTP=true
```

The `API_URL`/`SOCKET_URL` lines will be **overwritten with a Cloudflare URL** every dev session — that's normal. The `localhost` fallback is only used by smoke tests on the laptop.

---

## Daily startup (every time you start coding)

You'll open **three PowerShell windows**, do one thing in each, and leave them all running until you stop for the day.

### Window 1 — Backend (Docker Compose)

```powershell
cd C:\Users\Public\multiptabwatsap
docker compose up -d
docker compose ps
```

✅ **Confirm:** `multiptabwatsap-api` is `Up X (healthy)` and `multiptabwatsap-mongo` is `Up X (healthy)`.

Quick smoke test:

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
# ok=True service=multiptabwatsap-api
```

If unhealthy: `docker compose up -d --force-recreate api` and retry. You can close this window once it's running — Docker keeps the containers alive in the background.

### Window 2 — Cloudflare Tunnel for the API (LEAVE OPEN)

```powershell
cloudflared tunnel --url http://localhost:4000
```

After ~5 seconds it prints a banner with **your** unique URL between two `+----+` lines:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://furniture-poison-elsewhere-mainland.trycloudflare.com                             |
+--------------------------------------------------------------------------------------------+
```

📋 **Select that URL with the mouse and copy it** (right-click in PowerShell copies).

✅ **Confirm in your laptop browser:** open `https://<your-url>.trycloudflare.com/api/health` — must return `{"ok":true,...}`.

❗ **Do not close this window.** Closing it instantly breaks all API calls from the phone.

### Edit `mobile\.env` with the Cloudflare URL

Open `C:\Users\Public\multiptabwatsap\mobile\.env`. Replace the entire contents with:

```dotenv
API_URL=https://your-url.trycloudflare.com
SOCKET_URL=https://your-url.trycloudflare.com
DEV_SKIP_OTP=true
```

(Use **your** Cloudflare URL on both lines. No `http://192.168.x.x` anywhere.)

Save the file.

### Window 3 — Expo (LEAVE OPEN)

Open a **fresh** PowerShell window (don't reuse Window 2):

```powershell
cd C:\Users\Public\multiptabwatsap\mobile
npm run start:tunnel
```

Wait 30–60 seconds. ngrok needs to set up its tunnel. Eventually you'll see:

```
› Metro waiting on exp://xxxx-yyyy.exp.direct
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

✅ **Confirm:** the URL above the QR code ends with `.exp.direct`.

If you see `CommandError: ngrok tunnel took too long to connect`, just retry once or twice — ngrok is slow on cold start.

### On the phone

1. Make sure the phone has internet (any Wi-Fi or mobile data — does **not** need to match the laptop's network).
2. Open Expo Go → tap "Scan QR code" → scan the QR in Window 3.
3. Bundle download takes 30-60 s the first time.
4. App opens to the **Phone screen** with a **yellow debug box**.

### Verify the connection on the phone

In the yellow box:

- The line under **API_URL** should be your Cloudflare URL.
- Tap **Test connection**.
- Result should say: `OK 200 (XXXms): {"ok":true,"service":"multiptabwatsap-api"}`.

If it does → you're done. Type any phone number with country code (e.g. `+15551112233`) and tap **Continue**. The OTP step is skipped (`DEV_SKIP_OTP=true`) and you go straight to Create / Pick account.

---

## Daily shutdown

```powershell
# Window 3 (Expo): Ctrl+C
# Window 2 (cloudflared): Ctrl+C
# Window 1 (Docker, optional — leaves Mongo data intact):
docker compose stop
```

Tomorrow's startup is the same as today's — but **your Cloudflare URL changes every restart** (free quick tunnels are random each time). You'll re-edit `mobile\.env` with the new URL.

---

## Optional: permanent Cloudflare URL (skip the daily edit)

Free, takes ~10 minutes. Set up once, never touch `mobile\.env` again.

1. Sign up at <https://dash.cloudflare.com> (free) — no domain required, you can use a Cloudflare-provided one or a domain you already own.
2. Run `cloudflared tunnel login` (opens browser, authorize once).
3. `cloudflared tunnel create multiptabwatsap-dev` — note the tunnel ID printed.
4. Add a CNAME pointing your chosen subdomain to `<tunnel-id>.cfargotunnel.com` (Cloudflare dashboard does this for you with `cloudflared tunnel route dns multiptabwatsap-dev api.<your-domain>`).
5. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: C:\Users\<you>\.cloudflared\<tunnel-id>.json
   ingress:
     - hostname: api.<your-domain>
       service: http://localhost:4000
     - service: http_status:404
   ```
6. Run with `cloudflared tunnel run multiptabwatsap-dev` — same URL every time.

Set `mobile\.env` once with `https://api.<your-domain>` and forget about it.

---

## Troubleshooting

### "Test connection" on the phone says `FAIL: Aborted`

The phone reached out but got nothing back within 8 seconds. Cause is one of:

- **`cloudflared` window closed** → reopen Window 2.
- **Cloudflare URL in `mobile\.env` is stale** (you restarted `cloudflared` without updating `.env`) → copy the new URL from Window 2, paste into `mobile\.env`, **stop and restart Expo (Window 3)** — Expo only reads `.env` at startup.
- **Backend container died** → `docker compose ps` (Window 1). If unhealthy: `docker compose up -d --force-recreate api`.

### Yellow box still shows `http://192.168.1.x:4000`

Expo cached the old bundle. In Window 3:

```powershell
# Ctrl+C
npx expo start --tunnel --clear
```

The `--clear` wipes Metro's cache. Re-scan the QR.

### `npm run start:tunnel` exits with `ngrok tunnel took too long`

Just retry. ngrok cold-start is flaky:

```powershell
npm run start:tunnel
```

If it fails 3 times in a row, network restrictions are blocking ngrok itself. Use the **Plan B** approach from `docs/install-mobile-app.md` (open a second `cloudflared` for port 8081 and connect Expo Go via "Enter URL manually").

### `cloudflared --version` says "not recognized" after install

PATH not refreshed in your PowerShell session. Either close and reopen PowerShell, or run:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### Docker container restart loops

Usually a missing env var. Check:

```powershell
docker compose logs --tail=80 api
```

If you see `[env] WARNING: JWT_SECRET not set` → your repo-root `.env` is missing or empty. Recreate it from `.env.example` and:

```powershell
docker compose up -d --force-recreate api
```

### App opens but everything keeps spinning

Kill the cached Expo Go session: in Window 3 press `r` to reload. If that doesn't help, swipe Expo Go off the recent-apps list on the phone and re-scan the QR.

### Backend logs show requests but the phone gets timeouts

Cloudflare URL works in laptop browser but not on phone? Check phone clock — incorrect time/date breaks HTTPS cert validation, killing all `https://...trycloudflare.com` requests.

---

## Switching back to LAN mode (when on a permissive network)

If the dev box, the phone, and the Wi-Fi all play nice (home network, simple SOHO router, no client isolation):

1. Stop Window 2 (cloudflared) and Window 3 (Expo).
2. Edit `mobile\.env`:
   ```dotenv
   API_URL=http://192.168.1.12:4000
   SOCKET_URL=http://192.168.1.12:4000
   DEV_SKIP_OTP=true
   ```
   (Use **your** dev machine's Wi-Fi IP — `ipconfig` in PowerShell to find it.)
3. From the repo root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
   ```
   Run as **Administrator** the first time so it can open Windows Firewall ports 4000 and 8081-8090.

The script auto-detects your LAN IP, syncs `mobile\.env`, opens firewall rules, and starts Expo with `--lan`. The QR code reads `exp://192.168.1.x:8081` and the phone fetches the bundle directly over LAN — much faster than tunnel mode.

---

## Switching back to OTP (turn off the dev bypass)

When you want the real OTP flow back:

1. Repo-root `.env`: change `OTP_DEV_BYPASS=true` → `OTP_DEV_BYPASS=false`.
2. `mobile\.env`: change `DEV_SKIP_OTP=true` → `DEV_SKIP_OTP=false`.
3. Restart backend and Expo:
   ```powershell
   docker compose up -d --force-recreate api
   # in Window 3:
   #   Ctrl+C
   #   npm run start:tunnel
   ```

The PhoneScreen will once again navigate to the OTP screen after "Send OTP", and `POST /api/auth/dev-login` returns 404.

---

## Reference: which window does what

| Window | Command | Closes when… |
| --- | --- | --- |
| 1 | `docker compose up -d` | Manually `docker compose stop`. Containers persist after closing the PS window. |
| 2 | `cloudflared tunnel --url http://localhost:4000` | **Ctrl+C** — closing the window ends the tunnel and breaks API calls instantly. |
| 3 | `npm run start:tunnel` | **Ctrl+C** — closing the window kills Metro and the QR stops working. |

If you forget which window does what, run `Get-Process node, cloudflared, "Docker Desktop"` to see what's still alive.

---

## Reference: API endpoints used in dev-bypass mode

| Endpoint | Purpose | Auth |
| --- | --- | --- |
| `POST /api/auth/dev-login` | Issue a phone-session token from just a phone number (skips OTP). Only works when backend has `OTP_DEV_BYPASS=true`. | none |
| `POST /api/accounts` | Create a new identity on this phone | phone token |
| `POST /api/accounts/:id/login` | Log into an existing identity | phone token |
| `GET /api/users/me` etc. | All other app endpoints | account token |

The smoke test at `scripts/smoke-test.ps1` runs the **real** OTP flow and ignores the bypass — useful for verifying the production path still works.

