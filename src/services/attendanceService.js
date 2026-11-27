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
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  COLLECTIONS,
  ATTENDANCE_STATUS,
  REJECTION_REASONS,
  ATTENDANCE,
} from '../constants';
import { getClassroomStudents, sortStudentsByRollAndName } from './classroomService';
import { getCurrentLocation, validateLocationProximity } from './locationService';
import { verifyFace } from './faceService';
import {
  cancelScheduledNotificationByKey,
  notifyAttendanceEnded,
  notifyAttendanceStarted,
} from './notificationService';
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

  notifyAttendanceStarted(session, classroomDoc.data()).catch(() => {});

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

// Get ALL sessions for a classroom (with optional filter by status), sorted newest first
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
  return snapshot.docs
    .map((d) => ({ ...d.data(), sessionId: d.data().sessionId || d.id }))
    .sort(
      (a, b) =>
        (toValidDate(b.startTime)?.getTime() || 0) -
        (toValidDate(a.startTime)?.getTime() || 0)
    );
}

export async function closeAttendanceSession(sessionId) {
  const sessionRef = doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId);
  const sessionDoc = await readDoc(sessionRef);
  if (!sessionDoc.exists()) throw new Error('Attendance session not found');
  const session = sessionDoc.data();
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, session.classroomId));
  if (!classroomDoc.exists() || classroomDoc.data()?.teacherId !== session.teacherId) {
    throw new Error('Teacher does not own this classroom');
  }
  await updateDoc(sessionRef, {
    status: 'ended',
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  notifyAttendanceEnded(session, classroomDoc.data(), auth.currentUser?.uid || session.teacherId).catch(
    () => {}
  );
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

  notifyAttendanceStarted({ ...session, status: 'reopened' }, classroomDoc.data()).catch(() => {});
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
  const authenticatedStudentId = auth.currentUser?.uid;
  if (!authenticatedStudentId || authenticatedStudentId !== studentId) {
    return {
      success: false,
      reason: 'Authenticated student identity mismatch',
    };
  }

  const today = getTodayKey();
  const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, `${sessionId}_${authenticatedStudentId}`);
  const sessionRef = doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId);
  const classroomRef = doc(db, COLLECTIONS.CLASSROOMS, classroomId);

  const [existing, sessionDoc, classroomDoc] = await Promise.all([
    readDoc(attendanceRef),
    readDoc(sessionRef),
    readDoc(classroomRef),
  ]);

  if (existing.exists()) {
    return { success: false, reason: REJECTION_REASONS.ALREADY_MARKED };
  }

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

  if (!classroomDoc.exists()) {
    return { success: false, reason: 'Classroom not found' };
  }
  const classroom = classroomDoc.data();
  if (classroom.teacherId !== teacherId) {
    return { success: false, reason: 'Session teacher does not own this classroom' };
  }
  if (!Array.isArray(classroom?.studentIds) || !classroom.studentIds.includes(authenticatedStudentId)) {
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

  // Run local face identity verification and liveness challenge validation BEFORE GPS/DB write.
  const faceResult = await verifyFace(authenticatedStudentId, capturedFace);
  if (!faceResult.verified) {
    return {
      success: false,
      reason: faceResult.reason || REJECTION_REASONS.FACE_MISMATCH,
      faceResult,
    };
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
    studentId: authenticatedStudentId,
    teacherId,
    classroomId,
    sessionId,
    date: today,
    time: serverTimestamp(),
    gpsLocation: studentLocation,
    distanceMeters: proximity.distance,
    faceVerified: true,
    faceConfidence: faceResult.confidence,
    faceSimilarity: faceResult.similarity ?? null,
    status: ATTENDANCE_STATUS.PRESENT,
  };

  // Atomic Firestore transaction prevents concurrent/duplicate writes for the same session
  const txOutcome = await withTimeout(
    runTransaction(db, async (transaction) => {
      const [txAttendance, txSession, txClassroom] = await Promise.all([
        transaction.get(attendanceRef),
        transaction.get(sessionRef),
        transaction.get(classroomRef),
      ]);

      if (txAttendance.exists()) {
        return { ok: false, reason: REJECTION_REASONS.ALREADY_MARKED };
      }

      if (!txSession.exists()) {
        return { ok: false, reason: REJECTION_REASONS.NO_ACTIVE_SESSION };
      }
      const liveSession = txSession.data();
      if (!liveSession?.status || !['active', 'reopened'].includes(liveSession.status)) {
        return { ok: false, reason: REJECTION_REASONS.SESSION_INACTIVE };
      }

      const txNow = new Date();
      const txStart = toValidDate(liveSession.startTime);
      const txEnd = toValidDate(liveSession.endTime);
      if (!txStart || !txEnd || txNow < txStart || !isWithinTimeWindow(txStart, txEnd, txNow)) {
        return { ok: false, reason: REJECTION_REASONS.TIME_EXPIRED };
      }

      const liveClassroom = txClassroom.exists() ? txClassroom.data() : null;
      if (
        !liveClassroom ||
        liveClassroom.teacherId !== teacherId ||
        !Array.isArray(liveClassroom.studentIds) ||
        !liveClassroom.studentIds.includes(authenticatedStudentId)
      ) {
        return { ok: false, reason: 'Student is not enrolled in this classroom' };
      }

      transaction.set(attendanceRef, record);
      return { ok: true };
    }),
    15000,
    'Attendance submission timed out. Please retry.'
  );

  if (!txOutcome.ok) {
    return { success: false, reason: txOutcome.reason };
  }

  cancelScheduledNotificationByKey(`student_ending_${sessionId}`).catch(() => {});
  cancelScheduledNotificationByKey(`student_ended_${sessionId}`).catch(() => {});

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
  const classroomData = classroomDoc.data();
  const rollMap = classroomData?.studentRollNumbers || {};
  const [stats, teacherDoc] = await Promise.all([
    getAttendanceStats(studentId, classroomId),
    readDoc(doc(db, COLLECTIONS.USERS, classroomData.teacherId)),
  ]);
  return {
    ...stats,
    teacherName: teacherDoc.data()?.name || teacherDoc.data()?.displayName || 'Teacher',
    rollNumber: String(rollMap[studentId] ?? '').trim(),
  };
}

