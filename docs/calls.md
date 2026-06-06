# Audio / Video Calls — Architecture & Implementation Plan

This document explains how calling works in MultiTabWatsap and what's
been built so far. **The backend signaling layer is fully implemented and
deployed.** The mobile UI side requires switching from Expo Go to an
Expo Dev Client (one-time setup) — see §3 below.

---

## 1. Architecture overview

```
┌────────────────┐  Socket.io signaling (over your existing socket)   ┌────────────────┐
│  CALLER PHONE  │ ─────────────────────────────────────────────────► │  CALLEE PHONE  │
│                │      call:invite / accept / decline / end           │                │
│                │      call:offer / answer / ice-candidate            │                │
│  react-native- │                                                     │  react-native- │
│  webrtc        │                                                     │  webrtc        │
│                │  Encrypted P2P media (audio/video, WebRTC, SRTP)    │                │
│                │ ◄─── direct UDP, fallback to TURN if NAT'd ──────► │                │
└────────────────┘                                                     └────────────────┘
        ▲                                  ▲                                   ▲
        │   STUN: stun.l.google.com:19302  │  TURN: optional self-hosted coturn │
        └──────────────────────────────────┘                                   │
                                                                               │
┌──────────────────────────────────────────────────────────────────────────────┴──┐
│  BACKEND (Node + Express + Socket.io + MongoDB)                                  │
│  - Signaling relay (offer/answer/ICE pass-through, no media)                     │
│  - Call lifecycle: ringing -> accepted -> ended (or declined/cancelled/missed)   │
│  - 60s ring timeout auto-marks call as "missed"                                  │
│  - Call history persisted as Call documents                                      │
│  - GET /api/calls/ice-servers returns STUN/TURN config                           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Key facts:

- **Signaling traffic** (small JSON) goes through your existing Socket.io
  connection. No new ports or services on the backend.
- **Media traffic** (audio/video frames, encrypted with SRTP) goes
  **directly between the two phones** — never through your server. So
  bandwidth and CPU on your VPS don't scale with call minutes.
- **STUN** is "what's my public IP" — used to discover NAT mappings.
  Public Google STUN is free and works for ~80% of users.
- **TURN** is a relay used when both clients are behind NAT strict
  enough that direct P2P fails (~10-20% of users, more on corporate
  networks). You self-host coturn or pay a service.

---

## 2. What's implemented (backend) ✅

### Files added

| File | Purpose |
|---|---|
| `backend/src/models/Call.js` | `Call` document schema. One row per call attempt with full lifecycle state. |
| `backend/src/sockets/callHandlers.js` | Socket.io events: invite/accept/decline/cancel/end + WebRTC SDP/ICE relay. 60s auto-miss timer. |
| `backend/src/sockets/handlers.js` | (Edited) Registers call handlers on every authenticated socket. |
| `backend/src/controllers/call.controller.js` | REST endpoints for history + ICE-server config. |
| `backend/src/routes/call.routes.js` | Mounts `/api/calls/*`. |
| `backend/src/routes/index.js` | (Edited) Mounts `call.routes` under `/api/calls`. |
| `backend/src/config/env.js` | (Edited) New TURN_URL/TURN_USER/TURN_PASS env vars. |
| `docker-compose.yml` | (Edited) Forwards TURN env vars into the API container. |
| `backend/src/app.js` | (Edited) Root banner now advertises the call endpoints. |

### REST endpoints (account token)

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/calls` | This account's call history (newest first). Query: `?limit=50&before=<iso-date>` |
| `GET` | `/api/calls/ice-servers` | `{ iceServers: [...] }` — STUN + (optional) TURN config to feed `RTCPeerConnection` |
| `GET` | `/api/calls/:id` | Single call detail (only participants can read) |

### Socket.io events

**Client → server (with optional ack):**

| Event | Payload | Effect |
|---|---|---|
| `call:invite` | `{ conversationId, type: 'audio' \| 'video' }` | Creates a Call (status=ringing), emits `call:ringing` to all participants. |
| `call:accept` | `{ callId }` | Marks call accepted, emits `call:accepted` to all participants. |
| `call:decline` | `{ callId }` | Marks declined, emits `call:ended` (reason=declined). |
| `call:cancel` | `{ callId }` | Caller hangs up before pickup, emits `call:ended` (reason=cancelled). |
| `call:end` | `{ callId }` | Either side hangs up an answered call, emits `call:ended` (reason=hangup). |
| `call:offer` | `{ callId, toAccountId, payload: <SDP> }` | Pure relay — server forwards `payload` to target account room. |
| `call:answer` | `{ callId, toAccountId, payload: <SDP> }` | Pure relay. |
| `call:ice-candidate` | `{ callId, toAccountId, payload: <ICE> }` | Pure relay. |

**Server → client:**

| Event | Payload | Sent to |
|---|---|---|
| `call:ringing` | `{ id, conversationId, callerAccountId, calleeAccountIds, type, status, ... }` | All participants on invite. |
| `call:accepted` | (same Call shape) | All participants when callee accepts. |
| `call:ended` | (same Call shape, with `endedReason`) | All participants on any termination. Reasons: `declined`, `cancelled`, `missed`, `hangup`. |
| `call:offer` | `{ callId, fromAccountId, payload }` | Specific account that this offer is meant for. |
| `call:answer` | `{ callId, fromAccountId, payload }` | Specific account. |
| `call:ice-candidate` | `{ callId, fromAccountId, payload }` | Specific account. |

### Call lifecycle

```
                   ┌──────────────┐
                   │   ringing    │  call:invite → call:ringing emitted
                   └───┬───┬──┬───┘
            accept │   │   │  │ decline / cancel / 60s timeout
                   ▼   │   │  ▼
              ┌──────┐ │   │ ┌──────────┬──────────┬─────────┐
              │accept│ │   │ │ declined │cancelled │ missed  │
              └──┬───┘ │   │ └─────┬────┴────┬─────┴────┬────┘
                 │     │   │       └─ call:ended emitted ─┘
        end /    │     │   │
        hangup   ▼     │   │
              ┌──────┐ │   │
              │ ended│ │   │
              └──────┘ │   │
                       └───┴── persisted in Call collection
```

---

## 3. Mobile-side roadmap (what you need to do)

### 3.1 Switch from Expo Go to Expo Dev Client (one-time)

**Why:** `react-native-webrtc` is a native module. Expo Go is a fixed
app — you cannot add native modules to it. The fix is to build a custom
"Expo Go-like" app that has WebRTC compiled in. After that, your daily
workflow looks exactly the same — `expo start` → scan QR → app loads —
just with your custom dev client app instead of Expo Go.

```powershell
# One-time, in mobile/
npm install -g eas-cli
eas login                      # free Expo account

cd C:\Users\Public\multiptabwatsap\mobile
eas init                       # links the project, creates eas.json
npm install react-native-webrtc

eas build --profile development --platform android
# 10-15 min in EAS cloud — when done, you get a URL/QR for the APK.
# Install that APK on your phone (one time). It looks like Expo Go.
```

For iOS the same flow, but `--platform ios`. You'll need an Apple
Developer account ($99/yr) to install on a real iPhone — for free
testing during dev, use the Android dev client.

After that, **daily workflow is identical**:

```powershell
cd mobile
npm run start                  # or start:tunnel
# scan QR with your custom dev-client app instead of Expo Go
```

### 3.2 Add WebRTC dependencies + permissions

`mobile/package.json`:
```json
"dependencies": {
  "react-native-webrtc": "^124.0.0",
  "react-native-incall-manager": "^4.2.0",   // proximity sensor, audio routing
  "expo-av": "~14.0.0"                        // ringtone playback
}
```

`mobile/app.config.js` — add Android permissions:
```js
android: {
  package: 'com.multiptabwatsap.app',
  permissions: [
    'CAMERA',
    'RECORD_AUDIO',
    'MODIFY_AUDIO_SETTINGS',
    'BLUETOOTH',
    'INTERNET',
  ],
},
ios: {
  bundleIdentifier: 'com.multiptabwatsap.app',
  infoPlist: {
    NSCameraUsageDescription: 'Camera is used for video calls.',
    NSMicrophoneUsageDescription: 'Microphone is used for audio/video calls.',
  },
},
```

### 3.3 New mobile files to create

```
mobile/src/
├── api/
│   └── call.api.js           # listCalls(), getIceServers()
├── context/
│   └── CallContext.js        # provider that owns the active call, peer
│                             # connection, local/remote streams, signaling
│                             # listeners. Single source of truth.
├── components/
│   ├── IncomingCallSheet.js  # full-screen modal that pops up on call:ringing
│   └── CallControls.js       # mute/end/switch-camera buttons
└── screens/
    └── calls/
        ├── CallScreen.js     # in-call UI (RTCView for remote, mini self preview)
        └── CallHistoryScreen.js
```

### 3.4 The minimum viable `CallContext` (skeleton)

```js
// mobile/src/context/CallContext.js  -- pseudocode outline
import { mediaDevices, RTCPeerConnection } from 'react-native-webrtc';

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const [activeCall, setActiveCall] = useState(null);  // { id, type, role, status, peerAccountId }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const pcRef = useRef(null);

  // 1. Listen for incoming calls
  useEffect(() => {
    if (!socket) return;
    socket.on('call:ringing', (call) => { /* show IncomingCallSheet */ });
    socket.on('call:accepted', async (call) => {
      // Caller side: now we create offer, send call:offer
      if (activeCall?.role === 'caller') await sendOffer();
    });
    socket.on('call:offer',  ({ payload, fromAccountId }) => acceptOffer(payload, fromAccountId));
    socket.on('call:answer', ({ payload }) => pcRef.current.setRemoteDescription(payload));
    socket.on('call:ice-candidate', ({ payload }) => pcRef.current.addIceCandidate(payload));
    socket.on('call:ended', () => teardown());
    return () => socket.off('call:ringing'); /* off all */
  }, [socket]);

  async function startCall(conversationId, type) {
    const { iceServers } = await getIceServers();
    const stream = await mediaDevices.getUserMedia({
      audio: true, video: type === 'video',
    });
    setLocalStream(stream);
    const pc = new RTCPeerConnection({ iceServers });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('call:ice-candidate', {
        callId: activeCall.id, toAccountId: activeCall.peerAccountId, payload: e.candidate,
      });
    };
    pcRef.current = pc;
    socket.emit('call:invite', { conversationId, type }, ({ ok, call }) => {
      if (ok) setActiveCall({ id: call.id, type, role: 'caller', status: 'ringing',
                              peerAccountId: call.calleeAccountIds[0] });
    });
  }

  async function sendOffer() {
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socket.emit('call:offer', {
      callId: activeCall.id, toAccountId: activeCall.peerAccountId, payload: offer,
    });
  }

  async function acceptOffer(offer, fromAccountId) { /* mirror logic for callee */ }
  function teardown() { /* close pc, stop tracks, reset state */ }
  function endCall() { socket.emit('call:end', { callId: activeCall.id }); teardown(); }

  return <CallContext.Provider value={{ activeCall, localStream, remoteStream, startCall, endCall }}>
    {children}
  </CallContext.Provider>;
}
```

### 3.5 Hook into the chat screen

`mobile/src/screens/chats/ChatScreen.js` — add two icons in the header:

```jsx
<Header right={
  <>
    <IconButton icon="phone" onPress={() => startCall(conversationId, 'audio')} />
    <IconButton icon="video" onPress={() => startCall(conversationId, 'video')} />
  </>
}/>
```

`mobile/App.js` — wrap the navigation with the new provider:

```jsx
<AccountProvider>
  <SocketProvider>
    <CallProvider>          {/* new */}
      <NavigationContainer>...</NavigationContainer>
    </CallProvider>
  </SocketProvider>
