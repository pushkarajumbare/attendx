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
    // Disable push notifications on web
    if (Platform.OS === 'web') {
      console.log('Push notifications skipped on web');
      return null;
    }

    // Must be real device for push notifications
    if (!Device.isDevice) {
      console.log('Push notifications require physical device');
      return null;
    }

    const { status: existing } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
      })
    ).data;

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'default',
        {
          name: 'AttendX Notifications',
          importance:
            Notifications.AndroidImportance.MAX,
        }
      );
    }

    // Save token to Firestore
    if (userId) {
      await setDoc(
        doc(db, COLLECTIONS.USERS, userId),
        { pushToken: token },
        { merge: true }
      );
    }

    return token;
  } catch (error) {
    console.log(
      'Notification registration error:',
      error
    );
    return null;
  }
}

export function scheduleAttendanceReminder(
  title,
  body,
  triggerDate
) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: triggerDate,
  });
}