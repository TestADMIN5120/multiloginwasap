'use strict';

const path = require('path');

function uploadHandler(req, res) {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const url = `/uploads/${path.basename(req.file.path)}`;
  return res.status(201).json({
    url,
    filename: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
}

module.exports = { uploadHandler };

