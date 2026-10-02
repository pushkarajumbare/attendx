import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
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
import { getTodayKey, isCompletedSession, isWithinTimeWindow, toValidDate, withTimeout } from '../utils/helpers';

function readDoc(reference) {
  return withTimeout(getDoc(reference), 15000, 'Attendance request timed out. Please retry.');
}

function readDocs(queryReference) {
  return withTimeout(getDocs(queryReference), 15000, 'Attendance request timed out. Please retry.');
}

export async function createAttendanceSession(teacherId, classroomId, sessionData) {
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists() || classroomDoc.data()?.teacherId !== teacherId) {
    throw new Error('Teacher does not own this classroom');
  }

  const location = await getCurrentLocation();
  const sessionRef = doc(collection(db, COLLECTIONS.ATTENDANCE_SESSIONS));
  const startTime = toValidDate(sessionData.startTime);
  const endTime = toValidDate(sessionData.endTime);
  if (!startTime || !endTime || endTime <= startTime) {
    throw new Error('Session end time must be after its start time');
  }

  const session = {
    sessionId: sessionRef.id,
    teacherId,
    classroomId,
    subject: sessionData.subject,
    startTime,
    endTime,
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
  const snapshot = await readDocs(q);
  const now = Date.now();
  for (const sessionDoc of snapshot.docs) {
    const session = sessionDoc.data();
    const start = toValidDate(session.startTime);
    const end = toValidDate(session.endTime);
    if (!start || !end) continue;
    if (end.getTime() <= now) {
      try {
        await updateDoc(sessionDoc.ref, {
          status: 'ended',
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (_) {}
      continue;
    }
    if (start.getTime() <= now) return session;
  }
  return null;
}

// Get ALL sessions for a classroom (with optional filter by status)
export async function getClassroomSessions(classroomId, status = null) {
  let q;
  if (status) {
    q = query(
      collection(db, COLLECTIONS.ATTENDANCE_SESSIONS),
      where('classroomId', '==', classroomId),
      where('status', '==', status)
    );
  } else {
    q = query(
      collection(db, COLLECTIONS.ATTENDANCE_SESSIONS),
      where('classroomId', '==', classroomId)
    );
  }
  const snapshot = await readDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function closeAttendanceSession(sessionId) {
  const sessionRef = doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId);
  const sessionDoc = await readDoc(sessionRef);
  if (!sessionDoc.exists()) throw new Error('Attendance session not found');
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, sessionDoc.data().classroomId));
  if (!classroomDoc.exists() || classroomDoc.data()?.teacherId !== sessionDoc.data().teacherId) {
    throw new Error('Teacher does not own this classroom');
  }
  await updateDoc(sessionRef, {
    status: 'ended',
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Reopen a closed session
export async function reopenAttendanceSession(sessionId) {
  const sessionRef = doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId);
  const sessionDoc = await readDoc(sessionRef);
  if (!sessionDoc.exists()) throw new Error('Attendance session not found');
  const session = sessionDoc.data();
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, session.classroomId));
  const end = toValidDate(session.endTime);
  if (!classroomDoc.exists() || classroomDoc.data()?.teacherId !== session.teacherId) {
    throw new Error('Teacher does not own this classroom');
  }
  if (!end || end.getTime() <= Date.now()) throw new Error('Expired sessions cannot be reopened');
  await updateDoc(sessionRef, {
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

  const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, `${sessionId}_${studentId}`);
  const existing = await readDoc(attendanceRef);
  if (existing.exists()) {
    return { success: false, reason: REJECTION_REASONS.ALREADY_MARKED };
  }

  const sessionDoc = await readDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId));
  if (!sessionDoc.exists()) {
    return { success: false, reason: REJECTION_REASONS.NO_ACTIVE_SESSION };
  }

  const session = sessionDoc.data();
  if (!session || !session.status || !['active', 'reopened'].includes(session.status)) {
    return { success: false, reason: REJECTION_REASONS.SESSION_INACTIVE };
  }
  if (session.classroomId !== classroomId || session.teacherId !== teacherId) {
    return { success: false, reason: REJECTION_REASONS.NO_ACTIVE_SESSION };
  }

  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists()) {
    return { success: false, reason: 'Classroom not found' };
  }
  const classroom = classroomDoc.data();
  if (classroom.teacherId !== teacherId) {
    return { success: false, reason: 'Session teacher does not own this classroom' };
  }
  if (!Array.isArray(classroom?.studentIds) || !classroom.studentIds.includes(studentId)) {
    return { success: false, reason: 'Student is not enrolled in this classroom' };
  }

  const now = new Date();
  const start = toValidDate(session.startTime);
  const end = toValidDate(session.endTime);

  if (!start || !end) {
    return { success: false, reason: REJECTION_REASONS.NO_ACTIVE_SESSION };
  }

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
  const snapshot = await readDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getStudentAttendance(studentId, classroomId) {
  const q = query(
    collection(db, COLLECTIONS.ATTENDANCE),
    where('studentId', '==', studentId),
    where('classroomId', '==', classroomId)
  );
  const snapshot = await readDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getAttendanceStats(studentId, classroomId) {
  const [sessions, records] = await Promise.all([
    getClassroomSessions(classroomId),
    getStudentAttendance(studentId, classroomId),
  ]);
  const completedSessions = sessions.filter((session) => isCompletedSession(session));
  const attendedSessionIds = new Set(
    records.filter((record) => record.status === ATTENDANCE_STATUS.PRESENT).map((record) => record.sessionId)
  );
  const present = completedSessions.filter((session) => attendedSessionIds.has(session.sessionId)).length;
  return { present, absent: completedSessions.length - present, total: completedSessions.length };
}

export async function getClassroomAttendanceSummary(studentId, classroomId) {
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists()) return null;
  const [stats, teacherDoc] = await Promise.all([
    getAttendanceStats(studentId, classroomId),
    readDoc(doc(db, COLLECTIONS.USERS, classroomDoc.data().teacherId)),
  ]);
  return { ...stats, teacherName: teacherDoc.data()?.name || teacherDoc.data()?.displayName || 'Teacher' };
}

