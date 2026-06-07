# Deploy latest code to Expo Dev (EAS Build)

EAS Build is Expo's cloud build service. You push your latest code, it
compiles a real APK / iOS bundle in the cloud, and gives you a download
URL. The output is a real installable app — not Expo Go.

This repo is already linked to the EAS project
[`@surya081983/multiptabwatsap`](https://expo.dev/accounts/surya081983/projects/multiptabwatsap)
(project ID `459200b2-5d70-46b4-9e54-727b22e3fce2`). You only had to do
`eas init` once; from now on you just rebuild.

---

## TL;DR — one command

The repo ships a helper at `scripts\deploy-eas.ps1` that picks an API URL,
updates `eas.json`, and runs the cloud build:

```powershell
# Same Wi-Fi as your phone (fastest, simplest)
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode lan

# Anyone, any network — uses Cloudflare quick tunnel (laptop must stay on)
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode tunnel

# You already deployed the backend to a real domain
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode custom -ApiUrl https://api.example.com
```

The script:

1. Confirms `eas-cli` is installed and you're logged in.
2. Confirms your Docker backend is up at `http://127.0.0.1:4000`.
3. Resolves the API URL (LAN IP / cloudflared / your custom URL).
4. Verifies that URL actually responds to `GET /api/health`.
5. Rewrites `mobile/eas.json` so the chosen profile bakes in that URL.
6. Runs `eas build --profile preview --platform android` in the cloud.
7. Prints the APK download URL when the build finishes (~10–15 min).

> **Why baking in a URL matters:** an APK can't read `mobile/.env` after
> install — `process.env.API_URL` is replaced with a literal string by
> Babel at build time. So whatever URL is in `eas.json` when you run
> `eas build` is permanently embedded in that APK. (See
> [docs/fix-apk-404.md](fix-apk-404.md) for the full story.)

---

## Prerequisites (one-time)

```powershell
npm install -g eas-cli
eas login                        # sign in with your Expo account
```

Cloudflare Quick Tunnel mode also needs:

```powershell
winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
# Restart PowerShell so cloudflared is on PATH.
```

Make sure the backend is running:

```powershell
cd C:\Users\Public\multiptabwatsap
docker compose up -d
Invoke-RestMethod http://127.0.0.1:4000/api/health   # -> {"ok":true,...}
```

---

## Pick a mode

### A. `-Mode lan` — testing on your own phone, same Wi-Fi

| When to pick | Why |
|---|---|
| Both your phone and laptop are on the same Wi-Fi | Simplest. No tunnel, no rebuild when restarting laptop |
| Your test device is the only one that needs the APK | LAN IP is fine |

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode lan
```

The script bakes in something like `http://192.168.1.12:4000`. The APK
will only work when the phone is on the same Wi-Fi.

If your laptop's LAN IP changes (you moved networks, router reboot etc.)
you must rebuild — APK is now bound to the old IP.

### B. `-Mode tunnel` — sharing the APK with someone NOT on your Wi-Fi

| When to pick | Why |
|---|---|
| You want a friend / co-worker to test the app from anywhere | Cloudflare tunnel exposes your laptop publicly with HTTPS, free |
| You don't have a real backend deployment yet | Skip Render/Fly setup |

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 -Mode tunnel
```

The script:
- Starts cloudflared in a new window.
- Captures the URL like `https://example-foo-bar.trycloudflare.com`.
- Bakes that URL into the APK.

**Caveats:**
- The cloudflared window must stay open while users use the APK.
- If the URL rotates (you closed cloudflared and reopened) you must rebuild.
- Best for short-lived demos, not real production.

### C. `-Mode custom -ApiUrl https://...` — using a real deployed backend

| When to pick | Why |
|---|---|
| You deployed `backend/` to Render / Fly / Railway / VPS | Permanent URL, no laptop required |
| Building for actual production / Play Store | Use this with `-Profile production` |

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 `
  -Mode custom `
  -ApiUrl https://api.your-domain.com `
  -Profile preview
```

For Play Store builds:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-eas.ps1 `
  -Mode custom `
  -ApiUrl https://api.your-domain.com `
  -Profile production
```

This builds a signed `.aab` (Android App Bundle) instead of an APK. You
can upload `.aab` directly to Google Play Console.

---

## After the build finishes

The terminal will print something like:

```
✔ Build finished
🤖 Android app: https://expo.dev/artifacts/eas/abcd1234.apk
```

To install:

1. **On your phone**, open that URL in Chrome.
2. Tap **Download**.
3. Open the downloaded `.apk` (the notification or Files app).
4. Android prompts: *Install from this source?* → **Settings** → enable, return.
5. Tap **Install** → **Open**.

If you previously had an older MultiTabWatsap APK installed, Android
will offer to **Update** instead — same effect.

You can also see the build (and re-download the APK any time) at:
[`expo.dev/accounts/surya081983/projects/multiptabwatsap/builds`](https://expo.dev/accounts/surya081983/projects/multiptabwatsap/builds)

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `Found invalid character in eas.json` | A previous version had `#` comments which JSON doesn't allow | Already fixed in repo. `git pull`. |
| `eas.json is not valid - "_comment" is not allowed` | Same as above | Same as above |
| `Cannot automatically write to dynamic config at: app.config.js` after `eas init` | Expected — `app.config.js` is dynamic | The script already wrote `extra.eas.projectId` into `app.config.js` |
| Build fails with `Invalid version "124.0.5"` for `react-native-webrtc` | Drift between local and EAS resolver | `cd mobile ; npx expo install react-native-webrtc` then re-run deploy |
| APK installs but login returns 404 | API URL baked into the APK is wrong | See [docs/fix-apk-404.md](fix-apk-404.md) — rebuild with correct `-Mode` |
| `eas build` says "Project must be configured" | First time on this machine | Run `cd mobile ; eas init` once |

---

## Faster iterations: EAS Update (over-the-air JS push)

If you've **already shipped an APK** and only changed JS / images
(not native modules), you can push the new bundle without rebuilding:

```powershell
cd mobile
eas update --branch preview --message "fix login flow"
```

The next time the user opens the APK, Expo's update runtime fetches and
applies the new bundle. No Play Store, no reinstall.

This works because the `preview` profile's runtime fingerprint stays
the same as long as you don't change native deps. Add or upgrade
something like `react-native-webrtc` and you'll need a new full build
again.

Set up update channels (one-time):

```powershell
cd mobile
eas update:configure
```

(This adds `runtimeVersion` and `updates.url` to `app.config.js`. Already
done in this repo.)

---

## Manual fallback (skip the helper script)

If you prefer to do it by hand:

```powershell
# 1. Make sure backend is running
docker compose up -d

# 2. Edit mobile/eas.json — replace API_URL/SOCKET_URL in the "preview"
#    profile with whatever URL the phone will reach
notepad mobile\eas.json

# 3. Build
cd mobile
eas build --profile preview --platform android

# 4. Wait ~10-15 minutes, get an APK URL, install on phone.
```

---

## See also

- [docs/install-mobile-app.md](install-mobile-app.md) — Expo Go vs APK installation guide
- [docs/fix-apk-404.md](fix-apk-404.md) — when the APK login returns 404
- [docs/fix-tunnel-offline.md](fix-tunnel-offline.md) — when the Expo tunnel dies
- [docs/calls-mobile-runbook.md](calls-mobile-runbook.md) — getting voice/video working in the APK
- [docs/deploy-cloud.md](deploy-cloud.md) — deploying the backend to a real host

