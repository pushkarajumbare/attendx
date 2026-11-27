/**
 * Notification Service — AttendX
 *
 * Supports:
 * - Immediate & timed local alerts (attendance start, ending soon, session end, task deadline)
 * - Persistent per-user notifications in Firestore (`notifications` collection)
 * - Free Expo Push API relay on Spark plan (best-effort when recipient pushToken exists)
 * - Real-time foreground watchers for Students & Teachers with deduplication
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../constants';
import { formatDateTime, formatTime, toValidDate } from '../utils/helpers';

const SEEN_EVENTS_KEY = '@attendx_seen_notif_events_v1';
const SCHEDULED_MAP_KEY = '@attendx_scheduled_notifs_v1';

let channelConfigured = false;
let seenCache = null;
let scheduledCache = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || channelConfigured) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'AttendX Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: '#2563EB',
      enableVibrate: true,
      sound: 'default',
    });
    channelConfigured = true;
  } catch (err) {
    console.warn('[Notifications] Channel setup notice:', err?.message);
  }
}

export async function ensureLocalNotificationPermission() {
  if (Platform.OS === 'web') return false;
  try {
    await ensureAndroidChannel();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (_) {
    return false;
  }
}

export async function registerForPushNotifications(userId) {
  try {
    if (Platform.OS === 'web') return null;

    const granted = await ensureLocalNotificationPermission();
    if (!granted) return null;

    if (!Device.isDevice) {
      console.log('[Notifications] Local alerts ready; Expo push token skipped on emulator');
      return null;
    }

    const easProjectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

    if (!easProjectId) {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId,
    });
    const token = tokenData?.data || null;

    if (userId && token) {
      await setDoc(
        doc(db, COLLECTIONS.USERS, userId),
        { pushToken: token, pushTokenUpdatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    return token;
  } catch (error) {
    console.warn('[Notifications] Registration notice (non-fatal):', error?.message || error);
    return null;
  }
}

async function getSeenMap() {
  if (seenCache) return seenCache;
  try {
    const raw = await AsyncStorage.getItem(SEEN_EVENTS_KEY);
    seenCache = raw ? JSON.parse(raw) : {};
  } catch (_) {
    seenCache = {};
  }
  return seenCache;
}

async function markSeenEvent(eventKey) {
  const map = await getSeenMap();
  map[eventKey] = Date.now();
  // Trim oldest entries above 300 keys to keep AsyncStorage tiny
  const entries = Object.entries(map);
  if (entries.length > 300) {
    entries.sort((a, b) => b[1] - a[1]);
    seenCache = Object.fromEntries(entries.slice(0, 220));
  }
  try {
    await AsyncStorage.setItem(SEEN_EVENTS_KEY, JSON.stringify(seenCache));
  } catch (_) {}
}

async function getScheduledMap() {
  if (scheduledCache) return scheduledCache;
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_MAP_KEY);
    scheduledCache = raw ? JSON.parse(raw) : {};
  } catch (_) {
    scheduledCache = {};
  }
  return scheduledCache;
}

async function saveScheduledMap() {
  try {
    await AsyncStorage.setItem(SCHEDULED_MAP_KEY, JSON.stringify(scheduledCache || {}));
  } catch (_) {}
}

/**
 * Show an immediate local notification at most once per unique eventKey.
 */
export async function presentLocalNotificationOnce(eventKey, title, body, data = {}) {
  if (Platform.OS === 'web' || !eventKey) return false;
  try {
    const seen = await getSeenMap();
    if (seen[eventKey]) return false;

    const granted = await ensureLocalNotificationPermission();
    if (!granted) return false;

    await markSeenEvent(eventKey);
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { ...data, eventKey },
      },
      trigger: null,
    });
    return true;
  } catch (err) {
    console.warn('[Notifications] Local alert skipped:', err?.message);
    return false;
  }
}

/**
 * Schedule (or reschedule) a timed local notification at an exact future Date.
 */
