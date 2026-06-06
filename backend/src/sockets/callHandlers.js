'use strict';

const Conversation = require('../models/Conversation');
const Call = require('../models/Call');
const logger = require('../utils/logger');

// Map of in-progress calls -> auto-miss timer, so a ringing call that's
// never answered transitions to "missed" after 60s.
const ringTimers = new Map();

const RING_TIMEOUT_MS = 60_000;

function clearRingTimer(callId) {
  const t = ringTimers.get(String(callId));
  if (t) {
    clearTimeout(t);
    ringTimers.delete(String(callId));
  }
}

function emitToAccounts(io, accountIds, event, payload) {
  for (const id of accountIds) {
    io.to(`account:${String(id)}`).emit(event, payload);
  }
}

function serializeCall(call) {
  return {
    id: String(call._id),
    conversationId: String(call.conversationId),
    callerAccountId: String(call.callerAccountId),
    calleeAccountIds: (call.calleeAccountIds || []).map(String),
    type: call.type,
    status: call.status,
    startedAt: call.startedAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    endedReason: call.endedReason,
    createdAt: call.createdAt,
  };
}

/**
 * Register all call-signaling socket events on a connected socket.
 * Called from sockets/handlers.js#register so it shares the same
 * authenticated socket.data.accountId.
 */
