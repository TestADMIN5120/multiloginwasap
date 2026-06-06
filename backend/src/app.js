'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Static media
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR), { maxAge: '7d' }));

  // Friendly root — so hitting http://host:4000/ in a browser gives useful info
  // instead of a bare 404. The actual API lives under /api/*.
  app.get('/', (_req, res) => {
    res.json({
      service: 'multiptabwatsap-api',
      version: '1.0.0',
      ok: true,
      message: 'API is running. All endpoints live under /api/*.',
      docs: {
        health: '/api/health',
        auth: ['POST /api/auth/otp/request', 'POST /api/auth/otp/verify'],
        accounts: [
          'GET  /api/accounts          (phone token)',
          'POST /api/accounts          (phone token)',
          'POST /api/accounts/:id/login (phone token)',
          'DELETE /api/accounts/:id    (account token)',
        ],
        users: ['GET /api/users/me', 'PATCH /api/users/me', 'GET /api/users/search?q='],
        conversations: [
          'GET  /api/conversations',
          'POST /api/conversations',
          'GET  /api/conversations/:id',
          'GET  /api/conversations/:id/messages',
          'POST /api/conversations/:id/messages',
          'POST /api/messages/:id/read',
        ],
        uploads: 'POST /api/uploads (multipart/form-data, field "file")',
        calls: [
          'GET /api/calls               (account token) — call history',
          'GET /api/calls/ice-servers   (account token) — STUN/TURN config',
          'GET /api/calls/:id           (account token) — single call',
        ],
        socketio: {
          handshake: 'Pass account JWT via auth.token',
          chat: ['conversation:join', 'message:send', 'message:read', 'typing'],
          calls: [
            'call:invite {conversationId, type:audio|video} -> ack {call}',
            'call:accept {callId} | call:decline {callId} | call:cancel {callId} | call:end {callId}',
            'call:offer / call:answer / call:ice-candidate {callId, toAccountId, payload} (WebRTC SDP relay)',
            'server emits: call:ringing, call:accepted, call:ended, call:offer, call:answer, call:ice-candidate',
          ],
        },
      },
    });
  });

  // API
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