export async function scheduleTimedNotification(scheduleKey, title, body, triggerDate, data = {}) {
  if (Platform.OS === 'web' || !scheduleKey) return null;
  try {
    const targetDate = toValidDate(triggerDate);
    if (!targetDate || targetDate.getTime() <= Date.now() + 2500) {
      return null;
    }

    const granted = await ensureLocalNotificationPermission();
    if (!granted) return null;

    await cancelScheduledNotificationByKey(scheduleKey);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { ...data, scheduleKey },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: targetDate.getTime(),
        channelId: 'default',
      },
    });

    const map = await getScheduledMap();
    map[scheduleKey] = identifier;
    await saveScheduledMap();
    return identifier;
  } catch (err) {
    console.warn('[Notifications] Schedule timed notice:', err?.message);
    return null;
  }
}

export async function cancelScheduledNotificationByKey(scheduleKey) {
  if (Platform.OS === 'web' || !scheduleKey) return;
  try {
    const map = await getScheduledMap();
    const existingId = map[scheduleKey];
    if (existingId) {
      await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
      delete map[scheduleKey];
      await saveScheduledMap();
    }
  } catch (_) {}
}

export function scheduleAttendanceReminder(title, body, triggerDate) {
  return scheduleTimedNotification(`legacy_${Date.now()}`, title, body, triggerDate);
}

/**
 * Relay push messages via Expo's free push gateway (best-effort on Spark plan).
 */
async function sendExpoPushMessages(recipientIds, title, body, data = {}) {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) return;

  try {
    const userDocs = await Promise.all(
      recipientIds.map((uid) => getDoc(doc(db, COLLECTIONS.USERS, uid)).catch(() => null))
    );
    const tokens = [
      ...new Set(
        userDocs
          .map((snap) => snap?.exists?.() && snap.data()?.pushToken)
          .filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'))
      ),
    ];
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    }));

    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      }).catch(() => {});
    }
  } catch (_) {}
}

/**
 * Persist notification records in Firestore + trigger best-effort Expo push delivery.
 */
