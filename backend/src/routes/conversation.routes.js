'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/conversation.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth('account'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);

module.exports = router;

