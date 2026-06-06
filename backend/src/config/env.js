'use strict';

require('dotenv').config();

// Treat empty strings as "missing" too — Docker sometimes propagates
// JWT_SECRET="" when the host shell has it unset.
const isMissing = (k) => process.env[k] === undefined || process.env[k] === '';

const required = ['JWT_SECRET', 'MONGO_URI'];
for (const key of required) {
  if (isMissing(key)) {
    // We don't hard-fail anymore — a crash here used to put the container in
    // a restart loop after a host reboot if the .env got lost. Instead we
    // log loudly and fall through to the dev-default below; the operator
    // sees the problem in `docker compose logs api` and can fix it without
    // hunting a crash-looping container.
    // eslint-disable-next-line no-console
    console.error(
      `\n[env] !!!  ${key} is not set. Falling back to an INSECURE dev default.  !!!` +
        `\n[env] !!!  Set ${key} in your .env file (repo root) before going to prod.  !!!\n`
    );
  }
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 4000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/multiptabwatsap',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  JWT_PHONE_TTL: process.env.JWT_PHONE_TTL || '30m',
  JWT_ACCOUNT_TTL: process.env.JWT_ACCOUNT_TTL || '30d',

  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS, 10) || 300,
  OTP_LENGTH: parseInt(process.env.OTP_LENGTH, 10) || 6,
  OTP_DEV_RETURN: String(process.env.OTP_DEV_RETURN || 'true').toLowerCase() === 'true',
  // DEV ONLY: when true, exposes POST /api/auth/dev-login that issues a phone
  // session token from just a phone number — skips SMS / OTP entirely.
  // Refuses to honor the request unless this is explicitly set true.
  OTP_DEV_BYPASS: String(process.env.OTP_DEV_BYPASS || 'false').toLowerCase() === 'true',

  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB, 10) || 15,

  // ----- WebRTC ICE servers (audio / video calls) -----
  // STUN is always free (Google's public servers used by default in the
  // controller). TURN is optional: only configure these when you've put a
  // coturn server somewhere reachable. ~10-20% of users sit behind NAT
  // strict enough that peer-to-peer fails and you need a TURN relay.
  TURN_URL: process.env.TURN_URL || '',         // e.g. turn:turn.example.com:3478?transport=udp
  TURN_USER: process.env.TURN_USER || '',
  TURN_PASS: process.env.TURN_PASS || '',
};

module.exports = env;

