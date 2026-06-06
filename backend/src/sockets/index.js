'use strict';

const { Server } = require('socket.io');
const tokenService = require('../services/token.service');
const handlers = require('./handlers');
const env = require('../config/env');
const logger = require('../utils/logger');

function attach(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: false },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Auth middleware: client must pass the active account JWT in handshake
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (!token) return next(new Error('missing_token'));
    try {
      const payload = tokenService.verifyToken(token);
      if (payload.scope !== 'account') return next(new Error('wrong_scope'));
      socket.data.accountId = payload.accountId;
      socket.data.phoneId = payload.phoneId;
      return next();
    } catch (err) {
      return next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug(`[socket] connection account=${socket.data.accountId}`);
    handlers.register(io, socket);
  });

  return io;
}

module.exports = { attach };

