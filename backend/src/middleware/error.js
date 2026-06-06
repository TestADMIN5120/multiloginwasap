'use strict';

const logger = require('../utils/logger');

// 404 handler
function notFound(req, res, _next) {
  res.status(404).json({ error: 'not_found', path: req.path });
}

// Global error handler
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  logger.error('[http]', err.message, err.stack);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'validation_failed', details: err.errors });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'duplicate', details: err.keyValue });
  }
  return res.status(err.status || 500).json({
    error: err.expose ? err.message : 'internal_error',
  });
}

module.exports = { notFound, errorHandler };

