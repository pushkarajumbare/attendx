/**
 * Polyfills — AttendX
 *
 * NOTE: The primary navigator.userAgent and location stubs are now applied
 * synchronously in the root index.js entry point (before any ES module is
 * evaluated). This file is kept as a secondary safety net for modules that
 * import it directly, and for any runtime environment where the root entry
 * was not run first.
 *
 * Do NOT add browser API emulations here. Keep this minimal.
 */

// navigator.userAgent safety net
if (typeof global.navigator === 'undefined') {
  global.navigator = { userAgent: 'ReactNative' };
} else if (!global.navigator.userAgent) {
  try {
    global.navigator.userAgent = 'ReactNative';
  } catch (_) {
    global.navigator = Object.assign({}, global.navigator, { userAgent: 'ReactNative' });
  }
}

// location.href safety net (Firebase Auth internal checks)
if (typeof global.location === 'undefined') {
  global.location = {
    href: 'https://localhost/',
    origin: 'https://localhost',
    protocol: 'https:',
    host: 'localhost',
    hostname: 'localhost',
    pathname: '/',
    search: '',
    hash: '',
  };
}