async function getCompletedClassroomAttendanceData(classroomId, teacherId) {
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists() || classroomDoc.data()?.teacherId !== teacherId) {
    throw new Error('Teacher does not own this classroom');
  }
  const classroom = classroomDoc.data();
  const rollMap = classroom?.studentRollNumbers || {};
  const enrolledIds = [...new Set(classroom?.studentIds || [])];
  const [profiles, sessions, attendance] = await Promise.all([
    Promise.all(enrolledIds.map((studentId) => readDoc(doc(db, COLLECTIONS.USERS, studentId)))),
    getClassroomSessions(classroomId),
    readDocs(query(
      collection(db, COLLECTIONS.ATTENDANCE),
      where('classroomId', '==', classroomId)
    )),
  ]);
  const students = sortStudentsByRollAndName(
    enrolledIds.map((studentId, index) => {
      const profile = profiles[index]?.data() || {};
      const hasClassroomRoll = Object.prototype.hasOwnProperty.call(rollMap, studentId);
      const rollNumber = hasClassroomRoll
        ? String(rollMap[studentId] ?? '').trim()
        : String(profile.rollNumber ?? '').trim();
      return {
        studentId,
        name: profile.name || profile.displayName || 'Student',
        email: profile.email || '',
        rollNumber,
      };
    })
  );
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

/**
 * Load full attendance sheet (all enrolled students + current present/absent status)
 * for any specific session (live or completed).
 */
