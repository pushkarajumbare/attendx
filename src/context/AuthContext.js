import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  clearNotificationLocalCaches,
  registerForPushNotifications,
  startStudentActivityWatcher,
  subscribeUserNotifications,
} from '../services/notificationService';
import { clearFaceTemplateState } from '../services/faceService';
import { ROLES } from '../constants';

const AuthContext = createContext(null);
const PROFILE_CACHE_PREFIX = '@attendx_user_profile_';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getProfileCacheKey(uid) {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

async function readCachedProfile(uid) {
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(getProfileCacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

async function writeCachedProfile(uid, userProfile) {
  if (!uid || !userProfile) return;
  try {
    // Store serializable profile fields for instant offline/cold-boot restoration
    const serializable = {
      uid: userProfile.uid || uid,
      name: userProfile.name || userProfile.displayName || '',
      displayName: userProfile.displayName || userProfile.name || '',
      email: userProfile.email || '',
      role: userProfile.role || '',
      faceRegistered: Boolean(userProfile.faceRegistered),
      rollNumber: userProfile.rollNumber || '',
    };
    await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(serializable));
  } catch (_) {}
}

async function loadProfile(uid, retries = 4) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const userProfile = await fetchUserProfile(uid, 1, 0);
      if (userProfile) {
        return userProfile;
      }
    } catch (error) {
      lastError = error;
    }
    if (i < retries - 1) {
      await delay(450);
    }
  }
  throw lastError || new Error('Unable to load profile');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loggingOutRef = useRef(false);
  const previousAuthUidRef = useRef(null);
  const notifUnsubRef = useRef(null);
  const studentWatcherUnsubRef = useRef(null);

  const teardownWatchers = useCallback(() => {
    if (notifUnsubRef.current) {
      try {
        notifUnsubRef.current();
      } catch (_) {}
      notifUnsubRef.current = null;
    }
    if (studentWatcherUnsubRef.current) {
      try {
        studentWatcherUnsubRef.current();
      } catch (_) {}
      studentWatcherUnsubRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (loggingOutRef.current) return;

      const previousUid = previousAuthUidRef.current;
      if (previousUid && previousUid !== firebaseUser?.uid) {
        clearFaceTemplateState(previousUid);
        teardownWatchers();
      }
      previousAuthUidRef.current = firebaseUser?.uid || null;

      if (!firebaseUser) {
        teardownWatchers();
        setUser(null);
        setProfile(null);
        setNotifications([]);
        setUnreadNotifications(0);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // Hydrate cached profile immediately so app stays logged in even offline / slow network
      const cached = await readCachedProfile(firebaseUser.uid);
      if (cached) {
        setProfile(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      let activeProfile = cached;
      try {
        const freshProfile = await loadProfile(firebaseUser.uid);
        if (freshProfile && !loggingOutRef.current) {
          activeProfile = freshProfile;
          setProfile(freshProfile);
          await writeCachedProfile(firebaseUser.uid, freshProfile);
        }

        if (Platform.OS !== 'web') {
          registerForPushNotifications(firebaseUser.uid).catch((error) => {
            console.log('Notification registration skipped:', error?.message || error);
          });
        }
      } catch (error) {
        console.log('Background profile sync notice:', error?.message || error);
        if (!cached) {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }

      // Attach live notification listeners once per signed-in session
      teardownWatchers();
      notifUnsubRef.current = subscribeUserNotifications(
        firebaseUser.uid,
        ({ items, unreadCount }) => {
          setNotifications(items);
          setUnreadNotifications(unreadCount);
        }
      );

      if (activeProfile?.role === ROLES.STUDENT) {
        studentWatcherUnsubRef.current = startStudentActivityWatcher(firebaseUser.uid);
      }
    });

    return () => {
      unsubscribe();
      teardownWatchers();
    };
  }, [teardownWatchers]);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return null;
    try {
      const freshProfile = await loadProfile(auth.currentUser.uid, 3);
      if (freshProfile) {
        setProfile(freshProfile);
        await writeCachedProfile(auth.currentUser.uid, freshProfile);
        return freshProfile;
      }
    } catch (error) {
      console.log('Refresh profile error:', error?.message || error);
    }
    return null;
  }, []);

  const logOut = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    try {
      loggingOutRef.current = true;
      setLoading(true);
      teardownWatchers();
      await clearNotificationLocalCaches();
      await authLogOut();
      if (uid) {
        await AsyncStorage.removeItem(getProfileCacheKey(uid)).catch(() => {});
      }
      setUser(null);
      setProfile(null);
      setNotifications([]);
      setUnreadNotifications(0);
    } catch (error) {
      console.log('Logout error:', error);
      throw error;
    } finally {
      loggingOutRef.current = false;
      setLoading(false);
    }
  }, [teardownWatchers]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isTeacher: profile?.role === ROLES.TEACHER,
      isStudent: profile?.role === ROLES.STUDENT,
      notifications,
      unreadNotifications,
      refreshProfile,
      logOut,
    }),
    [user, profile, loading, notifications, unreadNotifications, refreshProfile, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
