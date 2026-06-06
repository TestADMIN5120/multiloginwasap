import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'MultiTabWatsap',
  slug: 'multiptabwatsap',
  scheme: 'multiptabwatsap',
  version: '1.0.0',
  orientation: 'portrait',
  // No custom icon/splash assets shipped — Expo provides defaults.
  // To brand the app later, drop icon.png (1024x1024) and splash.png into ./assets
  // and re-add the `icon:` / `splash:` keys here.
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.multiptabwatsap.app',
  },
  android: {
    package: 'com.multiptabwatsap.app',
    adaptiveIcon: {
      backgroundColor: '#075E54',
    },
  },
  web: {
    bundler: 'metro',
  },
  extra: {
    API_URL: process.env.API_URL || 'http://localhost:4000',
    SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:4000',
    // DEV ONLY: when "true", PhoneScreen calls POST /api/auth/dev-login and
    // skips the OTP screen entirely. Backend must also have OTP_DEV_BYPASS=true.
    DEV_SKIP_OTP: String(process.env.DEV_SKIP_OTP || 'false').toLowerCase() === 'true',
  },
});