export async function getSessionAttendanceSheet(sessionId, teacherId) {
  if (!sessionId || !teacherId) throw new Error('Session ID and Teacher ID are required.');

  const sessionSnap = await readDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId));
  if (!sessionSnap.exists()) throw new Error('Attendance session not found.');
  const session = sessionSnap.data();

  const classroomSnap = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, session.classroomId));
  if (!classroomSnap.exists() || classroomSnap.data()?.teacherId !== teacherId) {
    throw new Error('Unauthorized: Teacher does not own this classroom.');
  }

  const [students, recordsSnap] = await Promise.all([
    getClassroomStudents(session.classroomId),
    readDocs(query(collection(db, COLLECTIONS.ATTENDANCE), where('classroomId', '==', session.classroomId))),
  ]);

  const recordByStudent = new Map(
    recordsSnap.docs
      .filter((d) => d.data()?.sessionId === sessionId)
      .map((d) => {
        const data = d.data();
        return [data.studentId, data];
      })
  );

  const rows = students.map((student) => {
    const rec = recordByStudent.get(student.studentId) || null;
    const isPresent = rec?.status === ATTENDANCE_STATUS.PRESENT;
    return {
      studentId: student.studentId,
      name: student.name || 'Student',
      email: student.email || '',
      rollNumber: student.rollNumber || '',
      present: isPresent,
      status: isPresent ? ATTENDANCE_STATUS.PRESENT : ATTENDANCE_STATUS.ABSENT,
      markedBy: rec?.markedBy || (rec?.faceVerified ? 'biometric' : null),
      manualOverride: Boolean(rec?.manualOverride),
      faceVerified: Boolean(rec?.faceVerified),
      faceConfidence: rec?.faceConfidence ?? null,
      distanceMeters: rec?.distanceMeters ?? null,
      time: rec?.time || null,
      overrideNote: rec?.overrideNote || '',
    };
  });

  return { session, classroom: classroomSnap.data(), rows };
}

/**
 * Teacher marks or edits an individual student's attendance for a session (present/absent).
 */
export async function setStudentSessionAttendance({
  teacherId,
  classroomId,
  sessionId,
  studentId,
  status,
  note = '',
}) {
  if (!teacherId || !classroomId || !sessionId || !studentId) {
    throw new Error('Missing teacher, classroom, session, or student ID.');
  }
  const normalizedStatus =
    status === ATTENDANCE_STATUS.PRESENT ? ATTENDANCE_STATUS.PRESENT : ATTENDANCE_STATUS.ABSENT;

  const [classroomSnap, sessionSnap] = await Promise.all([
    readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId)),
    readDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId)),
  ]);

  if (!classroomSnap.exists() || classroomSnap.data()?.teacherId !== teacherId) {
    throw new Error('Unauthorized: only the classroom teacher can modify attendance.');
  }
  if (!Array.isArray(classroomSnap.data()?.studentIds) || !classroomSnap.data().studentIds.includes(studentId)) {
    throw new Error('Student is not enrolled in this classroom.');
  }
  if (!sessionSnap.exists() || sessionSnap.data()?.classroomId !== classroomId) {
    throw new Error('Attendance session does not belong to this classroom.');
  }

  const sessionData = sessionSnap.data();
  const sessionStart = toValidDate(sessionData.startTime);
  const dateKey = sessionStart ? sessionStart.toISOString().split('T')[0] : getTodayKey();
  const attendanceRef = doc(db, COLLECTIONS.ATTENDANCE, `${sessionId}_${studentId}`);
  const existingSnap = await readDoc(attendanceRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : {};

  const payload = {
    attendanceId: `${sessionId}_${studentId}`,
    studentId,
    teacherId,
    classroomId,
    sessionId,
    date: existingData.date || dateKey,
    time: existingData.time || serverTimestamp(),
    status: normalizedStatus,
    faceVerified: normalizedStatus === ATTENDANCE_STATUS.PRESENT ? Boolean(existingData.faceVerified) : false,
    faceConfidence: normalizedStatus === ATTENDANCE_STATUS.PRESENT ? existingData.faceConfidence ?? null : null,
    distanceMeters: normalizedStatus === ATTENDANCE_STATUS.PRESENT ? existingData.distanceMeters ?? null : null,
    markedBy: 'teacher',
    manualOverride: true,
    overrideNote: String(note || '').trim(),
    editedAt: serverTimestamp(),
  };

  await setDoc(attendanceRef, payload, { merge: true });
  return payload;
}

