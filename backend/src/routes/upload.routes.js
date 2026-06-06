'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadHandler } = require('../controllers/upload.controller');

router.post('/', requireAuth('account'), upload.single('file'), uploadHandler);

module.exports = router;

