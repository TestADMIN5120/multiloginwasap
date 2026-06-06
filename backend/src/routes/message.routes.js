'use strict';

const router = require('express').Router();
const msgCtrl = require('../controllers/message.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth('account'));

router.get('/conversations/:id/messages', msgCtrl.listMessages);
router.post('/conversations/:id/messages', msgCtrl.sendMessage);
router.post('/messages/:id/read', msgCtrl.markRead);

module.exports = router;

