/**
 * Notification Service — AttendX
 *
 * Handles Expo push notifications registration and scheduling.
 * Designed to be resilient: any failure is logged and swallowed so it
 * never crashes the authentication / startup flow.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId) {
  try {
    // Skip on web — Expo push tokens are for native only
    if (Platform.OS === 'web') {
      return null;
    }

    // Expo push tokens require a physical device
    if (!Device.isDevice) {
      console.log('[Notifications] Skipped — not a physical device');
      return null;
    }

    // Check / request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied');
      return null;
    }

    // Guard: EAS project ID must be present to get a push token
    const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!easProjectId) {
      console.warn(
        '[Notifications] EXPO_PUBLIC_EAS_PROJECT_ID is not set in .env — ' +
        'skipping push token registration.'
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId,
    });
    const token = tokenData.data;

    // Create Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'AttendX Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
      });
    }

    // Persist token to Firestore for server-side push delivery
    if (userId && token) {
      await setDoc(
        doc(db, COLLECTIONS.USERS, userId),
        { pushToken: token, pushTokenUpdatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    return token;
  } catch (error) {
    // Never crash the app over a notification failure
    console.warn('[Notifications] Registration failed (non-fatal):', error?.message || error);
    return null;
  }
}

export function scheduleAttendanceReminder(title, body, triggerDate) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: triggerDate,
  });
}