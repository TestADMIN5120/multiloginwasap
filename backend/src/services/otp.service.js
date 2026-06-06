'use strict';

const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const env = require('../config/env');
const logger = require('../utils/logger');

function generateCode(length = env.OTP_LENGTH) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += Math.floor(Math.random() * 10);
  return code;
}

/**
 * Pluggable SMS sender. In dev we just log + return the code from the API.
 * To use Twilio: replace this with a real call and set OTP_DEV_RETURN=false.
 */
async function sendSms(phone, code) {
  logger.info(`[otp] (dev) phone=${phone} code=${code}`);
  return true;
}

async function requestOtp(phone) {
  // Invalidate any prior unconsumed codes for this phone
  await Otp.updateMany({ phone, consumed: false }, { $set: { consumed: true } });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await Otp.create({ phone, codeHash, expiresAt });
  await sendSms(phone, code);

  return { code, expiresAt };
}

async function verifyOtp(phone, code) {
  const record = await Otp.findOne({ phone, consumed: false }).sort({ createdAt: -1 });
  if (!record) return { ok: false, reason: 'no_otp' };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (record.attempts >= 5) return { ok: false, reason: 'too_many_attempts' };

  const match = await bcrypt.compare(String(code), record.codeHash);
  if (!match) {
    record.attempts += 1;
    await record.save();
    return { ok: false, reason: 'mismatch' };
  }

  record.consumed = true;
  await record.save();
  return { ok: true };
}

module.exports = { requestOtp, verifyOtp };