/**
 * Teacher batch-marks all selected/enrolled students for a session as Present or Absent.
 */
export async function bulkMarkSessionAttendance({
  teacherId,
  classroomId,
  sessionId,
  studentIds = [],
  status = ATTENDANCE_STATUS.PRESENT,
}) {
  if (!teacherId || !classroomId || !sessionId || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new Error('Select at least one enrolled student.');
  }

  const [classroomSnap, sessionSnap] = await Promise.all([
    readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId)),
    readDoc(doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId)),
  ]);

  if (!classroomSnap.exists() || classroomSnap.data()?.teacherId !== teacherId) {
    throw new Error('Unauthorized: only the classroom teacher can update attendance.');
  }
  if (!sessionSnap.exists() || sessionSnap.data()?.classroomId !== classroomId) {
    throw new Error('Session does not belong to this classroom.');
  }

  const enrolledSet = new Set(classroomSnap.data()?.studentIds || []);
  const targets = [...new Set(studentIds)].filter((id) => enrolledSet.has(id));
  if (targets.length === 0) return 0;

  const normalizedStatus =
    status === ATTENDANCE_STATUS.PRESENT ? ATTENDANCE_STATUS.PRESENT : ATTENDANCE_STATUS.ABSENT;
  const sessionStart = toValidDate(sessionSnap.data().startTime);
  const dateKey = sessionStart ? sessionStart.toISOString().split('T')[0] : getTodayKey();

  for (let i = 0; i < targets.length; i += 400) {
    const chunk = targets.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const sid of chunk) {
      const refDoc = doc(db, COLLECTIONS.ATTENDANCE, `${sessionId}_${sid}`);
      batch.set(
        refDoc,
        {
          attendanceId: `${sessionId}_${sid}`,
          studentId: sid,
          teacherId,
          classroomId,
          sessionId,
          date: dateKey,
          time: serverTimestamp(),
          status: normalizedStatus,
          markedBy: 'teacher',
          manualOverride: true,
          editedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  return targets.length;
}

/**
 * Teacher deletes an erroneous attendance session and its associated attendance records.
 */
export async function deleteAttendanceSession(sessionId, teacherId) {
  if (!sessionId || !teacherId) throw new Error('Session ID and Teacher ID are required.');
  const sessionRef = doc(db, COLLECTIONS.ATTENDANCE_SESSIONS, sessionId);
  const sessionSnap = await readDoc(sessionRef);
  if (!sessionSnap.exists()) throw new Error('Session not found.');
  const session = sessionSnap.data();

  const classroomSnap = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, session.classroomId));
  if (!classroomSnap.exists() || classroomSnap.data()?.teacherId !== teacherId) {
    throw new Error('Unauthorized: Teacher does not own this classroom.');
  }

  await cancelScheduledNotificationByKey(`teacher_ending_${sessionId}`).catch(() => {});
  await cancelScheduledNotificationByKey(`teacher_ended_${sessionId}`).catch(() => {});

  const recordsSnap = await readDocs(
    query(collection(db, COLLECTIONS.ATTENDANCE), where('classroomId', '==', session.classroomId))
  );
  const matchingDocs = recordsSnap.docs.filter((d) => d.data()?.sessionId === sessionId);
  for (let i = 0; i < matchingDocs.length; i += 400) {
    const batch = writeBatch(db);
    matchingDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(sessionRef);
}