</AccountProvider>
```

---

## 4. Production: TURN server (when you go live)

Self-host **coturn** on a $5 VPS with a public IP (works alongside your
existing API VPS). Quick install on Ubuntu:

```bash
sudo apt install coturn
sudo nano /etc/turnserver.conf       # set listening-port, fingerprint,
                                     # use-auth-secret, static-auth-secret,
                                     # realm
sudo systemctl enable --now coturn
```

In your repo-root `.env`:

```
TURN_URL=turn:turn.your-domain.com:3478?transport=udp
TURN_USER=multiptabwatsap
TURN_PASS=<long-random-string>
```

Restart the API container — `GET /api/calls/ice-servers` will now
include your TURN server. The mobile app fetches that list at the start
of every call so there's no rebuild needed when you change credentials.

For dev / testing without paying: use [Twilio's Network Traversal
Service](https://www.twilio.com/stun-turn) — they give you 5 GB/month of
TURN traffic free. Implement it as a token endpoint that calls Twilio
and returns short-lived TURN credentials — drop-in compatible with the
existing `getIceServers` controller.

---

## 5. Manual smoke test (right now, no mobile app needed)

Even before the mobile UI is built, you can verify the signaling layer:

```powershell
$base = "http://localhost:4000/api"

# 1) Get a phone token (dev bypass)
$phone = (Invoke-RestMethod -Method Post -Uri "$base/auth/dev-login" `
          -ContentType 'application/json' -Body '{"phone":"+15551112233"}').phoneToken

# 2) Create two accounts
$h = @{ Authorization = "Bearer $phone" }
$alice = Invoke-RestMethod -Method Post -Uri "$base/accounts" -Headers $h `
          -ContentType 'application/json' -Body '{"displayName":"Alice","username":"alice"}'
$bob   = Invoke-RestMethod -Method Post -Uri "$base/accounts" -Headers $h `
          -ContentType 'application/json' -Body '{"displayName":"Bob","username":"bob"}'

# 3) ICE servers (no TURN configured — STUN only)
$ha = @{ Authorization = "Bearer $($alice.token)" }
Invoke-RestMethod -Method Get -Uri "$base/calls/ice-servers" -Headers $ha
# { iceServers: [{ urls: ["stun:stun.l.google.com:19302", ...] }] }

# 4) Call history (empty)
Invoke-RestMethod -Method Get -Uri "$base/calls" -Headers $ha
```

Once the mobile side is wired, full end-to-end calls happen between two
real phones running the dev client.

---

## 6. Estimated effort to ship calling end-to-end

| Step | Time |
|---|---|
| Backend signaling (✅ done) | 0 |
| `eas init` + first dev-client build | ~30 min (mostly waiting on EAS) |
| `react-native-webrtc` install + permissions config | 30 min |
| `CallContext` + `IncomingCallSheet` + `CallScreen` | 1 day |
| Polish (ringtone, mute, switch camera, call history UI) | 1 day |
| coturn TURN server setup for production | 1 hour |
| **Total to first call** | **~2 days of mobile work** |

The hard part — distributed signaling, lifecycle, persistence — is
already handled. The remaining work is well-trodden React Native
patterns.

