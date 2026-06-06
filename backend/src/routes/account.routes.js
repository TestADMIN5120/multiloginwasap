'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/account.controller');
const { requireAuth } = require('../middleware/auth');

// All routes here require a verified phone session OR an account session.
router.get('/', requireAuth('phone'), ctrl.listAccounts);
router.post('/', requireAuth('phone'), ctrl.createAccount);
router.post('/:id/login', requireAuth('phone'), ctrl.loginToAccount);
router.delete('/:id', requireAuth('account'), ctrl.deleteAccount);

module.exports = router;

