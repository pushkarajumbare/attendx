/**
 * AttendX — Root Entry Point
 *
 * CRITICAL: This file MUST run before any other import.
 * ES module static imports are hoisted, so we use require() here
 * to guarantee synchronous execution order.
 *
 * Order of operations:
 * 1. Set navigator.userAgent (required by TF.js environment detection)
 * 2. Set global.location safe stub (required by Firebase SDK)
 * 3. Bootstrap Expo Router
 */

// ─── STEP 1: navigator.userAgent polyfill ───────────────────────────────────
// TF.js and some Firebase internals call navigator.userAgent.includes('...')
// at module evaluation time. Hermes provides navigator but NOT .userAgent.
if (typeof global.navigator === 'undefined') {
  global.navigator = {};
}
if (typeof global.navigator.userAgent === 'undefined') {
  try {
    global.navigator.userAgent = 'ReactNative';
  } catch (_) {
    // userAgent is read-only on this runtime — redefine the whole object
    global.navigator = Object.assign({}, global.navigator, {
      userAgent: 'ReactNative',
    });
  }
}
// Mirror to window.navigator if window exists (some packages read from window)
if (typeof global.window !== 'undefined') {
  if (typeof global.window.navigator === 'undefined') {
    global.window.navigator = global.navigator;
  } else if (typeof global.window.navigator.userAgent === 'undefined') {
    try {
      global.window.navigator.userAgent = 'ReactNative';
    } catch (_) {
      global.window.navigator = Object.assign({}, global.window.navigator, {
        userAgent: 'ReactNative',
      });
    }
  }
}

// ─── STEP 2: location stub ───────────────────────────────────────────────────
// Firebase Auth checks location.href in some code paths.
// This is a minimal, safe stub — NOT a browser emulation.
const _locationStub = {
  href: 'https://localhost/',
  origin: 'https://localhost',
  protocol: 'https:',
  host: 'localhost',
  hostname: 'localhost',
  pathname: '/',
  search: '',
  hash: '',
};

if (typeof global.location === 'undefined') {
  global.location = _locationStub;
} else {
  // Patch only missing properties on an existing stub (e.g. Metro dev server)
  const _loc = global.location;
  const _keys = ['href', 'origin', 'protocol', 'host', 'hostname', 'pathname', 'search', 'hash'];
  for (const k of _keys) {
    if (_loc[k] === undefined) {
      try { _loc[k] = _locationStub[k]; } catch (_) {}
    }
  }
}

// ─── STEP 3: Boot Expo Router ────────────────────────────────────────────────
require('expo-router/entry');
