# Cloud Deployment — Render + MongoDB Atlas + EAS

> **TL;DR:** Vercel and Netlify **cannot host this app** — they're for
> stateless web pages. MultiTabWatsap needs a Node process that holds
> open WebSocket connections (Socket.IO), talks to MongoDB, and stores
> uploaded files. This guide walks you through the real path:
>
> 1. **MongoDB Atlas** — free hosted database (10 min)
> 2. **Render.com** — free Docker host with WebSocket support (15 min)
> 3. **EAS Build** — turns the Expo app into an APK you install on phones (20 min, mostly waiting)

---

## Why not Vercel?

| What MultiTabWatsap needs | Vercel | Render |
|---|---|---|
| Long-lived Socket.IO connection | ❌ 10-second timeout on serverless | ✅ |
| Hosted MongoDB | ❌ external only | ✅ external (Atlas) |
| Persistent uploads dir | ❌ ephemeral FS | ✅ 1 GB free disk on paid, Cloudinary on free |
| Always-on call ring timer (60 s) | ❌ | ✅ |
| Docker deploy | ❌ | ✅ uses `backend/Dockerfile` directly |

Your `mobile/` folder is a **React Native app**, not a website — it can never deploy to Vercel. It has to be packaged into an `.apk` (Android) or `.ipa` (iOS) and installed on a phone. We use **EAS Build** for that.

---

## Part 1 — MongoDB Atlas (free 512 MB)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up (Google login is fine).
2. Create a cluster:
   - Click **Build a Database** → choose **M0 (Free)** → AWS / nearest region → **Create**.
3. Set up access:
   - **Database User**: create a user `multiptab` with a strong password — **save it**.
   - **Network Access**: click **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Render's IP is dynamic on the free tier; you can lock it down later.
4. Get the connection string:
   - Cluster page → **Connect** → **Drivers** → **Node.js** → copy the URI. Looks like:
     ```
     mongodb+srv://multiptab:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with the password you just created.
   - **Add a database name** at the end before the `?`:
     ```
     mongodb+srv://multiptab:YourPass@cluster0.xxxxx.mongodb.net/multiptabwatsap?retryWrites=true&w=majority
     ```
   - Save this string — you'll paste it into Render in Part 2.

---

## Part 2 — Render.com (free Docker host)

### 2.1 Push your code to GitHub
Render deploys from a Git repo. If you haven't already:

```powershell
cd C:\Users\Public\multiptabwatsap
git init
git add .
git commit -m "initial commit"
git branch -M main
# create an empty repo on github.com first, then:
git remote add origin https://github.com/<your-username>/multiptabwatsap.git
git push -u origin main
```

> The repo already has a `render.yaml` at the root — this is what Render reads to know how to build & run your app.

### 2.2 Create the Render service from the blueprint

1. Go to <https://dashboard.render.com> and sign up (GitHub login).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account → pick `multiptabwatsap` → click **Connect**.
4. Render reads `render.yaml` and shows it'll create:
   - 1× web service `multiptabwatsap-api` (Docker)
   - 1× disk `uploads` (1 GB — **only on paid plans**; if free, ignore the warning, it'll skip)
5. Render asks you to set the two **secret** env vars:
   - `JWT_SECRET` → paste a long random string. Generate one in PowerShell:
     ```powershell
     -join ((48..57) + (97..122) + (65..90) | Get-Random -Count 48 | % { [char]$_ })
     ```
   - `MONGO_URI` → paste the connection string from Part 1.
6. Click **Apply**. Render starts building — first build takes ~5–8 minutes.

### 2.3 Watch the deploy

- Click into the service. Tab **Logs** streams the build.
- When it says `listening on :4000 (production)` → it's live.
- Top of the page shows your URL: `https://multiptabwatsap-api.onrender.com` (your subdomain will differ).

### 2.4 Smoke-test the production API

```powershell
# Replace with YOUR Render URL:
$base = "https://multiptabwatsap-api.onrender.com"

# Health check — should print {"ok":true,"service":"multiptabwatsap-api"}
Invoke-RestMethod "$base/api/health"

# Dev login — should print {"phoneToken":"eyJ...","accounts":[]}
Invoke-RestMethod -Method Post -Uri "$base/api/auth/dev-login" `
  -ContentType 'application/json' -Body '{"phone":"+15551112233"}'
