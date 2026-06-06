'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');

router.post('/otp/request', ctrl.requestOtp);
router.post('/otp/verify', ctrl.verifyOtp);
// Dev-only shortcut — guarded inside the controller by OTP_DEV_BYPASS=true.
router.post('/dev-login', ctrl.devLogin);

module.exports = router;

