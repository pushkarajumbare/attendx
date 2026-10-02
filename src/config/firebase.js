/**
 * Firebase Configuration — AttendX
 *
 * IMPORTANT (Android/Hermes fix):
 * Do NOT import browserLocalPersistence or browserSessionPersistence at the
 * module level. Importing those symbols causes Firebase SDK to run browser
 * detection code that crashes Hermes at startup (before any component mounts).
 *
 * Platform-specific persistence is handled below with a lazy Platform check.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Firebase project config — values come from .env (Expo public vars)
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || '',
};

// Prevent duplicate app initialization (safe for Fast Refresh)
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

// ─── Auth — platform-conditional persistence ─────────────────────────────────
let auth;

if (Platform.OS === 'web') {
  // Web: use session persistence (no auto-login on page refresh)
  // Import browser symbols ONLY in the web code path — they are never bundled
  // into the Android/iOS native build because Metro tree-shakes this branch.
  const { getAuth, setPersistence, browserSessionPersistence } =
    require('firebase/auth');  // eslint-disable-line @typescript-eslint/no-var-requires
  auth = getAuth(app);
  setPersistence(auth, browserSessionPersistence).catch((err) => {
    console.warn('[Firebase] Web session persistence error:', err?.message);
  });
} else {
  // React Native (Android / iOS): use AsyncStorage persistence
  // initializeAuth is called once; getAuth() is the fallback if already init'd.
  try {
    const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // Auth was already initialized (Fast Refresh / hot reload) — just get it
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
  }
}

// ─── Firestore + Storage ──────────────────────────────────────────────────────
const db      = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;