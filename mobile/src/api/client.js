import axios from 'axios';
import Constants from 'expo-constants';

const API_URL =
  Constants?.expoConfig?.extra?.API_URL ||
  Constants?.manifest?.extra?.API_URL ||
  'http://localhost:4000';

/**
 * Token providers are injected at runtime by AccountContext, because the active
 * account (and thus the bearer token) can change without remounting providers.
 *
 *   accountTokenProvider() → string | null   (long-lived per-account JWT)
 *   phoneTokenProvider()   → string | null   (short-lived OTP-session JWT)
 *
 * Use api.useAccountAuth() / api.usePhoneAuth() when calling endpoints.
 */
let accountTokenProvider = () => null;
let phoneTokenProvider = () => null;

export function setAccountTokenProvider(fn) {
  accountTokenProvider = typeof fn === 'function' ? fn : () => null;
}
export function setPhoneTokenProvider(fn) {
  phoneTokenProvider = typeof fn === 'function' ? fn : () => null;
}

const api = axios.create({
  baseURL: `${API_URL.replace(/\/+$/, '')}/api`,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const useAccount = config.headers?.['X-Auth-Mode'] !== 'phone';
  const token = useAccount ? accountTokenProvider() : phoneTokenProvider();
  if (config.headers && config.headers['X-Auth-Mode']) {
    delete config.headers['X-Auth-Mode'];
  }
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Surface a small, predictable error shape
    const data = err?.response?.data;
    const code = data?.error || err?.code || 'network_error';
    const message = data?.error || err?.message || 'Network error';
    return Promise.reject({ code, message, status: err?.response?.status, raw: err });
  }
);

export const usePhoneAuth = () => ({ headers: { 'X-Auth-Mode': 'phone' } });
export const useAccountAuth = () => ({ headers: { 'X-Auth-Mode': 'account' } });

export const API_BASE = API_URL;
export default api;

