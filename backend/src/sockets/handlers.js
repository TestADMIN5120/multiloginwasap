'use strict';

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const messageService = require('../services/message.service');
const callHandlers = require('./callHandlers');
const logger = require('../utils/logger');

function register(io, socket) {
  const accountId = socket.data.accountId;

  // Each connection joins its account room — all installs for the same account
  // (and the listening "other side" of each conversation) receive events here.
  socket.join(`account:${accountId}`);

  // Audio / video call signaling lives in its own module to keep this file
  // focused on chat. Same auth scope (account JWT) — registered on the
  // already-authenticated socket.
  callHandlers.register(io, socket);

  socket.on('conversation:join', async ({ conversationId } = {}) => {
    if (!conversationId) return;
    const conv = await Conversation.findOne({ _id: conversationId, members: accountId });
    if (!conv) return socket.emit('error', { code: 'forbidden' });
    socket.join(`conv:${conversationId}`);
  });

  socket.on('conversation:leave', ({ conversationId } = {}) => {
    if (conversationId) socket.leave(`conv:${conversationId}`);
  });

  socket.on('message:send', async (payload = {}, ack) => {
    try {
      const { conversationId, type = 'text', text = '', mediaUrl = null, mediaName = null } = payload;
      const conv = await Conversation.findOne({ _id: conversationId, members: accountId });
      if (!conv) {
        if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
        return;
      }
      if (type === 'text' && !String(text || '').trim()) {
        if (typeof ack === 'function') ack({ ok: false, error: 'empty_message' });
        return;
      }

      const message = await messageService.persistMessage({
        conversationId: conv._id,
        senderAccountId: accountId,
        type,
        text: String(text || '').slice(0, 4000),
        mediaUrl,
        mediaName,
      });

      messageService.broadcastNewMessage(io, conv, message);

      if (typeof ack === 'function') {
        ack({ ok: true, message: messageService.serializeMessage(message) });
      }
    } catch (err) {
      logger.error('[socket] message:send', err.message);
      if (typeof ack === 'function') ack({ ok: false, error: 'internal_error' });
    }
  });

  socket.on('typing', ({ conversationId, isTyping } = {}) => {
    if (!conversationId) return;
    socket.to(`conv:${conversationId}`).emit('typing', {
      conversationId,
      accountId,
      isTyping: !!isTyping,
    });
  });

  socket.on('message:read', async ({ messageId } = {}) => {
    try {
      const m = await Message.findById(messageId);
      if (!m) return;
      const conv = await Conversation.findOne({ _id: m.conversationId, members: accountId });
      if (!conv) return;
      if (!m.readBy.map(String).includes(String(accountId))) {
        m.readBy.push(accountId);
        await m.save();
      }
      // Notify everyone in the conversation
      for (const memberId of conv.members) {
        io.to(`account:${memberId.toString()}`).emit('message:read', {
          messageId: String(m._id),
          conversationId: String(conv._id),
          accountId: String(accountId),
        });
      }
    } catch (err) {
      logger.error('[socket] message:read', err.message);
    }
  });

  socket.on('disconnect', () => {
    logger.debug(`[socket] disconnect account=${accountId}`);
  });
}

module.exports = { register };

