// mobile/src/utils/webrtc.js
// ---------------------------------------------------------------------------
// Compatibility shim around `react-native-webrtc`.
//
// react-native-webrtc is a NATIVE module (compiled C++ + Java/Obj-C).
// Expo Go cannot load it — that fails the bundle in a way users can't
// recover from. So we lazy-require it. If the require throws, isAvailable()
// returns false and the call UI degrades to a friendly message instead
// of crashing the whole app.
//
// After you `eas build --profile preview --platform android`, the APK
// has the native module compiled in and isAvailable() returns true —
// no code change needed.
// ---------------------------------------------------------------------------

let _mod = null;
let _tried = false;
let _error = null;

function tryLoad() {
  if (_tried) return _mod;
  _tried = true;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    _mod = require('react-native-webrtc');
  } catch (err) {
    _error = err;
    _mod = null;
  }
  return _mod;
}

export function getWebRTC() {
  return tryLoad();
}

export function isWebRTCAvailable() {
  return !!tryLoad();
}

export function getWebRTCError() {
  tryLoad();
  return _error;
}

// Convenience re-exports — undefined when native module is missing.
export const RTCView = (() => {
  const m = tryLoad();
  return m ? m.RTCView : null;
})();

