'use strict';

const Phone = require('../models/Phone');
const Account = require('../models/Account');
const otpService = require('../services/otp.service');
const tokenService = require('../services/token.service');
const env = require('../config/env');
const { normalizePhone } = require('../utils/validators');

async function requestOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'invalid_phone' });

    const { code, expiresAt } = await otpService.requestOtp(phone);

    const payload = { ok: true, phone, expiresAt };
    if (env.OTP_DEV_RETURN) payload.devCode = code; // dev-only convenience
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || '').trim();
    if (!phone || !code) return res.status(400).json({ error: 'invalid_input' });

    const result = await otpService.verifyOtp(phone, code);
    if (!result.ok) return res.status(400).json({ error: result.reason });

    // Upsert Phone record
    let phoneDoc = await Phone.findOneAndUpdate(
      { phone },
      { $set: { phone, verifiedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const accounts = await Account.find({ phoneId: phoneDoc._id }).sort({ createdAt: 1 });

    const phoneToken = tokenService.signPhoneToken(phoneDoc._id);

    return res.json({
      ok: true,
      phoneToken,
      phone,
      accounts: accounts.map((a) => a.toPublicJSON()),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DEV ONLY: skip the OTP roundtrip entirely. Issues a phone session token
 * straight from a phone number. Disabled unless OTP_DEV_BYPASS=true.
 *
 * Same response shape as POST /auth/otp/verify so the mobile app can plug it
 * into the existing auth flow without branching after the call.
 */
async function devLogin(req, res, next) {
  try {
    if (!env.OTP_DEV_BYPASS) {
      return res.status(404).json({ error: 'not_found' });
    }

    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'invalid_phone' });

    const phoneDoc = await Phone.findOneAndUpdate(
      { phone },
      { $set: { phone, verifiedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const accounts = await Account.find({ phoneId: phoneDoc._id }).sort({ createdAt: 1 });
    const phoneToken = tokenService.signPhoneToken(phoneDoc._id);

    return res.json({
      ok: true,
      devBypass: true,
      phoneToken,
      phone,
      accounts: accounts.map((a) => a.toPublicJSON()),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { requestOtp, verifyOtp, devLogin };