export async function dispatchNotifications({
  senderId,
  recipientIds = [],
  title,
  body,
  type = 'general',
  classroomId = null,
  data = {},
}) {
  const effectiveSenderId = auth.currentUser?.uid || senderId;
  if (!effectiveSenderId || !title) return;
  const uniqueRecipients = [...new Set((recipientIds || []).filter(Boolean))];
  if (uniqueRecipients.length === 0) return;

  try {
    for (let i = 0; i < uniqueRecipients.length; i += 400) {
      const chunk = uniqueRecipients.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const recipientId of chunk) {
        const notifRef = doc(collection(db, COLLECTIONS.NOTIFICATIONS));
        batch.set(notifRef, {
          notificationId: notifRef.id,
          recipientId,
          senderId: effectiveSenderId,
          classroomId: classroomId || null,
          type,
          title,
          body: body || '',
          data,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    sendExpoPushMessages(uniqueRecipients, title, body, { type, classroomId, ...data }).catch(
      () => {}
    );
  } catch (err) {
    console.warn('[Notifications] Dispatch notice (non-fatal):', err?.message);
  }
}

export async function notifyAttendanceStarted(session, classroom) {
  if (!session || !classroom) return;
  const subject = session.subject || classroom.subject || classroom.className || 'Class';
  const endDate = toValidDate(session.endTime);
  const endLabel = endDate ? formatTime(endDate) : 'soon';
  const studentIds = classroom.studentIds || [];

  // 1. Notify enrolled students
  await dispatchNotifications({
    senderId: session.teacherId,
    recipientIds: studentIds,
    title: `Attendance Started: ${subject}`,
    body: `${classroom.className} session is open until ${endLabel}. Verify face & GPS to check in.`,
    type: 'attendance_start',
    classroomId: classroom.classroomId,
    data: { sessionId: session.sessionId, classroomId: classroom.classroomId },
  });

  // 2. Persist teacher log + immediate feedback + schedule end reminder for teacher
  await dispatchNotifications({
    senderId: session.teacherId,
    recipientIds: [session.teacherId],
    title: `Live Session Active: ${subject}`,
    body: `${classroom.className} attendance started. Scheduled to end at ${endLabel}.`,
    type: 'attendance_start',
    classroomId: classroom.classroomId,
    data: { sessionId: session.sessionId, classroomId: classroom.classroomId },
  });

  await presentLocalNotificationOnce(
    `teacher_start_${session.sessionId}`,
    `Attendance Started: ${subject}`,
    `${classroom.className} check-in is open until ${endLabel}.`,
    { type: 'attendance_start', sessionId: session.sessionId }
  );

  if (endDate) {
    const twoMinBefore = new Date(endDate.getTime() - 2 * 60 * 1000);
    if (twoMinBefore.getTime() > Date.now() + 20000) {
      await scheduleTimedNotification(
        `teacher_ending_${session.sessionId}`,
        `Attendance Ending Soon: ${subject}`,
        `${classroom.className} closes in 2 minutes (${endLabel}).`,
        twoMinBefore,
        { type: 'attendance_ending', sessionId: session.sessionId }
      );
    }

    await scheduleTimedNotification(
      `teacher_ended_${session.sessionId}`,
      `Attendance Session Ended: ${subject}`,
      `${classroom.className} window closed at ${endLabel}. Review attendance report.`,
      endDate,
      { type: 'attendance_end', sessionId: session.sessionId }
    );
  }
}

export async function notifyAttendanceEnded(session, classroom, actorUid) {
  if (!session || !classroom) return;
  const subject = session.subject || classroom.subject || classroom.className || 'Class';
  await cancelScheduledNotificationByKey(`teacher_ending_${session.sessionId}`);
  await cancelScheduledNotificationByKey(`teacher_ended_${session.sessionId}`);

  const recipients = [classroom.teacherId, ...(classroom.studentIds || [])];
  await dispatchNotifications({
    senderId: actorUid || session.teacherId,
    recipientIds: recipients,
    title: `Attendance Ended: ${subject}`,
    body: `${classroom.className} attendance window is now closed.`,
    type: 'attendance_end',
    classroomId: classroom.classroomId,
    data: { sessionId: session.sessionId, classroomId: classroom.classroomId },
  });

  await presentLocalNotificationOnce(
    `ended_${session.sessionId}`,
    `Attendance Ended: ${subject}`,
    `${classroom.className} attendance window has closed.`,
    { type: 'attendance_end', sessionId: session.sessionId }
  );
}

export async function notifyAssignmentUploaded(assignment, classroom) {
  if (!assignment || !classroom) return;
  const deadline = toValidDate(assignment.deadline);
  const dueText = deadline ? ` Due ${formatDateTime(deadline)}.` : '';
  const studentIds = classroom.studentIds || [];

  await dispatchNotifications({
    senderId: assignment.teacherId,
    recipientIds: studentIds,
    title: `New Task: ${assignment.title}`,
    body: `Uploaded in ${classroom.className}.${dueText}`,
    type: 'assignment_uploaded',
    classroomId: classroom.classroomId,
    data: { assignmentId: assignment.assignmentId, classroomId: classroom.classroomId },
  });

  await dispatchNotifications({
    senderId: assignment.teacherId,
    recipientIds: [assignment.teacherId],
    title: `Task Published: ${assignment.title}`,
    body: `Shared with ${studentIds.length} students in ${classroom.className}.${dueText}`,
    type: 'assignment_uploaded',
    classroomId: classroom.classroomId,
    data: { assignmentId: assignment.assignmentId, classroomId: classroom.classroomId },
  });

  await presentLocalNotificationOnce(
    `teacher_task_${assignment.assignmentId}`,
    `Task Published: ${assignment.title}`,
    `${classroom.className} students notified.${dueText}`,
    { type: 'assignment_uploaded', assignmentId: assignment.assignmentId }
  );
}

export async function notifyAssignmentSubmitted(submission, assignment, studentName) {
  if (!submission || !assignment) return;
  const who = studentName || 'A student';

  await dispatchNotifications({
    senderId: submission.studentId,
    recipientIds: [assignment.teacherId],
    title: `Task Submitted: ${assignment.title}`,
    body: `${who} submitted their completed work.`,
    type: 'assignment_submitted',
    classroomId: assignment.classroomId,
    data: { assignmentId: assignment.assignmentId, classroomId: assignment.classroomId },
  });

  await dispatchNotifications({
    senderId: submission.studentId,
    recipientIds: [submission.studentId],
    title: `Submission Confirmed: ${assignment.title}`,
    body: 'Your task submission has been recorded.',
    type: 'assignment_confirmation',
    classroomId: assignment.classroomId,
    data: { assignmentId: assignment.assignmentId, classroomId: assignment.classroomId },
  });

  await cancelScheduledNotificationByKey(`task_due_${assignment.assignmentId}`);
}

export function subscribeUserNotifications(uid, onChange) {
  if (!uid) {
    onChange({ items: [], unreadCount: 0 });
    return () => {};
  }

  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('recipientId', '==', uid)
  );

  let initialSnapshot = true;

  return onSnapshot(
    q,
    async (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ ...d.data(), notificationId: d.data().notificationId || d.id }))
        .sort(
          (a, b) =>
            (toValidDate(b.createdAt)?.getTime() || 0) -
            (toValidDate(a.createdAt)?.getTime() || 0)
        );

      const unreadCount = items.filter((item) => !item.read).length;
      onChange({ items, unreadCount });

      // Trigger immediate local popup for brand-new unread notifications arriving live
      if (!initialSnapshot) {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const docData = change.doc.data();
            if (!docData.read && docData.senderId !== uid) {
              await presentLocalNotificationOnce(
                `notif_${change.doc.id}`,
                docData.title,
                docData.body,
                docData.data || {}
              );
            }
          }
        }
      } else {
        // Also ensure recent unread items within the last 10 minutes alert once if unseen
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        for (const item of items) {
          const ts = toValidDate(item.createdAt)?.getTime() || 0;
          if (!item.read && item.senderId !== uid && ts >= tenMinAgo) {
            await presentLocalNotificationOnce(
              `notif_${item.notificationId}`,
              item.title,
              item.body,
              item.data || {}
            );
          }
        }
      }

      initialSnapshot = false;
    },
    (err) => {
      console.warn('[Notifications] Subscription notice:', err?.message);
    }
  );
}

