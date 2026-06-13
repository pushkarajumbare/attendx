import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { fetchUserProfile, logOut as authLogOut } from '../services/authService';
import { registerForPushNotifications } from '../services/notificationService';
import { ROLES } from '../constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (loggingOut) {
        // Skip state updates during logout
        return;
      }

      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userProfile = await fetchUserProfile(firebaseUser.uid);
          setProfile(userProfile);
          registerForPushNotifications(firebaseUser.uid);
        } catch (error) {
          console.log('Profile fetch error:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [loggingOut]);

  const refreshProfile = async () => {
    if (user) {
      try {
        const userProfile = await fetchUserProfile(user.uid);
        setProfile(userProfile);
      } catch (error) {
        console.log('Profile refresh error:', error);
      }
    }
  };

  const logOut = async () => {
    try {
      setLoggingOut(true);
      
      // Clear Firebase auth
      await authLogOut();
      
      // Clear AsyncStorage (mobile)
      try {
        await AsyncStorage.clear();
      } catch (err) {
        console.log('AsyncStorage clear error:', err);
      }
      
      // Reset context state
      setUser(null);
      setProfile(null);
      setLoading(false);
      setLoggingOut(false);
    } catch (error) {
      console.log('Logout error:', error);
      setLoggingOut(false);
      throw error;
    }
  };

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
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
