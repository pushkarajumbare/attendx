import { initializeApp, getApps } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';

import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// PREVENT DUPLICATE APP INITIALIZATION
const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

// FIX AUTH PERSISTENCE - PLATFORM SPECIFIC
let auth;

try {
  if (Platform.OS === 'web') {
    // WEB: Use session persistence (NO auto-login on page refresh)
    auth = getAuth(app);
    setPersistence(auth, browserSessionPersistence).catch((err) => {
      console.log('Web persistence error:', err);
    });
  } else {
    // MOBILE: Use AsyncStorage persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (error) {
  // fallback if auth already initialized
  auth = getAuth(app);
  if (Platform.OS === 'web') {
    setPersistence(auth, browserSessionPersistence).catch((err) => {
      console.log('Web persistence error:', err);
    });
  }
}

// DATABASE + STORAGE
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;