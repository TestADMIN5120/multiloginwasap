'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Two scopes of token:
 *   scope = 'phone'   ─ short-lived, granted after OTP. Lets you list/create accounts.
 *   scope = 'account' ─ long-lived, used for all messaging APIs and the Socket.io handshake.
 */

function signPhoneToken(phoneId) {
  return jwt.sign({ scope: 'phone', phoneId: String(phoneId) }, env.JWT_SECRET, {
    expiresIn: env.JWT_PHONE_TTL,
  });
}

function signAccountToken({ accountId, phoneId }) {
  return jwt.sign(
    { scope: 'account', accountId: String(accountId), phoneId: String(phoneId) },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCOUNT_TTL }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signPhoneToken, signAccountToken, verifyToken };