function register(io, socket) {
  const accountId = socket.data.accountId;

  // ------------------------------------------------------------------
  // Caller starts a call
  // ------------------------------------------------------------------
  socket.on('call:invite', async ({ conversationId, type } = {}, ack) => {
    try {
      if (!conversationId || !['audio', 'video'].includes(type)) {
        return ack && ack({ ok: false, error: 'bad_request' });
      }
      const conv = await Conversation.findOne({ _id: conversationId, members: accountId });
      if (!conv) return ack && ack({ ok: false, error: 'forbidden' });

      const callees = conv.members.filter((m) => String(m) !== String(accountId));
      if (callees.length === 0) return ack && ack({ ok: false, error: 'no_callees' });

      const call = await Call.create({
        conversationId: conv._id,
        callerAccountId: accountId,
        calleeAccountIds: callees,
        type,
        status: 'ringing',
        startedAt: new Date(),
      });

      // Auto-transition to "missed" after RING_TIMEOUT_MS if nobody picks up
      const timer = setTimeout(async () => {
        try {
          const fresh = await Call.findById(call._id);
          if (fresh && fresh.status === 'ringing') {
            fresh.status = 'missed';
            fresh.endedAt = new Date();
            fresh.endedReason = 'missed';
            await fresh.save();
            emitToAccounts(io, [fresh.callerAccountId, ...fresh.calleeAccountIds],
              'call:ended', serializeCall(fresh));
          }
        } catch (e) { logger.error('[call] auto-miss', e.message); }
        ringTimers.delete(String(call._id));
      }, RING_TIMEOUT_MS);
      ringTimers.set(String(call._id), timer);

      // Ring everyone
      emitToAccounts(io, [call.callerAccountId, ...call.calleeAccountIds],
        'call:ringing', serializeCall(call));

      if (ack) ack({ ok: true, call: serializeCall(call) });
    } catch (err) {
      logger.error('[call] invite', err.message);
      if (ack) ack({ ok: false, error: 'internal_error' });
    }
  });

  // ------------------------------------------------------------------
  // Callee accepts
  // ------------------------------------------------------------------
  socket.on('call:accept', async ({ callId } = {}, ack) => {
    try {
      const call = await Call.findById(callId);
      if (!call) return ack && ack({ ok: false, error: 'not_found' });
      if (!call.calleeAccountIds.map(String).includes(String(accountId))) {
        return ack && ack({ ok: false, error: 'forbidden' });
      }
      if (call.status !== 'ringing') {
        return ack && ack({ ok: false, error: 'invalid_state', status: call.status });
      }

      call.status = 'accepted';
      call.answeredAt = new Date();
      await call.save();
      clearRingTimer(call._id);

      emitToAccounts(io, [call.callerAccountId, ...call.calleeAccountIds],
        'call:accepted', serializeCall(call));

      if (ack) ack({ ok: true, call: serializeCall(call) });
    } catch (err) {
      logger.error('[call] accept', err.message);
      if (ack) ack({ ok: false, error: 'internal_error' });
    }
  });

  // ------------------------------------------------------------------
  // Callee declines
  // ------------------------------------------------------------------
  socket.on('call:decline', async ({ callId } = {}, ack) => {
    try {
      const call = await Call.findById(callId);
      if (!call) return ack && ack({ ok: false, error: 'not_found' });
      if (!call.calleeAccountIds.map(String).includes(String(accountId))) {
        return ack && ack({ ok: false, error: 'forbidden' });
      }
      if (call.status !== 'ringing') {
        return ack && ack({ ok: false, error: 'invalid_state' });
      }

      call.status = 'declined';
      call.endedAt = new Date();
      call.endedReason = 'declined';
      await call.save();
      clearRingTimer(call._id);

      emitToAccounts(io, [call.callerAccountId, ...call.calleeAccountIds],
        'call:ended', serializeCall(call));

      if (ack) ack({ ok: true });
    } catch (err) {
      logger.error('[call] decline', err.message);
      if (ack) ack({ ok: false, error: 'internal_error' });
    }
  });

  // ------------------------------------------------------------------
  // Caller cancels before pickup
  // ------------------------------------------------------------------
  socket.on('call:cancel', async ({ callId } = {}, ack) => {
    try {
      const call = await Call.findById(callId);
      if (!call) return ack && ack({ ok: false, error: 'not_found' });
      if (String(call.callerAccountId) !== String(accountId)) {
        return ack && ack({ ok: false, error: 'forbidden' });
      }
      if (call.status !== 'ringing') {
        return ack && ack({ ok: false, error: 'invalid_state' });
      }

      call.status = 'cancelled';
      call.endedAt = new Date();
      call.endedReason = 'cancelled';
      await call.save();
      clearRingTimer(call._id);

      emitToAccounts(io, [call.callerAccountId, ...call.calleeAccountIds],
        'call:ended', serializeCall(call));

      if (ack) ack({ ok: true });
    } catch (err) {
      logger.error('[call] cancel', err.message);
      if (ack) ack({ ok: false, error: 'internal_error' });
    }
  });

  // ------------------------------------------------------------------
  // Either side ends an active call
  // ------------------------------------------------------------------
  socket.on('call:end', async ({ callId } = {}, ack) => {
    try {
      const call = await Call.findById(callId);
      if (!call) return ack && ack({ ok: false, error: 'not_found' });
      const participants = [String(call.callerAccountId), ...call.calleeAccountIds.map(String)];
      if (!participants.includes(String(accountId))) {
        return ack && ack({ ok: false, error: 'forbidden' });
      }
      if (!['ringing', 'accepted'].includes(call.status)) {
        return ack && ack({ ok: false, error: 'invalid_state' });
      }

      call.status = 'ended';
      call.endedAt = new Date();
      call.endedReason = 'hangup';
      await call.save();
      clearRingTimer(call._id);

      emitToAccounts(io, [call.callerAccountId, ...call.calleeAccountIds],
        'call:ended', serializeCall(call));

      if (ack) ack({ ok: true });
    } catch (err) {
      logger.error('[call] end', err.message);
      if (ack) ack({ ok: false, error: 'internal_error' });
    }
  });

  // ------------------------------------------------------------------
  // WebRTC SDP / ICE relay — pure pass-through, server doesn't peek
  // inside the SDP. We just route to the right account room.
  // ------------------------------------------------------------------
  for (const event of ['call:offer', 'call:answer', 'call:ice-candidate']) {
    socket.on(event, ({ callId, toAccountId, payload } = {}) => {
      if (!callId || !toAccountId || !payload) return;
      io.to(`account:${toAccountId}`).emit(event, {
        callId,
        fromAccountId: String(accountId),
        payload,
      });
    });
  }
}

module.exports = { register, serializeCall };

