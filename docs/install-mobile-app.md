# How to Open & Install the Mobile App

There are **three ways** to run the app, ordered easiest → most permanent:

| Method | Time | Need a phone? | Need Play Store / Mac? | Survives reboot? |
| --- | --- | --- | --- | --- |
| **A. Expo Go (recommended for dev)** | 2 min | ✅ phone | Just Expo Go (free) | App vanishes when dev server stops |
| **B. Android Emulator on PC** | 5 min | no | Android Studio | Yes, while emulator runs |
| **C. Real APK install on Android** | ~10 min first time | ✅ phone | EAS account (free) | ✅ permanent install |

---

## Prerequisites (all methods)

- Backend running:
  ```powershell
  cd C:\Users\Public\multiptabwatsap
  docker compose up --build -d
  curl.exe http://localhost:4000/api/health     # → {"ok":true,...}
  ```
- Phone on the **same Wi-Fi** as your PC (for methods A and C).

---

## Method A — Expo Go (the fast path) ⭐

### A.1 Install Expo Go on your phone
- **Android:** [Play Store → Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) (free)
- **iOS:** [App Store → Expo Go](https://apps.apple.com/app/expo-go/id982107779) (free)

### A.2 Run the launcher (does everything for you)

Open PowerShell in the repo and run:

```powershell
cd C:\Users\Public\multiptabwatsap
powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
```

It will:
1. Auto-detect your LAN IP
2. Verify the backend responds on it
3. Update `mobile\.env` so the app calls the right host
4. Add Windows Firewall rules (only if you ran PowerShell as Administrator — see note below)
5. Start the Expo dev server

After ~30 s a **QR code** will appear in the terminal.

### A.3 Scan the QR

- **Android:** Open Expo Go → "Scan QR code" → point at the terminal QR.
- **iOS:** Open the **Camera** app → point at the QR → tap the banner that says "Open in Expo Go".

The app downloads (~3 MB) and opens. You'll see the **Phone screen** of MultiTabWatsap. Enter any phone number with country code (e.g. `+15551234567`) and the OTP code will be returned in the API response and pre-filled on the OTP screen — log in, create your first identity, and you're in.

### A.4 If your phone says "Could not connect"

You almost certainly hit the Windows Firewall. Either:

**Option 1** (easiest) — re-run the launcher as administrator:
```powershell
Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File C:\Users\Public\multiptabwatsap\scripts\open-app.ps1"
```

**Option 2** — open the ports manually once (also needs admin):
```powershell
netsh advfirewall firewall add rule name="multiptabwatsap-api-4000" dir=in action=allow protocol=TCP localport=4000
netsh advfirewall firewall add rule name="expo-metro-8081"           dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="expo-dev-19000-19006"      dir=in action=allow protocol=TCP localport=19000-19006
```

**Option 3** — use Expo's tunnel (works through any network, slower):
```powershell
cd C:\Users\Public\multiptabwatsap\mobile
npx expo start --tunnel
```

---

## Method B — Android Emulator on PC (no phone needed)

### B.1 Install Android Studio
Download → install with default options → run it once → on the welcome screen pick **More Actions → Virtual Device Manager** → **Create Device** → pick *Pixel 7* → pick a system image (e.g. *Android 14*) → Finish. Press ▶ next to your AVD to boot it.

### B.2 Run the app on the emulator
With the emulator running and the backend up:
```powershell
cd C:\Users\Public\multiptabwatsap\mobile
npx expo start
# When the QR code appears, press the letter:  a
```
Expo will install Expo Go onto the emulator (first time only) and open the app.

> Tip: from an emulator, **`10.0.2.2`** is the host's localhost. If you run the backend without Docker on your laptop, set `mobile\.env` to `API_URL=http://10.0.2.2:4000`. With Docker compose's published port, the LAN IP also works.

---

## Method C — Build a real APK and install it permanently

This produces a `.apk` file you can install on **any** Android phone — no Expo Go needed, no dev server needed (once your backend is reachable from the phone).

### C.1 Free Expo account
Sign up at [expo.dev](https://expo.dev) (free). Then on your PC:

```powershell
npm install -g eas-cli
eas login
```

### C.2 Configure EAS (one-time)
```powershell
cd C:\Users\Public\multiptabwatsap\mobile
eas init                # creates eas.json + links the project
```
When prompted, accept the defaults.

### C.3 Build the APK in Expo's cloud (free tier)
```powershell
eas build --platform android --profile preview
```
- First build takes ~15 min (it builds in EAS's cloud — your laptop just waits).
- When done, EAS prints a download URL like `https://expo.dev/artifacts/eas/.../app.apk`.

### C.4 Install on your phone
1. Open the URL on your phone, or scan the QR EAS shows you.
2. Tap **Download**, then tap the downloaded APK.
3. Android will say *"For your security, your phone is not allowed to install unknown apps from this source"* → tap **Settings** → toggle **Allow from this source**.
4. Tap **Install**. Done — *MultiTabWatsap* is now in your app drawer like any other app.

### C.5 Important — production API URL
For a real APK that you'll share, the `API_URL` baked in must be reachable from anywhere — not just your Wi-Fi. Either:

- **Easiest:** deploy the backend to a VPS with HTTPS (see `docs/deploy-docker.md` §4), then before `eas build` set `mobile\.env` to your public URL:
  ```
  API_URL=https://api.your-domain.com
  SOCKET_URL=https://api.your-domain.com
  ```
- **Quick test for friends:** install **ngrok** on your laptop, run `ngrok http 4000`, set `API_URL=https://abc-xyz.ngrok.io` in `mobile\.env` and rebuild. Anyone with the APK can use the app from anywhere — as long as your laptop and ngrok stay running.

---

## Method D (bonus) — Build for iOS

Same as Method C but `--platform ios`. Caveats:
- You need an **Apple Developer Program** membership ($99/year) to install on real iPhones.
- For a free test, you can install through TestFlight (also requires Apple Developer).
- Building from a Windows machine works (EAS builds in the cloud); the only thing you can't do from Windows is sign locally with Xcode.

---

## What the app actually does (after install)

1. **Phone screen** → you enter a number with country code (`+1...`)
2. **OTP screen** → in dev mode the code is pre-filled (it came from the API response). Tap *Verify*.
3. **First time on this number?** → *Create account* screen — pick a display name + username → tap Create. You're in.
4. **Already have accounts on that number?** → *Pick account* list → tap one → instantly logged in.
5. **In the chat list:** the top pill bar shows every account you've signed in to. Tap any pill → **instant switch** — chat list, contacts, and socket reconnect for that identity. **This is the multi-account-on-one-install feature you asked for.**
6. **Add another identity:** ⚙ icon (top right of chat list) → "Add another account" → re-verify a phone (same number is fine!) → create a new identity. Now there are two pills at the top, switchable in one tap.

---

## Common issues, quick answers

| Problem | Fix |
| --- | --- |
| QR code scans but app shows "Network error" | `mobile\.env` still says `localhost`. Re-run `scripts\open-app.ps1`. |
| "Cannot find module 'expo'" when starting | `cd mobile && npm install`. |
| Expo Go opens then immediately closes | Backend is unreachable. Curl `http://<your-LAN-IP>:4000/api/health` from your phone's browser — should return JSON. If it doesn't, firewall (see Method A.4). |
| Build with `eas build` says "project not configured" | Run `eas init` first; then `eas build ...`. |
| OTP screen says "invalid_phone" | Include the country code with `+`, e.g. `+15551234567`. |
| App shows but tapping any button does nothing | The Expo dev server crashed. Check the terminal — usually a syntax error in a screen file. Press `r` in the dev server to reload. |
| You changed `mobile\.env` but app still uses old URL | Stop Expo (Ctrl+C) and start it again — env vars are read at startup. |

