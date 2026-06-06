'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/call.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth('account'));

router.get('/', ctrl.listCalls);
router.get('/ice-servers', ctrl.getIceServers);
router.get('/:id', ctrl.getCall);

module.exports = router;

