# MultiTabWatsap — Dev Mode Runbook

This is the **one-page** guide for running MultiTabWatsap on your laptop +
phone the way we got it working. It captures every step we actually used,
in order, and tells you what to do after a Windows reboot or a Cloudflare
URL change.

There are two scripts that automate the whole thing — you only need to read
the manual section if something fails.

> **TL;DR — every coding session:**
> ```powershell
> cd C:\Users\Public\multiptabwatsap
> powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
> ```
> Then scan the QR code that appears in the new Expo window with Expo Go.

---

## Table of contents

1. [What you'll have running](#what-youll-have-running)
2. [One-time setup (do this once per machine)](#one-time-setup-do-this-once-per-machine)
3. [Daily startup — the easy way](#daily-startup--the-easy-way)
4. [Daily startup — the manual way (if a script fails)](#daily-startup--the-manual-way-if-a-script-fails)
5. [Daily shutdown](#daily-shutdown)
6. [After a Windows reboot](#after-a-windows-reboot)
7. [Switching between tunnel and LAN mode](#switching-between-tunnel-and-lan-mode)
8. [Disabling the OTP bypass (real OTP flow)](#disabling-the-otp-bypass-real-otp-flow)
9. [Troubleshooting](#troubleshooting)
10. [Reference: file roles](#reference-file-roles)

---

## What you'll have running

While you're developing, **three processes** stay alive:

| # | Process              | Where                  | Purpose                                                                 |
|---|----------------------|------------------------|-------------------------------------------------------------------------|
| 1 | **Docker stack**     | Docker Desktop (tray)  | `multiptabwatsap-api` (Node + Express + Socket.io) and `mongo:7`.       |
| 2 | **cloudflared**      | New PowerShell window  | Public HTTPS URL (`https://*.trycloudflare.com`) → `localhost:4000`.    |
| 3 | **Expo / Metro**     | New PowerShell window  | Bundles JS + serves the QR code (`exp://*.exp.direct` via ngrok).       |

The mobile app (Expo Go on your phone) downloads the JS bundle from #3 and
then makes API calls + websocket traffic to #2 — which is just Cloudflare's
edge proxying back to your laptop. **No port-forwarding, no firewall edits,
no phone-on-same-Wi-Fi requirement.**

---

## One-time setup (do this once per machine)

You only do these once. After this, all daily startups are a single
command.

### 1. Install the tooling

```powershell
# Docker Desktop — download from https://www.docker.com/products/docker-desktop
# Start it once, keep it running in the system tray.

# Node 20 LTS
winget install OpenJS.NodeJS.LTS

# Cloudflare's tunnel CLI
winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
```

**Close PowerShell and reopen it** so the new PATH picks up `cloudflared`.

Verify:

```powershell
docker --version
docker compose version
node -v                    # v20.x.x or higher
cloudflared --version      # cloudflared version 2026.x.x
```

If `cloudflared` says "not recognized" in a *new* PowerShell window,
refresh PATH manually:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
```

### 2. Install Expo Go on your phone

- **Android:** Play Store → "Expo Go"
- **iOS:**     App Store  → "Expo Go"

You do **not** need to sign in.

### 3. Install mobile dependencies

```powershell
cd C:\Users\Public\multiptabwatsap\mobile
npm install
```

> If you ever see `Cannot find module 'babel-preset-expo'` or
> `Cannot find module 'metro-cache/.../https-proxy-agent'`, your
> `node_modules` is corrupted. Fix:
> ```powershell
> Remove-Item -Recurse -Force node_modules, package-lock.json
> npm install
> ```

### 4. Create the two `.env` files

**Repo root** — `C:\Users\Public\multiptabwatsap\.env`:

```dotenv
JWT_SECRET=any-long-random-string-at-least-32-chars
OTP_DEV_RETURN=true
OTP_DEV_BYPASS=true
CORS_ORIGIN=*
```

> Generate a secret quickly:
> ```powershell
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

**Mobile app** — `C:\Users\Public\multiptabwatsap\mobile\.env`:

```dotenv
API_URL=http://localhost:4000
SOCKET_URL=http://localhost:4000
DEV_SKIP_OTP=true
```

The `localhost` placeholders will be **overwritten automatically** by
`dev-up.ps1` every time it runs. They only matter for local smoke tests
on the laptop browser.

### 5. (PowerShell only — once per machine) allow `npx` scripts

If `npm run start:tunnel` fails with *"running scripts is disabled on
this system"*:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

You only ever need this once.

---

## Daily startup — the easy way

```powershell
cd C:\Users\Public\multiptabwatsap
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
```

What it does, step by step (you'll see each step labeled in the output):

| Step | Action                                                                                                  |
|------|---------------------------------------------------------------------------------------------------------|
| 0    | Verifies `docker`, `node`, `npm`, `cloudflared` are on PATH and your `.env` exists.                    |
| 1    | `docker compose up -d` — and force-recreates the API if it's stuck in a restart loop (post-reboot fix). |
| 2    | Starts `cloudflared tunnel --url http://localhost:4000` in a **new** PowerShell window and waits up to 45 s for the `https://*.trycloudflare.com` URL. |
| 3    | Rewrites `mobile\.env` so `API_URL` and `SOCKET_URL` point at that URL and `DEV_SKIP_OTP=true`.        |
| 4    | Starts `npm run start:tunnel` in another **new** PowerShell window so Expo serves the bundle over ngrok. |

When it's done you'll have three windows open — leave them all running:

1. Your original window (it printed "DEV STACK IS UP" and exited).
2. The cloudflared window (don't close it!).
3. The Expo window with the QR code.

**On the phone:**

1. Open Expo Go → tap **Scan QR code** → scan the QR in the Expo window.
2. The bundle downloads (30–60 s the first time).
3. App opens on the **Phone screen**. Type any number with country code
   (e.g. `+919876543210`) and tap **Continue**. Because `DEV_SKIP_OTP=true`
   you go straight to **Create / Pick account** with no OTP step.

That's it. Repeat each morning.

### Useful flags

```powershell
# Skip Cloudflare and use your laptop LAN IP instead (faster bundle download
# but the phone must be on the same Wi-Fi)
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -SkipTunnel

# Already have Expo running, just rebuild Docker + Cloudflare URL
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -SkipExpo

# Force docker compose to recreate the API container (use after editing
# docker-compose.yml or the repo-root .env)
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -Recreate
```

---

## Daily startup — the manual way (if a script fails)

Open three PowerShell windows.

### Window 1 — backend

```powershell
cd C:\Users\Public\multiptabwatsap
docker compose up -d
docker compose ps                                # both healthy?
Invoke-RestMethod http://127.0.0.1:4000/api/health
# expect: ok=True service=multiptabwatsap-api
```

If a container is `Restarting`, force a fresh one:

```powershell
docker compose up -d --force-recreate api
docker compose logs --tail=50 api
```

### Window 2 — Cloudflare tunnel (LEAVE OPEN)

```powershell
cloudflared tunnel --url http://localhost:4000 --protocol http2
```

The `--protocol http2` flag forces the tunnel onto TCP/443 instead of
QUIC (UDP). Without it, on many home / corporate networks you'll see
the URL get printed and then a loop of `failed to run the datagram
handler / context canceled / Retrying connection in up to Ns` —
the QUIC datagram session keeps getting reset by your router or
firewall. HTTP/2 is slightly slower but works almost everywhere.

After ~5–15 s it prints a banner with **your** unique URL:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://variation-diagnostic-perform-jill.trycloudflare.com                               |
+--------------------------------------------------------------------------------------------+
```

📋 Copy that URL. Verify it works in your laptop browser:

```
https://variation-diagnostic-perform-jill.trycloudflare.com/api/health
```

You should see `{"ok":true,"service":"multiptabwatsap-api"}`.

### Edit `mobile\.env`

```dotenv
API_URL=https://variation-diagnostic-perform-jill.trycloudflare.com
SOCKET_URL=https://variation-diagnostic-perform-jill.trycloudflare.com
DEV_SKIP_OTP=true
```

Save the file.

### Window 3 — Expo (LEAVE OPEN)

```powershell
cd C:\Users\Public\multiptabwatsap\mobile
npm run start:tunnel
```

Wait 30–60 s. ngrok cold-start is slow. Eventually:

```
› Metro waiting on exp://xxxx-yyyy-8081.exp.direct
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

Scan the QR with Expo Go → app opens on the Phone screen.

---

## Daily shutdown

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1
```

Or manually:

```powershell
# Window 3 (Expo):       Ctrl+C
# Window 2 (cloudflared): Ctrl+C
# Window 1 (Docker):
docker compose stop
```

Mongo data persists in the `mongo_data` named volume — accounts,
conversations, and messages survive across restarts.

---

## After a Windows reboot

This is the case that bit us. Symptoms:

- `docker compose ps` shows `multiptabwatsap-api` as **Restarting** in a loop.
- `docker compose logs api` shows:
  ```
  Error: Missing required env var: JWT_SECRET
      at Object.<anonymous> (/app/src/config/env.js:10:13)
  ```

**Why it happens:** Docker Desktop's auto-start brought up an *old* copy
of the container that was created before the env vars were configured.
That container has no `JWT_SECRET` baked in, crashes on boot, and Docker
keeps restarting it.

**The fix:**

```powershell
cd C:\Users\Public\multiptabwatsap
docker compose down                         # remove the stuck container
docker compose up -d --build --force-recreate
docker compose logs --tail=20 api           # confirm "API listening on :4000"
```

After this is fixed once, the new `docker-compose.yml` (with
`restart: on-failure:5` and `env_file: .env`) prevents the loop from ever
happening again — Docker now gives up after 5 crashes instead of
hammering forever, and the container always reads the real `.env`.

The single command that does all of this:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -Recreate
```

---

## Switching between tunnel and LAN mode

| Mode               | When to use                                                     | Command                                                                |
|--------------------|------------------------------------------------------------------|------------------------------------------------------------------------|
| **Tunnel (default)** | Any Wi-Fi (public, hotel, hotspot, corporate). Phone bundle is served over ngrok, API over Cloudflare. | `dev-up.ps1` (no flags)                                                |
| **LAN**            | Home Wi-Fi where the phone can reach your laptop directly. Faster bundle download, no Cloudflare URL rotation. | `dev-up.ps1 -SkipTunnel`  *or*  `scripts\open-app.ps1`                 |

LAN mode requires:

- Phone and laptop on the **same Wi-Fi**.
- Windows Firewall TCP rules for ports 4000, 8081-8090, 19000-19006.
  `dev-up.ps1 -SkipTunnel` and `open-app.ps1` open them automatically when
  run in an **elevated** PowerShell (Run as Administrator).

---

## Disabling the OTP bypass (real OTP flow)

Backend (repo-root `.env`):

```dotenv
OTP_DEV_BYPASS=false
OTP_DEV_RETURN=true       # keep `true` so the dev OTP code is returned in the API response
```

Mobile (`mobile\.env`):

```dotenv
DEV_SKIP_OTP=false
```

Restart with `-Recreate`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -Recreate
```

Now PhoneScreen → tap **Send OTP** → OTPScreen pre-fills the dev code from
the API response → tap **Verify** → continue to Create/Pick account.

In production: set `OTP_DEV_RETURN=false` and wire a real SMS provider in
`backend/src/services/otp.service.js`.

---

## Troubleshooting

| Symptom                                                                                  | Fix                                                                                                                                                              |
|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `docker compose logs api` shows `Missing required env var: JWT_SECRET`                  | You're on a stale container from before the .env was set up. Run `dev-up.ps1 -Recreate` (or `docker compose down; docker compose up -d --build --force-recreate`). |
| Phone says **"Network error"** or **"Request timed out"**                                | The Cloudflare URL changed and `mobile\.env` is stale, OR the cloudflared window was closed. Re-run `dev-up.ps1`.                                                |
| Phone says **"Project is incompatible with this version of Expo Go — SDK 51 / SDK 54"**  | Mobile app is on Expo SDK 54; the `package.json` already pins `expo: ~54.0.0`. If you cloned old code: `cd mobile; rm -rf node_modules package-lock.json; npm install`. |
| `Cannot find module 'babel-preset-expo'`                                                 | `cd mobile; rm -rf node_modules package-lock.json; npm install`. The dep is in `devDependencies`.                                                                |
| `Cannot find module 'metro-cache/.../https-proxy-agent'`                                 | Same fix — corrupt npm install. Clean reinstall as above.                                                                                                        |
| `npx : running scripts is disabled on this system`                                       | One-time per machine: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.                                                                    |
| `CommandError: ngrok tunnel took too long to connect`                                    | ngrok cold-start is slow. Just retry `npm run start:tunnel` once or twice.                                                                                       |
| `cloudflared` window closed by accident                                                  | Re-run `dev-up.ps1` — it brings the tunnel back, picks up the new URL, rewrites `mobile\.env`, and restarts Expo.                                                |
| Yellow debug box on PhoneScreen still shows the old URL                                  | Expo cached the old bundle. In the Expo window press `r` to reload, or stop it and run `npx expo start --tunnel --clear`.                                        |
| `Port 8081 is being used` → Expo asks to use 8082 → say yes                              | Fine. The QR will read `exp://...-8082.exp.direct`. Scan it normally.                                                                                            |
| `404 not_found` on `http://localhost:4000/`                                              | That's expected — the root prints a help banner. The real endpoints live under `/api/*`. Test `http://localhost:4000/api/health`.                                |
| `Invoke-RestMethod ... : The underlying connection was closed`                           | Docker port-mapping went stale. Restart the API container: `docker compose up -d --force-recreate api`.                                                          |
| `cloudflared` prints the URL then loops with `failed to run the datagram handler` / `context canceled` / `Retrying connection in up to Ns` | Your network blocks/throttles QUIC (UDP/7844). Stop cloudflared (Ctrl+C in its window) and re-run with HTTP/2: `cloudflared tunnel --url http://localhost:4000 --protocol http2`. `dev-up.ps1` already passes this flag automatically. |
| `dev-login` returns `Expected property name or '}' in JSON at position 1`                | Bad JSON quoting in PowerShell. Use: `curl.exe -s -X POST http://127.0.0.1:4000/api/auth/dev-login -H "Content-Type: application/json" -d '{\"phone\":\"+15551112233\"}'` (note the *single* outer quotes). |
| Login screen appears but **+91 / India numbers** time out at 15 s                        | The API URL in `mobile\.env` is unreachable from the phone (LAN mode on a Wi-Fi that blocks client-to-client). Switch to tunnel mode: `dev-up.ps1` (no `-SkipTunnel`). |
| `'import' and 'export' may only appear at the top level` build error                     | A URL got pasted into the middle of a `.js` file. Open the file at the line shown in the stack trace and remove the stray text.                                  |

### Diagnosing what's actually broken

```powershell
# What containers are alive?
docker compose ps

# What does the API say?
docker compose logs --tail=80 api

# Health-check round trip
Invoke-RestMethod http://127.0.0.1:4000/api/health

# Is the Cloudflare URL still alive?
Invoke-RestMethod https://<your-url>.trycloudflare.com/api/health

# Is Expo still serving?
# Look in the Expo window — should still say "Metro waiting on exp://..."
```

---

## Reference: file roles

| File                                 | What it controls                                                                                                                       |
|--------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `docker-compose.yml`                 | Defines the Mongo + API services. References repo-root `.env` for `JWT_SECRET`, `OTP_DEV_BYPASS`, etc.                                 |
| `.env` (repo root)                   | Backend secrets. Never committed. `dev-up.ps1` requires it to exist.                                                                   |
| `backend/src/config/env.js`          | Loads env vars, falls back to dev defaults with a loud warning if any are missing (so the container doesn't crash-loop).               |
| `mobile/.env`                        | Tells the Expo app where the API + sockets live and whether to skip the OTP screen. Rewritten by `dev-up.ps1` every run.               |
| `mobile/app.config.js`               | Reads `mobile/.env` and exposes `API_URL`, `SOCKET_URL`, `DEV_SKIP_OTP` via `expo-constants` (`Constants.expoConfig.extra`).            |
| `scripts/dev-up.ps1`                 | The orchestrator described in [Daily startup — the easy way](#daily-startup--the-easy-way).                                            |
| `scripts/dev-down.ps1`               | Stops Expo, cloudflared, and `docker compose stop`.                                                                                    |
| `scripts/open-app.ps1`               | Older LAN-only launcher (auto-detects LAN IP, opens firewall, runs `expo start --lan`). Equivalent to `dev-up.ps1 -SkipTunnel`.        |
| `scripts/smoke-test.ps1`             | End-to-end test of the real OTP + multi-account flow against `localhost:4000`. Useful to verify a backend change.                      |

---

## Reference: API endpoints used by the app

| Endpoint                               | Auth header  | Purpose                                                                          |
|----------------------------------------|--------------|----------------------------------------------------------------------------------|
| `GET  /api/health`                     | —            | Liveness check.                                                                  |
| `POST /api/auth/otp/request`           | —            | Send (or, in dev, log) an OTP for a phone number.                                |
| `POST /api/auth/otp/verify`            | —            | Exchange a phone+code pair for a **phone token**.                                |
| `POST /api/auth/dev-login`             | —            | DEV ONLY (`OTP_DEV_BYPASS=true`). Skip OTP, get phone token straight from phone. |
| `GET  /api/accounts`                   | phone token  | List all identities owned by this phone number.                                  |
| `POST /api/accounts`                   | phone token  | Create a new identity on this phone.                                             |
| `POST /api/accounts/:id/login`         | phone token  | Switch to / log into an existing identity → returns an **account token**.        |
| `DELETE /api/accounts/:id`             | account tk.  | Delete the current identity.                                                     |
| `GET  /api/users/me`                   | account tk.  | Profile of the currently active identity.                                        |
| `GET  /api/users/search?q=`            | account tk.  | Find other users by username.                                                    |
| `GET  /api/conversations`              | account tk.  | List chats for this identity.                                                    |
| `POST /api/conversations`              | account tk.  | Create a 1:1 or group chat.                                                      |
| `GET  /api/conversations/:id/messages` | account tk.  | Paginated message history.                                                       |
| `POST /api/conversations/:id/messages` | account tk.  | Send a message.                                                                  |
| `POST /api/messages/:id/read`          | account tk.  | Mark a message read.                                                             |
| `POST /api/uploads`                    | account tk.  | Multipart upload, field `file`. Returns a URL.                                   |
| WebSocket (Socket.io) on the same host | account tk.  | Pass JWT via `auth.token` in the socket handshake.                               |

---

That's the entire dev workflow. If anything in this document is out of
date, the source of truth is the script you're running plus
`docker-compose.yml` — those two files together define what "dev mode"
means for this project.

