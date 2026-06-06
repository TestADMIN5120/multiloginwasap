# Docker Deployment Guide

This guide takes you from zero to a running, healthy backend in ~2 minutes, then explains how to host it on a real server.

---

## Prerequisites

- Docker Desktop **20.10+** (Windows/macOS) or Docker Engine + Compose plugin (Linux)
  ```powershell
  docker --version          # → Docker version 20.x or higher
  docker compose version    # → Docker Compose version v2.x or higher
  ```
- ~500 MB free disk for the Mongo image, ~200 MB for the API image
- Ports `4000` (API) and `27017` (Mongo) free on your host

---

## 1. Local one-command deploy

From the repo root:

```powershell
cd C:\Users\Public\multiptabwatsap

# (first run only) create your .env from the template
Copy-Item .env.example .env

# generate a strong JWT secret and write it into .env
$secret = -join ((48..57) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
(Get-Content .env) -replace 'JWT_SECRET=.*',"JWT_SECRET=$secret" | Set-Content .env -Encoding utf8

# build images and start the stack in the background
docker compose up --build -d
```

Verify:

```powershell
docker compose ps
# Both services should report STATUS = "Up ... (healthy)"

curl.exe http://localhost:4000/api/health
# {"ok":true,"service":"multiptabwatsap-api"}
```

Watch live logs:

```powershell
docker compose logs -f api
```

Stop / start / wipe:

```powershell
docker compose stop                # pause
docker compose start               # resume
docker compose down                # remove containers, keep data
docker compose down -v             # remove containers AND volumes (drops Mongo data)
```

---

## 2. Verify the multi-account feature is live

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
```

You'll see:

```
=== 1. Health ===                   {"ok":true,"service":"multiptabwatsap-api"}
=== 2. Request OTP ===              {"ok":true,"phone":"+15551112233","devCode":"123456",...}
=== 3. Verify OTP -> phone token === phoneToken (first 20 chars): eyJhbGciOiJIUzI1NiIs...
=== 4. Create FIRST identity ===    account 1: id=...  username=@alice_...
=== 5. Create SECOND identity ===   account 2: id=...  username=@alice_...
=== 6. List all identities ===      Total identities under +15551112233: 2
=== 7. Send a message ===           Account 2 received: 'Hello from Alice One to Alice Two!'
[OK] SUCCESS - one phone number, two accounts, both messaging in real time.
```

This actually proves end-to-end that:
- one phone number hosts multiple identities,
- each identity has its own JWT,
- messaging between identities works.

---

## 3. Point the mobile app at your Docker API

Edit `mobile/.env`:

```
API_URL=http://<your-LAN-IP>:4000
SOCKET_URL=http://<your-LAN-IP>:4000
```

Find your LAN IP:

```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' -or $_.PrefixOrigin -eq 'Manual' }).IPAddress
```

Then `cd mobile; npm install; npm run start` and scan the QR with **Expo Go**. Your phone must be on the same Wi-Fi as your dev machine.

> ⚠️ Don't use `localhost` or `127.0.0.1` here — that points the phone at *itself*, not your laptop. Always use the laptop's LAN IP.

---

## 4. Deploy to a real server (Linux VPS)

A $5/month VPS (DigitalOcean droplet, Hetzner, Linode…) is plenty for thousands of users. The steps:

### 4.1 Provision the host
- Ubuntu 22.04 LTS or newer
- Open inbound ports **80**, **443**, **22**. **Do not** open 4000 or 27017.
- Install Docker Engine + Compose plugin:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER && newgrp docker
  ```

### 4.2 Push the repo
- `git clone` the repo onto the server, OR `scp -r multiptabwatsap` from your laptop.

### 4.3 Configure production env
On the server, in the repo root:

```bash
cp .env.example .env
nano .env
```

Set:
```
JWT_SECRET=<run: openssl rand -hex 48>
OTP_DEV_RETURN=false                # IMPORTANT: stop returning OTPs in API responses
CORS_ORIGIN=https://your.app.domain  # restrict to your frontend
```

