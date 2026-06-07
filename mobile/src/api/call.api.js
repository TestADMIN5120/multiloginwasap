// mobile/src/api/call.api.js
// ---------------------------------------------------------------------------
// REST endpoints exposed by backend/src/routes/call.routes.js
//
//   GET /api/calls                  -> list call history (newest first)
//   GET /api/calls/ice-servers      -> { iceServers: [...] } for RTCPeerConnection
//   GET /api/calls/:id              -> single call detail
// ---------------------------------------------------------------------------

import api from './client';

export async function listCalls({ limit = 50, before } = {}) {
  const params = { limit };
  if (before) params.before = before;
  const { data } = await api.get('/calls', { params });
  return data?.calls || [];
}

export async function getCall(callId) {
  const { data } = await api.get(`/calls/${callId}`);
  return data?.call || data;
}

export async function getIceServers() {
  const { data } = await api.get('/calls/ice-servers');
  // backend returns { iceServers: [...] }; default to STUN if missing
  return (
    data?.iceServers || [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ]
  );
}

