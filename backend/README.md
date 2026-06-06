# MultiTabWatsap — Backend

Node.js + Express + MongoDB + Socket.io.

## Run locally
```powershell
copy .env.example .env
npm install
npm run dev
```
Health check: `curl http://localhost:4000/api/health`

## Run via Docker (with MongoDB)
From the **repo root**:
```powershell
docker compose up --build
```

## Smoke-test the OTP/account flow with curl
```powershell
$base = "http://localhost:4000/api"

# 1) Request OTP (dev mode returns the code in the body)
$otp = (Invoke-RestMethod -Method Post -Uri "$base/auth/otp/request" -ContentType 'application/json' -Body '{"phone":"+15551234567"}')
$otp

# 2) Verify it
$verify = Invoke-RestMethod -Method Post -Uri "$base/auth/otp/verify" -ContentType 'application/json' -Body (@{ phone="+15551234567"; code=$otp.devCode } | ConvertTo-Json)
$phoneToken = $verify.phoneToken

# 3) Create first identity
$h = @{ Authorization = "Bearer $phoneToken" }
$acc1 = Invoke-RestMethod -Method Post -Uri "$base/accounts" -Headers $h -ContentType 'application/json' -Body '{"displayName":"Alice One","username":"alice1"}'

# 4) Create second identity on the SAME phone -> two accounts on one number
$acc2 = Invoke-RestMethod -Method Post -Uri "$base/accounts" -Headers $h -ContentType 'application/json' -Body '{"displayName":"Alice Two","username":"alice2"}'

# 5) Confirm — list identities
Invoke-RestMethod -Method Get -Uri "$base/accounts" -Headers $h
```

You'll see two distinct accounts under one phone number, each with its own JWT — exactly what the mobile app uses to switch identities on a single install.

## Structure
```
src/
├── server.js              # bootstraps http + io + db
├── app.js                 # express + middleware + routes mounting
├── config/                # env, db, (sockets created in /sockets)
├── models/                # Phone, Account, Otp, Conversation, Message
├── services/              # otp, token, message
├── middleware/            # auth (jwt scopes), upload (multer), error
├── controllers/           # one per resource
├── routes/                # one per resource + index
├── sockets/               # io setup + event handlers
└── utils/                 # logger, validators
```

## Production checklist
- [ ] Set strong `JWT_SECRET`
- [ ] Set `OTP_DEV_RETURN=false` and wire a real SMS provider in `services/otp.service.js`
- [ ] Restrict `CORS_ORIGIN` to your app domain(s)
- [ ] Front with HTTPS (e.g. nginx + Let's Encrypt) and use `wss://` for Socket.io
- [ ] Persist Mongo data via a real volume / managed cluster
- [ ] Add request rate-limiting (e.g. `express-rate-limit`) per phone for OTP