### 4.4 Tighten the compose file for prod
Edit `docker-compose.yml` and **comment out the Mongo `ports:` block** so port 27017 is only reachable inside the docker network:

```yaml
  mongo:
    # ports:
    #   - "27017:27017"
```

### 4.5 Bring it up
```bash
docker compose up --build -d
docker compose ps     # both healthy
curl http://localhost:4000/api/health
```

### 4.6 Front with HTTPS (nginx + Let's Encrypt)
The API speaks plain HTTP on port 4000; in production you want a TLS-terminating reverse proxy in front of it. The lightest path is **caddy**, which auto-fetches and renews certificates. Add to `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [api]
    networks: [mtw]
```

And create `Caddyfile`:
```
api.your.app.domain {
  reverse_proxy api:4000
}
```

Add `caddy_data:` and `caddy_config:` to the `volumes:` section, point your domain's A record at the server IP, then `docker compose up -d caddy`. Done — auto-HTTPS at `https://api.your.app.domain`, including `wss://` for Socket.io.

In the mobile app, set `API_URL=https://api.your.app.domain` and `SOCKET_URL=https://api.your.app.domain`.

---

## 5. Common operations

| Task | Command |
| --- | --- |
| View running containers | `docker compose ps` |
| Tail API logs | `docker compose logs -f api` |
| Tail Mongo logs | `docker compose logs -f mongo` |
| Restart only the API (after pulling code) | `docker compose up --build -d api` |
| Open a Mongo shell | `docker exec -it multiptabwatsap-mongo mongosh multiptabwatsap` |
| Open a shell inside the API | `docker exec -it multiptabwatsap-api sh` |
| Backup Mongo data | `docker exec multiptabwatsap-mongo mongodump --archive | gzip > backup-$(date +%F).gz` |
| Restore Mongo data | `gunzip < backup.gz | docker exec -i multiptabwatsap-mongo mongorestore --archive` |
| Update the image to latest code | `git pull && docker compose up --build -d api` |

---

## 6. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Cannot connect to the Docker daemon` | Docker Desktop is not running. Start it. |
| `port is already allocated` on `:4000` | Something else is on 4000 — `Stop-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess`, or change the host-side port in `docker-compose.yml` to e.g. `"5000:4000"`. |
| API container `unhealthy` | `docker compose logs api` — most often Mongo not yet ready. The `depends_on: condition: service_healthy` should prevent this; if it persists, increase Mongo's `start_period` in compose. |
| Mobile app says "Network error" | You used `localhost` in `mobile/.env`. Use your LAN IP, and make sure your firewall lets the phone reach port 4000. |
| OTP code not arriving in API response | You set `OTP_DEV_RETURN=false`. In dev set it back to `true`; in prod wire a real SMS provider (see `backend/src/services/otp.service.js`). |
| `JWT_SECRET=change-me-in-prod-please` warning | Your `.env` was not loaded. Make sure the file is named exactly `.env`, lives in the same directory as `docker-compose.yml`, and you've run `docker compose up` (compose auto-loads it). |

---

## 7. What was deployed (recap)

```
┌────────────────────────────────────────────────────────┐
│ docker network: multiptabwatsap_mtw                    │
│                                                        │
│   ┌─────────────────────────┐  ┌────────────────────┐  │
│   │ multiptabwatsap-api     │  │ multiptabwatsap-   │  │
│   │   node:20-alpine + tini │  │   mongo (mongo:7)  │  │
│   │   non-root user         │  │                    │  │
│   │   HEALTHCHECK -> /api/  │──│ healthcheck:ping   │  │
│   │     health (15s)        │  │                    │  │
│   │   :4000 ──► host :4000  │  │ :27017 ──► host    │  │
│   └─────────────────────────┘  └────────────────────┘  │
│           │                              │             │
│           └──── api_uploads ─┐    ┌── mongo_data       │
│                              ▼    ▼                    │
│                          (named docker volumes)        │
└────────────────────────────────────────────────────────┘
```

You verified in this conversation:
- Both containers started and reported healthy
- `/api/health` returned `{"ok":true,...}`
- Two accounts were created under one phone, and they exchanged a message — which is exactly the feature the project was built for.

