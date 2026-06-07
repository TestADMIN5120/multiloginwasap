# Fix: APK login returns "Request failed with status code 404"

## Symptom

You scan the QR from the Expo dashboard, install the **APK** on Android, the app opens, you enter your phone number, tap **Continue** — and it errors:

```
Request failed with status code 404
```

The app's "Test connection" button (when available) shows:

```
FAIL: HTTP 404
```

## Root cause

Your EAS-built APK has the API URL **baked in at build time**. Earlier the
default in `eas.json` was the Render placeholder:

```json
"env": {
  "API_URL": "https://multiptabwatsap-api.onrender.com",
  ...
}
```

That domain isn't actually deployed — Render returns HTTP 404 to every request, including `POST /api/auth/dev-login`. So the APK works, the network reaches the server, but the server says "I don't know that endpoint" because it's a totally empty Render edge.

You can verify it yourself from the laptop:

```powershell
Invoke-WebRequest https://multiptabwatsap-api.onrender.com/api/health
# -> The remote server returned an error: (404) Not Found.
```

## Fix #1 (fastest, recommended for dev): use Expo Go, not the APK

Expo Go reads `mobile/.env` at **runtime** — so as long as the script
`scripts\restart-expo.ps1` rewrote it to your real LAN IP, it just works.

1. On the Android phone, uninstall "MultiTabWatsap" (the EAS APK).
2. Install **Expo Go** from Google Play (free).
3. Open Expo Go → **Enter URL manually** → paste:

   ```
   exp://<your-lan-ip>:19000
   ```

   (replace `<your-lan-ip>` with the value the script printed, e.g. `192.168.1.12`)

4. App loads → enter `+91xxxxxxxxxx` → **Continue** → straight into the app.

If it still 404s, your phone is reaching the wrong API — open the
phone browser and visit `http://<your-lan-ip>:4000/api/health`. It must
return `{"ok":true,...}`. If it times out, open port 4000 in Windows
Firewall:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\fix-firewall.ps1
```

## Fix #2 (for sharing the APK with someone NOT on your Wi-Fi)

You need a **public URL** for the backend. Two easy options:

### Option A — Cloudflare Quick Tunnel (free, no signup, ~30 s)

```powershell
# Run alongside docker compose; leave the window open
cloudflared tunnel --url http://localhost:4000 --protocol http2
```

Cloudflared prints a URL like `https://example-foo-bar.trycloudflare.com`.
Edit `mobile/eas.json` for the `preview` profile:

```json
"preview": {
  ...,
  "env": {
    "API_URL":    "https://example-foo-bar.trycloudflare.com",
    "SOCKET_URL": "https://example-foo-bar.trycloudflare.com",
    "DEV_SKIP_OTP": "true"
  }
}
```

Rebuild:

```powershell
cd mobile
eas build --profile preview --platform android
```

Wait ~10 minutes, download the new APK, install. URL is now public — anyone with the APK can use it as long as your laptop + cloudflared are running.

### Option B — Deploy backend to a real host (Render / Fly / Railway / VPS)

Pick the host, deploy `backend/` (the `Dockerfile` works as-is), get a public HTTPS URL, set it in `eas.json`, rebuild. See `docs/deploy-docker.md` and `docs/deploy-cloud.md`.

## What I changed in this repo to prevent recurrence

`mobile/eas.json` now defaults the `development` and `preview` profiles to
`http://192.168.1.12:4000` (a LAN URL) instead of the dead Render
placeholder. The `production` profile now has a clearly invalid
placeholder (`https://REPLACE-WITH-YOUR-PUBLIC-DOMAIN.example.com`) so
nobody accidentally ships a build pointing at a dead URL.

Before any future EAS build, edit `mobile/eas.json` and set `API_URL` /
`SOCKET_URL` to whatever URL your phone will be able to reach (LAN IP
for local testing, Cloudflare/ngrok URL for sharing, real domain for
production).

## Why doesn't the APK just read `mobile/.env` at runtime?

It can't — the APK is a compiled native package. `process.env.API_URL`
is replaced with a literal string by Babel at build time (via
`expo-constants`). After that, changing `mobile/.env` has no effect on
the installed APK. Only Expo Go (which downloads the JS bundle from
your laptop on every launch) picks up `.env` changes.

