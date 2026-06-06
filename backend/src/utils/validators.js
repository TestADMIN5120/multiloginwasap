'use strict';

const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,20}$/;

function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/[\s-]/g, '');
  if (!PHONE_REGEX.test(trimmed)) return null;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function isValidUsername(u) {
  return typeof u === 'string' && USERNAME_REGEX.test(u);
}

function isNonEmptyString(s, max = 200) {
  return typeof s === 'string' && s.trim().length > 0 && s.length <= max;
}

module.exports = {
  PHONE_REGEX,
  USERNAME_REGEX,
  normalizePhone,
  isValidUsername,
  isNonEmptyString,
};

