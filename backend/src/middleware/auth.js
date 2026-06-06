'use strict';

const { verifyToken } = require('../services/token.service');

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

/**
 * Requires a valid JWT.
 * @param {'phone'|'account'|'any'} requiredScope
 */
function requireAuth(requiredScope = 'account') {
  return function authMiddleware(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'missing_token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    if (requiredScope !== 'any' && payload.scope !== requiredScope) {
      return res.status(403).json({ error: 'wrong_scope', expected: requiredScope });
    }

    req.auth = payload;
    return next();
  };
}

module.exports = { requireAuth, extractToken };