```

If both responded, your backend is **production-deployed**. 🎉

> **Free tier caveat:** the service sleeps after 15 minutes of no traffic. The first request after sleep takes ~30 s while the container wakes up. Subsequent requests are instant. Upgrade to **Starter ($7/mo)** to disable sleep.

---

## Part 3 — Build the mobile APK with EAS

Render gave you a public HTTPS URL. Now we bake that URL into an APK so phones can install it directly (no more Expo Go, no more LAN, no more tunnels).

### 3.1 Install EAS CLI (one-time)

```powershell
npm install -g eas-cli
eas login                                       # free Expo account (sign up if needed)
```

### 3.2 Point the build at your Render URL

Open `mobile/eas.json` and **replace** both occurrences of
`https://multiptabwatsap-api.onrender.com` with **your** Render URL (in the `preview` and `development` blocks). Save.

### 3.3 Initialize & build

```powershell
cd C:\Users\Public\multiptabwatsap\mobile
eas init                                        # links project (run once)
eas build --profile preview --platform android  # ~10-15 min in EAS cloud
```

EAS streams progress in the terminal. When done it prints a URL like
`https://expo.dev/artifacts/eas/abc123.apk`.

### 3.4 Install on your phone

- Open that URL on your phone's browser → tap **Download** → tap the file.
- Android will warn "Install unknown apps" — allow it for Chrome → install.
- **Open the app.** It will hit your Render API automatically — no Wi-Fi or Expo Go needed.
- Works on any phone, any network (4G/5G/Wi-Fi), anywhere.

> Want to share the APK with friends? Just send them the same URL. The build is valid for 30 days on EAS's free tier.

### 3.5 iOS

iOS needs an Apple Developer account ($99/yr). Then:
```powershell
eas build --profile preview --platform ios
```
For free dev/testing on iPhone, install the Android dev client APK on any Android device.

---

## Part 4 — Going live for real users

Before sharing publicly you should:

1. **Disable OTP bypass** on Render:
   - Dashboard → service → **Environment** → set `OTP_DEV_BYPASS=false`.
   - Wire a real SMS provider (Twilio is easiest) into
     `backend/src/services/otp.service.js`. Stub already returns a code
     in the response — replace with Twilio send.
2. **Lock CORS** to just your app's domain:
   - `CORS_ORIGIN=https://your-frontend.com` (if you build a web version)
3. **Upgrade Render plan** to `starter` ($7/mo) so the API doesn't sleep + you can attach a 1 GB persistent disk for uploads.
4. **TURN server** for calls behind strict NAT — see `docs/calls.md` §4.
5. **Set a custom domain** in Render dashboard → Settings → Custom Domains. Free SSL via Let's Encrypt.
6. **Rebuild the APK** with the production profile pointing at your custom domain:
   ```powershell
   eas build --profile production --platform android
   ```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Render build fails on `npm install` | Check `backend/package.json` is committed. Re-deploy. |
| Render service crash-loops with `Missing required env var: MONGO_URI` | You forgot to fill it in the dashboard. Dashboard → service → Environment → set it → manual deploy. |
| `/api/health` returns 200 but `/api/auth/dev-login` returns 404 on Render | `OTP_DEV_BYPASS` isn't `"true"`. Set it, redeploy. |
| Mobile app can't reach Render — "Network Error" | (1) Wait 30 s — service was sleeping. (2) Confirm `API_URL` in `eas.json` matches your Render URL **exactly**, including `https://`, no trailing slash. |
| MongoDB connection times out | Atlas IP allowlist — make sure `0.0.0.0/0` is added. |
| Socket.IO disconnects every few seconds | Render free tier idle timeout. Either ping `/api/health` every 10 min from an uptime monitor like UptimeRobot, or upgrade to Starter. |

---

## Files you got from this guide

| File | Purpose |
|---|---|
| `render.yaml` | Render Blueprint — one-click deploy of the backend Docker image with disk + env vars. |
| `mobile/eas.json` | Build profiles for EAS — bakes the production API URL into the APK at build time. |
| `.vercelignore` | Hard block on accidental Vercel imports (since Vercel can't host this). |

You're done. The whole stack — backend, database, mobile app — is now
cloud-hosted and shareable with anyone, anywhere.

