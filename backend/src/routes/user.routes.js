'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth('account'));

router.get('/me', ctrl.me);
router.patch('/me', ctrl.updateMe);
router.get('/search', ctrl.search);

module.exports = router;

