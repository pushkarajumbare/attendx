import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from '../config/firebase';
import {
  fetchUserProfile,
  logOut as authLogOut,
} from '../services/authService';

import { registerForPushNotifications } from '../services/notificationService';
import { ROLES } from '../constants';

const AuthContext = createContext(null);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadProfile(uid, retries = 5) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const profile = await fetchUserProfile(uid);

      if (profile) {
        return profile;
      }
    } catch (error) {
      lastError = error;
      console.log(`Profile load attempt ${i + 1} failed`, error);
    }

    await delay(500);
  }

  throw lastError || new Error('Unable to load profile');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (loggingOut) return;

        setLoading(true);

        try {
          if (!firebaseUser) {
            setUser(null);
            setProfile(null);
            return;
          }

          setUser(firebaseUser);

          const userProfile = await loadProfile(firebaseUser.uid);

          setProfile(userProfile);

          if (Platform.OS !== 'web') {
            registerForPushNotifications(firebaseUser.uid).catch(
              (error) => {
                console.log(
                  'Notification registration skipped:',
                  error?.message || error
                );
              }
            );
          }
        } catch (error) {
          console.log('Profile loading failed:', error);

          // IMPORTANT:
          // Keep Firebase Auth user logged in.
          // Only clear profile.
          setProfile(null);
        } finally {
          setLoading(false);
        }
      }
    );

    return unsubscribe;
  }, [loggingOut]);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      const profile = await loadProfile(auth.currentUser.uid);
      setProfile(profile);
    } catch (error) {
      console.log('Refresh profile error:', error);
    }
  }, []);

  const logOut = useCallback(async () => {
    try {
      setLoggingOut(true);
      setLoading(true);

      await authLogOut();

      await AsyncStorage.clear();

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.log('Logout error:', error);
      throw error;
    } finally {
      setLoggingOut(false);
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isTeacher: profile?.role === ROLES.TEACHER,
      isStudent: profile?.role === ROLES.STUDENT,
      refreshProfile,
      logOut,
    }),
    [user, profile, loading, refreshProfile, logOut]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}