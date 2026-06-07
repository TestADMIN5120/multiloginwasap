# Call UI — what just got added & what to do next

## What's new in the app

| Where | What you'll see |
|---|---|
| **Chat list header** | New 📞 icon next to ⚙ — tap it to open Call History |
| **Inside a 1:1 chat** | New 📞 (voice) and 🎥 (video) icons in the header next to the chat name |
| **Call History screen** | Lists every past call (incoming ↙ / outgoing ↗, missed in red, type). Tap a row to redial. |
| **Incoming call** | Full-screen green modal pops up with Accept / Decline buttons (when someone calls **you**) |
| **During a call** | Full-screen UI with mute / camera / flip / speaker / end-call controls, remote video, self-preview PIP for video calls |

These are wired to the **already-deployed backend** call signaling
(invite / accept / offer / answer / ICE / hangup, see `docs/calls.md`).

---

## How calls actually work — and the one-time blocker

Real audio/video uses **WebRTC** via the `react-native-webrtc` library. WebRTC is a **native module** (compiled C++ + Java/Obj-C). Expo Go is a fixed prebuilt app that does not include it.

So:

| Where you run | Phone/video buttons visible? | What happens when you tap them |
|---|---|---|
| **Expo Go** (today) | ✅ Yes | Friendly alert: *"Calls not available in Expo Go — build the dev APK"* |
| **EAS-built APK** (one 15-min build) | ✅ Yes | Real call: ringing on the other phone, P2P audio/video, full controls |

**Nothing in the code changes between the two** — the lazy-require shim in `mobile/src/utils/webrtc.js` detects whether the native module is present at runtime.

---

## Step-by-step: get calls working end-to-end

### Step 1 — Restart your current dev session and verify the buttons appear

In your Metro window press `r` to reload (or restart Expo). On the phone:

1. Go to a 1:1 chat → you'll see 📞 and 🎥 in the header.
2. Tap either → **expected:** alert telling you to build the APK. ✅ This proves the UI is wired.
3. Go back to chat list → tap the new 📞 icon → Call History opens (empty list, that's fine).

If you see all three, the UI is good. Move on to Step 2.

### Step 2 — Install EAS CLI (one-time, ~1 min)

```powershell
npm install -g eas-cli
eas login                     # free Expo account; sign up if needed
```

### Step 3 — Initialize the project for EAS (one-time)

```powershell
cd C:\Users\Public\multiptabwatsap\mobile
eas init                      # creates a project ID, links to your account
```

Press **Y** when it asks to create a new project on your account.

### Step 4 — Build the dev/preview APK (~10–15 min in the cloud)

```powershell
# Option A — for cloud-deployed backend (Render):
#   First edit mobile/eas.json -> replace
#   "https://multiptabwatsap-api.onrender.com" with YOUR Render URL
eas build --profile preview --platform android

# Option B — quick local-only test (uses your laptop's LAN IP):
#   Edit mobile/eas.json -> set API_URL/SOCKET_URL in "preview" to
#   http://192.168.1.12:4000 (your LAN IP)
#   Then:
eas build --profile preview --platform android
```

EAS streams build progress in your terminal. When done it prints a URL
like:
```
https://expo.dev/artifacts/eas/XXXXXXXX.apk
```

### Step 5 — Install the APK on your phone

1. Open that URL on your **phone's browser**.
2. Tap **Download**, then tap the downloaded file.
3. Android will prompt "Install unknown apps" → allow for Chrome → install.
4. Open **MultiTabWatsap** from your app drawer (it's a real app icon now, not Expo Go).

### Step 6 — Make a real call

You need **two devices** signed into **two different accounts** (the whole point of this app — multi-account on one number works great here):

1. Phone A: log in with phone `+15551112233` → create account "Alice".
2. Phone B (or 2nd installation): log in with `+15554445566` → create account "Bob".
3. Have Alice and Bob start a chat.
4. From Alice's chat with Bob, tap 🎥.
5. Bob's phone shows the green incoming-call sheet → tap **Accept**.
6. You should hear/see each other within ~3 seconds.

> **Free testing without 2 phones:** install the APK on a phone *and* on an Android emulator (Android Studio → AVD Manager → run a device → drag-and-drop the APK onto it).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tap 📞 → alert says "Calls not available in Expo Go" | You're still in Expo Go. Do steps 4–5 to build & install the APK. |
| EAS build fails with `Invalid version "124.0.5"` | The package version drifted. In `mobile/`: `npx expo install react-native-webrtc` then re-run `eas build`. |
| APK installs, but tapping 📞 → permission denied | Phone settings → Apps → MultiTabWatsap → Permissions → enable Camera + Microphone. |
| Call rings forever, never connects | Both phones need internet. Check `GET /api/calls/ice-servers` returns at least STUN. For ~10–20% of users behind strict NAT you'll need a TURN server (`docs/calls.md` §4). |
| Call connects, audio works, video black | Camera permission denied OR `mediaDevices.getUserMedia` failed. Check phone permission and re-tap 🎥. |
| Caller hangs up but other side keeps ringing | Make sure both phones can reach the backend's Socket.IO. Run `Invoke-RestMethod $base/api/health` from a PC on the same network as the failing phone. |

---

## Production hardening (later)

When you're ready to share with real users, see `docs/calls.md` §4 for:
- Self-hosting **coturn** TURN server (~$5/mo VPS) for NAT-strict users
- Using **Twilio Network Traversal** (5 GB/mo free) as a managed alternative
- Switching from `--profile preview` to `--profile production` (signed app bundle for Play Store)