async function getCompletedClassroomAttendanceData(classroomId, teacherId) {
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists() || classroomDoc.data()?.teacherId !== teacherId) {
    throw new Error('Teacher does not own this classroom');
  }
  const classroom = classroomDoc.data();
  const enrolledIds = [...new Set(classroom?.studentIds || [])];
  const [profiles, sessions, attendance] = await Promise.all([
    Promise.all(enrolledIds.map((studentId) => readDoc(doc(db, COLLECTIONS.USERS, studentId)))),
    getClassroomSessions(classroomId),
    readDocs(query(
      collection(db, COLLECTIONS.ATTENDANCE),
      where('classroomId', '==', classroomId)
    )),
  ]);
  const students = enrolledIds.map((studentId, index) => {
    const profile = profiles[index]?.data() || {};
    return { studentId, name: profile.name || profile.displayName || 'Student', rollNumber: profile.rollNumber || '' };
  });
  const records = attendance.docs.map((item) => item.data());
  const completedSessions = sessions.filter((session) => isCompletedSession(session));
  return { classroom, students, sessions: completedSessions, records };
}

export async function getClassroomAttendanceReport(classroomId, teacherId) {
  const { students, sessions, records } = await getCompletedClassroomAttendanceData(classroomId, teacherId);
  const presentKeys = new Set(records
    .filter((record) => record.status === ATTENDANCE_STATUS.PRESENT)
    .map((record) => `${record.studentId}|${record.sessionId}`));
  return students.map((student) => {
    const present = sessions.reduce((count, session) => (
      count + (presentKeys.has(`${student.studentId}|${session.sessionId}`) ? 1 : 0)
    ), 0);
    return { ...student, present, absent: sessions.length - present, total: sessions.length };
  });
}

export async function getClassroomAttendanceExportData(classroomId, teacherId) {
  return getCompletedClassroomAttendanceData(classroomId, teacherId);
}

export async function getStudentLectureHistory(studentId, classroomId) {
  const [sessions, records] = await Promise.all([
    getClassroomSessions(classroomId),
    getStudentAttendance(studentId, classroomId),
  ]);
  const recordBySession = new Map(records.map((record) => [record.sessionId, record]));
  return sessions
    .filter((session) => isCompletedSession(session))
    .map((session) => ({ ...session, attendance: recordBySession.get(session.sessionId) || null }))
    .sort((left, right) => {
      return toValidDate(right.startTime).getTime() - toValidDate(left.startTime).getTime();
    });
}
