import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  COLLECTIONS,
  ATTENDANCE_STATUS,
  REJECTION_REASONS,
  ATTENDANCE,
} from '../constants';
import { getCurrentLocation, validateLocationProximity } from './locationService';
import { verifyFace } from './faceService';
import { getTodayKey, isWithinTimeWindow } from '../utils/helpers';

export async function createAttendanceSession(teacherId, classroomId, sessionData) {
  const location = await getCurrentLocation();
  const sessionRef = doc(collection(db, COLLECTIONS.ATTENDANCE_SESSIONS));

  const session = {
    sessionId: sessionRef.id,
    teacherId,
    classroomId,
    subject: sessionData.subject,
    startTime: sessionData.startTime,
    endTime: sessionData.endTime,
    radiusMeters: sessionData.radiusMeters || ATTENDANCE.DEFAULT_RADIUS_METERS,
    teacherLocation: location,
    status: 'active', // active, paused, ended, reopened
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(sessionRef, session);
  return session;
}

// Get single active session for a classroom (if any) — includes 'reopened' status
export async function getActiveSession(classroomId) {
  const q = query(
    collection(db, COLLECTIONS.ATTENDANCE_SESSIONS),
    where('classroomId', '==', classroomId),
    where('status', 'in', ['active', 'reopened'])
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

// Get ALL sessions for a classroom (with optional filter by status)
export async function getClassroomSessions(classroomId, status = null) {
  let q;
  if (status) {
    q = query(
      collection(db, COLLECTIONS.ATTENDANCE_SESSIONS),
      where('classroomId', '==', classroomId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, COLLECTIONS.ATTENDANCE_SESSIONS),
      where('classroomId', '==', classroomId),
      orderBy('createdAt', 'desc')
    );
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function closeAttendanceSession(sessionId) {
  await updateDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId), {
    status: 'ended',
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Reopen a closed session
export async function reopenAttendanceSession(sessionId) {
  await updateDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId), {
    status: 'reopened',
    reopenedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark student attendance.
 *
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.teacherId
 * @param {string} params.classroomId
 * @param {string} params.sessionId
 * @param {object} params.capturedFace - FaceCamera payload: { embedding: number[], livenessPassed: boolean }
 */
export async function markAttendance({
  studentId,
  teacherId,
  classroomId,
  sessionId,
  capturedFace, // { embedding: number[], livenessPassed: boolean } from FaceCamera onCapture
}) {
  const today = getTodayKey();

  const existingQuery = query(
    collection(db, COLLECTIONS.ATTENDANCE),
    where('studentId', '==', studentId),
    where('classroomId', '==', classroomId),
    where('sessionId', '==', sessionId)
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    return { success: false, reason: REJECTION_REASONS.ALREADY_MARKED };
  }

  const sessionDoc = await getDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId));
  if (!sessionDoc.exists()) {
    return { success: false, reason: REJECTION_REASONS.NO_ACTIVE_SESSION };
  }

  const session = sessionDoc.data();
  if (!session || !session.status || !['active', 'reopened'].includes(session.status)) {
    return { success: false, reason: REJECTION_REASONS.SESSION_INACTIVE };
  }

  const classroomDoc = await getDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists()) {
    return { success: false, reason: 'Classroom not found' };
  }
  const classroom = classroomDoc.data();
  if (!Array.isArray(classroom?.studentIds) || !classroom.studentIds.includes(studentId)) {
    return { success: false, reason: 'Student is not enrolled in this classroom' };
  }

  const now = new Date();
  const start = session.startTime?.toDate?.() || new Date(session.startTime);
  const end = session.endTime?.toDate?.() || new Date(session.endTime);

  if (now < start) {
    return { success: false, reason: REJECTION_REASONS.TIME_NOT_STARTED };
  }
  if (!isWithinTimeWindow(start, end, now)) {
    return { success: false, reason: REJECTION_REASONS.TIME_EXPIRED };
  }

  // Run local face identity verification and liveness challenge validation.
  const faceResult = await verifyFace(studentId, capturedFace);
  if (!faceResult.verified) {
    return { success: false, reason: REJECTION_REASONS.FACE_MISMATCH, faceResult };
  }

  let studentLocation;
  try {
    studentLocation = await getCurrentLocation();
  } catch (error) {
    return {
      success: false,
      reason: error?.message?.includes?.('Suspicious')
        ? REJECTION_REASONS.FAKE_GPS
        : 'Location unavailable',
    };
  }

  const proximity = validateLocationProximity(
    studentLocation,
    session.teacherLocation,
    session.radiusMeters
  );

  if (!proximity.valid) {
    return {
      success: false,
      reason: REJECTION_REASONS.OUT_OF_RANGE,
      distance: proximity.distance,
    };
  }

  const attendanceRef = doc(collection(db, COLLECTIONS.ATTENDANCE));
  const record = {
    attendanceId: attendanceRef.id,
    studentId,
    teacherId,
    classroomId,
    sessionId,
    date: today,
    time: serverTimestamp(),
    gpsLocation: studentLocation,
    distanceMeters: proximity.distance,
    faceVerified: true,
    faceConfidence: faceResult.confidence,
    status: ATTENDANCE_STATUS.PRESENT,
  };

  await setDoc(attendanceRef, record);

  return {
    success: true,
    message: 'Attendance Successfully Marked',
    record,
  };
}

export async function getAttendanceByClassroom(classroomId, date) {
  const q = query(
    collection(db, COLLECTIONS.ATTENDANCE),
    where('classroomId', '==', classroomId),
    where('date', '==', date || getTodayKey())
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getStudentAttendance(studentId, classroomId) {
  const q = query(
    collection(db, COLLECTIONS.ATTENDANCE),
    where('studentId', '==', studentId),
    where('classroomId', '==', classroomId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getAttendanceStats(studentId, classroomId) {
  const records = await getStudentAttendance(studentId, classroomId);
  const present = records.filter((r) => r.status === ATTENDANCE_STATUS.PRESENT).length;
  return { present, total: records.length };
}
