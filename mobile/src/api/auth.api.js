import api from './client';

export const requestOtp = (phone) => api.post('/auth/otp/request', { phone }).then((r) => r.data);

export const verifyOtp = (phone, code) =>
  api.post('/auth/otp/verify', { phone, code }).then((r) => r.data);

// DEV ONLY: backend must have OTP_DEV_BYPASS=true. Returns the same shape
// as verifyOtp (phoneToken + accounts) so callers can plug it in transparently.
export const devLogin = (phone) =>
  api.post('/auth/dev-login', { phone }).then((r) => r.data);

