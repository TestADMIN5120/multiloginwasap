'use strict';

const Call = require('../models/Call');
const env = require('../config/env');

/**
 * GET /api/calls
 * Returns this account's call history, newest first.
 * Query: ?limit=50&before=<iso-date>
 */
async function listCalls(req, res, next) {
  try {
    const accountId = req.auth.accountId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    const filter = {
      $or: [
        { callerAccountId: accountId },
        { calleeAccountIds: accountId },
      ],
    };
    if (before && !isNaN(before.getTime())) filter.createdAt = { $lt: before };

    const calls = await Call.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ calls });
  } catch (err) { next(err); }
}

/**
 * GET /api/calls/ice-servers
 * Returns the list of STUN/TURN servers the WebRTC client should use.
 * Public Google STUN by default; if TURN_URL/TURN_USER/TURN_PASS env
 * vars are set, a TURN server is added (recommended for production —
 * roughly 10-20% of users are behind NAT that requires relaying).
 */
async function getIceServers(req, res) {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  if (env.TURN_URL) {
    servers.push({
      urls: env.TURN_URL,
      username: env.TURN_USER || undefined,
      credential: env.TURN_PASS || undefined,
    });
  }
  res.json({ iceServers: servers });
}

/**
 * GET /api/calls/:id
 * Single call detail. Useful when the mobile app receives a `call:ringing`
 * event after a relaunch and wants to confirm the call is still alive.
 */
async function getCall(req, res, next) {
  try {
    const accountId = String(req.auth.accountId);
    const call = await Call.findById(req.params.id);
    if (!call) return res.status(404).json({ error: 'not_found' });
    const participants = [String(call.callerAccountId), ...call.calleeAccountIds.map(String)];
    if (!participants.includes(accountId)) return res.status(403).json({ error: 'forbidden' });
    res.json({ call });
  } catch (err) { next(err); }
}

module.exports = { listCalls, getIceServers, getCall };

