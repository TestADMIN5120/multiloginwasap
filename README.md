# MultiTabWatsap — Multi-Account WhatsApp-like Messenger

A full-stack, deployable messenger that lets a **single phone number host multiple identities** and a **single mobile install switch between many accounts** — like having multiple WhatsApp accounts on one device, no clones required.

```
┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────┐
│  React Native (Expo) │  HTTPS  │  Express + Socket.io │  TCP    │   MongoDB    │
│  multi-token store   │ ──────▶ │  JWT-per-account     │ ──────▶ │  users/msgs  │
│  account switcher    │  WSS    │  account:<id> rooms  │         │              │
└──────────────────────┘         └──────────────────────┘         └──────────────┘
```

## Features

- 📱 Phone + OTP signup (mock provider in dev, Twilio-ready)
- 👥 **Multiple accounts per phone number** — one SIM, many identities
- 🔀 **Account switcher** in the mobile app — single install, many logins
- 💬 Real-time 1-1 and group chats over Socket.io
- 🖼️ Media uploads (images / files)
- 🔐 JWT auth, isolated per account
- 🐳 One-command Docker deployment

## Repo Layout

```
multiptabwatsap/
├── backend/        # Node.js + Express + Mongo + Socket.io
├── mobile/         # React Native (Expo) app
├── docs/           # Architecture & API notes
├── docker-compose.yml
└── README.md
```

## Quick Start (Docker — full backend + DB)

Requires Docker Desktop.

```powershell
# from repo root
Copy-Item .env.example .env
docker compose up --build -d
```

This starts:
- MongoDB on `localhost:27017`
- API on `http://localhost:4000` (health at `/api/health`)

Verify the multi-account feature end-to-end:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

📖 **Full deployment guide (local + production VPS + HTTPS):** [docs/deploy-docker.md](docs/deploy-docker.md)

🛠 **Dev startup runbook (Cloudflare Tunnel + Expo Go on a real phone, works on any network):** [docs/dev-startup.md](docs/dev-startup.md)

⚡ **One-page dev runbook with the `dev-up.ps1` / `dev-down.ps1` scripts (recommended for daily use, includes the "after Windows reboot" fix):** [docs/DEV-RUNBOOK.md](docs/DEV-RUNBOOK.md)

📞 **Audio / video calling — architecture, backend (already implemented), and mobile-side roadmap:** [docs/calls.md](docs/calls.md)

In dev mode the OTP code is returned in the JSON response of `POST /api/auth/otp/request` so you don't need an SMS gateway.
You can also flip `OTP_DEV_BYPASS=true` (repo-root `.env`) + `DEV_SKIP_OTP=true` (`mobile/.env`) to skip the OTP screen entirely while testing — the mobile app will sign in straight from the phone-number screen via `POST /api/auth/dev-login`.

## Quick Start (manual — for development)

### Backend
```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```
> Requires a running MongoDB. Either start one with Docker (`docker run -d -p 27017:27017 mongo:7`) or install locally.

### Mobile (Expo)
```powershell
cd mobile
copy .env.example .env
# edit .env to point API_URL/SOCKET_URL at your machine's LAN IP, e.g. http://192.168.1.10:4000
npm install
npm run start
```
Scan the QR code with the **Expo Go** app on your phone, or press `a` for Android emulator / `i` for iOS simulator.

📱 **Full mobile install guide** (Expo Go, Android emulator, real APK build): [docs/install-mobile-app.md](docs/install-mobile-app.md)

Even faster — let the launcher script do everything (LAN IP detection, .env wiring, firewall rules, Expo start):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\open-app.ps1
```

## How Multi-Account Works

1. **One verified phone → many accounts.** After OTP verification you receive a short-lived *phone session token*. With it you can create one or more `Account` rows under that phone (different `displayName` / `username`). Each account gets its own permanent JWT.
2. **Mobile keeps every JWT locally.** `AsyncStorage` stores `{ accounts: [{id, phone, name, token}], activeId }`. The Axios + Socket.io clients always read whichever account is "active".
3. **Switching is instant.** Tapping a different account in the drawer/tabs updates `activeId`, tears down the old socket, and re-opens a new one with that account's JWT. The chat list and messages re-render for the new identity. No re-login.
4. **Add another account anytime.** From Settings → Accounts → "Add account" you re-verify a phone (same or different number) and create a new identity, all without removing existing ones.

## API Summary

Base URL: `http://<host>:4000/api`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/otp/request` | none | Send OTP to phone (returns code in dev) |
| POST | `/auth/otp/verify` | none | Verify OTP, returns phone session token + existing accounts |
| POST | `/accounts` | phone | Create a new account/identity |
| GET | `/accounts` | phone | List accounts for the verified phone |
| POST | `/accounts/:id/login` | phone | Issue per-account JWT |
| DELETE | `/accounts/:id` | account | Sign out / delete this account |
| GET | `/users/me` | account | Current account profile |
| PATCH | `/users/me` | account | Update profile |
| GET | `/users/search?q=` | account | Find users by username/phone |
| GET | `/conversations` | account | List my conversations |
| POST | `/conversations` | account | Create DM or group |
| GET | `/conversations/:id/messages` | account | Paginated messages |
| POST | `/conversations/:id/messages` | account | Send message |
| POST | `/messages/:id/read` | account | Mark read |
| POST | `/uploads` | account | Upload media (multipart `file`) |

Socket.io events (auth via `auth.token` handshake):
- `conversation:join` `{ conversationId }`
- `message:send` `{ conversationId, type, text, mediaUrl }`
- `message:new` (broadcast)
- `typing` `{ conversationId, isTyping }`
- `message:read` `{ messageId }`

## Production Notes

- Replace dev OTP with Twilio: implement a real `sendSms()` in `backend/src/services/otp.service.js` and set `OTP_DEV_RETURN=false`.
- Put the API behind HTTPS (e.g. nginx + Let's Encrypt) and use `wss://` for Socket.io.
- Rotate `JWT_SECRET`, harden `CORS_ORIGIN`.
- Swap local `uploads/` for S3/MinIO if needed.
- Set up MongoDB auth + persistent volume backups.

## License

MIT — use freely, ship it.