/**
 * Real-time watcher for Students: schedules timed reminders when sessions start/end
 * and cancels reminders once student attendance is recorded.
 */
export function startStudentActivityWatcher(uid) {
  if (!uid) return () => {};

  const classroomUnsubs = new Map();
  let stopped = false;

  const syncClassWatchers = (classrooms) => {
    const activeIds = new Set(classrooms.map((c) => c.classroomId));

    // Tear down dropped classrooms
    for (const [cid, unsubFn] of classroomUnsubs.entries()) {
      if (!activeIds.has(cid)) {
        unsubFn();
        classroomUnsubs.delete(cid);
      }
    }

    for (const cls of classrooms) {
      if (classroomUnsubs.has(cls.classroomId)) continue;

      const sessQuery = query(
        collection(db, COLLECTIONS.ATTENDANCE_SESSIONS),
        where('classroomId', '==', cls.classroomId)
      );
      const taskQuery = query(
        collection(db, COLLECTIONS.ASSIGNMENTS),
        where('classroomId', '==', cls.classroomId)
      );

      const unsubSess = onSnapshot(
        sessQuery,
        async (snap) => {
          if (stopped) return;
          const now = Date.now();
          for (const d of snap.docs) {
            const sess = d.data();
            const start = toValidDate(sess.startTime);
            const end = toValidDate(sess.endTime);
            if (!start || !end) continue;

            const isLive =
              ['active', 'reopened'].includes(sess.status) &&
              end.getTime() > now;

            if (isLive) {
              // Check if already marked
              const attSnap = await getDoc(
                doc(db, COLLECTIONS.ATTENDANCE, `${sess.sessionId}_${uid}`)
              ).catch(() => null);

              if (attSnap?.exists()) {
                await cancelScheduledNotificationByKey(`student_ending_${sess.sessionId}`);
                await cancelScheduledNotificationByKey(`student_ended_${sess.sessionId}`);
                continue;
              }

              const subject = sess.subject || cls.subject || cls.className || 'Class';
              const endStr = formatTime(end);

              if (start.getTime() <= now) {
                await presentLocalNotificationOnce(
                  `student_live_${sess.sessionId}`,
                  `Attendance Open: ${subject}`,
                  `${cls.className} attendance started! Ends at ${endStr}.`,
                  { type: 'attendance_start', classroomId: cls.classroomId, sessionId: sess.sessionId }
                );
              } else {
                await scheduleTimedNotification(
                  `student_start_${sess.sessionId}`,
                  `Attendance Starting: ${subject}`,
                  `${cls.className} attendance starts now until ${endStr}.`,
                  start,
                  { type: 'attendance_start', classroomId: cls.classroomId, sessionId: sess.sessionId }
                );
              }

              const twoMinBefore = new Date(end.getTime() - 2 * 60 * 1000);
              if (twoMinBefore.getTime() > now + 20000) {
                await scheduleTimedNotification(
                  `student_ending_${sess.sessionId}`,
                  `Attendance Ending Soon: ${subject}`,
                  `Only 2 minutes left to mark attendance for ${cls.className}!`,
                  twoMinBefore,
                  { type: 'attendance_ending', classroomId: cls.classroomId, sessionId: sess.sessionId }
                );
              }

              await scheduleTimedNotification(
                `student_ended_${sess.sessionId}`,
                `Attendance Ended: ${subject}`,
                `${cls.className} attendance window closed at ${endStr}.`,
                end,
                { type: 'attendance_end', classroomId: cls.classroomId, sessionId: sess.sessionId }
              );
            } else if (sess.status === 'ended' || end.getTime() <= now) {
              await cancelScheduledNotificationByKey(`student_start_${sess.sessionId}`);
              await cancelScheduledNotificationByKey(`student_ending_${sess.sessionId}`);
              await cancelScheduledNotificationByKey(`student_ended_${sess.sessionId}`);
            }
          }
        },
        () => {}
      );

      let initialTasks = true;
      const unsubTasks = onSnapshot(
        taskQuery,
        async (snap) => {
          if (stopped) return;
          const now = Date.now();
          for (const d of snap.docs) {
            const task = d.data();
            const deadline = toValidDate(task.deadline);
            const created = toValidDate(task.createdAt)?.getTime() || 0;

            if (!initialTasks || (created && now - created < 15 * 60 * 1000)) {
              const dueText = deadline ? ` Due ${formatDateTime(deadline)}.` : '';
              await presentLocalNotificationOnce(
                `student_task_${task.assignmentId}`,
                `New Task: ${task.title}`,
                `Posted in ${cls.className}.${dueText}`,
                { type: 'assignment_uploaded', classroomId: cls.classroomId }
              );
            }

            if (deadline && deadline.getTime() > now + 65 * 60 * 1000) {
              const oneHourBefore = new Date(deadline.getTime() - 60 * 60 * 1000);
              await scheduleTimedNotification(
                `task_due_${task.assignmentId}`,
                `Task Deadline in 1 Hour: ${task.title}`,
                `Submit before ${formatTime(deadline)} in ${cls.className}.`,
                oneHourBefore,
                { type: 'assignment_due', classroomId: cls.classroomId }
              );
            }
          }
          initialTasks = false;
        },
        () => {}
      );

      classroomUnsubs.set(cls.classroomId, () => {
        unsubSess();
        unsubTasks();
      });
    }
  };

  const clsQuery = query(
    collection(db, COLLECTIONS.CLASSROOMS),
    where('studentIds', 'array-contains', uid)
  );
  const unsubClasses = onSnapshot(
    clsQuery,
    (snap) => {
      if (stopped) return;
      const classes = snap.docs.map((d) => ({ ...d.data(), classroomId: d.data().classroomId || d.id }));
      syncClassWatchers(classes);
    },
    () => {}
  );

  return () => {
    stopped = true;
    unsubClasses();
    for (const fn of classroomUnsubs.values()) {
      fn();
    }
    classroomUnsubs.clear();
  };
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return;
  try {
    await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
      read: true,
    });
  } catch (_) {}
}

export async function markAllNotificationsRead(items = []) {
  const unread = items.filter((item) => !item.read && item.notificationId);
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    unread.slice(0, 400).forEach((item) => {
      batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, item.notificationId), { read: true });
    });
    await batch.commit();
  } catch (_) {}
}

export async function deleteUserNotification(notificationId) {
  if (!notificationId) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId));
  } catch (_) {}
}

export async function clearAllUserNotifications(items = []) {
  if (!Array.isArray(items) || items.length === 0) return;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach((item) => {
        if (item.notificationId) {
          batch.delete(doc(db, COLLECTIONS.NOTIFICATIONS, item.notificationId));
        }
      });
      await batch.commit();
    }
  } catch (_) {}
}

export async function clearNotificationLocalCaches() {
  seenCache = {};
  scheduledCache = {};
  try {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    await AsyncStorage.multiRemove([SEEN_EVENTS_KEY, SCHEDULED_MAP_KEY]).catch(() => {});
  } catch (_) {}
}
