# Architecture

## Data Model

```
Phone (1) ────< (N) Account
                    │
                    │ member
                    ▼
              Conversation (N) ────< (N) Message
```

- **Phone** — a verified phone number. Holds a list of `accountIds`.
- **Account** — an individual identity (`displayName`, `username`, `avatar`). Belongs to one Phone. A phone can have many.
- **Conversation** — DM (`members.length === 2`) or group (`members.length > 2`). Members are `Account` ids.
- **Message** — belongs to a conversation; `senderAccountId` identifies which identity sent it.

## Auth Flow

```
[Phone screen] ── POST /auth/otp/request ──▶ Otp.create(hash, ttl)
                                              (dev: returns code in JSON)

[OTP screen]  ── POST /auth/otp/verify ───▶ verifies, upserts Phone,
                                            returns:
                                              phoneSessionToken (scope=phone, 30m)
                                              existingAccounts: [...]

(branch A — pick existing account)
[Switcher]    ── POST /accounts/:id/login ─▶ accountToken (scope=account, 30d)
                                            stored in AsyncStorage

(branch B — create new account)
[CreateAccount] ─ POST /accounts ─────────▶ creates Account + accountToken
```

## Multi-Account Runtime (Mobile)

```
AsyncStorage:
  accounts: [
    { id, phone, displayName, token },  ← account 1
    { id, phone, displayName, token },  ← account 2
    ...
  ]
  activeId

AccountContext.activeAccount  ←─ derived from activeId
        │
        ├─▶ Axios interceptor injects activeAccount.token
        └─▶ SocketContext opens io(SOCKET_URL, { auth: { token: activeAccount.token } })
                  │
                  └─ on switchTo(newId): socket.disconnect() → reopen with new token
```

## Socket.io Rooms

On connect (after JWT handshake), the server joins the socket to `account:<accountId>`.
When a message is created in `services/message.service.js`, it emits `message:new` to every member's `account:<id>` room — so all of a user's devices and *every other member's installs* receive the event in real time.

## Why this design supports "multiple WhatsApp on one phone"

1. The server treats each `Account` as a fully independent user — its own JWT, its own conversations, its own socket room. The phone number is just metadata.
2. The client never has to "log out" to switch — it simply changes which token it sends. Both sockets and HTTP follow the active account.
3. Adding account N+1 only requires re-verifying a phone (same or new) — there is no per-device limit.

