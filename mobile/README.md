# MultiTabWatsap — Mobile

React Native + Expo client with **multiple-account** support on a single install.

## Setup
```powershell
copy .env.example .env
# Edit .env: set API_URL/SOCKET_URL to your dev machine's LAN IP
npm install
npm run start
```
Then scan the QR code with the **Expo Go** app, or press `a`/`i` for emulator.

## How accounts work
- Sign in with phone + OTP → create your first identity (display name + username).
- Open the drawer (☰) → "Add account" → re-verify a phone (same or different) → make a second identity.
- Tap any account in the drawer to switch instantly. The chat list, messages, and socket reconnect for that account.
- Each account stores its own JWT in AsyncStorage; nothing persists in memory between switches.

## Files
- `src/storage/accountStorage.js` — multi-account AsyncStorage CRUD
- `src/context/AccountContext.js` — active-account state machine
- `src/context/SocketContext.js` — Socket.io reconnect on account switch
- `src/api/client.js` — Axios with active-token interceptor
- `src/api/upload.api.js` — multipart upload helper (image attachments)
- `src/utils/media.js` — relative→absolute media URL resolver
- `src/screens/auth/*` — phone → otp → create account flow
- `src/components/AccountSwitcherTabs.js` — switcher pill bar at the top of the chat list

## Sending images
Tap the **📎** button in any chat input to pick a photo from the device library.
The mobile app uploads it to the backend (`POST /api/uploads`) and then sends a
message of `type: 'image'` referencing the returned URL. The receiver's
`MessageBubble` renders the image inline (tap to open full-size in the OS
viewer). Permissions are requested on first use.

