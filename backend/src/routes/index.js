'use strict';

const router = require('express').Router();

router.get('/health', (_req, res) => res.json({ ok: true, service: 'multiptabwatsap-api' }));

router.use('/auth', require('./auth.routes'));
router.use('/accounts', require('./account.routes'));
router.use('/users', require('./user.routes'));
router.use('/conversations', require('./conversation.routes'));
router.use('/', require('./message.routes')); // mounts /conversations/:id/messages and /messages/:id/read
router.use('/uploads', require('./upload.routes'));
router.use('/calls', require('./call.routes'));

module.exports = router;

